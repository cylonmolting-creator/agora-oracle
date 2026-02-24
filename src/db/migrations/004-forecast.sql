-- Migration 004: Price Forecasts (Phase 3 - Predictive Pricing)
-- Creates tables for ML-based 7-day price forecasting system
-- ARO becomes "Bloomberg Terminal of AI Economy" with predictive intelligence

-- Table: price_forecasts
-- Stores ML-generated price predictions for each skill (7-day rolling forecasts)
CREATE TABLE IF NOT EXISTS price_forecasts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  skill TEXT NOT NULL,                    -- e.g., 'text-generation/chat'
  forecast_date DATE NOT NULL,            -- target date for prediction (YYYY-MM-DD)
  predicted_price REAL NOT NULL,          -- forecasted price in USD
  confidence REAL NOT NULL,               -- model confidence (0.0-1.0, where 1.0 = 100% confident)
  model_version TEXT,                     -- e.g., 'exponential_smoothing_v1', 'prophet_v1'
  features_used TEXT,                     -- JSON array of features (e.g., '["historical_prices","provider_count","volatility"]')
  generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,  -- when forecast was generated

  -- Prevent duplicate forecasts for same skill+date in same generation run
  UNIQUE(skill, forecast_date, generated_at)
);

-- Index: Fast lookup by skill + forecast date (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_forecast_skill
  ON price_forecasts(skill, forecast_date DESC);

-- Index: Fast lookup by generation time (cleanup old forecasts)
CREATE INDEX IF NOT EXISTS idx_forecast_date
  ON price_forecasts(generated_at);

-- Insert sample data (for testing until first forecast generation runs)
-- This represents what a 7-day forecast looks like for text-generation/chat
INSERT OR IGNORE INTO price_forecasts (skill, forecast_date, predicted_price, confidence, model_version, features_used, generated_at)
VALUES
  ('text-generation/chat', DATE('now', '+1 day'), 0.0135, 0.92, 'exponential_smoothing_v1', '["historical_prices","volatility"]', DATETIME('now')),
  ('text-generation/chat', DATE('now', '+2 days'), 0.0132, 0.89, 'exponential_smoothing_v1', '["historical_prices","volatility"]', DATETIME('now')),
  ('text-generation/chat', DATE('now', '+3 days'), 0.0130, 0.85, 'exponential_smoothing_v1', '["historical_prices","volatility"]', DATETIME('now')),
  ('text-generation/chat', DATE('now', '+4 days'), 0.0128, 0.82, 'exponential_smoothing_v1', '["historical_prices","volatility"]', DATETIME('now')),
  ('text-generation/chat', DATE('now', '+5 days'), 0.0127, 0.78, 'exponential_smoothing_v1', '["historical_prices","volatility"]', DATETIME('now')),
  ('text-generation/chat', DATE('now', '+6 days'), 0.0126, 0.74, 'exponential_smoothing_v1', '["historical_prices","volatility"]', DATETIME('now')),
  ('text-generation/chat', DATE('now', '+7 days'), 0.0125, 0.70, 'exponential_smoothing_v1', '["historical_prices","volatility"]', DATETIME('now'));

-- Performance notes:
-- - idx_forecast_skill enables fast filtering: SELECT * FROM price_forecasts WHERE skill='X' AND forecast_date >= TODAY
-- - idx_forecast_date enables fast cleanup: DELETE FROM price_forecasts WHERE generated_at < DATE('now', '-30 days')
-- - UNIQUE constraint prevents duplicate forecasts if generation runs multiple times
-- - confidence score helps UI decide whether to show forecast (hide if confidence < 0.5)
-- - model_version allows A/B testing (compare exponential_smoothing_v1 vs prophet_v1 accuracy)
-- - features_used enables debugging (which inputs drove the prediction?)
