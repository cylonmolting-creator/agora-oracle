#!/usr/bin/env node

/**
 * test-compare-api.js — Manual test for compare API
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3402';

async function test(name, fn) {
  process.stdout.write(`Test: ${name} ... `);
  try {
    await fn();
    console.log('✅');
    return true;
  } catch (error) {
    console.log(`❌\n  Error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('\n=== Compare API Tests ===\n');

  let passed = 0;
  let failed = 0;

  // Test 1: Compare all providers in text-generation category
  if (await test('GET /v1/compare?category=text-generation returns comparison', async () => {
    const response = await fetch(`${BASE_URL}/v1/compare?category=text-generation`);
    const data = await response.json();
    
    if (response.status !== 200) throw new Error(`Status ${response.status}`);
    if (!data.success) throw new Error('success=false');
    if (!data.data.comparison) throw new Error('Missing comparison array');
    if (!Array.isArray(data.data.comparison)) throw new Error('comparison is not array');
    if (data.data.comparison.length === 0) throw new Error('comparison array is empty');
    
    // Check ranking
    if (data.data.comparison[0].ranking !== 1) throw new Error('First item ranking should be 1');
    
    // Check price sorting (ascending)
    const prices = data.data.comparison.map(c => c.pricing.price);
    for (let i = 1; i < prices.length; i++) {
      if (prices[i] < prices[i-1]) throw new Error('Prices not sorted ascending');
    }
    
    // Check priceStats
    if (!data.meta.priceStats) throw new Error('Missing priceStats');
    if (typeof data.meta.priceStats.min !== 'number') throw new Error('Invalid priceStats.min');
    
    console.log(`    Found ${data.data.comparison.length} providers, price range: $${data.meta.priceStats.min}-$${data.meta.priceStats.max}`);
  })) passed++; else failed++;

  // Test 2: Compare with specific providers
  if (await test('GET /v1/compare?category=text-generation&providers=1,2 returns filtered', async () => {
    const response = await fetch(`${BASE_URL}/v1/compare?category=text-generation&providers=1,2`);
    const data = await response.json();
    
    if (response.status !== 200) throw new Error(`Status ${response.status}`);
    if (!data.success) throw new Error('success=false');
    if (data.data.comparison.length === 0) throw new Error('No results for provider filter');
    
    // Should only have max 2 providers
    const providerIds = [...new Set(data.data.comparison.map(c => c.provider.id))];
    if (providerIds.length > 2) throw new Error(`Expected max 2 providers, got ${providerIds.length}`);
    
    console.log(`    Filtered to ${data.data.comparison.length} services from ${providerIds.length} providers`);
  })) passed++; else failed++;

  // Test 3: Compare with subcategory filter
  if (await test('GET /v1/compare?category=text-generation&subcategory=general', async () => {
    const response = await fetch(`${BASE_URL}/v1/compare?category=text-generation&subcategory=general`);
    const data = await response.json();
    
    if (response.status !== 200) throw new Error(`Status ${response.status}`);
    if (!data.success) throw new Error('success=false');
    
    // All results should have subcategory=general
    const wrongSubcat = data.data.comparison.find(c => c.service.subcategory !== 'general');
    if (wrongSubcat) throw new Error(`Found wrong subcategory: ${wrongSubcat.service.subcategory}`);
    
    console.log(`    Found ${data.data.comparison.length} services in subcategory=general`);
  })) passed++; else failed++;

  // Test 4: Missing category parameter returns 400
  if (await test('GET /v1/compare (no category) returns 400 error', async () => {
    const response = await fetch(`${BASE_URL}/v1/compare`);
    const data = await response.json();
    
    if (response.status !== 400) throw new Error(`Expected 400, got ${response.status}`);
    if (data.success !== false) throw new Error('Expected success=false');
    if (!data.error) throw new Error('Missing error message');
  })) passed++; else failed++;

  // Test 5: Check response structure
  if (await test('Response has correct structure', async () => {
    const response = await fetch(`${BASE_URL}/v1/compare?category=text-generation`);
    const data = await response.json();
    
    const firstItem = data.data.comparison[0];
    if (!firstItem.ranking) throw new Error('Missing ranking');
    if (!firstItem.provider) throw new Error('Missing provider');
    if (!firstItem.service) throw new Error('Missing service');
    if (!firstItem.pricing) throw new Error('Missing pricing');
    if (!firstItem.quality) throw new Error('Missing quality');
    if (!firstItem.priceComparison) throw new Error('Missing priceComparison');
    
    if (typeof firstItem.pricing.price !== 'number') throw new Error('price not a number');
    if (typeof firstItem.quality.confidence !== 'number') throw new Error('confidence not a number');
  })) passed++; else failed++;

  // Summary
  console.log(`\n=== Summary: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
