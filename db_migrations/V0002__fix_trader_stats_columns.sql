-- Исправление типов данных для корректного хранения статистики трейдеров
ALTER TABLE t_p69186337_bybit_p2p_scraper.p2p_offers 
  ALTER COLUMN completion_rate TYPE INTEGER,
  ALTER COLUMN completed_orders TYPE DECIMAL(5, 2);

-- Комментарии для ясности
COMMENT ON COLUMN t_p69186337_bybit_p2p_scraper.p2p_offers.completion_rate IS 'Количество выполненных сделок (recentOrderNum)';
COMMENT ON COLUMN t_p69186337_bybit_p2p_scraper.p2p_offers.completed_orders IS 'Процент выполнения (recentExecuteRate)';