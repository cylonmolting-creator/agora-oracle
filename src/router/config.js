import OpenAIAdapter from './adapters/openai.js';
import AnthropicAdapter from './adapters/anthropic.js';
import DeepSeekAdapter from './adapters/deepseek.js';
import logger from '../logger.js';

/**
 * Get all available providers with configured API keys
 * @returns {Array} Array of { name, adapter } for providers with keys set
 */
function getAvailableProviders() {
  const providers = [];

  if (process.env.OPENAI_API_KEY) {
    providers.push({
      name: 'openai',
      adapter: new OpenAIAdapter({
        apiKey: process.env.OPENAI_API_KEY,
      }),
    });
  }

  if (process.env.ANTHROPIC_API_KEY) {
    providers.push({
      name: 'anthropic',
      adapter: new AnthropicAdapter({
        apiKey: process.env.ANTHROPIC_API_KEY,
      }),
    });
  }

  if (process.env.DEEPSEEK_API_KEY) {
    providers.push({
      name: 'deepseek',
      adapter: new DeepSeekAdapter({
        apiKey: process.env.DEEPSEEK_API_KEY,
      }),
    });
  }

  return providers;
}

/**
 * Get configuration for a specific provider
 * @param {string} name - Provider name
 * @returns {Object|null} Provider config or null if not available
 */
function getProviderConfig(name) {
  const configs = {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4o-mini',
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseUrl: 'https://api.anthropic.com/v1',
      defaultModel: 'claude-haiku-4-5-20251001',
    },
    deepseek: {
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseUrl: 'https://api.deepseek.com/v1',
      defaultModel: 'deepseek-chat',
    },
  };

  const config = configs[name];
  if (!config || !config.apiKey) {
    return null;
  }

  return config;
}

/**
 * Check if Smart Router is enabled (at least 1 provider key set)
 * @returns {boolean}
 */
function isSmartRouteEnabled() {
  const enabled = !!(
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.DEEPSEEK_API_KEY
  );

  if (!enabled) {
    logger.warn('Smart Router: disabled (no API keys configured)');
  }

  return enabled;
}

/**
 * Get adapter map for smart routing
 * @returns {Object} Map of providerName -> adapter instance
 */
function getAdapterMap() {
  const providers = getAvailableProviders();
  const adapterMap = {};

  for (const { name, adapter } of providers) {
    adapterMap[name] = adapter;
  }

  return adapterMap;
}

/**
 * Log available providers at startup
 */
function logProviderStatus() {
  const providers = getAvailableProviders();

  if (providers.length === 0) {
    logger.warn('Smart Router: disabled (no API keys configured)');
    logger.warn('Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or DEEPSEEK_API_KEY in .env to enable');
  } else {
    const names = providers.map(p => p.name).join(', ');
    logger.info(`Smart Router: ${providers.length}/3 providers configured [${names}]`);
  }
}

export {
  getAvailableProviders,
  getProviderConfig,
  isSmartRouteEnabled,
  getAdapterMap,
  logProviderStatus,
};
