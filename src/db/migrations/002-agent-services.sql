-- ARO v3: Agent Service Comparison Tables
-- Migration 002: x402 Bazaar agent services tracking

-- Table: agent_services
-- Stores x402 Bazaar agent service listings
CREATE TABLE IF NOT EXISTS agent_services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL UNIQUE,
    agent_name TEXT NOT NULL,
    skill TEXT NOT NULL,
    price REAL NOT NULL,
    unit TEXT NOT NULL,
    currency TEXT DEFAULT 'USD',
    uptime REAL,
    avg_latency_ms INTEGER,
    reviews_count INTEGER DEFAULT 0,
    rating REAL DEFAULT 0,
    x402_endpoint TEXT,
    bazaar_url TEXT,
    metadata TEXT,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: agent_service_history
-- Tracks price changes over time for agent services
CREATE TABLE IF NOT EXISTS agent_service_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    price REAL NOT NULL,
    uptime REAL,
    avg_latency_ms INTEGER,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES agent_services(agent_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_services_skill ON agent_services(skill);
CREATE INDEX IF NOT EXISTS idx_agent_services_price ON agent_services(skill, price);
CREATE INDEX IF NOT EXISTS idx_agent_service_history_agent ON agent_service_history(agent_id, recorded_at);
