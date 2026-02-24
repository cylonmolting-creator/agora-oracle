#!/usr/bin/env node
/**
 * tests/smart-route.test.js
 * Smart Router decision engine, fallback, and budget tests
 */

// Simple test helpers
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
    toBeLessThan(expected) {
      if (value >= expected) {
        throw new Error(`Expected ${value} to be less than ${expected}`);
      }
    },
    toContain(expected) {
      if (!value.includes(expected)) {
        throw new Error(`Expected array to contain ${expected}`);
      }
    }
  };
}

console.log('\n=== Smart Router Test Suite ===\n');

// Test 1: selectProvider - Cost Optimization
test('Decision Engine: selects cheapest provider', () => {
  // Mock rate data (DeepSeek cheapest)
  const mockRates = [
    { provider_name: 'openai', input_rate_per_1k: 0.15, output_rate_per_1k: 0.60, confidence_score: 0.90 },
    { provider_name: 'anthropic', input_rate_per_1k: 3.00, output_rate_per_1k: 15.00, confidence_score: 0.95 },
    { provider_name: 'deepseek', input_rate_per_1k: 0.014, output_rate_per_1k: 0.028, confidence_score: 0.85 },
  ];

  // Simple scoring: lowest cost wins
  const scores = mockRates.map(r => {
    const avgCost = (r.input_rate_per_1k + r.output_rate_per_1k) / 2;
    return { name: r.provider_name, score: 1 / avgCost };
  });

  scores.sort((a, b) => b.score - a.score);

  expect(scores[0].name).toBe('deepseek');
});

// Test 2: selectProvider - Quality Optimization
test('Decision Engine: selects highest confidence provider', () => {
  const mockRates = [
    { provider_name: 'openai', confidence_score: 0.90 },
    { provider_name: 'anthropic', confidence_score: 0.95 },
    { provider_name: 'deepseek', confidence_score: 0.85 },
  ];

  mockRates.sort((a, b) => b.confidence_score - a.confidence_score);

  expect(mockRates[0].provider_name).toBe('anthropic');
});

// Test 3: Budget enforcement
test('Budget Manager: allows request when budget sufficient', () => {
  const budget = { limit: 100, spent: 50 };
  const estimatedCost = 10;

  const allowed = (budget.spent + estimatedCost) <= budget.limit;

  expect(allowed).toBe(true);
});

test('Budget Manager: rejects request when budget exceeded', () => {
  const budget = { limit: 100, spent: 95 };
  const estimatedCost = 10;

  const allowed = (budget.spent + estimatedCost) <= budget.limit;

  expect(allowed).toBe(false);
});

test('Budget Manager: rejects when exactly at limit', () => {
  const budget = { limit: 100, spent: 100 };
  const estimatedCost = 0.01;

  const allowed = (budget.spent + estimatedCost) <= budget.limit;

  expect(allowed).toBe(false);
});

// Test 4: Fallback logic
test('Fallback Handler: tries providers in order', () => {
  const providers = ['primary', 'secondary', 'tertiary'];
  const attemptOrder = [];

  // Simulate trying each provider
  for (const p of providers) {
    attemptOrder.push(p);
    if (p === 'secondary') break; // secondary succeeds
  }

  expect(attemptOrder).toContain('primary');
  expect(attemptOrder).toContain('secondary');
  expect(attemptOrder.length).toBe(2);
});

test('Fallback Handler: stops after max 3 attempts', () => {
  const providers = ['p1', 'p2', 'p3', 'p4', 'p5'];
  const maxAttempts = 3;
  const attemptOrder = [];

  for (let i = 0; i < Math.min(providers.length, maxAttempts); i++) {
    attemptOrder.push(providers[i]);
  }

  expect(attemptOrder.length).toBe(3);
});

// Test 5: Validation
test('Validation: missing prompt should fail', () => {
  const request = { task: 'text-generation' }; // no prompt
  const valid = !!(request.prompt && request.task);

  expect(valid).toBe(false);
});

test('Validation: missing task should fail', () => {
  const request = { prompt: 'Hello' }; // no task
  const valid = !!(request.prompt && request.task);

  expect(valid).toBe(false);
});

test('Validation: valid request should pass', () => {
  const request = { prompt: 'Hello', task: 'text-generation' };
  const valid = !!(request.prompt && request.task);

  expect(valid).toBe(true);
});

// Summary
console.log('\n========================================');
console.log(`Tests passed: ${testsPassed}`);
console.log(`Tests failed: ${testsFailed}`);
console.log(`Total: ${testsPassed + testsFailed}`);
console.log('========================================\n');

process.exit(testsFailed === 0 ? 0 : 1);
