import { getAll } from '../db/database.js';
import logger from '../logger.js';

/**
 * Select best provider based on task requirements and optimization strategy
 * @param {string} task - Task category (e.g., 'chat', 'text-generation')
 * @param {string} optimize - Optimization strategy: 'cost', 'speed', 'quality', 'balanced'
 * @param {Object} constraints - Constraints object { maxCost, minConfidence }
 * @param {Array<string>} availableProviders - List of available provider names
 * @returns {Array<Object>} Sorted array of providers: [{ providerId, providerName, score, estimatedCost, confidence }]
 */
export const selectProvider = (task, optimize = 'cost', constraints = {}, availableProviders = []) => {
  try {
    // Step 1: Query AGORA rate database for all rates matching the task category
    const rates = getAll(`
      SELECT
        r.id as rate_id,
        s.provider_id,
        p.name as provider_name,
        s.category,
        s.subcategory,
        r.price,
        r.unit,
        r.confidence
      FROM rates r
      JOIN services s ON r.service_id = s.id
      JOIN providers p ON s.provider_id = p.id
      WHERE s.category = ? OR ? = ''
    `, [task || '', task || '']);

    if (rates.length === 0) {
      logger.warn('no_rates_found_for_task', { task });
      return [];
    }

    // Step 2: Filter by constraints
    let filteredRates = rates;

    if (constraints.maxCost !== undefined) {
      filteredRates = filteredRates.filter(r => {
        // Use price directly as estimated cost
        const estimatedCost = r.price;
        return estimatedCost <= constraints.maxCost;
      });
    }

    if (constraints.minConfidence !== undefined) {
      filteredRates = filteredRates.filter(r => r.confidence >= constraints.minConfidence);
    }

    // Step 3: Filter by available providers (only providers with configured API keys)
    if (availableProviders.length > 0) {
      filteredRates = filteredRates.filter(r =>
        availableProviders.includes(r.provider_name.toLowerCase())
      );
    }

    if (filteredRates.length === 0) {
      logger.warn('no_providers_after_filtering', { task, constraints, availableProviders });
      return [];
    }

    // Step 4: Score each provider based on optimization strategy
    const scoredProviders = filteredRates.map(rate => {
      // Use price directly as estimated cost
      const estimatedCost = rate.price;

      // Get average latency from request_log (if available)
      const latencyData = getAll(`
        SELECT AVG(latency_ms) as avg_latency
        FROM request_log
        WHERE provider = ?
      `, [rate.provider_name]);
      const avgLatency = latencyData[0]?.avg_latency || 1000; // default 1000ms

      let score = 0;

      switch (optimize) {
        case 'cost':
          // Lower cost = higher score (inverse)
          score = 1 / (estimatedCost + 0.0001); // +0.0001 to avoid division by zero
          break;

        case 'speed':
          // Lower latency = higher score (inverse)
          score = 1 / (avgLatency + 1);
          break;

        case 'quality':
          // Higher confidence = higher score
          score = rate.confidence;
          break;

        case 'balanced':
          // 40% cost + 30% speed + 30% quality
          const costScore = 1 / (estimatedCost + 0.0001);
          const speedScore = 1 / (avgLatency + 1);
          const qualityScore = rate.confidence;

          // Normalize scores (0-1 range)
          const maxCostScore = 1 / 0.0001;
          const maxSpeedScore = 1 / 1;

          score = (
            0.4 * (costScore / maxCostScore) +
            0.3 * (speedScore / maxSpeedScore) +
            0.3 * (qualityScore / 100)
          );
          break;

        default:
          score = 1 / (estimatedCost + 0.0001); // default to cost optimization
      }

      return {
        providerId: rate.provider_id,
        providerName: rate.provider_name,
        score,
        estimatedCost,
        confidence: rate.confidence
      };
    });

    // Step 5: Sort by score (highest first) and remove duplicates
    const uniqueProviders = [];
    const seenProviders = new Set();

    scoredProviders
      .sort((a, b) => b.score - a.score)
      .forEach(provider => {
        if (!seenProviders.has(provider.providerName)) {
          uniqueProviders.push(provider);
          seenProviders.add(provider.providerName);
        }
      });

    logger.info('provider_selection_complete', {
      task,
      optimize,
      totalProviders: uniqueProviders.length,
      topProvider: uniqueProviders[0]?.providerName
    });

    return uniqueProviders;
  } catch (error) {
    logger.error('provider_selection_failed', { error: error.message });
    throw error;
  }
};
