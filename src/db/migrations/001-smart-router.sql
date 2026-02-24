-- Smart Router Migration: Agents, Budgets, Request Log
-- Created: 2026-02-24 by Hustle
-- Purpose: Add tables for agent tracking, budget management, and request logging

-- Agents table: tracks API keys and agent identities
CREATE TABLE IF NOT EXISTS agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    api_key TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Budgets table: monthly spending limits per agent
CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id INTEGER NOT NULL,
    monthly_limit REAL NOT NULL,
    spent REAL DEFAULT 0,
    period TEXT NOT NULL,
    FOREIGN KEY (agent_id) REFERENCES agents(id)
);

-- Request log: every smart route call is logged here
CREATE TABLE IF NOT EXISTS request_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id INTEGER NOT NULL,
    provider TEXT NOT NULL,
    category TEXT,
    cost REAL,
    latency_ms INTEGER,
    tokens_in INTEGER,
    tokens_out INTEGER,
    status TEXT DEFAULT 'success',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES agents(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agents_key ON agents(api_key);
CREATE INDEX IF NOT EXISTS idx_budgets_agent ON budgets(agent_id, period);
CREATE INDEX IF NOT EXISTS idx_request_log_agent ON request_log(agent_id, created_at);
