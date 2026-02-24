/**
 * SDK Integration Tests
 *
 * Tests ARO SDK client against a real running server
 */

import { AgentRateOracle } from '../src/sdk/index.js';

// Mock fetch for testing without server
const mockFetch = (url, options) => {
  // Health endpoint
  if (url.includes('/health')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        success: true,
        status: 'ok',
        version: '0.1.0',
        uptime: 123.45
      })
    });
  }

  // Rates endpoint - all categories
  if (url.match(/\/v1\/rates$/) || url.endsWith('/rates')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        success: true,
        data: [
          {
            category: 'text-generation',
            subcategories: [
              {
                name: 'chat',
                price: 0.0005,
                currency: 'USD',
                unit: 'per-token',
                confidence: 0.85,
                sourceCount: 5,
                lastUpdated: '2026-02-24T00:00:00Z'
              }
            ]
          }
        ],
        meta: {
          timestamp: '2026-02-24T00:00:00Z',
          apiVersion: '0.1.0'
        }
      })
    });
  }

  // Specific category
  if (url.match(/\/v1\/rates\/text-generation$/)) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        success: true,
        data: {
          category: 'text-generation',
          subcategories: [
            {
              name: 'chat',
              price: 0.0005,
              currency: 'USD',
              unit: 'per-token',
              confidence: 0.85,
              sourceCount: 5,
              lastUpdated: '2026-02-24T00:00:00Z'
            },
            {
              name: 'general',
              price: 0.0003,
              currency: 'USD',
              unit: 'per-token',
              confidence: 0.9,
              sourceCount: 8,
              lastUpdated: '2026-02-24T00:00:00Z'
            }
          ]
        },
        meta: {
          timestamp: '2026-02-24T00:00:00Z',
          apiVersion: '0.1.0'
        }
      })
    });
  }

  // Specific subcategory
  if (url.match(/\/v1\/rates\/text-generation\/chat$/)) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        success: true,
        data: {
          category: 'text-generation',
          subcategory: 'chat',
          price: 0.0005,
          currency: 'USD',
          unit: 'per-token',
          confidence: 0.85,
          sourceCount: 5,
          lastUpdated: '2026-02-24T00:00:00Z',
          trend: 'stable',
          history: []
        },
        meta: {
          timestamp: '2026-02-24T00:00:00Z',
          apiVersion: '0.1.0'
        }
      })
    });
  }

  // Providers endpoint
  if (url.includes('/v1/providers')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        success: true,
        data: [
          {
            id: 1,
            name: 'OpenAI',
            url: 'https://openai.com',
            type: 'llm',
            serviceCount: 15
          },
          {
            id: 2,
            name: 'Anthropic',
            url: 'https://anthropic.com',
            type: 'llm',
            serviceCount: 8
          }
        ],
        meta: {
          timestamp: '2026-02-24T00:00:00Z',
          apiVersion: '0.1.0'
        }
      })
    });
  }

  // Stats endpoint
  if (url.includes('/v1/stats') && !url.includes('volatility')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        success: true,
        data: {
          totalProviders: 20,
          totalServices: 156,
          totalRateDataPoints: 1234,
          categoriesCount: 13,
          lastCrawlTime: '2026-02-24T00:00:00Z',
          averageConfidence: 0.82
        },
        meta: {
          timestamp: '2026-02-24T00:00:00Z',
          apiVersion: '0.1.0'
        }
      })
    });
  }

  // Volatility endpoint
  if (url.includes('/v1/stats/volatility')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        success: true,
        data: [
          {
            category: 'image-generation',
            volatility: 0.45,
            change: 0.15
          }
        ],
        meta: {
          timestamp: '2026-02-24T00:00:00Z',
          apiVersion: '0.1.0'
        }
      })
    });
  }

  // Compare endpoint
  if (url.includes('/v1/compare')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        success: true,
        data: [
          {
            provider: 'OpenAI',
            price: 0.0005,
            unit: 'per-token',
            confidence: 0.85,
            ranking: 1
          },
          {
            provider: 'Anthropic',
            price: 0.0006,
            unit: 'per-token',
            confidence: 0.9,
            ranking: 2
          }
        ],
        meta: {
          timestamp: '2026-02-24T00:00:00Z',
          apiVersion: '0.1.0'
        }
      })
    });
  }

  // Default 404
  return Promise.resolve({
    ok: false,
    status: 404,
    text: () => Promise.resolve('Not found')
  });
};

// Install mock
global.fetch = mockFetch;

describe('AgentRateOracle SDK', () => {
  let client;

  beforeEach(() => {
    client = new AgentRateOracle({ baseUrl: 'http://localhost:3402' });
  });

  test('should instantiate client with default options', () => {
    const defaultClient = new AgentRateOracle();
    expect(defaultClient.baseUrl).toBe('http://localhost:3402');
    expect(defaultClient.apiKey).toBe(null);
  });

  test('should instantiate client with custom baseUrl', () => {
    const customClient = new AgentRateOracle({ baseUrl: 'http://custom:8080/' });
    expect(customClient.baseUrl).toBe('http://custom:8080');
  });

  test('should instantiate client with apiKey', () => {
    const authClient = new AgentRateOracle({ apiKey: 'test-key' });
    expect(authClient.apiKey).toBe('test-key');
  });

  test('health() should return server health status', async () => {
    const health = await client.health();
    expect(health.status).toBe('ok');
    expect(health.version).toBe('0.1.0');
    expect(typeof health.uptime).toBe('number');
  });

  test('getRates() should return all rates', async () => {
    const rates = await client.getRates();
    expect(Array.isArray(rates)).toBe(true);
    expect(rates.length).toBeGreaterThan(0);
    expect(rates[0]).toHaveProperty('category');
    expect(rates[0]).toHaveProperty('subcategories');
  });

  test('getRate() should return specific rate', async () => {
    const rate = await client.getRate('text-generation', 'chat');
    expect(rate).toHaveProperty('category');
    expect(rate.category).toBe('text-generation');
    expect(rate.subcategory).toBe('chat');
    expect(rate).toHaveProperty('price');
    expect(rate).toHaveProperty('currency');
    expect(rate).toHaveProperty('confidence');
  });

  test('getRate() should throw on missing category', async () => {
    await expect(client.getRate()).rejects.toThrow('category is required');
  });

  test('getRate() should throw on missing subcategory', async () => {
    await expect(client.getRate('text-generation')).rejects.toThrow('subcategory is required');
  });

  test('findBestRate() should return lowest rate', async () => {
    const best = await client.findBestRate('text-generation');
    expect(best).toBeDefined();
    expect(best.price).toBe(0.0003); // general is cheaper than chat
    expect(best.name).toBe('general');
  });

  test('findBestRate() should filter by minConfidence', async () => {
    const best = await client.findBestRate('text-generation', { minConfidence: 0.9 });
    expect(best).toBeDefined();
    expect(best.confidence).toBeGreaterThanOrEqual(0.9);
  });

  test('findBestRate() should throw on missing category', async () => {
    await expect(client.findBestRate()).rejects.toThrow('category is required');
  });

  test('getProviders() should return all providers', async () => {
    const providers = await client.getProviders();
    expect(Array.isArray(providers)).toBe(true);
    expect(providers.length).toBeGreaterThan(0);
    expect(providers[0]).toHaveProperty('id');
    expect(providers[0]).toHaveProperty('name');
    expect(providers[0]).toHaveProperty('serviceCount');
  });

  test('getProviders() should accept filter options', async () => {
    const providers = await client.getProviders({ category: 'text-generation', sortBy: 'price' });
    expect(Array.isArray(providers)).toBe(true);
  });

  test('getStats() should return system statistics', async () => {
    const stats = await client.getStats();
    expect(stats).toHaveProperty('totalProviders');
    expect(stats).toHaveProperty('totalServices');
    expect(stats).toHaveProperty('totalRateDataPoints');
    expect(typeof stats.totalProviders).toBe('number');
  });

  test('getVolatility() should return volatility data', async () => {
    const volatility = await client.getVolatility();
    expect(Array.isArray(volatility)).toBe(true);
    if (volatility.length > 0) {
      expect(volatility[0]).toHaveProperty('category');
      expect(volatility[0]).toHaveProperty('volatility');
    }
  });

  test('compareRates() should compare providers', async () => {
    const comparison = await client.compareRates('text-generation', ['OpenAI', 'Anthropic']);
    expect(Array.isArray(comparison)).toBe(true);
    expect(comparison.length).toBeGreaterThan(0);
    expect(comparison[0]).toHaveProperty('provider');
    expect(comparison[0]).toHaveProperty('price');
    expect(comparison[0]).toHaveProperty('ranking');
  });

  test('compareRates() should throw on missing category', async () => {
    await expect(client.compareRates()).rejects.toThrow('category is required');
  });
});
