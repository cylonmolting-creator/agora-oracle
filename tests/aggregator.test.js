/**
 * Tests for Aggregator Module — Outlier Detection & Confidence Scoring
 */

import { detectOutliers } from '../src/aggregator/outlier.js';
import { calculateConfidence, calculateConfidenceDetailed } from '../src/aggregator/confidence.js';

// Test Case 1: Normal distribution with clear outliers
function testNormalDistributionWithOutliers() {
  console.log('\n=== Test 1: Normal Distribution with Outliers ===');

  const rates = [
    { price: 10, source: 'provider-a' },
    { price: 12, source: 'provider-b' },
    { price: 11, source: 'provider-c' },
    { price: 13, source: 'provider-d' },
    { price: 11.5, source: 'provider-e' },
    { price: 100, source: 'provider-outlier-1' },  // Clear outlier
    { price: 1, source: 'provider-outlier-2' },    // Clear outlier
    { price: 12.5, source: 'provider-f' }
  ];

  const result = detectOutliers(rates);

  console.log('Input rates:', rates.length);
  console.log('Quartiles: Q1=%s, Median=%s, Q3=%s', result.stats.q1, result.stats.median, result.stats.q3);
  console.log('IQR: %s', result.stats.iqr);
  console.log('Bounds: [%s, %s]', result.stats.lowerBound, result.stats.upperBound);
  console.log('Filtered rates:', result.filtered.length);
  console.log('Removed outliers:', result.removed.length);
  console.log('Removed prices:', result.removed.map(r => r.price));

  // Assertions
  const passed =
    result.removed.length === 2 &&
    result.filtered.length === 6 &&
    result.removed.some(r => r.price === 100) &&
    result.removed.some(r => r.price === 1);

  console.log(passed ? '✅ PASS' : '❌ FAIL');
  return passed;
}

// Test Case 2: No outliers (tight distribution)
function testNoOutliers() {
  console.log('\n=== Test 2: No Outliers (Tight Distribution) ===');

  const rates = [
    { price: 10.0, source: 'provider-a' },
    { price: 10.5, source: 'provider-b' },
    { price: 11.0, source: 'provider-c' },
    { price: 11.5, source: 'provider-d' },
    { price: 12.0, source: 'provider-e' }
  ];

  const result = detectOutliers(rates);

  console.log('Input rates:', rates.length);
  console.log('Quartiles: Q1=%s, Median=%s, Q3=%s', result.stats.q1, result.stats.median, result.stats.q3);
  console.log('IQR: %s', result.stats.iqr);
  console.log('Filtered rates:', result.filtered.length);
  console.log('Removed outliers:', result.removed.length);

  const passed =
    result.removed.length === 0 &&
    result.filtered.length === 5;

  console.log(passed ? '✅ PASS' : '❌ FAIL');
  return passed;
}

// Test Case 3: Edge case — only 2 data points
function testEdgeCaseTwoPoints() {
  console.log('\n=== Test 3: Edge Case — Two Data Points ===');

  const rates = [
    { price: 10, source: 'provider-a' },
    { price: 100, source: 'provider-b' }
  ];

  const result = detectOutliers(rates);

  console.log('Input rates:', rates.length);
  console.log('Filtered rates:', result.filtered.length);
  console.log('Removed outliers:', result.removed.length);

  // With only 2 points, no outliers are detected
  const passed =
    result.removed.length === 0 &&
    result.filtered.length === 2;

  console.log(passed ? '✅ PASS (no outliers with <3 points)' : '❌ FAIL');
  return passed;
}

// Test Case 4: Edge case — empty array
function testEdgeCaseEmpty() {
  console.log('\n=== Test 4: Edge Case — Empty Array ===');

  const rates = [];

  const result = detectOutliers(rates);

  console.log('Input rates:', rates.length);
  console.log('Filtered rates:', result.filtered.length);
  console.log('Removed outliers:', result.removed.length);

  const passed =
    result.filtered.length === 0 &&
    result.removed.length === 0 &&
    result.stats.total === 0;

  console.log(passed ? '✅ PASS' : '❌ FAIL');
  return passed;
}

// Test Case 5: Edge case — single data point
function testEdgeCaseSinglePoint() {
  console.log('\n=== Test 5: Edge Case — Single Data Point ===');

  const rates = [
    { price: 42, source: 'provider-a' }
  ];

  const result = detectOutliers(rates);

  console.log('Input rates:', rates.length);
  console.log('Filtered rates:', result.filtered.length);
  console.log('Removed outliers:', result.removed.length);

  const passed =
    result.filtered.length === 1 &&
    result.removed.length === 0;

  console.log(passed ? '✅ PASS' : '❌ FAIL');
  return passed;
}

// ========================================
// CONFIDENCE SCORING TESTS
// ========================================

// Test Case 6: High confidence — many sources, low variance, fresh data
function testHighConfidence() {
  console.log('\n=== Test 6: High Confidence (Many sources, low variance, fresh) ===');

  const now = Date.now();
  const rates = [
    { price: 10.0, timestamp: now },
    { price: 10.2, timestamp: now - 3600000 },  // 1h ago
    { price: 10.1, timestamp: now },
    { price: 10.3, timestamp: now - 7200000 },  // 2h ago
    { price: 10.15, timestamp: now }
  ];

  const confidence = calculateConfidence(rates);
  const detailed = calculateConfidenceDetailed(rates);

  console.log('Source count:', rates.length);
  console.log('Confidence:', confidence.toFixed(3));
  console.log('Breakdown:', detailed.breakdown);
  console.log('Stats:', detailed.stats);

  // 5 sources, low stddev, fresh data → should be high (>0.8)
  const passed = confidence > 0.8;

  console.log(passed ? '✅ PASS (confidence > 0.8)' : '❌ FAIL');
  return passed;
}

// Test Case 7: Medium confidence — few sources, moderate variance
function testMediumConfidence() {
  console.log('\n=== Test 7: Medium Confidence (Few sources, moderate variance) ===');

  const now = Date.now();
  const rates = [
    { price: 10.0, timestamp: now },
    { price: 12.0, timestamp: now },
    { price: 11.0, timestamp: now }
  ];

  const confidence = calculateConfidence(rates);
  const detailed = calculateConfidenceDetailed(rates);

  console.log('Source count:', rates.length);
  console.log('Confidence:', confidence.toFixed(3));
  console.log('Breakdown:', detailed.breakdown);

  // 3 sources, moderate variance → should be medium-high (0.6-0.85)
  const passed = confidence >= 0.6 && confidence <= 0.85;

  console.log(passed ? '✅ PASS (0.6 <= confidence <= 0.85)' : '❌ FAIL');
  return passed;
}

// Test Case 8: Low confidence — high variance
function testLowConfidenceHighVariance() {
  console.log('\n=== Test 8: Low Confidence (High variance) ===');

  const now = Date.now();
  const rates = [
    { price: 5.0, timestamp: now },
    { price: 15.0, timestamp: now },
    { price: 10.0, timestamp: now }
  ];

  const confidence = calculateConfidence(rates);
  const detailed = calculateConfidenceDetailed(rates);

  console.log('Source count:', rates.length);
  console.log('Confidence:', confidence.toFixed(3));
  console.log('Breakdown:', detailed.breakdown);
  console.log('StdDev:', detailed.stats.stddev);

  // High variance (CV = 50%) → should lower confidence
  const passed = confidence < 0.7;

  console.log(passed ? '✅ PASS (confidence < 0.7)' : '❌ FAIL');
  return passed;
}

// Test Case 9: Freshness decay — old data lowers confidence
function testFreshnessDecay() {
  console.log('\n=== Test 9: Freshness Decay (Old data) ===');

  const now = Date.now();
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

  const freshRates = [
    { price: 10.0, timestamp: now },
    { price: 10.1, timestamp: now },
    { price: 10.2, timestamp: now }
  ];

  const oldRates = [
    { price: 10.0, timestamp: thirtyDaysAgo },
    { price: 10.1, timestamp: thirtyDaysAgo },
    { price: 10.2, timestamp: thirtyDaysAgo }
  ];

  const freshConfidence = calculateConfidence(freshRates);
  const oldConfidence = calculateConfidence(oldRates);

  console.log('Fresh confidence:', freshConfidence.toFixed(3));
  console.log('Old confidence:', oldConfidence.toFixed(3));
  console.log('Decay:', (freshConfidence - oldConfidence).toFixed(3));

  // Fresh data should have higher confidence
  const passed = freshConfidence > oldConfidence;

  console.log(passed ? '✅ PASS (fresh > old)' : '❌ FAIL');
  return passed;
}

// Test Case 10: Edge case — empty array
function testConfidenceEmpty() {
  console.log('\n=== Test 10: Confidence Edge Case — Empty Array ===');

  const confidence = calculateConfidence([]);

  console.log('Confidence:', confidence);

  const passed = confidence === 0.0;

  console.log(passed ? '✅ PASS (confidence = 0.0)' : '❌ FAIL');
  return passed;
}

// Test Case 11: Edge case — single source
function testConfidenceSingleSource() {
  console.log('\n=== Test 11: Confidence Edge Case — Single Source ===');

  const now = Date.now();
  const rates = [{ price: 10.0, timestamp: now }];

  const confidence = calculateConfidence(rates);
  const detailed = calculateConfidenceDetailed(rates);

  console.log('Confidence:', confidence.toFixed(3));
  console.log('Breakdown:', detailed.breakdown);

  // Single source caps at 0.6 max
  const passed = confidence <= 0.6;

  console.log(passed ? '✅ PASS (single source <= 0.6)' : '❌ FAIL');
  return passed;
}

// Run all tests
console.log('========================================');
console.log('  Aggregator Tests — Outlier & Confidence');
console.log('========================================');

const results = [
  // Outlier tests
  testNormalDistributionWithOutliers(),
  testNoOutliers(),
  testEdgeCaseTwoPoints(),
  testEdgeCaseEmpty(),
  testEdgeCaseSinglePoint(),
  // Confidence tests
  testHighConfidence(),
  testMediumConfidence(),
  testLowConfidenceHighVariance(),
  testFreshnessDecay(),
  testConfidenceEmpty(),
  testConfidenceSingleSource()
];

const passed = results.filter(r => r).length;
const total = results.length;

console.log('\n========================================');
console.log(`  Results: ${passed}/${total} tests passed`);
console.log('========================================');

process.exit(passed === total ? 0 : 1);
