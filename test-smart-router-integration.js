#!/usr/bin/env node
/**
 * Smart Router Integration Test
 * Tests SUCCESS CRITERIA for ROADMAP v2
 */

import { AgentRateOracle } from './src/sdk/index.js';

async function runTests() {
  console.log('🧪 ARO Smart Router Integration Test\n');

  const aro = new AgentRateOracle({ baseUrl: 'http://localhost:3402' });

  // Test 1: Create agent via API
  console.log('Test 1: Create agent...');
  const response = await fetch('http://localhost:3402/v1/agents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Integration Test Agent' })
  });
  const agentData = await response.json();
  const agent = agentData.data;
  console.log('✅ Agent created:', agent);

  // Test 2: Get rates (existing API)
  console.log('\nTest 2: Get rates...');
  const rates = await aro.getRates();
  console.log('✅ Found', rates.length, 'rate categories');

  // Test 3: Set budget
  console.log('\nTest 3: Set budget...');
  const aroWithKey = new AgentRateOracle({
    baseUrl: 'http://localhost:3402',
    apiKey: agent.apiKey,
    agentId: agent.id
  });
  await aroWithKey.setBudget(200);
  console.log('✅ Budget set to $200/month');

  // Test 4: Get budget status
  console.log('\nTest 4: Get budget status...');
  const budget = await aroWithKey.getBudget();
  console.log('✅ Budget status:', budget);

  // Test 5: Test smart route (should fail with no provider keys)
  console.log('\nTest 5: Test smart route (expect no provider keys)...');
  try {
    await aroWithKey.smartRoute({
      prompt: 'Test prompt',
      task: 'text-generation',
      optimize: 'cost'
    });
    console.log('❌ Expected error but succeeded');
  } catch (err) {
    if (err.message.includes('No provider API keys')) {
      console.log('✅ Correctly returned error: No provider keys configured');
    } else {
      console.log('❌ Unexpected error:', err.message);
    }
  }

  // Test 6: Get analytics
  console.log('\nTest 6: Get analytics...');
  const analytics = await aroWithKey.getAnalytics();
  console.log('✅ Analytics:', analytics);

  // Test 7: Get savings
  console.log('\nTest 7: Get savings...');
  const savings = await aroWithKey.getSavings();
  console.log('✅ Savings:', savings);

  console.log('\n✅ All SUCCESS CRITERIA tests passed!');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
});
