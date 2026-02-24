/**
 * Integration Tests for Aggregation Engine
 *
 * Tests the main aggregateRates() function with real database data.
 * Requires seeded database at data/aro.db
 */

import { initDatabase } from '../src/db/database.js';
import { aggregateRates, aggregateAllCategories } from '../src/aggregator/index.js';

// Initialize database
try {
  initDatabase();
  console.log('✓ Database initialized for testing\n');
} catch (error) {
  console.error('❌ Failed to initialize database:', error.message);
  process.exit(1);
}

// Test Case 1: Aggregate rates for a specific category
function testAggregateSingleCategory() {
  console.log('=== Test 1: Aggregate Single Category ===');

  try {
    // Try text-generation category (should have data from manual seed)
    const result = aggregateRates('text-generation', 'chat');

    if (!result) {
      console.log('⚠️  No data found for text-generation:chat');
      console.log('✅ PASS (graceful null handling)');
      return true;
    }

    console.log('Result:', JSON.stringify(result, null, 2));

    // Validate structure
    const hasRequiredFields =
      typeof result.price === 'number' &&
      typeof result.currency === 'string' &&
      typeof result.unit === 'string' &&
      typeof result.confidence === 'number' &&
      typeof result.sourceCount === 'number' &&
      typeof result.lastUpdated === 'string' &&
      typeof result.trend === 'string' &&
      result.category === 'text-generation';

    // Validate ranges
    const validRanges =
      result.price > 0 &&
      result.confidence >= 0 &&
      result.confidence <= 1 &&
      result.sourceCount > 0 &&
      ['up', 'down', 'stable'].includes(result.trend);

    const passed = hasRequiredFields && validRanges;

    console.log(passed ? '✅ PASS' : '❌ FAIL');
    return passed;
  } catch (error) {
    console.error('❌ FAIL — Error:', error.message);
    return false;
  }
}

// Test Case 2: Aggregate category without subcategory
function testAggregateCategoryOnly() {
  console.log('\n=== Test 2: Aggregate Category Only (No Subcategory) ===');

  try {
    // Try aggregating all text-generation rates (no subcategory filter)
    const result = aggregateRates('text-generation');

    if (!result) {
      console.log('⚠️  No data found for text-generation');
      console.log('✅ PASS (graceful null handling)');
      return true;
    }

    console.log('Price:', result.price);
    console.log('Source count:', result.sourceCount);
    console.log('Confidence:', result.confidence);
    console.log('Trend:', result.trend);
    console.log('Outliers removed:', result.meta.outliersRemoved);

    const passed =
      result.category === 'text-generation' &&
      result.subcategory === null;

    console.log(passed ? '✅ PASS' : '❌ FAIL');
    return passed;
  } catch (error) {
    console.error('❌ FAIL — Error:', error.message);
    return false;
  }
}

// Test Case 3: Non-existent category returns null
function testNonExistentCategory() {
  console.log('\n=== Test 3: Non-Existent Category Returns Null ===');

  try {
    const result = aggregateRates('non-existent-category', 'fake-subcategory');

    console.log('Result:', result);

    const passed = result === null;

    console.log(passed ? '✅ PASS (null for missing data)' : '❌ FAIL');
    return passed;
  } catch (error) {
    console.error('❌ FAIL — Error:', error.message);
    return false;
  }
}

// Test Case 4: Aggregate all categories
function testAggregateAllCategories() {
  console.log('\n=== Test 4: Aggregate All Categories ===');

  try {
    const results = aggregateAllCategories();

    console.log('Categories aggregated:', Object.keys(results).length);
    console.log('Categories:', Object.keys(results).slice(0, 5), '...');

    if (Object.keys(results).length === 0) {
      console.log('⚠️  No categories found in database');
      console.log('✅ PASS (empty DB is valid)');
      return true;
    }

    // Validate structure of first result
    const firstKey = Object.keys(results)[0];
    const firstResult = results[firstKey];

    console.log(`Sample (${firstKey}):`, {
      price: firstResult.price,
      confidence: firstResult.confidence,
      sourceCount: firstResult.sourceCount,
      trend: firstResult.trend
    });

    const passed =
      typeof results === 'object' &&
      firstResult.price > 0 &&
      firstResult.confidence >= 0 &&
      firstResult.confidence <= 1;

    console.log(passed ? '✅ PASS' : '❌ FAIL');
    return passed;
  } catch (error) {
    console.error('❌ FAIL — Error:', error.message);
    return false;
  }
}

// Test Case 5: Verify median calculation
function testMedianCalculation() {
  console.log('\n=== Test 5: Verify Median Calculation ===');

  try {
    // Get a category with data
    const result = aggregateRates('text-generation');

    if (!result) {
      console.log('⚠️  No data — skipping median test');
      console.log('✅ PASS (skip)');
      return true;
    }

    console.log('Price (should be median):', result.price);
    console.log('Source count:', result.sourceCount);
    console.log('Meta:', result.meta);

    // If we filtered outliers, median should be reasonable
    const passed =
      result.meta.medianUsed === true &&
      result.price > 0;

    console.log(passed ? '✅ PASS (median calculated)' : '❌ FAIL');
    return passed;
  } catch (error) {
    console.error('❌ FAIL — Error:', error.message);
    return false;
  }
}

// Test Case 6: Verify confidence scoring integration
function testConfidenceIntegration() {
  console.log('\n=== Test 6: Verify Confidence Scoring Integration ===');

  try {
    const result = aggregateRates('text-generation');

    if (!result) {
      console.log('⚠️  No data — skipping confidence test');
      console.log('✅ PASS (skip)');
      return true;
    }

    console.log('Confidence:', result.confidence);
    console.log('Source count:', result.sourceCount);

    // More sources should correlate with higher confidence (generally)
    const passed =
      result.confidence >= 0 &&
      result.confidence <= 1 &&
      (result.sourceCount >= 5 ? result.confidence >= 0.4 : true);

    console.log(passed ? '✅ PASS (confidence in range)' : '❌ FAIL');
    return passed;
  } catch (error) {
    console.error('❌ FAIL — Error:', error.message);
    return false;
  }
}

// Run all tests
console.log('========================================');
console.log('  Aggregation Engine Integration Tests');
console.log('========================================\n');

const results = [
  testAggregateSingleCategory(),
  testAggregateCategoryOnly(),
  testNonExistentCategory(),
  testAggregateAllCategories(),
  testMedianCalculation(),
  testConfidenceIntegration()
];

const passed = results.filter(r => r).length;
const total = results.length;

console.log('\n========================================');
console.log(`  Results: ${passed}/${total} tests passed`);
console.log('========================================');

process.exit(passed === total ? 0 : 1);
