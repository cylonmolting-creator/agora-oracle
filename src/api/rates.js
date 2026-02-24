/**
 * Agent Rate Oracle — Rates API Endpoints
 *
 * Provides REST API for querying aggregated rate data:
 * - GET /v1/rates — All categories with latest aggregate prices
 * - GET /v1/rates/:category — Specific category with all subcategories
 * - GET /v1/rates/:category/:subcategory — Specific rate with full detail
 */

import express from 'express';
import { aggregateRates, aggregateAllCategories } from '../aggregator/index.js';
import { getAll } from '../db/database.js';
import { cache } from '../server.js';
import logger from '../logger.js';

const router = express.Router();

/**
 * GET /v1/rates
 * Returns all categories with their latest aggregated prices
 */
router.get('/', (req, res) => {
  try {
    // Check cache first
    const cacheKey = 'rates:all';
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const aggregated = aggregateAllCategories();

    // Transform to array format for easier consumption
    const rates = Object.entries(aggregated).map(([key, data]) => ({
      category: data.category,
      subcategory: data.subcategory,
      price: data.price,
      currency: data.currency,
      unit: data.unit,
      confidence: data.confidence,
      trend: data.trend,
      lastUpdated: data.lastUpdated
    }));

    const response = {
      success: true,
      data: rates,
      meta: {
        timestamp: new Date().toISOString(),
        apiVersion: '0.1.0',
        count: rates.length
      }
    };

    // Cache for 5 minutes
    cache.set(cacheKey, response);

    res.json(response);
  } catch (error) {
    logger.error('rates_fetch_error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rates',
      meta: {
        timestamp: new Date().toISOString(),
        apiVersion: '0.1.0'
      }
    });
  }
});

/**
 * GET /v1/rates/:category
 * Returns specific category with all subcategories
 */
router.get('/:category', (req, res) => {
  try {
    const { category } = req.params;

    // Check cache
    const cacheKey = `rates:${category}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Get all subcategories for this category
    const subcategoriesResult = getAll(`
      SELECT DISTINCT subcategory
      FROM services
      WHERE category = ?
      ORDER BY subcategory
    `, [category]);

    if (subcategoriesResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Category '${category}' not found`,
        meta: {
          timestamp: new Date().toISOString(),
          apiVersion: '0.1.0'
        }
      });
    }

    // Aggregate rates for each subcategory
    const rates = [];
    for (const { subcategory } of subcategoriesResult) {
      const result = aggregateRates(category, subcategory);
      if (result) {
        rates.push(result);
      }
    }

    // Also get category-level aggregate (no subcategory filter)
    const categoryAggregate = aggregateRates(category);

    const response = {
      success: true,
      data: {
        category,
        aggregate: categoryAggregate,
        subcategories: rates
      },
      meta: {
        timestamp: new Date().toISOString(),
        apiVersion: '0.1.0',
        subcategoryCount: rates.length
      }
    };

    // Cache for 5 minutes
    cache.set(cacheKey, response);

    res.json(response);
  } catch (error) {
    logger.error('category_rates_error', { category: req.params.category, error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch category rates',
      meta: {
        timestamp: new Date().toISOString(),
        apiVersion: '0.1.0'
      }
    });
  }
});

/**
 * GET /v1/rates/:category/:subcategory
 * Returns specific rate with full detail including history
 */
router.get('/:category/:subcategory', (req, res) => {
  try {
    const { category, subcategory } = req.params;

    // Check cache
    const cacheKey = `rates:${category}:${subcategory}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Get aggregated rate
    const aggregate = aggregateRates(category, subcategory);

    if (!aggregate) {
      return res.status(404).json({
        success: false,
        error: `No rates found for ${category}:${subcategory}`,
        meta: {
          timestamp: new Date().toISOString(),
          apiVersion: '0.1.0'
        }
      });
    }

    // Get individual provider rates for this category/subcategory
    const providerRates = getAll(`
      SELECT
        p.name as provider,
        p.url as providerUrl,
        s.description as service,
        r.price,
        r.currency,
        r.unit,
        r.pricing_type as pricingType,
        r.confidence,
        r.created_at as lastUpdated
      FROM rates r
      JOIN services s ON r.service_id = s.id
      JOIN providers p ON s.provider_id = p.id
      WHERE s.category = ? AND s.subcategory = ?
      ORDER BY r.price ASC
    `, [category, subcategory]);

    // Get 30-day price history
    const history = getAll(`
      SELECT
        DATE(rh.recorded_at) as date,
        AVG(rh.price) as avgPrice,
        MIN(rh.price) as minPrice,
        MAX(rh.price) as maxPrice,
        COUNT(*) as dataPoints
      FROM rate_history rh
      JOIN services s ON rh.service_id = s.id
      WHERE s.category = ?
        AND s.subcategory = ?
        AND rh.recorded_at >= datetime('now', '-30 days')
      GROUP BY DATE(rh.recorded_at)
      ORDER BY date ASC
    `, [category, subcategory]);

    const response = {
      success: true,
      data: {
        aggregate,
        providers: providerRates,
        history: history.map(row => ({
          date: row.date,
          avgPrice: row.avgPrice ? parseFloat(row.avgPrice.toFixed(6)) : 0,
          minPrice: row.minPrice ? parseFloat(row.minPrice.toFixed(6)) : 0,
          maxPrice: row.maxPrice ? parseFloat(row.maxPrice.toFixed(6)) : 0,
          dataPoints: row.dataPoints
        }))
      },
      meta: {
        timestamp: new Date().toISOString(),
        apiVersion: '0.1.0',
        providerCount: providerRates.length,
        historyDays: history.length
      }
    };

    // Cache for 5 minutes
    cache.set(cacheKey, response);

    res.json(response);
  } catch (error) {
    logger.error('subcategory_rates_error', {
      category: req.params.category,
      subcategory: req.params.subcategory,
      error: error.message
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subcategory rates',
      meta: {
        timestamp: new Date().toISOString(),
        apiVersion: '0.1.0'
      }
    });
  }
});

export default router;
