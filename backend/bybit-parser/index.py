import json
import requests
import random
import time
import logging
from typing import List, Dict, Any
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed

# Импорт модулей прокси-менеджера
from proxy_manager import ProxyManager
from config import (
    PROXIES, 
    REQUEST_TIMEOUT, 
    MAX_RETRIES, 
    REQUEST_DELAY_RANGE,
    PROXY_USE_PROBABILITY,
    ENABLE_PROXY_LOGGING,
    PARALLEL_REQUESTS
)
from db_manager import DatabaseManager

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

cache = {}
CACHE_TTL = 8

# In-memory кеш для данных из БД (снижает rate limit)
db_cache = {
    'sell': {'data': None, 'timestamp': None},
    'buy': {'data': None, 'timestamp': None},
    'auto_update_enabled': {'value': True, 'timestamp': None}
}
DB_CACHE_TTL_SECONDS = 19  # Кеш БД на 19 секунд - все пользователи получают одни данные

# Инициализация глобального прокси-менеджера
proxy_manager = ProxyManager(
    proxies_list=PROXIES,
    use_probability=PROXY_USE_PROBABILITY,
    max_retries=MAX_RETRIES,
    timeout=REQUEST_TIMEOUT,
    enable_logging=ENABLE_PROXY_LOGGING
)

# Инициализация менеджера базы данных
db_manager = DatabaseManager()

UPDATE_INTERVAL_SECONDS = 19  # 19 секунд = 4547 вызовов/сутки (оптимально для лимита 30k)

# Маппинг ID методов оплаты Bybit на названия
PAYMENT_METHOD_MAP = {
    '14': 'Bank Transfer',
    '40': 'Mobile Top-up',
    '90': 'Cash Deposit',
    '75': 'Наличные',
    '64': 'Wallet',
    '1': 'Card',
    '29': 'QIWI',
    '377': 'YooMoney',
    '378': 'Tinkoff',
    '379': 'Sberbank',
    '62': 'Raiffeisen Bank',
    '413': 'Rosbank'
}

def fetch_page(page: int, side: str, url: str, user_agents: list, accept_languages: list, referers: list) -> tuple:
    """
    Загружает одну страницу объявлений параллельно
    Возвращает: (page_number, items_list, success)
    """
    payload = {
        'userId': '',
        'tokenId': 'USDT',
        'currencyId': 'RUB',
        'payment': [],
        'side': side,
        'size': '100',
        'page': str(page),
        'amount': '',
        'authMaker': False,
        'canTrade': False
    }

    headers = {
        'Content-Type': 'application/json',
        'User-Agent': random.choice(user_agents),
        'Accept': 'application/json',
        'Accept-Language': random.choice(accept_languages),
        'Accept-Encoding': 'gzip, deflate, br',
        'Origin': 'https://www.bybit.com',
        'Referer': random.choice(referers),
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site'
    }
    
    try:
        response = proxy_manager.make_request(
            method='POST',
            url=url,
            json=payload,
            headers=headers
        )
        
        if response is None or response.status_code != 200:
            return (page, [], False)
        
        response_data = response.json()
        
        if not isinstance(response_data, dict) or response_data.get('ret_code') != 0:
            return (page, [], False)
        
        result = response_data.get('result', {})
        if not isinstance(result, dict):
            return (page, [], False)
        
        items = result.get('items', [])
        if not isinstance(items, list):
            return (page, [], False)
        
        return (page, items, True)
        
    except Exception as e:
        logging.error(f'Error fetching page {page}: {e}')
        return (page, [], False)

def handler(event: dict, context) -> dict:
    '''
    Парсинг P2P объявлений Bybit для пары USDT/RUB.
    Возвращает все доступные объявления с полной информацией о трейдерах.
    '''
    
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    params = event.get('queryStringParameters') or {}
    
    # POST запросы для управления настройками
    if method == 'POST':
        try:
            body = json.loads(event.get('body', '{}'))
            action = body.get('action')
            
            if action == 'toggle_auto_update':
                enabled = body.get('enabled', True)
                success = db_manager.set_auto_update_enabled(enabled)
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({
                        'success': success,
                        'auto_update_enabled': enabled
                    }),
                    'isBase64Encoded': False
                }
            
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'Unknown action'}),
                'isBase64Encoded': False
            }
        except Exception as e:
            return {
                'statusCode': 500,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': str(e)}),
                'isBase64Encoded': False
            }
    
    # GET запросы для получения данных
    side = str(params.get('side', '1')) if params.get('side') else '1'
    debug = params.get('debug') == 'true'
    search_user = params.get('search', '').strip()
    check_status = params.get('status') == 'true'
    force_update = params.get('force') == 'true'
    limit = params.get('limit')  # 'quick' = только 200, 'full' = все
    
    try:
        # Проверяем глобальный статус автообновления (с кешированием)
        now_ts = datetime.now()
        if (db_cache['auto_update_enabled']['timestamp'] is None or 
            (now_ts - db_cache['auto_update_enabled']['timestamp']).total_seconds() > DB_CACHE_TTL_SECONDS):
            try:
                auto_update_enabled = db_manager.is_auto_update_enabled()
                db_cache['auto_update_enabled']['value'] = auto_update_enabled
                db_cache['auto_update_enabled']['timestamp'] = now_ts
            except Exception as e:
                logging.error(f'Error checking auto_update: {e}, using cached value')
                auto_update_enabled = db_cache['auto_update_enabled']['value']
        else:
            auto_update_enabled = db_cache['auto_update_enabled']['value']
        
        # Если запрос только на проверку статуса
        if check_status:
            try:
                last_update_sell = db_manager.get_last_update('1')
                last_update_buy = db_manager.get_last_update('0')
            except Exception as e:
                logging.error(f'Error getting last updates: {e}')
                last_update_sell = None
                last_update_buy = None
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'auto_update_enabled': auto_update_enabled,
                    'last_update_sell': last_update_sell.isoformat() if last_update_sell else None,
                    'last_update_buy': last_update_buy.isoformat() if last_update_buy else None,
                    'update_interval_seconds': UPDATE_INTERVAL_SECONDS
                }),
                'isBase64Encoded': False
            }
        
        # Проверяем кеш данных для этой стороны
        cache_key = 'sell' if side == '1' else 'buy'
        cached = db_cache[cache_key]
        
        # ВСЕГДА используем memory cache если он есть (даже если устарел)
        # Это снижает нагрузку на PostgreSQL
        if cached['data'] is not None and cached['timestamp'] is not None:
            cache_age = (now_ts - cached['timestamp']).total_seconds()
            
            # Если кеш свежий - возвращаем немедленно
            if cache_age < DB_CACHE_TTL_SECONDS:
                logging.info(f'[MEMORY-HIT] Fresh cache for side {side}, age: {cache_age:.1f}s')
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'X-Cache': 'MEMORY-HIT',
                        'X-Cache-Age': str(int(cache_age))
                    },
                    'body': json.dumps({
                        'offers': cached['data']['offers'],
                        'total': cached['data']['total'],
                        'side': cached['data']['side'],
                        'from_cache': True,
                        'cache_age': int(cache_age),
                        'auto_update_enabled': auto_update_enabled,
                        'proxy_stats': {}
                    }),
                    'isBase64Encoded': False
                }
            else:
                # Кеш устарел, но используем его если БД недоступна
                logging.info(f'[STALE-CACHE] Cache expired ({cache_age:.1f}s), trying DB...')
        else:
            logging.info(f'[NO-CACHE] No memory cache, need to fetch from DB')
        
        # Проверяем, нужно ли обновлять данные (проверяем возраст БД в секундах)
        try:
            should_fetch = force_update or (auto_update_enabled and db_manager.should_update_seconds(side, UPDATE_INTERVAL_SECONDS))
        except Exception as e:
            logging.error(f'Error checking should_update: {e}')
            should_fetch = force_update  # Если force=true, всё равно обновляем
        
        if not should_fetch:
            # Возвращаем данные из базы
            try:
                offers = db_manager.get_offers(side)
                last_update = db_manager.get_last_update(side)
                
                # Сохраняем в память
                db_cache[cache_key]['data'] = {
                    'offers': offers,
                    'total': len(offers),
                    'side': 'sell' if side == '1' else 'buy'
                }
                db_cache[cache_key]['timestamp'] = now_ts
                
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'X-Cache': 'DB-HIT',
                        'X-Last-Update': last_update.isoformat() if last_update else ''
                    },
                    'body': json.dumps({
                        'offers': offers,
                        'total': len(offers),
                        'side': 'sell' if side == '1' else 'buy',
                        'from_cache': True,
                        'last_update': last_update.isoformat() if last_update else None,
                        'auto_update_enabled': auto_update_enabled,
                        'proxy_stats': {}
                    }),
                    'isBase64Encoded': False
                }
            except Exception as e:
                logging.error(f'[DB-ERROR] Failed to read from DB: {e}')
                
                # ВАЖНО: Если есть устаревший кеш - используем его вместо пустого ответа
                if cached['data'] is not None:
                    cache_age = (now_ts - cached['timestamp']).total_seconds()
                    logging.warning(f'[FALLBACK] Using stale cache ({cache_age:.0f}s old) due to DB error')
                    return {
                        'statusCode': 200,
                        'headers': {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                            'X-Cache': 'STALE-FALLBACK',
                            'X-Cache-Age': str(int(cache_age))
                        },
                        'body': json.dumps({
                            'offers': cached['data']['offers'],
                            'total': cached['data']['total'],
                            'side': cached['data']['side'],
                            'from_cache': True,
                            'cache_age': int(cache_age),
                            'warning': 'Using cached data due to DB unavailability',
                            'auto_update_enabled': auto_update_enabled,
                            'proxy_stats': {}
                        }),
                        'isBase64Encoded': False
                    }
                
                # Нет кеша вообще - загружаем с Bybit
                logging.warning(f'[NO-CACHE] No cache available, fetching from Bybit')
                # Продолжаем выполнение - загрузим с Bybit ниже
    except Exception as e:
        logging.error(f'Error reading from database: {e}')
        # При ошибке БД продолжаем обычную загрузку
    
    cache_key = f'offers_{side}'
    now = datetime.now()
    
    try:
        url = 'https://api2.bybit.com/fiat/otc/item/online'
        
        user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ]
        
        accept_languages = [
            'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
            'en-US,en;q=0.9',
            'ru;q=0.9,en;q=0.8'
        ]
        
        referers = [
            'https://www.bybit.com/fiat/trade/otc/?actionType=1&token=USDT&fiat=RUB&paymentMethod=',
            'https://www.bybit.com/fiat/trade/otc/?actionType=0&token=USDT&fiat=RUB&paymentMethod=',
            'https://www.bybit.com/fiat/trade/otc/'
        ]
        
        all_offers = []
        page = 1
        total_items = 0
        start_time = time.time()
        
        # Если limit=quick, загружаем только 2 страницы (200 офферов)
        if limit == 'quick':
            MAX_PAGES = 2  # Только топ-200 для быстрого ответа
            TIMEOUT_SECONDS = 5  # Быстрый таймаут
            logging.info(f'[QUICK MODE] Loading only top 200 offers for side {side}')
        else:
            MAX_PAGES = 8  # Максимум 8 страниц = 800 офферов
            TIMEOUT_SECONDS = 15  # Общий таймаут на загрузку всех страниц
            logging.info(f'[FULL MODE] Loading up to {MAX_PAGES * 100} offers for side {side}')
        
        # Параллельная загрузка страниц батчами
        while True:
            # Проверка таймаута
            elapsed = time.time() - start_time
            if elapsed > TIMEOUT_SECONDS:
                logging.warning(f'Timeout reached after {elapsed:.1f}s, stopping at page {page}')
                break
            
            # Проверка лимита страниц
            if page > MAX_PAGES:
                logging.warning(f'Max pages limit ({MAX_PAGES}) reached')
                break
            batch_pages = list(range(page, page + PARALLEL_REQUESTS))
            batch_results = []
            
            # Загружаем батч страниц параллельно
            with ThreadPoolExecutor(max_workers=PARALLEL_REQUESTS) as executor:
                futures = {
                    executor.submit(fetch_page, p, side, url, user_agents, accept_languages, referers): p 
                    for p in batch_pages
                }
                
                for future in as_completed(futures):
                    try:
                        page_num, items, success = future.result()
                        if success:
                            batch_results.append((page_num, items))
                    except Exception as e:
                        logging.error(f'Error in parallel fetch: {e}')
            
            # Сортируем результаты по номеру страницы
            batch_results.sort(key=lambda x: x[0])
            
            # Проверяем на пустую страницу и обрабатываем результаты
            has_empty_page = False
            for page_num, items in batch_results:
                if not items:
                    has_empty_page = True
                    break
                
                # Обрабатываем каждый item со страницы
                for item in items:
                    if not isinstance(item, dict):
                        continue
                    
                    # Методы оплаты (payments - это массив ID строк, например ["14", "40"])
                    payments = item.get('payments', [])
                    if not isinstance(payments, list):
                        payments = []
                    
                    payment_methods = []
                    for payment_id in payments:
                        if isinstance(payment_id, str):
                            payment_name = PAYMENT_METHOD_MAP.get(payment_id, f'Payment #{payment_id}')
                            payment_methods.append(payment_name)
                    
                    # Лимиты
                    min_amt = float(item.get('minAmount', 0))
                    max_amt = float(item.get('maxAmount', 0))
                    is_triangle = abs(max_amt - min_amt) <= 1.0
                    
                    # Онлайн статус
                    is_online = bool(item.get('isOnline', False))
                    last_logout_time = item.get('lastLogoutTime', '')
                    
                    # Определяем тип мерчанта по Verified Advertiser тегам
                    auth_tags = item.get('authTag', [])
                    if not isinstance(auth_tags, list):
                        auth_tags = []
                    
                    merchant_type = None
                    merchant_badge = None
                    is_merchant = False
                    is_block_trade = 'BA' in auth_tags
                    
                    if 'VA3' in auth_tags:
                        merchant_type = 'gold'
                        merchant_badge = 'vaGoldIcon'
                        is_merchant = True
                    elif 'VA2' in auth_tags:
                        merchant_type = 'silver'
                        merchant_badge = 'vaSilverIcon'
                        is_merchant = True
                    elif 'VA1' in auth_tags or 'VA' in auth_tags:
                        merchant_type = 'bronze'
                        merchant_badge = 'vaBronzeIcon'
                        is_merchant = True
                    
                    # Формируем объект оффера (старый формат для совместимости с frontend)
                    offer = {
                        'id': str(item.get('id', '')),
                        'price': float(item.get('price', 0)),
                        'maker': str(item.get('nickName', 'Unknown')),
                        'maker_id': str(item.get('userId', '')),
                        'quantity': float(item.get('lastQuantity', 0)),
                        'min_amount': min_amt,
                        'max_amount': max_amt,
                        'payment_methods': payment_methods,
                        'side': 'sell' if side == '1' else 'buy',
                        'completion_rate': int(item.get('recentOrderNum', 0)),
                        'total_orders': int(item.get('recentExecuteRate', 0)),
                        'is_merchant': is_merchant,
                        'merchant_type': merchant_type,
                        'merchant_badge': merchant_badge,
                        'is_block_trade': is_block_trade,
                        'is_online': is_online,
                        'is_triangle': is_triangle,
                        'last_logout_time': last_logout_time,
                        'auth_tags': auth_tags
                    }
                    
                    all_offers.append(offer)
                    total_items += 1
            
            # Если встретили пустую страницу, прекращаем загрузку
            if has_empty_page:
                break
            
            # Переходим к следующему батчу
            page += PARALLEL_REQUESTS
        
        # Сохраняем в БД ТОЛЬКО если это не quick mode (преобразуем формат для БД)
        # Quick mode не сохраняет - отдаём данные быстро, full mode дозагрузит и сохранит
        if not search_user and limit != 'quick':
            try:
                offers_for_db = []
                for offer in all_offers:
                    offers_for_db.append({
                        'id': offer['id'],
                        'price': offer['price'],
                        'min_amount': offer['min_amount'],
                        'max_amount': offer['max_amount'],
                        'available_amount': offer['quantity'],
                        'nickname': offer['maker'],
                        'is_merchant': offer['is_merchant'],
                        'merchant_type': offer['merchant_type'],
                        'is_online': offer['is_online'],
                        'is_triangle': offer['is_triangle'],
                        'completion_rate': offer['completion_rate'],
                        'completed_orders': offer['total_orders'],
                        'payment_methods': offer['payment_methods']
                    })
                
                db_manager.save_offers(offers_for_db, side)
                logging.info(f'Successfully saved {len(offers_for_db)} offers to database for side {side}')
            except Exception as e:
                logging.error(f'Failed to save to database: {e}')
        elif limit == 'quick':
            logging.info(f'[QUICK MODE] Skipping DB save, returning data immediately')
        
        # Обновляем кеш
        cache[cache_key] = {
            'data': all_offers,
            'timestamp': now
        }
        
        proxy_stats = proxy_manager.get_stats()
        
        response_data = {
            'offers': all_offers,
            'total': len(all_offers),
            'side': 'sell' if side == '1' else 'buy',
            'from_cache': False,
            'timestamp': now.isoformat(),
            'auto_update_enabled': auto_update_enabled,
            'proxy_stats': proxy_stats if debug else {}
        }
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'X-Cache': 'MISS'
            },
            'body': json.dumps(response_data),
            'isBase64Encoded': False
        }
        
    except Exception as e:
        logging.error(f'Critical error in handler: {e}')
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': f'Internal server error: {str(e)}'}),
            'isBase64Encoded': False
        }