/**
 * Crawler Orchestrator
 *
 * Runs all provider crawlers in parallel, collects results,
 * inserts new rates into database. Individual crawler failures
 * are handled gracefully — one failure doesn't stop others.
 */

import { getDb, runQuery, getOne } from '../db/database.js';
import { crawlOpenAI } from './providers/openai.js';
import logger from '../logger.js';
import { crawlAnthropic } from './providers/anthropic.js';
import { crawlX402Bazaar } from './providers/x402-bazaar.js';
import {
  createAgentService,
  getAgentServiceById,
  updateAgentServicePrice
} from '../db/agent-services.js';

/**
 * Crawl all providers in parallel
 * @returns {Promise<{providersChecked: number, newRates: number, errors: string[]}>}
 */
export async function crawlAll() {
  const startTime = Date.now();
  const results = {
    providersChecked: 0,
    newRates: 0,
    errors: []
  };

  // Define all crawlers (add more as we implement them)
  const crawlers = [
    { name: 'OpenAI', fn: crawlOpenAI, type: 'provider' },
    { name: 'Anthropic', fn: crawlAnthropic, type: 'provider' },
    { name: 'x402-bazaar', fn: crawlX402Bazaar, type: 'agent-service' }
  ];

  logger.info('crawler_start', { provider_count: crawlers.length });

  // Run all crawlers in parallel
  const crawlPromises = crawlers.map(async ({ name, fn, type }) => {
    try {
      const rates = await fn();
      return { name, success: true, rates, type };
    } catch (error) {
      return { name, success: false, error: error.message, type };
    }
  });

  // Wait for all crawlers (settled, not rejected)
  const crawlResults = await Promise.allSettled(crawlPromises);

  // Process results
  for (const result of crawlResults) {
    if (result.status === 'fulfilled') {
      const { name, success, rates, error, type } = result.value;

      results.providersChecked++;

      if (success && rates && rates.length > 0) {
        // Route to appropriate insert function based on type
        if (type === 'agent-service') {
          const inserted = await insertAgentServices(name, rates);
          results.newRates += inserted;
          logger.info('crawler_success', { provider: name, new_services: inserted, type });
        } else {
          // Standard provider rates
          const inserted = await insertRates(name, rates);
          results.newRates += inserted;
          logger.info('crawler_success', { provider: name, new_rates: inserted });
        }
      } else if (success && rates && rates.length === 0) {
        logger.info('crawler_no_data', { provider: name });
      } else {
        results.errors.push(`${name}: ${error}`);
        logger.error('crawler_failed', { provider: name, error: String(error) });
      }
    } else {
      // Promise itself rejected (shouldn't happen with our try-catch, but safety)
      results.errors.push(`Unknown crawler failed: ${result.reason}`);
      logger.error('crawler_unexpected', { reason: result.reason });
    }
  }

  const duration = Date.now() - startTime;
  logger.info('crawler_finished', { duration_ms: duration, providers_checked: results.providersChecked, new_rates: results.newRates, error_count: results.errors.length });

  return results;
}

/**
 * Insert rates from a provider into the database
 * @param {string} providerName - Name of the provider
 * @param {Array} rates - Array of rate objects
 * @returns {Promise<number>} - Number of rates inserted
 */
async function insertRates(providerName, rates) {
  const db = getDb();
  let insertedCount = 0;

  for (const rate of rates) {
    try {
      // Find provider in database
      const provider = await getOne(
        'SELECT id FROM providers WHERE name = ?',
        [providerName]
      );

      if (!provider) {
        logger.warn('provider_not_found', { provider: providerName });
        continue;
      }

      // Find or create service
      let service = await getOne(
        'SELECT id FROM services WHERE provider_id = ? AND category = ? AND subcategory = ?',
        [provider.id, rate.category, rate.subcategory || '']
      );

      if (!service) {
        // Create service
        const serviceResult = await runQuery(
          `INSERT INTO services (provider_id, category, subcategory, description)
           VALUES (?, ?, ?, ?)`,
          [provider.id, rate.category, rate.subcategory || '', rate.model || '']
        );
        service = { id: serviceResult.lastInsertRowid };
      }

      // Check if rate already exists (avoid duplicates)
      const existingRate = await getOne(
        `SELECT id FROM rates
         WHERE service_id = ?
         AND price = ?
         AND unit = ?
         AND created_at > datetime('now', '-5 minutes')`,
        [service.id, rate.price, rate.unit]
      );

      if (existingRate) {
        // Rate already exists and is fresh
        continue;
      }

      // Insert new rate
      await runQuery(
        `INSERT INTO rates (service_id, price, currency, unit, pricing_type, confidence, source_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          service.id,
          rate.price,
          rate.currency || 'USD',
          rate.unit || 'per-token',
          rate.pricingType || 'per-token',
          rate.confidence || 0.9,
          1 // source_count = 1 for individual crawler results
        ]
      );

      // Insert into rate_history
      await runQuery(
        `INSERT INTO rate_history (service_id, price, currency, unit, recorded_at)
         VALUES (?, ?, ?, ?, datetime('now'))`,
        [service.id, rate.price, rate.currency || 'USD', rate.unit || 'per-token']
      );

      insertedCount++;
    } catch (error) {
      logger.error('rate_insert_failed', { model: rate.model, error: error.message });
    }
  }

  return insertedCount;
}

/**
 * Insert agent services from x402 Bazaar into database
 * @param {string} providerName - Name of the source (e.g., "x402-bazaar")
 * @param {Array} services - Array of agent service objects
 * @returns {Promise<number>} - Number of services inserted/updated
 */
async function insertAgentServices(providerName, services) {
  let changeCount = 0;

  for (const service of services) {
    try {
      const { agentId, agentName, skill, price, unit, uptime, avgLatency, x402Endpoint, bazaarUrl, metadata } = service;

      // Check if service already exists
      const existing = getAgentServiceById(agentId);

      if (existing) {
        // Service exists — check if price changed
        if (existing.price !== price) {
          // Price changed → update
          updateAgentServicePrice(agentId, price);
          logger.info('agent_service_updated', {
            agentId,
            agentName,
            oldPrice: existing.price,
            newPrice: price
          });
          changeCount++;
        } else {
          // No price change → skip (use logger.info instead of debug)
          // logger.info('agent_service_unchanged', { agentId, price }); // Commented to reduce noise
        }
      } else {
        // New service → create
        createAgentService({
          agentId,
          agentName,
          skill,
          price,
          unit,
          uptime,
          avgLatency,
          x402Endpoint,
          bazaarUrl,
          metadata
        });
        logger.info('agent_service_created_new', {
          agentId,
          agentName,
          skill,
          price
        });
        changeCount++;
      }
    } catch (error) {
      logger.error('agent_service_insert_failed', {
        agentId: service.agentId,
        error: error.message
      });
    }
  }

  return changeCount;
}

/**
 * Run a single crawl cycle (used by scheduler)
 * @returns {Promise<Object>}
 */
export async function runCrawlCycle() {
  logger.info('crawler_cycle_start', {});
  const results = await crawlAll();

  if (results.errors.length > 0) {
    logger.warn('crawler_cycle_errors', { error_count: results.errors.length, errors: results.errors });
  }

  return results;
}
