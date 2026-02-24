import { BaseAdapter } from './base.js';
import logger from '../../logger.js';

/**
 * Anthropic adapter
 */
export class AnthropicAdapter extends BaseAdapter {
  constructor({ apiKey }) {
    super({
      name: 'anthropic',
      apiKey,
      baseUrl: 'https://api.anthropic.com/v1',
      defaultModel: 'claude-haiku-4-5-20251001'
    });
  }

  /**
   * Generate text using Anthropic API
   * @param {string} prompt - Input prompt
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} { text, tokens: { input, output }, latency, cost, model }
   */
  async generate(prompt, options = {}) {
    const startTime = Date.now();

    try {
      const model = options.model || this.defaultModel;
      const maxTokens = options.maxTokens || 1000;

      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          messages: [{ role: 'user', content: prompt }]
        }),
        signal: AbortSignal.timeout(10000) // 10s timeout
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Anthropic API error: ${response.status} ${error}`);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

      const text = data.content[0].text;
      const tokensIn = data.usage.input_tokens;
      const tokensOut = data.usage.output_tokens;
      const cost = this.calculateCost(tokensIn, tokensOut, model);

      logger.info('anthropic_generate_success', { model, tokensIn, tokensOut, latency });

      return {
        text,
        tokens: { input: tokensIn, output: tokensOut },
        latency,
        cost,
        model
      };
    } catch (error) {
      logger.error('anthropic_generate_failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Check if Anthropic API is available
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    try {
      // Anthropic doesn't have a health check endpoint, so we do a minimal request
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.defaultModel,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'test' }]
        }),
        signal: AbortSignal.timeout(10000)
      });

      return response.ok;
    } catch (error) {
      logger.warn('anthropic_availability_check_failed', { error: error.message });
      return false;
    }
  }
}

export default AnthropicAdapter;
