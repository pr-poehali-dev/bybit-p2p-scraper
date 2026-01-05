import os
import psycopg2
import psycopg2.extras
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

class DatabaseManager:
    def __init__(self):
        self.dsn = os.environ.get('DATABASE_URL')
        self.schema = os.environ.get('MAIN_DB_SCHEMA', 't_p69186337_bybit_p2p_scraper')
        
    def get_connection(self):
        return psycopg2.connect(self.dsn)
    
    def save_offers(self, offers: List[Dict[str, Any]], side: str) -> int:
        """Сохранение офферов в базу данных. Возвращает количество сохраненных записей."""
        if not offers:
            return 0
            
        conn = self.get_connection()
        try:
            with conn.cursor() as cur:
                # Удаляем старые данные для этой стороны
                cur.execute(f"DELETE FROM {self.schema}.p2p_offers WHERE side = %s", (side,))
                
                # Вставляем новые данные
                insert_query = f"""
                    INSERT INTO {self.schema}.p2p_offers 
                    (id, side, price, min_amount, max_amount, available_amount, 
                     nickname, is_merchant, merchant_type, is_online, is_triangle,
                     completion_rate, completed_orders, payment_methods, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """
                
                for offer in offers:
                    cur.execute(insert_query, (
                        offer['id'],
                        side,
                        offer['price'],
                        offer['min_amount'],
                        offer['max_amount'],
                        offer['available_amount'],
                        offer['nickname'],
                        offer['is_merchant'],
                        offer.get('merchant_type'),
                        offer['is_online'],
                        offer['is_triangle'],
                        offer['completion_rate'],
                        offer['completed_orders'],
                        ','.join(offer['payment_methods']) if offer['payment_methods'] else None,
                        datetime.now()
                    ))
                
                # Обновляем метаданные
                cur.execute(f"""
                    INSERT INTO {self.schema}.update_metadata (side, last_update, offers_count)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (side) 
                    DO UPDATE SET last_update = EXCLUDED.last_update, offers_count = EXCLUDED.offers_count
                """, (side, datetime.now(), len(offers)))
                
                conn.commit()
                logger.info(f"Saved {len(offers)} offers for side {side}")
                return len(offers)
        except Exception as e:
            conn.rollback()
            logger.error(f"Error saving offers: {e}")
            raise
        finally:
            conn.close()
    
    def get_offers(self, side: str) -> List[Dict[str, Any]]:
        """Получение офферов из базы данных."""
        conn = self.get_connection()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(f"""
                    SELECT id, side, price, min_amount, max_amount, available_amount,
                           nickname, is_merchant, merchant_type, is_online, is_triangle,
                           completion_rate, completed_orders, payment_methods, updated_at
                    FROM {self.schema}.p2p_offers
                    WHERE side = %s
                    ORDER BY price {'ASC' if side == '1' else 'DESC'}
                """, (side,))
                
                rows = cur.fetchall()
                
                offers = []
                for row in rows:
                    offers.append({
                        'id': row['id'],
                        'price': float(row['price']),
                        'maker': row['nickname'],
                        'maker_id': '',
                        'quantity': float(row['available_amount']),
                        'min_amount': float(row['min_amount']),
                        'max_amount': float(row['max_amount']),
                        'payment_methods': row['payment_methods'].split(',') if row['payment_methods'] else [],
                        'side': 'sell' if side == '1' else 'buy',
                        'completion_rate': int(row['completion_rate']) if row['completion_rate'] else 0,
                        'total_orders': row['completed_orders'],
                        'is_merchant': row['is_merchant'],
                        'merchant_type': row['merchant_type'],
                        'merchant_badge': f'va{row["merchant_type"].capitalize()}Icon' if row['merchant_type'] else None,
                        'is_block_trade': row['merchant_type'] == 'block_trade' if row['merchant_type'] else False,
                        'is_online': row['is_online'],
                        'is_triangle': row['is_triangle'],
                        'last_logout_time': '',
                        'auth_tags': []
                    })
                
                return offers
        finally:
            conn.close()
    
    def get_last_update(self, side: str) -> Optional[datetime]:
        """Получение времени последнего обновления."""
        conn = self.get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(f"""
                    SELECT last_update FROM {self.schema}.update_metadata WHERE side = %s
                """, (side,))
                
                row = cur.fetchone()
                return row[0] if row else None
        finally:
            conn.close()
    
    def should_update(self, side: str, interval_minutes: int = 10) -> bool:
        """Проверка необходимости обновления данных (в минутах)."""
        last_update = self.get_last_update(side)
        if not last_update:
            return True
        
        now = datetime.now()
        time_diff = (now - last_update).total_seconds() / 60
        return time_diff >= interval_minutes
    
    def should_update_seconds(self, side: str, interval_seconds: int = 90) -> bool:
        """Проверка необходимости обновления данных (в секундах)."""
        last_update = self.get_last_update(side)
        if not last_update:
            return True
        
        now = datetime.now()
        time_diff = (now - last_update).total_seconds()
        return time_diff >= interval_seconds