import cron from 'node-cron';
import { seedFromManualData } from './providers/manual.js';
import { crawlAll } from './index.js';
import { getDb } from '../db/database.js';
import { checkPriceAlerts } from '../alerts/alert-checker.js';
import { generateAllForecasts } from '../forecast/scheduler.js';
import logger from '../logger.js';

let cronJob = null;
let alertCheckerJob = null;
let forecastGeneratorJob = null;
let isRunning = false;
let isCheckingAlerts = false;
let isGeneratingForecasts = false;

// Crawler task to be run on schedule
async function runCrawlerTask() {
  if (isRunning) {
    console.log('[scheduler] Previous crawl still running, skipping...');
    return;
  }

  isRunning = true;
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  console.log(`[scheduler] Starting crawl at ${timestamp}`);

  try {
    // Check if database is empty, seed if needed
    const db = getDb();
    const providerCount = db.prepare('SELECT COUNT(*) as count FROM providers').get().count;

    if (providerCount === 0) {
      console.log('[scheduler] Database empty, seeding manual data...');
      await seedFromManualData();
    }

    // Run all provider crawlers
    const result = await crawlAll();

    const duration = Date.now() - startTime;
    console.log(`[scheduler] Crawl completed in ${duration}ms`);
    console.log(`[scheduler] Providers checked: ${result.providersChecked}`);
    console.log(`[scheduler] New rates collected: ${result.newRates}`);
    if (result.errors && result.errors.length > 0) {
      console.log(`[scheduler] Errors: ${result.errors.length}`);
      result.errors.forEach(err => console.log(`  - ${err}`));
    }

  } catch (error) {
    console.error('[scheduler] Crawl failed:', error.message);
  } finally {
    isRunning = false;
  }
}

/**
 * Alert checker task to be run on schedule (every 5 minutes)
 * Checks active price alerts and triggers notifications when conditions are met
 */
async function runAlertCheckerTask() {
  if (isCheckingAlerts) {
    logger.info('alert_checker_skip', { message: 'Previous check still running, skipping...' });
    return;
  }

  isCheckingAlerts = true;
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  logger.info('alert_checker_scheduled_run', { timestamp });

  try {
    const result = await checkPriceAlerts();

    const duration = Date.now() - startTime;
    logger.info('alert_checker_scheduled_complete', {
      duration: `${duration}ms`,
      checkedAlerts: result.checkedAlerts,
      triggeredAlerts: result.triggeredAlerts
    });
  } catch (error) {
    logger.error(`alert_checker_scheduled_failed: ${error.message}`);
  } finally {
    isCheckingAlerts = false;
  }
}

/**
 * Forecast generator task to be run on schedule (daily at 2 AM UTC)
 * Generates 7-day price forecasts for all skills
 */
async function runForecastGeneratorTask() {
  if (isGeneratingForecasts) {
    logger.info('forecast_generator_skip', { message: 'Previous forecast generation still running, skipping...' });
    return;
  }

  isGeneratingForecasts = true;
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  logger.info('forecast_generator_scheduled_run', { timestamp });

  try {
    const result = await generateAllForecasts();

    const duration = Date.now() - startTime;
    logger.info('forecast_generator_scheduled_complete', {
      duration: `${duration}ms`,
      skillsProcessed: result.skills,
      forecastsGenerated: result.forecastsGenerated,
      errors: result.errors.length
    });

    if (result.errors.length > 0) {
      logger.warn('forecast_generator_errors', { errors: result.errors });
    }
  } catch (error) {
    logger.error(`forecast_generator_scheduled_failed: ${error.message}`);
  } finally {
    isGeneratingForecasts = false;
  }
}

/**
 * Start the crawler scheduler
 * @param {string} schedule - Cron schedule string (default: every 5 minutes)
 */
export function startScheduler(schedule = '*/5 * * * *') {
  if (cronJob) {
    console.log('[scheduler] Scheduler already running');
    return;
  }

  console.log(`[scheduler] Starting crawler scheduler: ${schedule}`);

  // Validate cron expression
  if (!cron.validate(schedule)) {
    throw new Error(`Invalid cron schedule: ${schedule}`);
  }

  // Create cron job
  cronJob = cron.schedule(schedule, runCrawlerTask, {
    scheduled: true,
    timezone: 'UTC'
  });

  // Run immediately on startup
  console.log('[scheduler] Running initial crawl...');
  runCrawlerTask();

  return cronJob;
}

/**
 * Start the alert checker scheduler
 * @param {string} schedule - Cron schedule string (default: every 5 minutes)
 */
export function startAlertChecker(schedule = '*/5 * * * *') {
  if (alertCheckerJob) {
    logger.info('alert_checker_scheduler_already_running', { message: 'Alert checker already running' });
    return;
  }

  logger.info('alert_checker_scheduler_start', { schedule });

  // Validate cron expression
  if (!cron.validate(schedule)) {
    throw new Error(`Invalid cron schedule for alert checker: ${schedule}`);
  }

  // Create cron job
  alertCheckerJob = cron.schedule(schedule, runAlertCheckerTask, {
    scheduled: true,
    timezone: 'UTC'
  });

  // Run immediately on startup (optional: check if alerts exist first)
  logger.info('alert_checker_initial_run', { message: 'Running initial alert check...' });
  runAlertCheckerTask();

  return alertCheckerJob;
}

/**
 * Stop the crawler scheduler
 */
export function stopScheduler() {
  if (cronJob) {
    console.log('[scheduler] Stopping crawler scheduler');
    cronJob.stop();
    cronJob = null;
  } else {
    console.log('[scheduler] No scheduler running');
  }
}

/**
 * Stop the alert checker scheduler
 */
export function stopAlertChecker() {
  if (alertCheckerJob) {
    logger.info('alert_checker_scheduler_stop', { message: 'Stopping alert checker' });
    alertCheckerJob.stop();
    alertCheckerJob = null;
  } else {
    logger.info('alert_checker_scheduler_not_running', { message: 'No alert checker running' });
  }
}

/**
 * Start the forecast generator scheduler
 * @param {string} schedule - Cron schedule string (default: daily at 2 AM UTC)
 */
export function startForecastGenerator(schedule = '0 2 * * *') {
  if (forecastGeneratorJob) {
    logger.info('forecast_generator_scheduler_already_running', { message: 'Forecast generator already running' });
    return;
  }

  logger.info('forecast_generator_scheduler_start', { schedule });

  // Validate cron expression
  if (!cron.validate(schedule)) {
    throw new Error(`Invalid cron schedule for forecast generator: ${schedule}`);
  }

  // Create cron job (daily at 2 AM UTC)
  forecastGeneratorJob = cron.schedule(schedule, runForecastGeneratorTask, {
    scheduled: true,
    timezone: 'UTC'
  });

  // Optional: Run immediately on startup (commented out by default to avoid heavy load)
  // logger.info('forecast_generator_initial_run', { message: 'Running initial forecast generation...' });
  // runForecastGeneratorTask();

  return forecastGeneratorJob;
}

/**
 * Stop the forecast generator scheduler
 */
export function stopForecastGenerator() {
  if (forecastGeneratorJob) {
    logger.info('forecast_generator_scheduler_stop', { message: 'Stopping forecast generator' });
    forecastGeneratorJob.stop();
    forecastGeneratorJob = null;
  } else {
    logger.info('forecast_generator_scheduler_not_running', { message: 'No forecast generator running' });
  }
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus() {
  return {
    crawlerRunning: cronJob !== null,
    crawling: isRunning,
    alertCheckerRunning: alertCheckerJob !== null,
    checkingAlerts: isCheckingAlerts,
    forecastGeneratorRunning: forecastGeneratorJob !== null,
    generatingForecasts: isGeneratingForecasts,
    lastRun: cronJob ? new Date().toISOString() : null
  };
}
