import os
import psycopg2
import psycopg2.extras
import psycopg2.pool
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from decimal import Decimal

logger = logging.getLogger(__name__)

class DatabaseManager:
    _pool = None
    
    def __init__(self):
        self.dsn = os.environ.get('DATABASE_URL')
        self.schema = os.environ.get('MAIN_DB_SCHEMA', 't_p69186337_bybit_p2p_scraper')
        
        # Инициализируем connection pool один раз
        if DatabaseManager._pool is None:
            try:
                DatabaseManager._pool = psycopg2.pool.SimpleConnectionPool(
                    minconn=1,
                    maxconn=3,  # Ограничиваем максимум 3 соединения
                    dsn=self.dsn
                )
                logger.info("Database connection pool created")
            except Exception as e:
                logger.error(f"Failed to create connection pool: {e}")
                DatabaseManager._pool = None
        
    def get_connection(self):
        if DatabaseManager._pool:
            try:
                return DatabaseManager._pool.getconn()
            except Exception as e:
                logger.error(f"Failed to get connection from pool: {e}")
                # Fallback к прямому подключению
                return psycopg2.connect(self.dsn)
        return psycopg2.connect(self.dsn)
    
    def put_connection(self, conn):
        if DatabaseManager._pool:
            try:
                DatabaseManager._pool.putconn(conn)
            except Exception as e:
                logger.error(f"Failed to return connection to pool: {e}")
                try:
                    conn.close()
                except:
                    pass
        else:
            try:
                conn.close()
            except:
                pass
    
    def save_offers(self, offers: List[Dict[str, Any]], side: str) -> int:
        """Сохранение офферов в базу данных. Возвращает количество сохраненных записей."""
        if not offers:
            return 0
            
        conn = self.get_connection()
        try:
            with conn.cursor() as cur:
                # Удаляем старые данные для этой стороны (атомарно)
                cur.execute(f"DELETE FROM {self.schema}.p2p_offers WHERE side = %s", (side,))
                
                # Используем UPSERT для предотвращения race condition
                upsert_query = f"""
                    INSERT INTO {self.schema}.p2p_offers 
                    (id, side, price, min_amount, max_amount, available_amount, 
                     nickname, is_merchant, merchant_type, is_online, is_triangle,
                     completion_rate, completed_orders, payment_methods, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id, side) 
                    DO UPDATE SET 
                        price = EXCLUDED.price,
                        min_amount = EXCLUDED.min_amount,
                        max_amount = EXCLUDED.max_amount,
                        available_amount = EXCLUDED.available_amount,
                        nickname = EXCLUDED.nickname,
                        is_merchant = EXCLUDED.is_merchant,
                        merchant_type = EXCLUDED.merchant_type,
                        is_online = EXCLUDED.is_online,
                        is_triangle = EXCLUDED.is_triangle,
                        completion_rate = EXCLUDED.completion_rate,
                        completed_orders = EXCLUDED.completed_orders,
                        payment_methods = EXCLUDED.payment_methods,
                        updated_at = EXCLUDED.updated_at
                """
                
                for offer in offers:
                    cur.execute(upsert_query, (
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
            self.put_connection(conn)
    
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
                    # Конвертируем Decimal в float для JSON сериализации
                    def to_float(val):
                        if isinstance(val, Decimal):
                            return float(val)
                        return val
                    
                    offers.append({
                        'id': row['id'],
                        'price': to_float(row['price']),
                        'maker': row['nickname'],
                        'maker_id': '',
                        'quantity': to_float(row['available_amount']),
                        'min_amount': to_float(row['min_amount']),
                        'max_amount': to_float(row['max_amount']),
                        'payment_methods': row['payment_methods'].split(',') if row['payment_methods'] else [],
                        'side': 'sell' if side == '1' else 'buy',
                        'completion_rate': int(to_float(row['completion_rate'])) if row['completion_rate'] else 0,
                        'total_orders': int(to_float(row['completed_orders'])) if row['completed_orders'] else 0,
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
            self.put_connection(conn)
    
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
            self.put_connection(conn)
    
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
    
    def is_auto_update_enabled(self) -> bool:
        """Проверка глобального статуса автообновления."""
        conn = self.get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(f"""
                    SELECT setting_value FROM {self.schema}.system_settings 
                    WHERE setting_key = 'auto_update_enabled'
                """)
                row = cur.fetchone()
                return row[0].lower() == 'true' if row else True
        except Exception as e:
            logger.error(f"Error checking auto_update_enabled: {e}")
            return True  # По умолчанию включено
        finally:
            self.put_connection(conn)
    
    def set_auto_update_enabled(self, enabled: bool, updated_by: str = 'user') -> bool:
        """Установка глобального статуса автообновления."""
        conn = self.get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(f"""
                    INSERT INTO {self.schema}.system_settings (setting_key, setting_value, updated_at, updated_by)
                    VALUES ('auto_update_enabled', %s, %s, %s)
                    ON CONFLICT (setting_key) 
                    DO UPDATE SET setting_value = EXCLUDED.setting_value, 
                                  updated_at = EXCLUDED.updated_at,
                                  updated_by = EXCLUDED.updated_by
                """, ('true' if enabled else 'false', datetime.now(), updated_by))
                conn.commit()
                logger.info(f"Auto-update set to {enabled} by {updated_by}")
                return True
        except Exception as e:
            conn.rollback()
            logger.error(f"Error setting auto_update_enabled: {e}")
            return False
        finally:
            self.put_connection(conn)