import logger from '../logger.js';

/**
 * Execute request with automatic fallback to alternative providers
 * @param {Array<Object>} rankedProviders - Sorted providers from decision.js: [{ providerName, ... }]
 * @param {Map<string, Object>} adapterMap - Map of provider name → adapter instance
 * @param {string} prompt - Input prompt
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} { result, provider, attempts, failedProviders }
 */
export const executeWithFallback = async (rankedProviders, adapterMap, prompt, options = {}) => {
  const maxAttempts = 3;
  const failedProviders = [];
  let attempts = 0;

  // Try up to 3 providers or until we run out
  for (const rankedProvider of rankedProviders.slice(0, maxAttempts)) {
    attempts++;

    const providerName = rankedProvider.providerName.toLowerCase();
    const adapter = adapterMap.get(providerName);

    if (!adapter) {
      logger.warn('adapter_not_found', { provider: providerName });
      failedProviders.push({ name: providerName, error: 'Adapter not configured' });
      continue;
    }

    try {
      logger.info('attempting_provider', { provider: providerName, attempt: attempts });

      // Try to generate with this provider
      const result = await adapter.generate(prompt, options);

      logger.info('provider_success', { provider: providerName, attempts });

      return {
        result,
        provider: providerName,
        attempts,
        failedProviders
      };
    } catch (error) {
      // Log failure and try next provider
      logger.warn('provider_failed', {
        provider: providerName,
        error: error.message,
        attempt: attempts
      });

      failedProviders.push({
        name: providerName,
        error: error.message
      });

      // Continue to next provider (don't throw yet)
      continue;
    }
  }

  // All providers failed
  logger.error('all_providers_failed', { attempts, failedProviders });
  throw new Error(`All providers failed after ${attempts} attempts. Failed providers: ${failedProviders.map(p => p.name).join(', ')}`);
};
