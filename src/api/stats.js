/**
 * Agent Rate Oracle — Stats API Endpoints
 *
 * Provides REST API for system statistics and analytics:
 * - GET /v1/stats — Global statistics (provider count, service count, etc.)
 * - GET /v1/stats/volatility — Most volatile categories in last 7 days
 */

import express from 'express';
import { getAll, getOne } from '../db/database.js';
import logger from '../logger.js';

const router = express.Router();

/**
 * GET /v1/stats
 * Returns global system statistics
 */
router.get('/', (req, res) => {
  try {
    // Total counts
    const totalProviders = getOne('SELECT COUNT(*) as count FROM providers')?.count || 0;
    const totalServices = getOne('SELECT COUNT(*) as count FROM services')?.count || 0;
    const totalRates = getOne('SELECT COUNT(*) as count FROM rates')?.count || 0;

    // Categories count (distinct category + subcategory pairs)
    const categoriesCount = getOne(`
      SELECT COUNT(DISTINCT category || ':' || subcategory) as count
      FROM services
    `)?.count || 0;

    // Last crawl time (most recent rate update)
    const lastCrawl = getOne(`
      SELECT MAX(created_at) as lastCrawl
      FROM rates
    `);

    // Average confidence score across all rates
    const avgConfidence = getOne(`
      SELECT AVG(confidence) as avgConfidence
      FROM rates
    `);

    // Data points in history table
    const totalDataPoints = getOne('SELECT COUNT(*) as count FROM rate_history')?.count || 0;

    // Most active provider (most services)
    const mostActiveProvider = getOne(`
      SELECT p.name, COUNT(s.id) as serviceCount
      FROM providers p
      JOIN services s ON p.id = s.provider_id
      GROUP BY p.id
      ORDER BY serviceCount DESC
      LIMIT 1
    `);

    // Price range stats
    const priceStats = getOne(`
      SELECT
        MIN(price) as minPrice,
        MAX(price) as maxPrice,
        AVG(price) as avgPrice
      FROM rates
    `);

    res.json({
      success: true,
      data: {
        totalProviders,
        totalServices,
        totalRates,
        totalDataPoints,
        categoriesCount,
        lastCrawlTime: lastCrawl?.lastCrawl || null,
        averageConfidence: avgConfidence?.avgConfidence
          ? parseFloat(avgConfidence.avgConfidence.toFixed(4))
          : 0,
        mostActiveProvider: mostActiveProvider
          ? {
              name: mostActiveProvider.name,
              serviceCount: mostActiveProvider.serviceCount
            }
          : null,
        priceRange: {
          min: priceStats?.minPrice || 0,
          max: priceStats?.maxPrice || 0,
          avg: priceStats?.avgPrice ? parseFloat(priceStats.avgPrice.toFixed(6)) : 0
        }
      },
      meta: {
        timestamp: new Date().toISOString(),
        apiVersion: '0.1.0'
      }
    });
  } catch (error) {
    logger.error('stats_error', { endpoint: 'GET /v1/stats', error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
      meta: {
        timestamp: new Date().toISOString(),
        apiVersion: '0.1.0'
      }
    });
  }
});

/**
 * GET /v1/stats/volatility
 * Returns top 10 most volatile categories in last 7 days
 * Volatility = coefficient of variation (stddev / mean)
 */
router.get('/volatility', (req, res) => {
  try {
    // Calculate volatility for each category/subcategory based on price history
    const volatilityData = getAll(`
      SELECT
        s.category,
        s.subcategory,
        COUNT(DISTINCT rh.id) as dataPoints,
        AVG(rh.price) as avgPrice,
        MIN(rh.price) as minPrice,
        MAX(rh.price) as maxPrice,
        (MAX(rh.price) - MIN(rh.price)) / AVG(rh.price) as volatility,
        MAX(rh.recorded_at) as lastUpdate
      FROM rate_history rh
      JOIN services s ON rh.service_id = s.id
      WHERE rh.recorded_at >= datetime('now', '-7 days')
      GROUP BY s.category, s.subcategory
      HAVING dataPoints >= 5
      ORDER BY volatility DESC
      LIMIT 10
    `);

    // Transform to more readable format
    const results = volatilityData.map((row, index) => ({
      rank: index + 1,
      category: row.category,
      subcategory: row.subcategory,
      volatility: parseFloat((row.volatility * 100).toFixed(2)), // As percentage
      priceRange: {
        min: parseFloat(row.minPrice.toFixed(6)),
        max: parseFloat(row.maxPrice.toFixed(6)),
        avg: parseFloat(row.avgPrice.toFixed(6))
      },
      dataPoints: row.dataPoints,
      lastUpdate: row.lastUpdate
    }));

    // Also calculate current market volatility (last 24h vs 7d)
    const recentVolatility = getOne(`
      SELECT
        AVG(CASE WHEN rh.recorded_at >= datetime('now', '-1 day')
          THEN rh.price END) as price24h,
        AVG(CASE WHEN rh.recorded_at >= datetime('now', '-7 days')
          THEN rh.price END) as price7d
      FROM rate_history rh
    `);

    const marketTrend =
      recentVolatility?.price24h && recentVolatility?.price7d
        ? ((recentVolatility.price24h - recentVolatility.price7d) / recentVolatility.price7d * 100)
        : 0;

    res.json({
      success: true,
      data: {
        topVolatile: results,
        marketTrend: {
          change24h: parseFloat(marketTrend.toFixed(2)),
          direction: marketTrend > 0 ? 'up' : marketTrend < 0 ? 'down' : 'stable'
        }
      },
      meta: {
        timestamp: new Date().toISOString(),
        apiVersion: '0.1.0',
        period: '7 days',
        count: results.length
      }
    });
  } catch (error) {
    logger.error('stats_error', { endpoint: 'GET /v1/stats/volatility', error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch volatility data',
      meta: {
        timestamp: new Date().toISOString(),
        apiVersion: '0.1.0'
      }
    });
  }
});

export default router;
