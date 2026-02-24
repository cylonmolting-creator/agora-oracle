#!/usr/bin/env node
/**
 * Simple test suite for Compare API
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3402';

async function test(name, fn) {
  try {
    process.stdout.write(`\n${name}... `);
    await fn();
    console.log('✅');
    return true;
  } catch (error) {
    console.log(`❌\n  Error: ${error.message}`);
    return false;
  }
}

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text.substring(0, 200)}`);
  }
  return response.json();
}

async function runTests() {
  console.log('\n=== Compare API Tests ===');

  let passed = 0;
  let total = 0;

  // Test 1: Compare all providers in text-generation category
  total++;
  if (await test('Test 1: GET /v1/compare?category=text-generation', async () => {
    const result = await fetchJSON(`${BASE_URL}/v1/compare?category=text-generation`);

    if (!result.success) throw new Error('success should be true');
    if (!result.data.summary) throw new Error('summary missing');
    if (!result.data.comparison) throw new Error('comparison array missing');
    if (!Array.isArray(result.data.comparison)) throw new Error('comparison should be array');
    if (result.data.comparison.length === 0) throw new Error('should have comparison results');

    // Check summary
    const { summary } = result.data;
    if (typeof summary.providersCompared !== 'number') throw new Error('providersCompared missing');
    if (!summary.priceRange) throw new Error('priceRange missing');
    if (!summary.cheapest) throw new Error('cheapest missing');
    if (!summary.mostExpensive) throw new Error('mostExpensive missing');
    if (!summary.costSpread) throw new Error('costSpread missing');

    // Check first entry structure
    const first = result.data.comparison[0];
    if (first.ranking !== 1) throw new Error('first entry should have ranking 1');
    if (!first.provider) throw new Error('provider name missing');
    if (typeof first.price !== 'number') throw new Error('price should be number');
    if (!first.currency) throw new Error('currency missing');
    if (typeof first.relativeCost !== 'number') throw new Error('relativeCost missing');
    if (first.relativeCost !== 1) throw new Error('first item relativeCost should be 1.0');

    // Check sorted by price ascending
    for (let i = 0; i < result.data.comparison.length - 1; i++) {
      if (result.data.comparison[i].price > result.data.comparison[i + 1].price) {
        throw new Error(`Not sorted: ${result.data.comparison[i].price} > ${result.data.comparison[i + 1].price}`);
      }
    }

    console.log(`\n    Providers: ${summary.providersCompared}, Services: ${summary.servicesCompared}`);
    console.log(`    Cheapest: ${summary.cheapest.provider} @ $${summary.cheapest.price}/${summary.cheapest.unit}`);
    console.log(`    Price range: $${summary.priceRange.min} - $${summary.priceRange.max}`);
    console.log(`    Cost spread: ${summary.costSpread}`);
  })) passed++;

  // Test 2: Compare with subcategory filter
  total++;
  if (await test('Test 2: GET /v1/compare?category=text-generation&subcategory=general', async () => {
    const result = await fetchJSON(`${BASE_URL}/v1/compare?category=text-generation&subcategory=general`);

    if (!result.success) throw new Error('success should be true');
    if (result.data.summary.subcategory !== 'general') throw new Error('subcategory should be "general"');
    if (result.data.comparison.length === 0) throw new Error('should have results');

    // All should be "general" subcategory
    for (const item of result.data.comparison) {
      if (item.subcategory !== 'general') {
        throw new Error(`Found non-general subcategory: ${item.subcategory}`);
      }
    }

    console.log(`\n    Found ${result.data.comparison.length} general text-generation services`);
  })) passed++;

  // Test 3: Compare specific providers by name
  total++;
  if (await test('Test 3: GET /v1/compare?category=text-generation&providers=OpenAI,Anthropic', async () => {
    const result = await fetchJSON(`${BASE_URL}/v1/compare?category=text-generation&providers=OpenAI,Anthropic`);

    if (!result.success) throw new Error('success should be true');
    if (result.data.comparison.length === 0) throw new Error('should have results');

    // Check only specified providers are included
    const providers = new Set(result.data.comparison.map(c => c.provider));
    for (const provider of providers) {
      if (!['OpenAI', 'Anthropic'].includes(provider)) {
        throw new Error(`Unexpected provider: ${provider}`);
      }
    }

    console.log(`\n    Found ${result.data.comparison.length} services from ${providers.size} providers`);
  })) passed++;

  // Test 4: Missing category parameter (should return 400)
  total++;
  if (await test('Test 4: GET /v1/compare (missing category) returns 400', async () => {
    const response = await fetch(`${BASE_URL}/v1/compare`);
    const result = await response.json();

    if (response.status !== 400) throw new Error(`Expected 400, got ${response.status}`);
    if (result.success !== false) throw new Error('success should be false');
    if (!result.error || !result.error.toLowerCase().includes('category')) {
      throw new Error('error message should mention category');
    }
  })) passed++;

  // Test 5: Non-existent category (should return 404)
  total++;
  if (await test('Test 5: GET /v1/compare?category=nonexistent returns 404', async () => {
    const response = await fetch(`${BASE_URL}/v1/compare?category=nonexistent-category-xyz`);
    const result = await response.json();

    if (response.status !== 404) throw new Error(`Expected 404, got ${response.status}`);
    if (result.success !== false) throw new Error('success should be false');
  })) passed++;

  // Summary
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed}/${total} tests passed`);
  console.log('='.repeat(50));

  return passed === total;
}

// Main
runTests()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
