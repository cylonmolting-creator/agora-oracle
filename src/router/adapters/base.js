import { getAll } from '../../db/database.js';
import logger from '../../logger.js';

/**
 * Base adapter class for AI providers
 * All provider adapters extend this class
 */
export class BaseAdapter {
  /**
   * @param {Object} config - Adapter configuration
   * @param {string} config.name - Provider name
   * @param {string} config.apiKey - API key
   * @param {string} config.baseUrl - Base URL for API
   * @param {string} config.defaultModel - Default model to use
   */
  constructor({ name, apiKey, baseUrl, defaultModel }) {
    this.name = name;
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.defaultModel = defaultModel;
  }

  /**
   * Generate text from prompt (must be implemented by subclass)
   * @param {string} prompt - Input prompt
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} { text, tokens: { input, output }, latency, cost, model }
   */
  async generate(prompt, options = {}) {
    throw new Error('generate() must be implemented by subclass');
  }

  /**
   * Check if provider is available
   * @returns {Promise<boolean>} true if available
   */
  async isAvailable() {
    return true; // Override in subclass
  }

  /**
   * Calculate cost based on token usage using AGORA rate database
   * @param {number} tokensIn - Input tokens
   * @param {number} tokensOut - Output tokens
   * @param {string} model - Model name
   * @returns {number} Cost in USD
   */
  calculateCost(tokensIn, tokensOut, model) {
    try {
      // Query AGORA rate database for this provider's rates
      const rates = getAll(
        `SELECT r.*, s.category, s.subcategory
         FROM rates r
         JOIN services s ON r.service_id = s.id
         JOIN providers p ON s.provider_id = p.id
         WHERE p.name = ?`,
        [this.name]
      );

      if (rates.length === 0) {
        logger.warn('no_rates_found', { provider: this.name });
        return 0;
      }

      // Use first available rate (simplified cost calculation)
      const rate = rates[0];

      // Simple cost estimation: price per unit (assuming per_1m_tokens)
      const totalTokens = tokensIn + tokensOut;
      const inputCost = (totalTokens / 1_000_000) * (rate.price || 0);
      const outputCost = 0; // Simplified: price already covers both

      return inputCost + outputCost;
    } catch (error) {
      logger.error('cost_calculation_failed', { provider: this.name, error: error.message });
      return 0;
    }
  }

  /**
   * Get adapter name
   * @returns {string} Provider name
   */
  getName() {
    return this.name;
  }
}

export default BaseAdapter;
