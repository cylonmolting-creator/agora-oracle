/**
 * providers.js — Express router for provider endpoints
 *
 * Routes:
 * - GET /v1/providers — List all providers with service count
 * - GET /v1/providers/:id — Specific provider with all services and current prices
 *
 * Features:
 * - Sorting by price (asc/desc)
 * - Filtering by category
 * - Provider detail with service list
 * - Current pricing for each service
 */

import express from 'express';
import { getAll, getOne } from '../db/database.js';
import logger from '../logger.js';

const router = express.Router();

/**
 * GET /v1/providers
 * List all providers with service count, sorted by name
 *
 * Query params:
 * - sortByPrice: "asc" | "desc" (sorts by avg service price)
 * - category: filter by service category
 *
 * Response:
 * {
 *   success: true,
 *   data: [
 *     {
 *       id: 1,
 *       name: "OpenAI",
 *       url: "https://openai.com",
 *       type: "llm",
 *       serviceCount: 4,
 *       avgPrice: 3.75,
 *       currency: "USD",
 *       categories: ["text-generation"]
 *     }
 *   ],
 *   meta: {
 *     timestamp: "2026-02-24T00:31:00.000Z",
 *     apiVersion: "0.1.0",
 *     count: 20
 *   }
 * }
 */
router.get('/', (req, res) => {
  try {
    const { sortByPrice, category } = req.query;

    // Base query: providers with service count and average price
    let sql = `
      SELECT
        p.id,
        p.name,
        p.url,
        p.type,
        COUNT(DISTINCT s.id) as serviceCount,
        AVG(r.price) as avgPrice,
        r.currency,
        GROUP_CONCAT(DISTINCT s.category) as categories
      FROM providers p
      LEFT JOIN services s ON p.id = s.provider_id
      LEFT JOIN rates r ON s.id = r.service_id
    `;

    // Apply category filter if provided
    const params = [];
    if (category) {
      sql += ` WHERE s.category = ?`;
      params.push(category);
    }

    sql += ` GROUP BY p.id`;

    // Apply sorting
    if (sortByPrice === 'asc') {
      sql += ` ORDER BY avgPrice ASC`;
    } else if (sortByPrice === 'desc') {
      sql += ` ORDER BY avgPrice DESC`;
    } else {
      sql += ` ORDER BY p.name ASC`;
    }

    const providers = getAll(sql, params);

    // Transform data: parse categories as array
    const data = providers.map(p => ({
      id: p.id,
      name: p.name,
      url: p.url,
      type: p.type,
      serviceCount: p.serviceCount || 0,
      avgPrice: p.avgPrice ? parseFloat(p.avgPrice.toFixed(4)) : null,
      currency: p.currency || 'USD',
      categories: p.categories ? p.categories.split(',') : []
    }));

    res.json({
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        apiVersion: '0.1.0',
        count: data.length
      }
    });
  } catch (error) {
    logger.error('providers_error', { endpoint: 'GET /v1/providers', error: error.message });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /v1/providers/:id
 * Get specific provider with all services and current prices
 *
 * Query params:
 * - sortByPrice: "asc" | "desc" (sorts services by price)
 * - category: filter services by category
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     provider: {
 *       id: 1,
 *       name: "OpenAI",
 *       url: "https://openai.com",
 *       type: "llm",
 *       serviceCount: 4,
 *       avgPrice: 3.75
 *     },
 *     services: [
 *       {
 *         id: 1,
 *         category: "text-generation",
 *         subcategory: "general",
 *         description: "GPT-4o",
 *         price: 7.50,
 *         currency: "USD",
 *         unit: "per million tokens",
 *         pricingType: "per-token",
 *         confidence: 0.95,
 *         lastUpdated: "2026-02-24T00:15:00.000Z"
 *       }
 *     ]
 *   },
 *   meta: {
 *     timestamp: "2026-02-24T00:31:00.000Z",
 *     apiVersion: "0.1.0",
 *     serviceCount: 4
 *   }
 * }
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { sortByPrice, category } = req.query;

    // Get provider info
    const provider = getOne(
      'SELECT id, name, url, type, created_at, updated_at FROM providers WHERE id = ?',
      [id]
    );

    if (!provider) {
      return res.status(404).json({
        success: false,
        error: 'Provider not found',
        message: `Provider with id ${id} does not exist`
      });
    }

    // Get services with current rates
    let sql = `
      SELECT
        s.id,
        s.category,
        s.subcategory,
        s.description,
        r.price,
        r.currency,
        r.unit,
        r.pricing_type as pricingType,
        r.confidence,
        r.created_at as lastUpdated
      FROM services s
      LEFT JOIN rates r ON s.id = r.service_id
      WHERE s.provider_id = ?
    `;

    const params = [id];

    // Apply category filter
    if (category) {
      sql += ` AND s.category = ?`;
      params.push(category);
    }

    // Apply sorting
    if (sortByPrice === 'asc') {
      sql += ` ORDER BY r.price ASC`;
    } else if (sortByPrice === 'desc') {
      sql += ` ORDER BY r.price DESC`;
    } else {
      sql += ` ORDER BY s.category ASC, s.subcategory ASC`;
    }

    const services = getAll(sql, params);

    // Calculate average price
    const prices = services.map(s => s.price).filter(p => p !== null);
    const avgPrice = prices.length > 0
      ? parseFloat((prices.reduce((sum, p) => sum + p, 0) / prices.length).toFixed(4))
      : null;

    res.json({
      success: true,
      data: {
        provider: {
          id: provider.id,
          name: provider.name,
          url: provider.url,
          type: provider.type,
          serviceCount: services.length,
          avgPrice
        },
        services: services.map(s => ({
          id: s.id,
          category: s.category,
          subcategory: s.subcategory,
          description: s.description,
          price: s.price,
          currency: s.currency || 'USD',
          unit: s.unit,
          pricingType: s.pricingType,
          confidence: s.confidence,
          lastUpdated: s.lastUpdated
        }))
      },
      meta: {
        timestamp: new Date().toISOString(),
        apiVersion: '0.1.0',
        serviceCount: services.length
      }
    });
  } catch (error) {
    logger.error('providers_error', { endpoint: `GET /v1/providers/${req.params.id}`, error: error.message });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

export default router;
