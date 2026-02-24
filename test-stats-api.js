/**
 * test-stats-api.js — Test stats API endpoints
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3402';

async function test() {
  console.log('🧪 Testing Stats API Endpoints\n');

  let passed = 0;
  let failed = 0;

  // Test 1: GET /v1/stats
  try {
    console.log('Test 1: GET /v1/stats');
    const res = await fetch(`${BASE_URL}/v1/stats`);
    const data = await res.json();

    if (res.status === 200 && data.success) {
      console.log(`✅ Status: ${res.status}`);
      console.log(`✅ Providers: ${data.data.totalProviders}`);
      console.log(`✅ Services: ${data.data.totalServices}`);
      console.log(`✅ Rates: ${data.data.totalRates}`);
      console.log(`✅ Categories: ${data.data.categoriesCount}`);
      console.log(`✅ Avg confidence: ${data.data.averageConfidence}`);
      console.log(`✅ Price range: $${data.data.priceRange.min} - $${data.data.priceRange.max}`);
      passed++;
    } else {
      console.log(`❌ Failed: ${res.status}`);
      console.log(JSON.stringify(data, null, 2));
      failed++;
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    failed++;
  }

  console.log('');

  // Test 2: GET /v1/stats/volatility
  try {
    console.log('Test 2: GET /v1/stats/volatility');
    const res = await fetch(`${BASE_URL}/v1/stats/volatility`);
    const data = await res.json();

    if (res.status === 200 && data.success) {
      console.log(`✅ Status: ${res.status}`);
      console.log(`✅ Volatile categories: ${data.data.topVolatile?.length || 0}`);
      
      if (data.data.topVolatile && data.data.topVolatile.length > 0) {
        const top = data.data.topVolatile[0];
        console.log(`✅ Most volatile: ${top.category}:${top.subcategory} (${top.volatility}%)`);
      }
      
      console.log(`✅ Market trend: ${data.data.marketTrend?.direction || 'N/A'} (${data.data.marketTrend?.change24h || 0}%)`);
      passed++;
    } else {
      console.log(`❌ Failed: ${res.status}`);
      console.log(JSON.stringify(data, null, 2));
      failed++;
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    failed++;
  }

  console.log('');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${passed}/2`);
  console.log(`❌ Failed: ${failed}/2`);

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
