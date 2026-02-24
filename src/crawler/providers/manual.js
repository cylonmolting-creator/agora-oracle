import { readFileSync } from 'fs';
import { join } from 'path';
import { getDb, runQuery, getOne, transaction } from '../../db/database.js';
import logger from '../../logger.js';

/**
 * Seeds the database with manually collected provider data from data/providers.json
 * Handles upsert logic to avoid duplicates
 * @returns {Object} Seeding statistics
 */
export const seedFromManualData = () => {
  try {
    // Read providers.json
    const providersPath = join(process.cwd(), 'data', 'providers.json');
    const data = JSON.parse(readFileSync(providersPath, 'utf-8'));

    let providersInserted = 0;
    let servicesInserted = 0;
    let ratesInserted = 0;
    let providersUpdated = 0;

    // Use transaction for atomic operation
    const result = transaction(() => {
      for (const provider of data.providers) {
        // Check if provider exists
        const existingProvider = getOne(
          'SELECT id FROM providers WHERE name = ?',
          [provider.name]
        );

        let providerId;

        if (existingProvider) {
          // Update existing provider
          runQuery(
            'UPDATE providers SET url = ?, type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [provider.url, provider.type, existingProvider.id]
          );
          providerId = existingProvider.id;
          providersUpdated++;
        } else {
          // Insert new provider
          const providerResult = runQuery(
            'INSERT INTO providers (name, url, type) VALUES (?, ?, ?)',
            [provider.name, provider.url, provider.type]
          );
          providerId = providerResult.lastInsertRowid;
          providersInserted++;
        }

        // Process each service for this provider
        for (const service of provider.services) {
          // Check if service exists (by provider_id, category, subcategory, description)
          const existingService = getOne(
            'SELECT id FROM services WHERE provider_id = ? AND category = ? AND subcategory = ? AND description = ?',
            [providerId, service.category, service.subcategory || '', service.description || '']
          );

          let serviceId;

          if (existingService) {
            // Update existing service
            runQuery(
              'UPDATE services SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
              [existingService.id]
            );
            serviceId = existingService.id;
          } else {
            // Insert new service
            const serviceResult = runQuery(
              'INSERT INTO services (provider_id, category, subcategory, description) VALUES (?, ?, ?, ?)',
              [providerId, service.category, service.subcategory || '', service.description || '']
            );
            serviceId = serviceResult.lastInsertRowid;
            servicesInserted++;
          }

          // Determine pricing details
          const pricing = service.pricing;
          let price;
          let unit = pricing.unit || 'request';
          let pricingType = pricing.type || 'per-request';

          // Handle different pricing structures
          if (pricing.inputPrice !== undefined && pricing.outputPrice !== undefined) {
            // For token-based pricing, use average of input/output
            price = (pricing.inputPrice + pricing.outputPrice) / 2;
          } else if (pricing.base !== undefined) {
            price = pricing.base;
          } else if (pricing.price !== undefined) {
            price = pricing.price;
          } else {
            logger.warn('manual_seed_no_price', { service: service.description });
            continue;
          }

          // Check if rate exists for this service
          const existingRate = getOne(
            'SELECT id FROM rates WHERE service_id = ?',
            [serviceId]
          );

          if (existingRate) {
            // Update existing rate
            runQuery(
              'UPDATE rates SET price = ?, currency = ?, unit = ?, pricing_type = ?, confidence = 1.0, source_count = 1 WHERE id = ?',
              [price, pricing.currency || 'USD', unit, pricingType, existingRate.id]
            );
          } else {
            // Insert new rate
            runQuery(
              'INSERT INTO rates (service_id, price, currency, unit, pricing_type, confidence, source_count) VALUES (?, ?, ?, ?, ?, 1.0, 1)',
              [serviceId, price, pricing.currency || 'USD', unit, pricingType]
            );
            ratesInserted++;
          }
        }
      }

      return { providersInserted, providersUpdated, servicesInserted, ratesInserted };
    });

    logger.info('manual_seed_complete', {
      providersInserted: result.providersInserted,
      providersUpdated: result.providersUpdated,
      servicesInserted: result.servicesInserted,
      ratesInserted: result.ratesInserted
    });

    return {
      success: true,
      stats: result,
      totalProviders: result.providersInserted + result.providersUpdated,
      totalServices: result.servicesInserted,
      totalRates: result.ratesInserted
    };
  } catch (error) {
    logger.error('manual_seed_failed', { error: error.message, stack: error.stack });
    return {
      success: false,
      error: error.message
    };
  }
};

export default { seedFromManualData };
