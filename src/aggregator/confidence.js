/**
 * Agent Rate Oracle — Confidence Scorer
 *
 * Calculates confidence score (0.0-1.0) for aggregated rates based on:
 * - Source count (more sources = higher confidence)
 * - Standard deviation (lower variance = higher confidence)
 * - Data freshness (newer data = higher confidence)
 *
 * Formula:
 *   confidence = sourceScore * 0.4 + varianceScore * 0.4 + freshnessScore * 0.2
 *
 * Where:
 *   - sourceScore = min(sourceCount / 5, 1.0)  // caps at 5+ sources
 *   - varianceScore = 1 - normalizedStdDev     // lower stddev = higher score
 *   - freshnessScore = decays exponentially with age (halflife = 30 days)
 */

/**
 * Calculate standard deviation of prices
 * @param {number[]} prices
 * @returns {number}
 */
function calculateStdDev(prices) {
  if (prices.length === 0) return 0;
  if (prices.length === 1) return 0;

  const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
  const squaredDiffs = prices.map(p => Math.pow(p - mean, 2));
  const variance = squaredDiffs.reduce((sum, sq) => sum + sq, 0) / prices.length;

  return Math.sqrt(variance);
}

/**
 * Normalize standard deviation to 0-1 scale
 * Uses coefficient of variation (stddev/mean) capped at 1.0
 * @param {number} stddev
 * @param {number} mean
 * @returns {number} - 0.0 (high variance) to 1.0 (low variance)
 */
function normalizeStdDev(stddev, mean) {
  if (mean === 0) return 0;

  // Coefficient of variation (CV)
  const cv = stddev / mean;

  // Cap CV at 1.0 (100% variance is worst case)
  // Invert so lower CV = higher score
  return Math.max(0, 1 - Math.min(cv, 1.0));
}

/**
 * Calculate freshness score based on data age
 * Uses exponential decay with 30-day halflife
 * @param {Date} timestamp
 * @returns {number} - 0.0 (very old) to 1.0 (fresh)
 */
function calculateFreshnessScore(timestamp) {
  const now = Date.now();
  const age = (now - timestamp) / (1000 * 60 * 60 * 24); // days

  // Exponential decay: score = 2^(-age / halflife)
  const halflife = 30; // 30 days
  const score = Math.pow(2, -age / halflife);

  return Math.max(0, Math.min(1, score));
}

/**
 * Calculate confidence score for aggregated rates
 *
 * @param {Array<{price: number, timestamp?: number}>} rates - Array of rate objects
 * @returns {number} - Confidence score between 0.0 and 1.0
 *
 * @example
 * calculateConfidence([
 *   {price: 10, timestamp: Date.now()},
 *   {price: 11, timestamp: Date.now() - 86400000},
 *   {price: 10.5, timestamp: Date.now()}
 * ])
 * // => 0.78 (3 sources, low variance, fresh data)
 */
export function calculateConfidence(rates) {
  // Edge cases
  if (!rates || rates.length === 0) return 0.0;
  if (rates.length === 1) {
    // Single source: confidence depends only on freshness
    const timestamp = rates[0].timestamp || Date.now();
    return calculateFreshnessScore(timestamp) * 0.6; // max 0.6 for single source
  }

  // Extract prices and timestamps
  const prices = rates.map(r => r.price);
  const timestamps = rates.map(r => r.timestamp || Date.now());

  // 1. Source count score (max at 5+ sources)
  const sourceScore = Math.min(rates.length / 5, 1.0);

  // 2. Variance score (lower stddev = higher confidence)
  const stddev = calculateStdDev(prices);
  const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
  const varianceScore = normalizeStdDev(stddev, mean);

  // 3. Freshness score (average of all timestamps)
  const freshnessScores = timestamps.map(t => calculateFreshnessScore(t));
  const avgFreshnessScore = freshnessScores.reduce((sum, s) => sum + s, 0) / freshnessScores.length;

  // Weighted combination
  const confidence = (
    sourceScore * 0.4 +
    varianceScore * 0.4 +
    avgFreshnessScore * 0.2
  );

  // Ensure bounds
  return Math.max(0, Math.min(1, confidence));
}

/**
 * Calculate detailed confidence breakdown (for debugging/transparency)
 * @param {Array<{price: number, timestamp?: number}>} rates
 * @returns {object} - Detailed breakdown
 */
export function calculateConfidenceDetailed(rates) {
  if (!rates || rates.length === 0) {
    return {
      confidence: 0.0,
      breakdown: {
        sourceScore: 0,
        varianceScore: 0,
        freshnessScore: 0
      },
      stats: {
        sourceCount: 0,
        stddev: 0,
        mean: 0,
        avgAge: 0
      }
    };
  }

  const prices = rates.map(r => r.price);
  const timestamps = rates.map(r => r.timestamp || Date.now());

  const sourceScore = Math.min(rates.length / 5, 1.0);

  const stddev = calculateStdDev(prices);
  const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
  const varianceScore = normalizeStdDev(stddev, mean);

  const freshnessScores = timestamps.map(t => calculateFreshnessScore(t));
  const avgFreshnessScore = freshnessScores.reduce((sum, s) => sum + s, 0) / freshnessScores.length;

  const now = Date.now();
  const avgAge = timestamps.reduce((sum, t) => sum + (now - t), 0) / timestamps.length / (1000 * 60 * 60 * 24);

  const confidence = (
    sourceScore * 0.4 +
    varianceScore * 0.4 +
    avgFreshnessScore * 0.2
  );

  return {
    confidence: Math.max(0, Math.min(1, confidence)),
    breakdown: {
      sourceScore: sourceScore.toFixed(3),
      varianceScore: varianceScore.toFixed(3),
      freshnessScore: avgFreshnessScore.toFixed(3)
    },
    stats: {
      sourceCount: rates.length,
      stddev: stddev.toFixed(4),
      mean: mean.toFixed(4),
      avgAge: avgAge.toFixed(2)
    }
  };
}
