-- Добавляем таблицу для глобального управления обновлениями
CREATE TABLE IF NOT EXISTS t_p69186337_bybit_p2p_scraper.system_settings (
    setting_key VARCHAR(50) PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(100)
);

-- Вставляем начальную настройку (обновление включено)
INSERT INTO t_p69186337_bybit_p2p_scraper.system_settings (setting_key, setting_value, updated_at)
VALUES ('auto_update_enabled', 'true', NOW())
ON CONFLICT (setting_key) DO NOTHING;

-- Индекс для быстрого доступа
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON t_p69186337_bybit_p2p_scraper.system_settings(setting_key);