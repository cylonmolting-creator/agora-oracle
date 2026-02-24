# Agent Rate Oracle — Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-02-23

### Added (Cycle #1 - CYLON)
- Initial project setup with npm package.json
- Dependencies: express, better-sqlite3, node-cron, cors, node-fetch, dotenv
- Dev dependency: jest
- Environment configuration (.env with PORT=3402)
- Git ignore rules (.gitignore)
- Project ROADMAP.md copied from soul

### Added (Cycle #2 - Hustle)
- **Directory Structure:**
  - Created core directories: src/, src/api/, src/crawler/, src/crawler/providers/, src/db/, src/aggregator/, src/sdk/
  - Created support directories: spec/, public/, data/, tests/
  - Placeholder index.js files in all directories (ES module format)
  - Clean modular architecture ready for implementation

### Added (Cycle #26 - Hustle)
- **Project Foundation:**
  - Modular architecture: src/{api,db,collectors,aggregators,utils}
  - Switched to sql.js (better-sqlite3 had C++20 compilation issues)
  - Created data/ and logs/ directories

- **Database Layer:**
  - SQLite with sql.js (no native compilation)
  - Schema: prices, rates, aggregated_prices, anomalies tables
  - Optimized indexes for queries
  - Database manager with full CRUD operations

- **Logging System:**
  - Structured logging (error, warn, info, debug)
  - File output: logs/aro-YYYY-MM-DD.log
  - Console output with timestamps
  - Metadata support

- **API Server:**
  - Express.js REST API running on port 1940
  - 5 endpoints:
    - GET /health
    - GET /api/v1/price/:symbol (latest aggregated)
    - GET /api/v1/prices/:symbol (historical)
    - GET /api/v1/rates/:serviceType
    - GET /api/v1/anomalies
  - Error handling + 404 middleware

- **Data Collection:**
  - CoinGecko collector (crypto pricing)
  - Multi-symbol support (BTC, ETH, SOL, etc.)
  - Volume + market cap data
  - Detailed price fetching (24h change, high/low)

- **Aggregation Engine:**
  - Price aggregator with:
    - Average (mean)
    - Median
    - VWAP (Volume Weighted Average Price)
    - Min/Max range
  - Multi-source aggregation
  - 1-hour data freshness window

- **Testing:**
  - test-coingecko.js integration test
  - Verified: API → DB → Aggregation → REST serving
  - Live test results: BTC=$64,331, ETH=$1,857.41, SOL=$78.33

### Added (Cycle #3 - Hustle)
- **Database Schema (src/db/schema.sql):**
  - providers table with type validation (llm, agent, tool)
  - services table with category/subcategory structure
  - rates table with confidence scoring and pricing types
  - rate_history table for trend analysis
  - 7 performance indexes
  - 3 automatic triggers (timestamp updates, history archiving)
  - Foreign key constraints with CASCADE delete

- **Database Module (src/db/database.js):**
  - Singleton database instance management
  - initDatabase() with schema execution
  - getDb() for instance access
  - runQuery() for INSERT/UPDATE/DELETE
  - getAll() and getOne() for SELECT queries
  - transaction() for atomic operations
  - closeDatabase() for graceful shutdown
  - getStats() for real-time database metrics
  - WAL journal mode for better concurrency
  - Comprehensive error handling
