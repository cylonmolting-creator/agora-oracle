/**
 * test-providers-api.js — Test providers API endpoints
 *
 * Tests:
 * 1. GET /v1/providers — List all providers
 * 2. GET /v1/providers?sortByPrice=asc — Sort by price ascending
 * 3. GET /v1/providers?category=text-generation — Filter by category
 * 4. GET /v1/providers/1 — Specific provider (OpenAI)
 * 5. GET /v1/providers/999 — Non-existent provider (404)
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3402';

async function test() {
  console.log('🧪 Testing Providers API Endpoints\n');

  let passed = 0;
  let failed = 0;

  // Test 1: GET /v1/providers
  try {
    console.log('Test 1: GET /v1/providers');
    const res = await fetch(`${BASE_URL}/v1/providers`);
    const data = await res.json();

    if (res.status === 200 && data.success && data.data.length > 0) {
      console.log(`✅ Status: ${res.status}`);
      console.log(`✅ Providers: ${data.meta.count}`);
      console.log(`✅ Sample: ${data.data[0].name} (${data.data[0].serviceCount} services, avg: $${data.data[0].avgPrice})`);
      passed++;
    } else {
      console.log(`❌ Failed: ${res.status}`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    failed++;
  }

  console.log('');

  // Test 2: GET /v1/providers?sortByPrice=asc
  try {
    console.log('Test 2: GET /v1/providers?sortByPrice=asc');
    const res = await fetch(`${BASE_URL}/v1/providers?sortByPrice=asc`);
    const data = await res.json();

    if (res.status === 200 && data.success && data.data.length > 0) {
      const first = data.data[0];
      const last = data.data[data.data.length - 1];
      const isSorted = first.avgPrice <= last.avgPrice;

      console.log(`✅ Status: ${res.status}`);
      console.log(`✅ Sorted: ${isSorted ? 'YES' : 'NO'}`);
      console.log(`✅ Cheapest: ${first.name} ($${first.avgPrice})`);
      console.log(`✅ Most expensive: ${last.name} ($${last.avgPrice})`);
      passed++;
    } else {
      console.log(`❌ Failed: ${res.status}`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    failed++;
  }

  console.log('');

  // Test 3: GET /v1/providers?category=text-generation
  try {
    console.log('Test 3: GET /v1/providers?category=text-generation');
    const res = await fetch(`${BASE_URL}/v1/providers?category=text-generation`);
    const data = await res.json();

    if (res.status === 200 && data.success) {
      const allTextGen = data.data.every(p =>
        p.categories.includes('text-generation')
      );

      console.log(`✅ Status: ${res.status}`);
      console.log(`✅ Providers: ${data.meta.count}`);
      console.log(`✅ All text-generation: ${allTextGen ? 'YES' : 'NO'}`);
      console.log(`✅ Sample: ${data.data[0]?.name || 'N/A'}`);
      passed++;
    } else {
      console.log(`❌ Failed: ${res.status}`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    failed++;
  }

  console.log('');

  // Test 4: GET /v1/providers/1 (OpenAI)
  try {
    console.log('Test 4: GET /v1/providers/1 (specific provider)');
    const res = await fetch(`${BASE_URL}/v1/providers/1`);
    const data = await res.json();

    if (res.status === 200 && data.success && data.data.provider && data.data.services) {
      const { provider, services } = data.data;
      console.log(`✅ Status: ${res.status}`);
      console.log(`✅ Provider: ${provider.name}`);
      console.log(`✅ Services: ${services.length}`);
      console.log(`✅ Avg price: $${provider.avgPrice}`);
      console.log(`✅ Sample service: ${services[0]?.description || 'N/A'} ($${services[0]?.price})`);
      passed++;
    } else {
      console.log(`❌ Failed: ${res.status}`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    failed++;
  }

  console.log('');

  // Test 5: GET /v1/providers/999 (non-existent)
  try {
    console.log('Test 5: GET /v1/providers/999 (non-existent)');
    const res = await fetch(`${BASE_URL}/v1/providers/999`);
    const data = await res.json();

    if (res.status === 404 && !data.success) {
      console.log(`✅ Status: ${res.status}`);
      console.log(`✅ Error: "${data.error}"`);
      passed++;
    } else {
      console.log(`❌ Expected 404, got: ${res.status}`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    failed++;
  }

  console.log('');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${passed}/5`);
  console.log(`❌ Failed: ${failed}/5`);

  if (failed === 0) {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed');
    process.exit(1);
  }
}

test().catch(error => {
  console.error('Test suite error:', error);
  process.exit(1);
});
