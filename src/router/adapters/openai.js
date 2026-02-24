import { BaseAdapter } from './base.js';
import logger from '../../logger.js';

/**
 * OpenAI adapter
 */
export class OpenAIAdapter extends BaseAdapter {
  constructor({ apiKey }) {
    super({
      name: 'openai',
      apiKey,
      baseUrl: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4o-mini'
    });
  }

  /**
   * Generate text using OpenAI API
   * @param {string} prompt - Input prompt
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} { text, tokens: { input, output }, latency, cost, model }
   */
  async generate(prompt, options = {}) {
    const startTime = Date.now();

    try {
      const model = options.model || this.defaultModel;
      const maxTokens = options.maxTokens || 1000;

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: maxTokens
        }),
        signal: AbortSignal.timeout(10000) // 10s timeout
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} ${error}`);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

      const text = data.choices[0].message.content;
      const tokensIn = data.usage.prompt_tokens;
      const tokensOut = data.usage.completion_tokens;
      const cost = this.calculateCost(tokensIn, tokensOut, model);

      logger.info('openai_generate_success', { model, tokensIn, tokensOut, latency });

      return {
        text,
        tokens: { input: tokensIn, output: tokensOut },
        latency,
        cost,
        model
      };
    } catch (error) {
      logger.error('openai_generate_failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Check if OpenAI API is available
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        signal: AbortSignal.timeout(10000)
      });

      return response.ok;
    } catch (error) {
      logger.warn('openai_availability_check_failed', { error: error.message });
      return false;
    }
  }
}

export default OpenAIAdapter;
