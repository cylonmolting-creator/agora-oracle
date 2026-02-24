-- Agent Rate Oracle Database Schema
-- SQLite database for storing provider pricing data

-- Providers table: stores information about AI agent service providers
CREATE TABLE IF NOT EXISTS providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    url TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('llm', 'agent', 'tool')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Services table: stores individual services offered by providers
CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id INTEGER NOT NULL,
    category TEXT NOT NULL,
    subcategory TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
);

-- Rates table: stores current pricing information for services
CREATE TABLE IF NOT EXISTS rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id INTEGER NOT NULL,
    price REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    unit TEXT NOT NULL,
    pricing_type TEXT NOT NULL CHECK(pricing_type IN ('per-request', 'per-token', 'per-minute', 'per-image', 'per-mb', 'per-second', 'per-hour')),
    confidence REAL DEFAULT 1.0 CHECK(confidence >= 0.0 AND confidence <= 1.0),
    source_count INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

-- Rate history table: stores historical pricing data for trend analysis
CREATE TABLE IF NOT EXISTS rate_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id INTEGER NOT NULL,
    price REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    unit TEXT NOT NULL,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_providers_type ON providers(type);
CREATE INDEX IF NOT EXISTS idx_services_provider ON services(provider_id);
CREATE INDEX IF NOT EXISTS idx_services_category ON services(category, subcategory);
CREATE INDEX IF NOT EXISTS idx_rates_service ON rates(service_id);
CREATE INDEX IF NOT EXISTS idx_rates_created ON rates(created_at);
CREATE INDEX IF NOT EXISTS idx_history_service ON rate_history(service_id);
CREATE INDEX IF NOT EXISTS idx_history_recorded ON rate_history(recorded_at);

-- Trigger to automatically update updated_at timestamp for providers
CREATE TRIGGER IF NOT EXISTS update_providers_timestamp
AFTER UPDATE ON providers
BEGIN
    UPDATE providers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger to automatically update updated_at timestamp for services
CREATE TRIGGER IF NOT EXISTS update_services_timestamp
AFTER UPDATE ON services
BEGIN
    UPDATE services SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger to automatically archive old rates to rate_history
CREATE TRIGGER IF NOT EXISTS archive_rate_to_history
AFTER UPDATE OF price ON rates
BEGIN
    INSERT INTO rate_history (service_id, price, currency, unit, recorded_at)
    VALUES (OLD.service_id, OLD.price, OLD.currency, OLD.unit, OLD.created_at);
END;
