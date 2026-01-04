import json
import requests
from typing import List, Dict, Any

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
    
    try:
        url = 'https://api2.bybit.com/fiat/otc/item/online'
        
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
        
            headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
                'Origin': 'https://www.bybit.com',
                'Referer': 'https://www.bybit.com/'
            }
            
            response = requests.post(url, json=payload, headers=headers, timeout=10)
            
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
                
                offer = {
                    'id': str(item.get('id', '')),
                    'price': float(item.get('price', 0)),
                    'maker': str(item.get('nickName', 'Unknown')),
                    'maker_id': str(item.get('userId', '')),
                    'quantity': float(item.get('lastQuantity', 0)),
                    'min_amount': float(item.get('minAmount', 0)),
                    'max_amount': float(item.get('maxAmount', 0)),
                    'payment_methods': payment_methods,
                    'side': 'sell' if side == '1' else 'buy',
                    'completion_rate': float(item.get('recentOrderNum', 0)),
                    'total_orders': int(item.get('recentExecuteRate', 0))
                }
                all_offers.append(offer)
            
            if len(items) < 100:
                break
            
            page += 1
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'offers': all_offers,
                'total': len(all_offers),
                'side': 'sell' if side == '1' else 'buy',
                'pages_loaded': page - 1
            }),
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