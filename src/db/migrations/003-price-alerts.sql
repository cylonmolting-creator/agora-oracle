-- ROADMAP v3 Phase 2: Real-Time Price Alerts
-- Migration 003: price_alerts and alert_triggers tables

-- Table: price_alerts
-- Stores user-configured price alert rules
CREATE TABLE IF NOT EXISTS price_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER NOT NULL,
  alert_type TEXT NOT NULL CHECK(alert_type IN ('price_drop', 'price_threshold', 'any_change')),
  target_skill TEXT,
  target_provider TEXT,
  max_price REAL,
  notify_method TEXT NOT NULL CHECK(notify_method IN ('webhook', 'email', 'websocket')),
  webhook_url TEXT,
  email TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'paused', 'expired')),
  last_triggered DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

-- Table: alert_triggers
-- Logs each time an alert condition is met
CREATE TABLE IF NOT EXISTS alert_triggers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_id INTEGER NOT NULL,
  old_price REAL NOT NULL,
  new_price REAL NOT NULL,
  provider TEXT NOT NULL,
  skill TEXT NOT NULL,
  triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  notified BOOLEAN DEFAULT 0,
  FOREIGN KEY (alert_id) REFERENCES price_alerts(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_price_alerts_agent ON price_alerts(agent_id, status);
CREATE INDEX IF NOT EXISTS idx_price_alerts_active ON price_alerts(status, alert_type);
CREATE INDEX IF NOT EXISTS idx_alert_triggers_alert ON alert_triggers(alert_id, triggered_at);
