import dotenv from 'dotenv';
import app from './server.js';
import { initDatabase, initMigrations, closeDatabase, getDb } from './db/database.js';
import { seedFromManualData } from './crawler/providers/manual.js';
import { startScheduler, stopScheduler, startAlertChecker, stopAlertChecker, startForecastGenerator, stopForecastGenerator } from './crawler/scheduler.js';
import { logProviderStatus, getAdapterMap } from './router/config.js';
import { initAlertWebSocket, closeAllConnections } from './gateway/websocket-alerts.js';
import { validateX402Config } from './middleware/x402-payment.js';

// Load .env file and override existing environment variables
dotenv.config({ override: true });

const PORT = process.env.PORT || 3402;

/**
 * Main startup sequence:
 * 1. Initialize database
 * 2. Seed manual data if database is empty
 * 3. Start crawler scheduler
 * 4. Start Express server
 */
async function startup() {
  try {
    console.log('🚀 Agent Rate Oracle v0.1.0');
    console.log('⚙️  Environment:', process.env.NODE_ENV || 'development');
    console.log('');

    // Step 1: Initialize database
    console.log('[startup] Initializing database...');
    initDatabase('./data/aro.db');

    // Step 1b: Run migrations
    console.log('[startup] Running database migrations...');
    initMigrations();
    console.log('[startup] ✓ Migrations complete');

    // Step 2: Check if database is empty and seed if needed
    console.log('[startup] Checking database status...');
    const db = getDb();
    const providerCount = db.prepare('SELECT COUNT(*) as count FROM providers').get().count;

    if (providerCount === 0) {
      console.log('[startup] Database is empty, seeding manual data...');
      const seedResult = seedFromManualData();
      if (seedResult.success) {
        console.log(`[startup] ✓ Seeded ${seedResult.totalProviders} providers, ${seedResult.totalServices} services, ${seedResult.totalRates} rates`);
      } else {
        console.error('[startup] ✗ Failed to seed data:', seedResult.error);
      }
    } else {
      console.log(`[startup] ✓ Database already populated (${providerCount} providers)`);
    }

    // Step 3: Check Smart Router configuration
    console.log('[startup] Checking Smart Router configuration...');
    logProviderStatus();

    // Initialize adapter map and store in app.locals
    const adapterMap = getAdapterMap();
    app.locals.adapterMap = adapterMap;

    // Step 3b: Validate x402 payment configuration
    console.log('[startup] Checking x402 payment configuration...');
    validateX402Config();

    // Step 4: Start crawler scheduler (every 5 minutes)
    console.log('[startup] Starting crawler scheduler...');
    startScheduler('*/5 * * * *');
    console.log('[startup] ✓ Crawler scheduler started (runs every 5 minutes)');

    // Step 4b: Start alert checker scheduler (every 5 minutes)
    console.log('[startup] Starting alert checker scheduler...');
    startAlertChecker('*/5 * * * *');
    console.log('[startup] ✓ Alert checker scheduler started (runs every 5 minutes)');

    // Step 4c: Start forecast generator scheduler (daily at 2 AM UTC)
    console.log('[startup] Starting forecast generator scheduler...');
    startForecastGenerator('0 2 * * *');
    console.log('[startup] ✓ Forecast generator scheduler started (daily at 2 AM UTC)');

    // Step 5: Start Express server
    console.log('[startup] Starting Express server...');
    const server = app.listen(PORT, () => {
      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📡 Server listening on http://localhost:${PORT}`);
      console.log(`🏥 Health check: http://localhost:${PORT}/health`);
      console.log(`📊 Dashboard: http://localhost:${PORT}/`);
      console.log(`🔗 API: http://localhost:${PORT}/v1/`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
      console.log('✅ Agent Rate Oracle is running');
      console.log('Press Ctrl+C to shutdown gracefully');
      console.log('');
    });

    // Step 6: Initialize WebSocket server for price alerts
    console.log('[startup] Initializing WebSocket server...');
    initAlertWebSocket(server);
    console.log('[startup] ✓ WebSocket server ready at ws://localhost:' + PORT + '/ws/alerts');

    // Graceful shutdown handler
    const shutdown = async (signal) => {
      console.log('');
      console.log(`${signal} received. Shutting down gracefully...`);

      // Stop crawler scheduler
      console.log('[shutdown] Stopping crawler scheduler...');
      stopScheduler();

      // Stop alert checker scheduler
      console.log('[shutdown] Stopping alert checker...');
      stopAlertChecker();

      // Stop forecast generator scheduler
      console.log('[shutdown] Stopping forecast generator...');
      stopForecastGenerator();

      // Close WebSocket connections
      console.log('[shutdown] Closing WebSocket connections...');
      closeAllConnections();

      // Close HTTP server
      console.log('[shutdown] Closing HTTP server...');
      server.close(() => {
        console.log('[shutdown] ✓ HTTP server closed');

        // Close database connection
        console.log('[shutdown] Closing database...');
        closeDatabase();

        console.log('[shutdown] ✓ Graceful shutdown complete');
        process.exit(0);
      });

      // Force shutdown after 10 seconds if graceful shutdown hangs
      setTimeout(() => {
        console.error('[shutdown] ✗ Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    // Register shutdown handlers
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    console.error('');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('✗ FATAL ERROR DURING STARTUP');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(error);
    process.exit(1);
  }
}

// Start the application
startup();
