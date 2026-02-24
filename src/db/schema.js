export const SCHEMA = {
  prices: `
    CREATE TABLE IF NOT EXISTS prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      symbol TEXT NOT NULL,
      price REAL NOT NULL,
      volume REAL,
      timestamp INTEGER NOT NULL,
      raw_data TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `,

  rates: `
    CREATE TABLE IF NOT EXISTS rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_type TEXT NOT NULL,
      provider TEXT NOT NULL,
      rate REAL NOT NULL,
      unit TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      metadata TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `,

  aggregated_prices: `
    CREATE TABLE IF NOT EXISTS aggregated_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      avg_price REAL NOT NULL,
      median_price REAL NOT NULL,
      vwap REAL,
      min_price REAL,
      max_price REAL,
      source_count INTEGER NOT NULL,
      timestamp INTEGER NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `,

  anomalies: `
    CREATE TABLE IF NOT EXISTS anomalies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      symbol TEXT,
      description TEXT NOT NULL,
      severity TEXT NOT NULL,
      data TEXT,
      timestamp INTEGER NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `
};

export const INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_prices_symbol_timestamp ON prices(symbol, timestamp)',
  'CREATE INDEX IF NOT EXISTS idx_prices_source ON prices(source)',
  'CREATE INDEX IF NOT EXISTS idx_rates_service_timestamp ON rates(service_type, timestamp)',
  'CREATE INDEX IF NOT EXISTS idx_aggregated_symbol_timestamp ON aggregated_prices(symbol, timestamp)',
  'CREATE INDEX IF NOT EXISTS idx_anomalies_timestamp ON anomalies(timestamp)'
];
