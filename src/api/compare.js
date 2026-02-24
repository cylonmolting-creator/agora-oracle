/**
 * compare.js — Express router for price comparison
 * 
 * Endpoint:
 * GET /v1/compare?category=X&providers=a,b,c
 * 
 * Side-by-side price comparison for multiple providers in a category
 * Returns table-friendly data sorted by price ascending
 */

import express from 'express';
import { getAll, getOne } from '../db/database.js';
import logger from '../logger.js';

const router = express.Router();

/**
 * GET /v1/compare
 * Compare prices across multiple providers for a specific category
 * 
 * Query params:
 *   - category: required - service category (e.g., "text-generation")
 *   - subcategory: optional - specific subcategory (e.g., "general")
 *   - providers: optional - comma-separated provider IDs (e.g., "1,2,3")
 *                If not provided, compares all providers in the category
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     category: "text-generation",
 *     subcategory: "general",
 *     comparison: [
 *       {
 *         ranking: 1,
 *         provider: {id: 1, name: "OpenAI", url: "...", type: "llm"},
 *         price: 7.50,
 *         currency: "USD",
 *         unit: "per million tokens",
 *         pricingType: "per-token",
 *         confidence: 0.95,
 *         sla: {uptime: null, latency_p95_ms: null}
 *       },
 *       ...
 *     ]
 *   },
 *   meta: {...}
 * }
 */
router.get('/', (req, res) => {
  try {
    const { category, subcategory, providers } = req.query;

    // Validate category is provided
    if (!category) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: category',
        meta: {
          timestamp: new Date().toISOString(),
          apiVersion: '0.1.0'
        }
      });
    }

    // Build query for services and rates
    let query = `
      SELECT
        p.id as provider_id,
        p.name as provider_name,
        p.url as provider_url,
        p.type as provider_type,
        s.id as service_id,
        s.category,
        s.subcategory,
        s.description,
        r.price,
        r.currency,
        r.unit,
        r.pricing_type,
        r.confidence,
        r.source_count,
        r.created_at as rate_updated_at
      FROM services s
      JOIN providers p ON s.provider_id = p.id
      LEFT JOIN rates r ON s.id = r.service_id
      WHERE s.category = ?
    `;

    const params = [category];

    // Filter by subcategory if provided
    if (subcategory) {
      query += ' AND s.subcategory = ?';
      params.push(subcategory);
    }

    // Filter by provider IDs or names if provided
    if (providers) {
      const providerList = providers.split(',').map(p => p.trim()).filter(p => p);
      if (providerList.length > 0) {
        const ids = providerList.filter(p => /^\d+$/.test(p));
        const names = providerList.filter(p => !/^\d+$/.test(p));

        const conditions = [];
        if (ids.length > 0) {
          const placeholders = ids.map(() => '?').join(',');
          conditions.push(`p.id IN (${placeholders})`);
          params.push(...ids);
        }
        if (names.length > 0) {
          const placeholders = names.map(() => '?').join(',');
          conditions.push(`p.name IN (${placeholders})`);
          params.push(...names);
        }
        if (conditions.length > 0) {
          query += ` AND (${conditions.join(' OR ')})`;
        }
      }
    }

    // Only include services with pricing data
    query += ' AND r.price IS NOT NULL';

    // Order by price ascending (cheapest first)
    query += ' ORDER BY r.price ASC';

    const results = getAll(query, params);

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No pricing data found for the specified category/providers',
        meta: {
          timestamp: new Date().toISOString(),
          apiVersion: '0.1.0'
        }
      });
    }

    // Transform results into comparison format with ranking
    const prices = results.map(r => r.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    const comparison = results.map((row, index) => ({
      ranking: index + 1,
      provider: row.provider_name,
      providerId: row.provider_id,
      providerUrl: row.provider_url,
      providerType: row.provider_type,
      subcategory: row.subcategory,
      description: row.description,
      price: parseFloat(row.price.toFixed(6)),
      currency: row.currency || 'USD',
      unit: row.unit,
      pricingType: row.pricing_type,
      confidence: parseFloat(row.confidence.toFixed(3)),
      sourceCount: row.source_count,
      relativeCost: parseFloat((row.price / minPrice).toFixed(2)),
      updatedAt: row.rate_updated_at,
      sla: {
        uptime: null,  // TODO: fetch from SLA table when available
        latency_p95_ms: null
      }
    }));

    // Get unique providers
    const uniqueProviders = [...new Set(results.map(r => r.provider_id))];

    // Calculate summary
    const summary = {
      category,
      subcategory: subcategory || 'all',
      providersCompared: uniqueProviders.length,
      servicesCompared: comparison.length,
      priceRange: {
        min: parseFloat(minPrice.toFixed(6)),
        max: parseFloat(maxPrice.toFixed(6)),
        avg: parseFloat((prices.reduce((sum, p) => sum + p, 0) / prices.length).toFixed(6)),
        median: parseFloat(prices[Math.floor(prices.length / 2)].toFixed(6))
      },
      cheapest: {
        provider: comparison[0].provider,
        price: comparison[0].price,
        unit: comparison[0].unit
      },
      mostExpensive: {
        provider: comparison[comparison.length - 1].provider,
        price: comparison[comparison.length - 1].price,
        unit: comparison[comparison.length - 1].unit
      },
      costSpread: `${parseFloat((maxPrice / minPrice).toFixed(2))}x`
    };

    res.json({
      success: true,
      data: {
        summary,
        comparison
      },
      meta: {
        timestamp: new Date().toISOString(),
        apiVersion: '0.1.0',
        count: comparison.length,
        filters: {
          category,
          subcategory: subcategory || null,
          providers: providers || 'all'
        }
      }
    });
  } catch (error) {
    logger.error('compare_error', { endpoint: 'GET /v1/compare', error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch comparison data',
      message: error.message,
      meta: {
        timestamp: new Date().toISOString(),
        apiVersion: '0.1.0'
      }
    });
  }
});

export default router;
