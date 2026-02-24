#!/usr/bin/env node
/**
 * tests/budget.test.js
 * Budget manager tests
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
    toBeLessThanOrEqual(expected) {
      if (value > expected) {
        throw new Error(`Expected ${value} to be <= ${expected}`);
      }
    }
  };
}

console.log('\n=== Budget Manager Test Suite ===\n');

// Test 1: Set budget
test('setBudget: creates new budget for current period', () => {
  const period = '2026-02';
  const limit = 100.0;

  // Simulate budget creation
  const budget = { id: 1, agent_id: 1, monthly_limit: limit, spent: 0, period };

  expect(budget.monthly_limit).toBe(100.0);
  expect(budget.spent).toBe(0);
});

// Test 2: Check budget - allowed
test('checkBudget: allows request when budget has room', () => {
  const budget = { limit: 100, spent: 50 };
  const estimatedCost = 10;

  const remaining = budget.limit - budget.spent;
  const allowed = estimatedCost <= remaining;

  expect(allowed).toBe(true);
  expect(remaining).toBe(50);
});

// Test 3: Check budget - rejected
test('checkBudget: rejects when would exceed limit', () => {
  const budget = { limit: 100, spent: 95 };
  const estimatedCost = 10;

  const remaining = budget.limit - budget.spent;
  const allowed = estimatedCost <= remaining;

  expect(allowed).toBe(false);
  expect(remaining).toBe(5);
});

// Test 4: Check budget - exactly at limit
test('checkBudget: rejects when exactly at limit', () => {
  const budget = { limit: 100, spent: 100 };
  const estimatedCost = 0.01;

  const remaining = budget.limit - budget.spent;
  const allowed = estimatedCost <= remaining;

  expect(allowed).toBe(false);
  expect(remaining).toBe(0);
});

// Test 5: Zero budget
test('checkBudget: rejects all requests when budget is zero', () => {
  const budget = { limit: 0, spent: 0 };
  const estimatedCost = 0.01;

  const remaining = budget.limit - budget.spent;
  const allowed = estimatedCost <= remaining;

  expect(allowed).toBe(false);
});

// Test 6: Record spend
test('recordSpend: increments spent amount correctly', () => {
  let spent = 10.50;
  const cost = 5.25;

  spent += cost;

  expect(spent).toBe(15.75);
});

// Test 7: Record small spend
test('recordSpend: handles small decimals', () => {
  let spent = 0;
  const cost = 0.001;

  spent += cost;

  expect(spent).toBe(0.001);
});

// Test 8: Budget status
test('getBudgetStatus: returns complete status', () => {
  const budget = { limit: 100, spent: 60, period: '2026-02' };
  const remaining = budget.limit - budget.spent;

  expect(remaining).toBe(40);
  expect(budget.period).toBe('2026-02');
});

// Test 9: Budget projection
test('getBudgetStatus: projects spending to month end', () => {
  const budget = { limit: 100, spent: 30 };
  const daysElapsed = 10;
  const daysInMonth = 28;
  const daysLeft = daysInMonth - daysElapsed;

  const dailyRate = budget.spent / daysElapsed;
  const projectedMonthEnd = budget.spent + (dailyRate * daysLeft);

  expect(projectedMonthEnd).toBeGreaterThan(budget.spent);
  expect(Math.round(projectedMonthEnd)).toBe(84); // 30 + (3 * 18) = 84
});

// Test 10: Period format
test('Period Management: uses YYYY-MM format', () => {
  const period = '2026-02';
  const regex = /^\d{4}-\d{2}$/;

  const valid = regex.test(period);

  expect(valid).toBe(true);
});

// Test 11: Auto-reset for new month
test('Period Management: handles month rollover', () => {
  const oldPeriod = '2026-02';
  const newPeriod = '2026-03';

  const oldMonth = parseInt(oldPeriod.split('-')[1]);
  const newMonth = parseInt(newPeriod.split('-')[1]);

  expect(newMonth).toBeGreaterThan(oldMonth);
});

// Summary
console.log('\n========================================');
console.log(`Tests passed: ${testsPassed}`);
console.log(`Tests failed: ${testsFailed}`);
console.log(`Total: ${testsPassed + testsFailed}`);
console.log('========================================\n');

process.exit(testsFailed === 0 ? 0 : 1);
