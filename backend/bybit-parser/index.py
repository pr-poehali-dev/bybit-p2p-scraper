import json
import requests
import random
import time
import logging
from typing import List, Dict, Any
from datetime import datetime, timedelta

# Импорт модулей прокси-менеджера
from proxy_manager import ProxyManager
from config import (
    PROXIES, 
    REQUEST_TIMEOUT, 
    MAX_RETRIES, 
    REQUEST_DELAY_RANGE,
    PROXY_USE_PROBABILITY,
    ENABLE_PROXY_LOGGING
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

UPDATE_INTERVAL_MINUTES = 10

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
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    if method != 'GET':
        return {
            'statusCode': 405,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': 'Method not allowed'}),
            'isBase64Encoded': False
        }
    
    params = event.get('queryStringParameters') or {}
    side = str(params.get('side', '1')) if params.get('side') else '1'
    debug = params.get('debug') == 'true'
    search_user = params.get('search', '').strip()
    force_update = params.get('force') == 'true'
    
    try:
        # Проверяем, нужно ли обновлять данные
        should_fetch = force_update or db_manager.should_update(side, UPDATE_INTERVAL_MINUTES)
        
        if not should_fetch:
            # Возвращаем данные из базы
            offers = db_manager.get_offers(side)
            last_update = db_manager.get_last_update(side)
            
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
                    'from_cache': True,
                    'last_update': last_update.isoformat() if last_update else None
                }),
                'isBase64Encoded': False
            }
    except Exception as e:
        logging.error(f'Error reading from database: {e}')
        # При ошибке БД продолжаем обычную загрузку
    
    cache_key = f'offers_{side}'
    now = datetime.now()
    
    try:
        url = 'https://api2.bybit.com/fiat/otc/item/online'
        
        user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0'
        ]
        
        all_offers = []
        page = 1
        max_pages = 10
        
        while page <= max_pages:
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
        
            accept_languages = [
                'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
                'ru-RU,ru;q=0.9,en;q=0.8',
                'en-US,en;q=0.9,ru;q=0.8',
                'ru;q=0.9,en-US;q=0.8,en;q=0.7'
            ]
            
            referers = [
                'https://www.bybit.com/fiat/trade/otc/',
                'https://www.bybit.com/fiat/trade/otc/?actionType=1&token=USDT&fiat=RUB',
                'https://www.bybit.com/en/trade/spot/BTC/USDT',
                'https://www.bybit.com/'
            ]
            
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
            
            # Используем прокси-менеджер для выполнения запроса
            response = proxy_manager.make_request(
                method='POST',
                url=url,
                json=payload,
                headers=headers
            )
            
            # Если запрос не удался - прерываем пагинацию
            if response is None:
                break
            
            # Обработка rate limit (429)
            if response.status_code == 429:
                time.sleep(random.uniform(2, 5))
                continue
            
            # Если не 200 - прерываем
            if response.status_code != 200:
                break
            
            response_data = response.json()
            
            if not isinstance(response_data, dict) or response_data.get('ret_code') != 0:
                break
            
            result = response_data.get('result', {})
            if not isinstance(result, dict):
                break
            
            items = result.get('items', [])
            if not isinstance(items, list) or len(items) == 0:
                break
            
            if debug and page == 1 and len(items) > 0:
                debug_items = []
                for item in items[:10]:
                    debug_items.append({
                        'nickName': item.get('nickName'),
                        'authMaker': item.get('authMaker'),
                        'authStatus': item.get('authStatus'),
                        'authTag': item.get('authTag'),
                        'userType': item.get('userType'),
                        'isMerchant': item.get('isMerchant'),
                        'merchantLevel': item.get('merchantLevel'),
                        'certificationLevel': item.get('certificationLevel'),
                        'vaGoldIcon': item.get('vaGoldIcon'),
                        'vaSilverIcon': item.get('vaSilverIcon'),
                        'vaBronzeIcon': item.get('vaBronzeIcon'),
                        'baIcon': item.get('baIcon'),
                        'recentOrderNum': item.get('recentOrderNum'),
                        'recentExecuteRate': item.get('recentExecuteRate'),
                        'all_keys': list(item.keys())
                    })
                debug_info = {
                    'debug': True,
                    'items': debug_items
                }
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps(debug_info, ensure_ascii=False, indent=2),
                    'isBase64Encoded': False
                }
            
            for item in items:
                if not isinstance(item, dict):
                    continue
                
                payments = item.get('payments', [])
                if not isinstance(payments, list):
                    payments = []
                
                payment_methods = []
                for p in payments:
                    if isinstance(p, dict):
                        payment_methods.append(p.get('name', ''))
                
                min_amt = float(item.get('minAmount', 0))
                max_amt = float(item.get('maxAmount', 0))
                is_triangle = abs(max_amt - min_amt) <= 1.0
                
                # Онлайн статус - используем isOnline
                is_online = bool(item.get('isOnline', False))
                last_logout_time = item.get('lastLogoutTime', '')
                
                # Определяем тип мерчанта по Verified Advertiser тегам
                # BA = Block Advertiser (блочный мерчант - высший статус)
                # VA3 = Gold Verified Advertiser
                # VA2 = Silver Verified Advertiser
                # VA1/VA = Bronze Verified Advertiser
                auth_tags = item.get('authTag', [])
                if not isinstance(auth_tags, list):
                    auth_tags = []
                
                merchant_type = None
                merchant_badge = None
                is_merchant = False
                is_block_trade = 'BA' in auth_tags
                
                # Определяем уровень VA (Verified Advertiser)
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
            
            if len(items) < 100:
                break
            
            # Задержка между запросами из конфига
            time.sleep(random.uniform(*REQUEST_DELAY_RANGE))
            page += 1
        
        if search_user:
            found_users = [o for o in all_offers if search_user.lower() in o['maker'].lower()]
            result_data = {
                'search': search_user,
                'found': len(found_users),
                'users': found_users
            }
        else:
            result_data = {
                'offers': all_offers,
                'total': len(all_offers),
                'side': 'sell' if side == '1' else 'buy',
                'pages_loaded': page - 1,
                'proxy_stats': proxy_manager.get_stats()  # Статистика прокси
            }
        
        # Сохраняем в базу данных (только для основных запросов, не поиска)
        if not search_user:
            try:
                # Преобразуем данные для БД
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
            
            cache[cache_key] = (result_data, datetime.now())
        
        headers_dict = {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'X-Cache': 'MISS',
            'X-Saved-To-DB': 'true' if not search_user else 'false'
        }
        
        # Добавляем статистику прокси в заголовки для мониторинга
        stats = proxy_manager.get_stats()
        if stats['total_requests'] > 0:
            headers_dict['X-Proxy-Success-Rate'] = f"{stats.get('success_rate', 0):.1f}%"
            headers_dict['X-Proxy-Usage'] = f"{stats.get('proxy_usage_rate', 0):.1f}%"
        
        return {
            'statusCode': 200,
            'headers': headers_dict,
            'body': json.dumps(result_data),
            'isBase64Encoded': False
        }
        
    except requests.exceptions.Timeout:
        return {
            'statusCode': 504,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': 'Request timeout'}),
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