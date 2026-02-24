/**
 * Agent Rate Oracle — Main Aggregation Engine
 *
 * Aggregates rates from multiple sources with:
 * - Outlier detection (IQR method)
 * - Confidence scoring
 * - Trend analysis (24h comparison)
 */

import { getAll } from '../db/database.js';
import { detectOutliers } from './outlier.js';
import { calculateConfidence } from './confidence.js';
import logger from '../logger.js';
import { getAgentServicesBySkill } from '../db/agent-services.js';

/**
 * Calculate median from sorted array
 * @param {number[]} sorted - Sorted array of numbers
 * @returns {number}
 */
function calculateMedian(sorted) {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];

  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Determine price trend (up/down/stable)
 * @param {number} currentPrice
 * @param {number|null} previousPrice
 * @returns {string} - "up", "down", or "stable"
 */
function calculateTrend(currentPrice, previousPrice) {
  if (!previousPrice) return 'stable';

  const changePercent = ((currentPrice - previousPrice) / previousPrice) * 100;

  // Threshold: ±5% for "stable"
  if (Math.abs(changePercent) < 5) return 'stable';
  return changePercent > 0 ? 'up' : 'down';
}

/**
 * Get historical price from 24h ago for trend analysis
 * @param {number} serviceId
 * @returns {number|null}
 */
function getPrevious24hPrice(serviceId) {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const sql = `
    SELECT price
    FROM rate_history
    WHERE service_id = ?
      AND recorded_at <= ?
    ORDER BY recorded_at DESC
    LIMIT 1
  `;

  const row = getAll(sql, [serviceId, cutoff])[0];
  return row ? row.price : null;
}

/**
 * Aggregate rates for a specific category/subcategory
 *
 * @param {string} category - Service category (e.g., "text-generation")
 * @param {string} [subcategory] - Optional subcategory (e.g., "chat")
 * @returns {Object|null} Aggregated rate data
 *
 * @example
 * aggregateRates("text-generation", "chat")
 * // => {
 * //   price: 0.0025,
 * //   currency: "USD",
 * //   unit: "per-token",
 * //   confidence: 0.85,
 * //   sourceCount: 7,
 * //   lastUpdated: "2026-02-24T00:25:56.000Z",
 * //   trend: "stable",
 * //   category: "text-generation",
 * //   subcategory: "chat"
 * // }
 */
export function aggregateRates(category, subcategory = null) {
  try {
    // Build SQL query
    let sql = `
      SELECT
        r.id,
        r.price,
        r.currency,
        r.unit,
        r.pricing_type,
        r.created_at,
        r.service_id,
        s.category,
        s.subcategory,
        p.name as provider_name
      FROM rates r
      JOIN services s ON r.service_id = s.id
      JOIN providers p ON s.provider_id = p.id
      WHERE s.category = ?
    `;

    const params = [category];

    if (subcategory) {
      sql += ' AND s.subcategory = ?';
      params.push(subcategory);
    }

    sql += ' ORDER BY r.created_at DESC';

    // Fetch rates
    const rows = getAll(sql, params);

    if (rows.length === 0) {
      return null; // No data available
    }

    // Transform to outlier detection format
    const ratesForDetection = rows.map(row => ({
      price: row.price,
      source: row.provider_name,
      timestamp: new Date(row.created_at).getTime(),
      serviceId: row.service_id
    }));

    // Step 1: Detect and remove outliers
    const { filtered, removed, stats: outlierStats } = detectOutliers(ratesForDetection);

    if (filtered.length === 0) {
      return null; // All rates were outliers
    }

    // Step 2: Calculate median price
    const prices = filtered.map(r => r.price);
    const sortedPrices = [...prices].sort((a, b) => a - b);
    const medianPrice = calculateMedian(sortedPrices);

    // Step 3: Calculate confidence score
    const confidence = calculateConfidence(filtered);

    // Step 4: Determine trend
    // Get service_id from first row (all should be same category/subcategory)
    if (filtered.length === 0) {
      return null; // Safety check (should not happen)
    }
    const firstServiceId = filtered[0].serviceId;
    const previous24hPrice = getPrevious24hPrice(firstServiceId);
    const trend = calculateTrend(medianPrice, previous24hPrice);

    // Step 5: Extract metadata
    const currency = rows[0].currency;
    const unit = rows[0].unit;
    const lastUpdated = new Date(
      Math.max(...filtered.map(r => r.timestamp))
    ).toISOString();

    // Return aggregated result
    return {
      price: parseFloat(medianPrice.toFixed(6)),
      currency,
      unit,
      confidence: parseFloat(confidence.toFixed(3)),
      sourceCount: filtered.length,
      lastUpdated,
      trend,
      category,
      subcategory: subcategory || null,
      meta: {
        outliersRemoved: removed.length,
        totalRatesCollected: rows.length,
        medianUsed: true
      }
    };
  } catch (error) {
    logger.error('aggregation_failed', { category, subcategory, error: error.message });
    throw error;
  }
}

/**
 * Aggregate all rates grouped by category
 * @returns {Object} - Category-keyed aggregated rates
 */
export function aggregateAllCategories() {
  try {
    // Get all unique categories
    const categoriesResult = getAll(`
      SELECT DISTINCT category, subcategory
      FROM services
      ORDER BY category, subcategory
    `);

    const aggregated = {};

    for (const { category, subcategory } of categoriesResult) {
      const key = subcategory ? `${category}:${subcategory}` : category;

      const result = aggregateRates(category, subcategory);
      if (result) {
        aggregated[key] = result;
      }
    }

    return aggregated;
  } catch (error) {
    logger.error('aggregate_all_failed', { error: error.message });
    return {};
  }
}

/**
 * Calculate standard deviation
 * @param {number[]} values
 * @param {number} mean
 * @returns {number}
 */
function calculateStdDev(values, mean) {
  if (values.length === 0) return 0;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Aggregate agent service stats for a specific skill
 *
 * @param {string} skill - Skill category (e.g., "text-generation/chat")
 * @returns {Object|null} Aggregated stats for agent services
 *
 * @example
 * aggregateAgentServiceStats("text-generation/chat")
 * // => {
 * //   skill: "text-generation/chat",
 * //   marketMedian: 0.015,
 * //   priceRange: { min: 0.01, max: 0.025 },
 * //   avgPrice: 0.0165,
 * //   stdDeviation: 0.0062,
 * //   avgUptime: 99.6,
 * //   avgLatency: 245,
 * //   avgRating: 4.7,
 * //   totalAgents: 4,
 * //   outliers: []
 * // }
 */
export function aggregateAgentServiceStats(skill) {
  try {
    // Fetch all agent services for the skill
    const services = getAgentServicesBySkill(skill);

    if (!services || services.length === 0) {
      logger.info('agent_service_stats_empty', { skill });
      return null;
    }

    // Extract prices for calculations
    const prices = services.map(s => s.price);
    const sortedPrices = [...prices].sort((a, b) => a - b);

    // Calculate median
    const marketMedian = calculateMedian(sortedPrices);

    // Calculate mean
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;

    // Calculate standard deviation
    const stdDeviation = calculateStdDev(prices, avgPrice);

    // Price range
    const priceRange = {
      min: sortedPrices[0],
      max: sortedPrices[sortedPrices.length - 1]
    };

    // Calculate average uptime (filter out null values)
    const uptimes = services.filter(s => s.uptime !== null).map(s => s.uptime);
    const avgUptime = uptimes.length > 0
      ? uptimes.reduce((sum, u) => sum + u, 0) / uptimes.length
      : null;

    // Calculate average latency (filter out null values)
    const latencies = services.filter(s => s.avg_latency_ms !== null).map(s => s.avg_latency_ms);
    const avgLatency = latencies.length > 0
      ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
      : null;

    // Calculate average rating (filter out null values)
    const ratings = services.filter(s => s.rating !== null && s.rating > 0).map(s => s.rating);
    const avgRating = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
      : null;

    // Detect outliers using IQR method (same as rate aggregation)
    const ratesForDetection = services.map(s => ({
      price: s.price,
      source: s.agent_name,
      timestamp: new Date(s.last_updated).getTime(),
      agentId: s.agent_id
    }));

    const { removed } = detectOutliers(ratesForDetection);
    const outliers = removed.map(r => r.agentId);

    logger.info('agent_service_stats_calculated', {
      skill,
      totalAgents: services.length,
      marketMedian,
      avgPrice,
      outliers: outliers.length
    });

    return {
      skill,
      marketMedian: parseFloat(marketMedian.toFixed(6)),
      priceRange: {
        min: parseFloat(priceRange.min.toFixed(6)),
        max: parseFloat(priceRange.max.toFixed(6))
      },
      avgPrice: parseFloat(avgPrice.toFixed(6)),
      stdDeviation: parseFloat(stdDeviation.toFixed(6)),
      avgUptime: avgUptime !== null ? parseFloat(avgUptime.toFixed(2)) : null,
      avgLatency: avgLatency !== null ? Math.round(avgLatency) : null,
      avgRating: avgRating !== null ? parseFloat(avgRating.toFixed(2)) : null,
      totalAgents: services.length,
      outliers
    };
  } catch (error) {
    logger.error('agent_service_stats_failed', { skill, error: error.message });
    throw error;
  }
}

export default {
  aggregateRates,
  aggregateAllCategories,
  aggregateAgentServiceStats
};
