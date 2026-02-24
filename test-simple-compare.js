#!/usr/bin/env node
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3402';

async function main() {
  console.log('\n=== Simple Compare API Test ===\n');

  // Test 1: Basic compare
  console.log('Test 1: GET /v1/compare?category=text-generation');
  const r1 = await fetch(`${BASE_URL}/v1/compare?category=text-generation`);
  const d1 = await r1.json();
  console.log(`Status: ${r1.status} ${r1.ok ? '✅' : '❌'}`);
  console.log(`Success: ${d1.success} ${d1.success ? '✅' : '❌'}`);
  console.log(`Providers: ${d1.data?.summary?.providersCompared || 0}`);
  console.log(`Services: ${d1.data?.summary?.servicesCompared || 0}`);
  console.log(`Price range: $${d1.data?.summary?.priceRange?.min} - $${d1.data?.summary?.priceRange?.max}`);
  console.log();

  // Test 2: Missing category
  console.log('Test 2: GET /v1/compare (no category)');
  const r2 = await fetch(`${BASE_URL}/v1/compare`);
  const d2 = await r2.json();
  console.log(`Status: ${r2.status} ${r2.status === 400 ? '✅' : '❌'}`);
  console.log(`Success: ${d2.success} ${d2.success === false ? '✅' : '❌'}`);
  console.log(`Error: ${d2.error}`);
  console.log();

  // Test 3: With provider filter
  console.log('Test 3: GET /v1/compare?category=text-generation&providers=1,2');
  const r3 = await fetch(`${BASE_URL}/v1/compare?category=text-generation&providers=1,2`);
  const d3 = await r3.json();
  console.log(`Status: ${r3.status} ${r3.ok ? '✅' : '❌'}`);
  console.log(`Providers: ${d3.data?.summary?.providersCompared || 0}`);
  console.log(`Services: ${d3.data?.summary?.servicesCompared || 0}`);
  console.log();

  console.log('=== All tests completed ===\n');
}

main().catch(console.error);
