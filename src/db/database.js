import Database from 'better-sqlite3';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import logger from '../logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Singleton database instance
let dbInstance = null;

/**
 * Run database migrations from src/db/migrations/ directory
 * Executes all .sql files in alphabetical order
 */
export const initMigrations = () => {
  try {
    const migrationsDir = join(__dirname, 'migrations');

    // Check if migrations directory exists
    if (!existsSync(migrationsDir)) {
      logger.warn('migrations_dir_not_found', { path: migrationsDir });
      return;
    }

    // Get all .sql files sorted alphabetically
    const files = readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      logger.info('no_migrations_found', {});
      return;
    }

    const db = getDb();
    let count = 0;

    // Execute each migration file
    for (const file of files) {
      const migrationPath = join(migrationsDir, file);
      const migration = readFileSync(migrationPath, 'utf-8');
      db.exec(migration);
      count++;
      logger.info('migration_executed', { file });
    }

    logger.info('migrations_completed', { count });
  } catch (error) {
    logger.error('migration_failed', { error: error.message });
    throw error;
  }
};

/**
 * Initialize the SQLite database
 * @param {string} dbPath - Path to the database file (default: data/aro.db)
 * @returns {Database} SQLite database instance
 */
export const initDatabase = (dbPath = join(process.cwd(), 'data', 'aro.db')) => {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    // Create database connection
    dbInstance = new Database(dbPath);

    // Enable foreign keys
    dbInstance.pragma('foreign_keys = ON');

    // Set journal mode to WAL for better concurrency
    dbInstance.pragma('journal_mode = WAL');

    // Read and execute schema
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');

    // Execute schema statements
    dbInstance.exec(schema);

    // Run migrations after main schema
    initMigrations();

    logger.info('db_initialized', { path: dbPath });
    return dbInstance;
  } catch (error) {
    logger.error('db_init_failed', { error: error.message });
    throw error;
  }
};

/**
 * Get the database instance
 * @returns {Database} SQLite database instance
 */
export const getDb = () => {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return dbInstance;
};

/**
 * Execute a SQL query that modifies data (INSERT, UPDATE, DELETE)
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Object} Result with lastInsertRowid and changes
 */
export const runQuery = (sql, params = []) => {
  try {
    const db = getDb();
    const stmt = db.prepare(sql);
    const result = stmt.run(...params);
    return {
      lastInsertRowid: result.lastInsertRowid,
      changes: result.changes
    };
  } catch (error) {
    logger.error('query_failed', { error: error.message });
    throw error;
  }
};

/**
 * Execute a SELECT query and return all rows
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Array} Array of result rows
 */
export const getAll = (sql, params = []) => {
  try {
    const db = getDb();
    const stmt = db.prepare(sql);
    return stmt.all(...params);
  } catch (error) {
    logger.error('query_failed', { error: error.message });
    throw error;
  }
};

/**
 * Execute a SELECT query and return a single row
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Object|undefined} Single result row or undefined
 */
export const getOne = (sql, params = []) => {
  try {
    const db = getDb();
    const stmt = db.prepare(sql);
    return stmt.get(...params);
  } catch (error) {
    logger.error('query_failed', { error: error.message });
    throw error;
  }
};

/**
 * Execute a transaction with multiple operations
 * @param {Function} callback - Function containing database operations
 * @returns {*} Result of the callback function
 */
export const transaction = (callback) => {
  try {
    const db = getDb();
    return db.transaction(callback)();
  } catch (error) {
    logger.error('transaction_failed', { error: error.message });
    throw error;
  }
};

/**
 * Close the database connection
 */
export const closeDatabase = () => {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    logger.info('db_closed', {});
  }
};

/**
 * Get database statistics
 * @returns {Object} Database stats
 */
export const getStats = () => {
  try {
    const providerCount = getOne('SELECT COUNT(*) as count FROM providers')?.count || 0;
    const serviceCount = getOne('SELECT COUNT(*) as count FROM services')?.count || 0;
    const rateCount = getOne('SELECT COUNT(*) as count FROM rates')?.count || 0;
    const historyCount = getOne('SELECT COUNT(*) as count FROM rate_history')?.count || 0;

    return {
      providers: providerCount,
      services: serviceCount,
      rates: rateCount,
      history: historyCount
    };
  } catch (error) {
    logger.error('db_stats_failed', { error: error.message });
    return { providers: 0, services: 0, rates: 0, history: 0 };
  }
};

export default {
  initDatabase,
  initMigrations,
  getDb,
  runQuery,
  getAll,
  getOne,
  transaction,
  closeDatabase,
  getStats
};
