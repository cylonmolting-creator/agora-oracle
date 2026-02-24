/**
 * SDK Test Script
 * Tests all AgentRateOracle SDK methods against running server
 */

import { AgentRateOracle } from './src/sdk/client.js';

const aro = new AgentRateOracle({ baseUrl: 'http://localhost:3402' });

async function testSDK() {
  console.log('🧪 Testing Agent Rate Oracle SDK\n');

  try {
    // Test 1: Health check
    console.log('1. Testing health()...');
    const health = await aro.health();
    console.log('   ✓ Health:', health);

    // Test 2: Get all rates
    console.log('\n2. Testing getRates()...');
    const rates = await aro.getRates();
    console.log(`   ✓ Found ${rates.length} rate categories`);

    // Test 3: Get specific rate
    console.log('\n3. Testing getRate(category, subcategory)...');
    const rate = await aro.getRate('text-generation', 'general');
    console.log(`   ✓ Rate: $${rate.aggregate.price} per ${rate.aggregate.unit}`);

    // Test 4: Get providers
    console.log('\n4. Testing getProviders()...');
    const providers = await aro.getProviders();
    console.log(`   ✓ Found ${providers.length} providers`);

    // Test 5: Get stats
    console.log('\n5. Testing getStats()...');
    const stats = await aro.getStats();
    console.log(`   ✓ Stats: ${stats.totalProviders} providers, ${stats.totalServices} services`);

    // Test 6: Compare rates
    console.log('\n6. Testing compareRates()...');
    const comparison = await aro.compareRates('text-generation', ['OpenAI', 'Anthropic']);
    console.log(`   ✓ Comparison: ${comparison.summary.servicesCompared} services compared`);

    // Test 7: Find best rate
    console.log('\n7. Testing findBestRate()...');
    const best = await aro.findBestRate('text-generation', { minConfidence: 0.5 });
    console.log(`   ✓ Best rate: ${best.subcategory || 'aggregate'} at $${best.price} per ${best.unit}`);

    console.log('\n✅ All SDK tests passed!');
  } catch (error) {
    console.error('\n❌ SDK test failed:', error.message);
    process.exit(1);
  }
}

testSDK();
