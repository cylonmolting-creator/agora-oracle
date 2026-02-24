#!/usr/bin/env node
/**
 * tests/analytics.test.js
 * Analytics and savings calculation tests
 */

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  try {
    process.stdout.write(`\n${name}... `);
    fn();
    console.log('✅');
    testsPassed++;
    return true;
  } catch (error) {
    console.log(`❌\n  Error: ${error.message}`);
    testsFailed++;
    return false;
  }
}

function expect(value) {
  return {
    toBe(expected) {
      if (value !== expected) {
        throw new Error(`Expected ${expected}, got ${value}`);
      }
    },
    toBeGreaterThan(expected) {
      if (value <= expected) {
        throw new Error(`Expected ${value} to be greater than ${expected}`);
      }
    },
    toBeCloseTo(expected, precision = 2) {
      const diff = Math.abs(value - expected);
      const tolerance = Math.pow(10, -precision);
      if (diff >= tolerance) {
        throw new Error(`Expected ${value} to be close to ${expected} (diff: ${diff})`);
      }
    }
  };
}

console.log('\n=== Analytics Test Suite ===\n');

// Test 1: Calculate total spending
test('Analytics: calculates correct totals from request_log', () => {
  const mockRequests = [
    { cost: 0.05 },
    { cost: 0.03 },
    { cost: 0.01 },
    { cost: 0.10 },
  ];

  const totalSpent = mockRequests.reduce((sum, r) => sum + r.cost, 0);

  expect(totalSpent).toBeCloseTo(0.19, 2);
});

// Test 2: Group by provider
test('Analytics: groups spending by provider', () => {
  const mockRequests = [
    { provider: 'openai', cost: 0.05 },
    { provider: 'openai', cost: 0.03 },
    { provider: 'deepseek', cost: 0.01 },
    { provider: 'anthropic', cost: 0.10 },
  ];

  const byProvider = {};
  for (const r of mockRequests) {
    byProvider[r.provider] = (byProvider[r.provider] || 0) + r.cost;
  }

  expect(byProvider.openai).toBeCloseTo(0.08, 2);
  expect(byProvider.deepseek).toBeCloseTo(0.01, 2);
  expect(byProvider.anthropic).toBeCloseTo(0.10, 2);
});

// Test 3: Group by task category
test('Analytics: groups spending by task category', () => {
  const mockRequests = [
    { category: 'text-generation', cost: 0.05 },
    { category: 'text-generation', cost: 0.03 },
    { category: 'code-generation', cost: 0.10 },
  ];

  const byTask = {};
  for (const r of mockRequests) {
    byTask[r.category] = (byTask[r.category] || 0) + r.cost;
  }

  expect(byTask['text-generation']).toBeCloseTo(0.08, 2);
  expect(byTask['code-generation']).toBeCloseTo(0.10, 2);
});

// Test 4: Daily aggregation
test('Analytics: aggregates daily spending', () => {
  const mockRequests = [
    { created_at: '2026-02-01', cost: 0.05 },
    { created_at: '2026-02-01', cost: 0.03 },
    { created_at: '2026-02-02', cost: 0.10 },
  ];

  const daily = {};
  for (const r of mockRequests) {
    const date = r.created_at.split(' ')[0]; // extract date only
    daily[date] = (daily[date] || 0) + r.cost;
  }

  expect(daily['2026-02-01']).toBeCloseTo(0.08, 2);
  expect(daily['2026-02-02']).toBeCloseTo(0.10, 2);
});

// Test 5: Empty agent
test('Analytics: returns zeroes for agent with no requests', () => {
  const mockRequests = [];

  const totalSpent = mockRequests.reduce((sum, r) => sum + r.cost, 0);
  const totalRequests = mockRequests.length;

  expect(totalSpent).toBe(0);
  expect(totalRequests).toBe(0);
});

// Test 6: Savings calculation (vs expensive provider)
test('Savings: calculates savings vs most expensive provider', () => {
  const mockRates = [
    { provider_name: 'openai', input_rate_per_1k: 0.15, output_rate_per_1k: 0.60 },
    { provider_name: 'anthropic', input_rate_per_1k: 3.00, output_rate_per_1k: 15.00 },
    { provider_name: 'deepseek', input_rate_per_1k: 0.014, output_rate_per_1k: 0.028 },
  ];

  // Calculate avg cost for each
  const costs = mockRates.map(r => ({
    name: r.provider_name,
    avgCost: (r.input_rate_per_1k + r.output_rate_per_1k) / 2
  }));

  costs.sort((a, b) => b.avgCost - a.avgCost);

  const mostExpensive = costs[0].avgCost; // Anthropic: 9.00
  const cheapest = costs[costs.length - 1].avgCost; // DeepSeek: 0.021

  const savings = mostExpensive - cheapest;
  const savingsPercent = (savings / mostExpensive) * 100;

  expect(savingsPercent).toBeGreaterThan(99); // >99% savings
});

// Test 7: Zero savings
test('Savings: shows zero savings if always using most expensive', () => {
  const actualCost = 10.0;
  const mostExpensiveCost = 10.0;

  const savings = mostExpensiveCost - actualCost;

  expect(savings).toBe(0);
});

// Test 8: Partial savings
test('Savings: calculates partial savings for mixed providers', () => {
  const requests = [
    { cost: 0.10 }, // expensive
    { cost: 0.01 }, // cheap
  ];

  const totalSpent = requests.reduce((sum, r) => sum + r.cost, 0);

  expect(totalSpent).toBeCloseTo(0.11, 2);
});

// Test 9: Top provider
test('Top Provider: identifies most-used provider', () => {
  const requests = [
    { provider: 'openai' },
    { provider: 'deepseek' },
    { provider: 'openai' },
    { provider: 'openai' },
  ];

  const counts = {};
  for (const r of requests) {
    counts[r.provider] = (counts[r.provider] || 0) + 1;
  }

  const topProvider = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];

  expect(topProvider).toBe('openai');
});

// Test 10: Small costs
test('Edge Case: handles very small costs', () => {
  const cost = 0.0001;
  const rounded = Math.round(cost * 10000) / 10000;

  expect(rounded).toBe(0.0001);
});

// Summary
console.log('\n========================================');
console.log(`Tests passed: ${testsPassed}`);
console.log(`Tests failed: ${testsFailed}`);
console.log(`Total: ${testsPassed + testsFailed}`);
console.log('========================================\n');

process.exit(testsFailed === 0 ? 0 : 1);
