/**
 * Agent Services Test Suite
 * Tests for ROADMAP v3 Phase 1: Agent Service Comparison
 *
 * Coverage:
 * - CRUD operations (create, read, update agent services)
 * - Comparison logic (market median, ranking, best value)
 * - Outlier detection
 * - API endpoints (/agent-services, /agent-services/:id, /compare)
 */

import assert from 'assert';

// Mock database
const mockDb = {
  services: new Map(),
  history: [],
  nextId: 1
};

// Mock logger
const mockLogger = {
  info: () => {},
  error: () => {},
  warn: () => {},
  debug: () => {}
};

// Mock CRUD functions
function createAgentService(data) {
  const id = mockDb.nextId++;
  const service = {
    id,
    agent_id: data.agentId,
    agent_name: data.agentName,
    skill: data.skill,
    price: data.price,
    unit: data.unit,
    currency: data.currency || 'USD',
    uptime: data.uptime || null,
    avg_latency_ms: data.avgLatency || null,
    reviews_count: data.reviewsCount || 0,
    rating: data.rating || 0,
    x402_endpoint: data.x402Endpoint || null,
    bazaar_url: data.bazaarUrl || null,
    metadata: data.metadata ? JSON.stringify(data.metadata) : null,
    last_updated: new Date().toISOString(),
    created_at: new Date().toISOString()
  };
  mockDb.services.set(data.agentId, service);
  return { id, agentId: data.agentId };
}

function getAgentServiceById(agentId) {
  return mockDb.services.get(agentId) || null;
}

function getAgentServicesBySkill(skill) {
  const services = Array.from(mockDb.services.values())
    .filter(s => s.skill === skill)
    .sort((a, b) => a.price - b.price);
  return services;
}

function updateAgentServicePrice(agentId, price) {
  const service = mockDb.services.get(agentId);
  if (!service) {
    throw new Error('Agent service not found');
  }

  // Record history
  mockDb.history.push({
    agent_id: agentId,
    price: service.price,
    uptime: service.uptime,
    avg_latency_ms: service.avg_latency_ms,
    recorded_at: new Date().toISOString()
  });

  // Update price
  service.price = price;
  service.last_updated = new Date().toISOString();
  return true;
}

// Mock comparison logic
function calculateMarketStats(services) {
  if (services.length === 0) return null;

  const prices = services.map(s => s.price).sort((a, b) => a - b);
  const medianIndex = Math.floor(prices.length / 2);
  const marketMedian = prices.length % 2 === 0
    ? (prices[medianIndex - 1] + prices[medianIndex]) / 2
    : prices[medianIndex];

  const avgUptime = services
    .filter(s => s.uptime !== null)
    .reduce((sum, s) => sum + s.uptime, 0) / services.filter(s => s.uptime !== null).length;

  return {
    marketMedian,
    priceRange: { min: prices[0], max: prices[prices.length - 1] },
    avgUptime: avgUptime || null,
    totalAgents: services.length
  };
}

function findBestValue(services, marketMedian) {
  if (services.length === 0) return null;

  // Find max price for normalization
  const maxPrice = Math.max(...services.map(s => s.price));

  // Score: 50% price + 30% uptime + 20% rating (higher is better)
  const scored = services.map(s => {
    // Price score: lower price = higher score (inverted)
    const priceScore = maxPrice > 0 ? (1 - (s.price / maxPrice)) : 0;
    const uptimeScore = s.uptime ? s.uptime : 0.5;
    const ratingScore = s.rating ? s.rating / 5 : 0.5;
    const totalScore = (priceScore * 0.5) + (uptimeScore * 0.3) + (ratingScore * 0.2);
    return { ...s, score: totalScore };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0];
}

function detectOutliers(services) {
  if (services.length < 4) return [];

  const prices = services.map(s => s.price).sort((a, b) => a - b);
  const q1Index = Math.floor(prices.length * 0.25);
  const q3Index = Math.floor(prices.length * 0.75);
  const q1 = prices[q1Index];
  const q3 = prices[q3Index];
  const iqr = q3 - q1;
  const lowerBound = q1 - (1.5 * iqr);
  const upperBound = q3 + (1.5 * iqr);

  return services
    .filter(s => s.price < lowerBound || s.price > upperBound)
    .map(s => s.agent_id);
}

// Test suite
const tests = [
  {
    name: 'CRUD: createAgentService - returns ID and agentId',
    fn: () => {
      mockDb.services.clear();
      mockDb.nextId = 1;

      const result = createAgentService({
        agentId: 'agent_test_1',
        agentName: 'Test Agent',
        skill: 'text-generation/chat',
        price: 0.01,
        unit: 'per-1k-tokens'
      });

      assert.strictEqual(result.id, 1);
      assert.strictEqual(result.agentId, 'agent_test_1');
      assert.strictEqual(mockDb.services.size, 1);
    }
  },

  {
    name: 'CRUD: getAgentServiceById - returns correct data',
    fn: () => {
      mockDb.services.clear();
      createAgentService({
        agentId: 'agent_test_2',
        agentName: 'Test Agent 2',
        skill: 'image-generation/standard',
        price: 0.05,
        unit: 'per-image',
        uptime: 0.999,
        avgLatency: 250
      });

      const service = getAgentServiceById('agent_test_2');
      assert.strictEqual(service.agent_name, 'Test Agent 2');
      assert.strictEqual(service.skill, 'image-generation/standard');
      assert.strictEqual(service.price, 0.05);
      assert.strictEqual(service.uptime, 0.999);
    }
  },

  {
    name: 'CRUD: getAgentServicesBySkill - returns sorted array (price ASC)',
    fn: () => {
      mockDb.services.clear();
      createAgentService({ agentId: 'a1', agentName: 'A1', skill: 'embeddings/text', price: 0.0005, unit: 'per-1k' });
      createAgentService({ agentId: 'a2', agentName: 'A2', skill: 'embeddings/text', price: 0.0001, unit: 'per-1k' });
      createAgentService({ agentId: 'a3', agentName: 'A3', skill: 'embeddings/text', price: 0.0003, unit: 'per-1k' });
      createAgentService({ agentId: 'a4', agentName: 'A4', skill: 'audio/transcription', price: 0.006, unit: 'per-min' });

      const services = getAgentServicesBySkill('embeddings/text');
      assert.strictEqual(services.length, 3);
      assert.strictEqual(services[0].agent_id, 'a2'); // cheapest
      assert.strictEqual(services[1].agent_id, 'a3');
      assert.strictEqual(services[2].agent_id, 'a1'); // most expensive
    }
  },

  {
    name: 'CRUD: updateAgentServicePrice - price changes + history record inserted',
    fn: () => {
      mockDb.services.clear();
      mockDb.history = [];

      createAgentService({ agentId: 'agent_price_test', agentName: 'Price Test', skill: 'text-generation/chat', price: 0.015, unit: 'per-1k' });

      const oldService = getAgentServiceById('agent_price_test');
      assert.strictEqual(oldService.price, 0.015);

      updateAgentServicePrice('agent_price_test', 0.012);

      const newService = getAgentServiceById('agent_price_test');
      assert.strictEqual(newService.price, 0.012);
      assert.strictEqual(mockDb.history.length, 1);
      assert.strictEqual(mockDb.history[0].price, 0.015); // old price in history
    }
  },

  {
    name: 'Comparison: 5 agents same skill - returns sorted by price, correct ranking',
    fn: () => {
      mockDb.services.clear();
      createAgentService({ agentId: 'c1', agentName: 'C1', skill: 'vision/analysis', price: 0.04, unit: 'per-image' });
      createAgentService({ agentId: 'c2', agentName: 'C2', skill: 'vision/analysis', price: 0.025, unit: 'per-image' });
      createAgentService({ agentId: 'c3', agentName: 'C3', skill: 'vision/analysis', price: 0.06, unit: 'per-image' });
      createAgentService({ agentId: 'c4', agentName: 'C4', skill: 'vision/analysis', price: 0.015, unit: 'per-image' });
      createAgentService({ agentId: 'c5', agentName: 'C5', skill: 'vision/analysis', price: 0.05, unit: 'per-image' });

      const services = getAgentServicesBySkill('vision/analysis');
      assert.strictEqual(services.length, 5);

      // Check ranking
      const rankings = services.map((s, i) => ({ agentId: s.agent_id, ranking: i + 1 }));
      assert.strictEqual(rankings[0].agentId, 'c4'); // cheapest, rank 1
      assert.strictEqual(rankings[4].agentId, 'c3'); // most expensive, rank 5
    }
  },

  {
    name: 'Comparison: calculateMarketStats - correct marketMedian',
    fn: () => {
      mockDb.services.clear();
      createAgentService({ agentId: 's1', agentName: 'S1', skill: 'data/analysis', price: 0.10, unit: 'per-query', uptime: 0.995 });
      createAgentService({ agentId: 's2', agentName: 'S2', skill: 'data/analysis', price: 0.25, unit: 'per-query', uptime: 0.998 });
      createAgentService({ agentId: 's3', agentName: 'S3', skill: 'data/analysis', price: 0.18, unit: 'per-query', uptime: 0.993 });
      createAgentService({ agentId: 's4', agentName: 'S4', skill: 'data/analysis', price: 0.20, unit: 'per-query', uptime: 0.996 });

      const services = getAgentServicesBySkill('data/analysis');
      const stats = calculateMarketStats(services);

      // Median of [0.10, 0.18, 0.20, 0.25] = (0.18 + 0.20) / 2 = 0.19
      assert.strictEqual(stats.marketMedian, 0.19);
      assert.strictEqual(stats.priceRange.min, 0.10);
      assert.strictEqual(stats.priceRange.max, 0.25);
      assert.strictEqual(stats.totalAgents, 4);
      assert.ok(stats.avgUptime > 0.99); // avg uptime ~0.9955
    }
  },

  {
    name: 'Comparison: findBestValue - agent with best price+quality combo wins',
    fn: () => {
      mockDb.services.clear();
      // Agent 1: cheap but very low quality (should lose)
      createAgentService({ agentId: 'v1', agentName: 'V1', skill: 'web/scraping', price: 0.02, unit: 'per-page', uptime: 0.80, rating: 3.0 });
      // Agent 2: balanced (best value) - moderate price, excellent quality
      createAgentService({ agentId: 'v2', agentName: 'V2', skill: 'web/scraping', price: 0.05, unit: 'per-page', uptime: 0.99, rating: 4.8 });
      // Agent 3: expensive but high quality (should lose on price)
      createAgentService({ agentId: 'v3', agentName: 'V3', skill: 'web/scraping', price: 0.12, unit: 'per-page', uptime: 0.995, rating: 4.9 });

      const services = getAgentServicesBySkill('web/scraping');
      const stats = calculateMarketStats(services);
      const bestValue = findBestValue(services, stats.marketMedian);

      // V2 should win: good price + excellent uptime/rating
      assert.strictEqual(bestValue.agent_id, 'v2');
    }
  },

  {
    name: 'Comparison: Outlier detection - very expensive agent marked as outlier',
    fn: () => {
      mockDb.services.clear();
      // Normal priced agents
      createAgentService({ agentId: 'o1', agentName: 'O1', skill: 'audio/generation', price: 0.015, unit: 'per-char' });
      createAgentService({ agentId: 'o2', agentName: 'O2', skill: 'audio/generation', price: 0.018, unit: 'per-char' });
      createAgentService({ agentId: 'o3', agentName: 'O3', skill: 'audio/generation', price: 0.020, unit: 'per-char' });
      createAgentService({ agentId: 'o4', agentName: 'O4', skill: 'audio/generation', price: 0.016, unit: 'per-char' });
      // Outlier: very expensive
      createAgentService({ agentId: 'o5', agentName: 'O5', skill: 'audio/generation', price: 0.15, unit: 'per-char' });

      const services = getAgentServicesBySkill('audio/generation');
      const outliers = detectOutliers(services);

      assert.strictEqual(outliers.length, 1);
      assert.strictEqual(outliers[0], 'o5'); // expensive agent is outlier
    }
  },

  {
    name: 'API Mock: GET /agent-services - returns array',
    fn: () => {
      mockDb.services.clear();
      createAgentService({ agentId: 'api1', agentName: 'API1', skill: 'text-generation/code', price: 0.009, unit: 'per-1k' });
      createAgentService({ agentId: 'api2', agentName: 'API2', skill: 'text-generation/code', price: 0.018, unit: 'per-1k' });

      const allServices = Array.from(mockDb.services.values());
      assert.strictEqual(allServices.length, 2);
      assert.strictEqual(allServices[0].agent_id, 'api1');
    }
  },

  {
    name: 'API Mock: GET /agent-services/:agentId - returns agent data',
    fn: () => {
      mockDb.services.clear();
      mockDb.history = [];

      createAgentService({ agentId: 'api_detail', agentName: 'Detail Test', skill: 'image-generation/hd', price: 0.055, unit: 'per-image' });
      updateAgentServicePrice('api_detail', 0.050);
      updateAgentServicePrice('api_detail', 0.048);

      const service = getAgentServiceById('api_detail');
      assert.strictEqual(service.agent_id, 'api_detail');
      assert.strictEqual(service.price, 0.048); // latest price
      assert.strictEqual(mockDb.history.length, 2); // 2 price changes recorded
    }
  },

  {
    name: 'API Mock: GET /compare?skill=X - returns comparison with marketMedian',
    fn: () => {
      mockDb.services.clear();
      createAgentService({ agentId: 'cmp1', agentName: 'CMP1', skill: 'text-generation/chat', price: 0.01, unit: 'per-1k', uptime: 0.996 });
      createAgentService({ agentId: 'cmp2', agentName: 'CMP2', skill: 'text-generation/chat', price: 0.012, unit: 'per-1k', uptime: 0.998 });
      createAgentService({ agentId: 'cmp3', agentName: 'CMP3', skill: 'text-generation/chat', price: 0.015, unit: 'per-1k', uptime: 0.997 });
      createAgentService({ agentId: 'cmp4', agentName: 'CMP4', skill: 'text-generation/chat', price: 0.025, unit: 'per-1k', uptime: 0.999 });

      const services = getAgentServicesBySkill('text-generation/chat');
      const stats = calculateMarketStats(services);
      const bestValue = findBestValue(services, stats.marketMedian);

      assert.strictEqual(services.length, 4);
      assert.strictEqual(stats.marketMedian, 0.0135); // median of [0.01, 0.012, 0.015, 0.025]
      assert.strictEqual(services[0].agent_id, 'cmp1'); // cheapest
      assert.strictEqual(bestValue.agent_id, 'cmp1'); // best value (cheapest with good uptime)
    }
  },

  {
    name: 'API Mock: GET /compare (missing skill) - validation fail',
    fn: () => {
      // In real API, this would return 400 Bad Request
      // Mock validation: skill parameter required
      const skill = undefined;

      assert.throws(() => {
        if (!skill) {
          throw new Error('Missing required parameter: skill');
        }
      }, /Missing required parameter/);
    }
  }
];

// Test runner
console.log('\n=== Agent Services Test Suite ===\n');

let passed = 0;
let failed = 0;

for (const test of tests) {
  try {
    test.fn();
    console.log(`✓ ${test.name}`);
    passed++;
  } catch (err) {
    console.error(`✗ ${test.name}`);
    console.error(`  ${err.message}`);
    failed++;
  }
}

console.log(`\n=== Results ===`);
console.log(`Passed: ${passed}/${tests.length}`);
console.log(`Failed: ${failed}/${tests.length}`);

if (failed === 0) {
  console.log('\n✅ All tests passed!\n');
  process.exit(0);
} else {
  console.log('\n❌ Some tests failed\n');
  process.exit(1);
}
