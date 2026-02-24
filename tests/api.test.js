#!/usr/bin/env node
/**
 * tests/api.test.js
 * 
 * Comprehensive API test suite
 * Tests all endpoints for basic functionality
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
  const data = await response.json();
  return { status: response.status, data };
}

async function runTests() {
  console.log('\n=== ARO API Integration Tests ===\n');

  let passed = 0;
  let total = 0;

  // Test 1: Health endpoint
  total++;
  if (await test('Test 1: GET /health returns OK', async () => {
    const { status, data } = await fetchJSON(`${BASE_URL}/health`);
    
    if (status !== 200) throw new Error(`Expected 200, got ${status}`);
    if (data.status !== 'ok') throw new Error('Status should be "ok"');
    if (!data.version) throw new Error('Version missing');
    if (typeof data.uptime !== 'number') throw new Error('Uptime should be number');
    
    console.log(`\n    Version: ${data.version}`);
    console.log(`    Uptime: ${data.uptime.toFixed(2)}s`);
  })) passed++;

  // Test 2: Rates endpoint returns valid JSON
  total++;
  if (await test('Test 2: GET /v1/rates returns valid JSON', async () => {
    const { status, data } = await fetchJSON(`${BASE_URL}/v1/rates`);
    
    if (status !== 200) throw new Error(`Expected 200, got ${status}`);
    if (data.success !== true) throw new Error('success should be true');
    if (!Array.isArray(data.data)) throw new Error('data should be array');
    if (!data.meta) throw new Error('meta missing');
    if (!data.meta.timestamp) throw new Error('timestamp missing');
    if (!data.meta.apiVersion) throw new Error('apiVersion missing');
    
    console.log(`\n    Found ${data.meta.count} rate categories`);
  })) passed++;

  // Test 3: Providers endpoint returns valid JSON
  total++;
  if (await test('Test 3: GET /v1/providers returns valid JSON', async () => {
    const { status, data } = await fetchJSON(`${BASE_URL}/v1/providers`);
    
    if (status !== 200) throw new Error(`Expected 200, got ${status}`);
    if (data.success !== true) throw new Error('success should be true');
    if (!Array.isArray(data.data)) throw new Error('data should be array');
    if (data.data.length === 0) throw new Error('should have providers');
    
    const provider = data.data[0];
    if (!provider.id) throw new Error('provider.id missing');
    if (!provider.name) throw new Error('provider.name missing');
    
    console.log(`\n    Found ${data.meta.count} providers`);
  })) passed++;

  // Test 4: Stats endpoint returns valid JSON
  total++;
  if (await test('Test 4: GET /v1/stats returns valid JSON', async () => {
    const { status, data } = await fetchJSON(`${BASE_URL}/v1/stats`);
    
    if (status !== 200) throw new Error(`Expected 200, got ${status}`);
    if (data.success !== true) throw new Error('success should be true');
    if (!data.data) throw new Error('data missing');
    if (typeof data.data.totalProviders !== 'number') throw new Error('totalProviders missing');
    if (typeof data.data.totalServices !== 'number') throw new Error('totalServices missing');
    
    console.log(`\n    Providers: ${data.data.totalProviders}`);
    console.log(`    Services: ${data.data.totalServices}`);
  })) passed++;

  // Test 5: Compare endpoint returns valid JSON
  total++;
  if (await test('Test 5: GET /v1/compare?category=text-generation returns valid JSON', async () => {
    const { status, data } = await fetchJSON(`${BASE_URL}/v1/compare?category=text-generation`);
    
    if (status !== 200) throw new Error(`Expected 200, got ${status}`);
    if (data.success !== true) throw new Error('success should be true');
    if (!data.data.comparison) throw new Error('comparison missing');
    if (!Array.isArray(data.data.comparison)) throw new Error('comparison should be array');
    
    console.log(`\n    Compared ${data.meta.count} providers`);
  })) passed++;

  // Test 6: 404 for unknown route
  total++;
  if (await test('Test 6: GET /v1/nonexistent returns 404', async () => {
    const { status, data } = await fetchJSON(`${BASE_URL}/v1/nonexistent`);
    
    if (status !== 404) throw new Error(`Expected 404, got ${status}`);
    if (data.success !== false) throw new Error('success should be false');
    if (!data.error) throw new Error('error message missing');
    
    console.log(`\n    Error: "${data.error}"`);
  })) passed++;

  // Test 7: 404 for specific provider not found
  total++;
  if (await test('Test 7: GET /v1/providers/999999 returns 404', async () => {
    const { status, data } = await fetchJSON(`${BASE_URL}/v1/providers/999999`);
    
    if (status !== 404) throw new Error(`Expected 404, got ${status}`);
    if (data.success !== false) throw new Error('success should be false');
    
    console.log(`\n    Error: "${data.error}"`);
  })) passed++;

  // Test 8: 400 for compare without category
  total++;
  if (await test('Test 8: GET /v1/compare (no category) returns 400', async () => {
    const { status, data } = await fetchJSON(`${BASE_URL}/v1/compare`);
    
    if (status !== 400) throw new Error(`Expected 400, got ${status}`);
    if (data.success !== false) throw new Error('success should be false');
    
    console.log(`\n    Error: "${data.error}"`);
  })) passed++;

  // Test 9: CORS headers present
  total++;
  if (await test('Test 9: CORS headers are present', async () => {
    const response = await fetch(`${BASE_URL}/health`);
    const corsHeader = response.headers.get('access-control-allow-origin');
    
    if (!corsHeader) throw new Error('CORS header missing');
    
    console.log(`\n    CORS: ${corsHeader}`);
  })) passed++;

  // Test 10: Response time is reasonable
  total++;
  if (await test('Test 10: Response time < 500ms', async () => {
    const start = Date.now();
    await fetchJSON(`${BASE_URL}/v1/rates`);
    const duration = Date.now() - start;
    
    if (duration > 500) throw new Error(`Response took ${duration}ms (> 500ms)`);
    
    console.log(`\n    Response time: ${duration}ms`);
  })) passed++;

  // Summary
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed}/${total} tests passed`);
  console.log(`${'='.repeat(50)}\n`);

  process.exit(passed === total ? 0 : 1);
}

runTests().catch(error => {
  console.error('\n❌ Test runner failed:', error);
  process.exit(1);
});
