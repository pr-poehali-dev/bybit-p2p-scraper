-- Создание таблицы для хранения P2P объявлений Bybit
CREATE TABLE IF NOT EXISTS t_p69186337_bybit_p2p_scraper.p2p_offers (
    id VARCHAR(100) PRIMARY KEY,
    side VARCHAR(10) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    min_amount DECIMAL(15, 2) NOT NULL,
    max_amount DECIMAL(15, 2) NOT NULL,
    available_amount DECIMAL(15, 2) NOT NULL,
    nickname VARCHAR(255) NOT NULL,
    is_merchant BOOLEAN DEFAULT FALSE,
    merchant_type VARCHAR(50),
    is_online BOOLEAN DEFAULT FALSE,
    is_triangle BOOLEAN DEFAULT FALSE,
    completion_rate DECIMAL(5, 2),
    completed_orders INTEGER DEFAULT 0,
    payment_methods TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индекс для быстрого поиска по стороне (buy/sell)
CREATE INDEX idx_p2p_offers_side ON t_p69186337_bybit_p2p_scraper.p2p_offers(side);

-- Индекс для фильтрации по времени обновления
CREATE INDEX idx_p2p_offers_updated ON t_p69186337_bybit_p2p_scraper.p2p_offers(updated_at DESC);

-- Индекс для фильтрации мерчантов
CREATE INDEX idx_p2p_offers_merchant ON t_p69186337_bybit_p2p_scraper.p2p_offers(is_merchant, side);

-- Таблица для хранения метаданных последнего обновления
CREATE TABLE IF NOT EXISTS t_p69186337_bybit_p2p_scraper.update_metadata (
    side VARCHAR(10) PRIMARY KEY,
    last_update TIMESTAMP NOT NULL,
    offers_count INTEGER DEFAULT 0
);