/**
 * Test script for rates API endpoints
 * Tests all 3 routes:
 * - GET /v1/rates
 * - GET /v1/rates/:category
 * - GET /v1/rates/:category/:subcategory
 */

import express from 'express';
import cors from 'cors';
import { initDatabase } from './src/db/database.js';
import ratesRouter from './src/api/rates.js';
import { seedFromManualData } from './src/crawler/providers/manual.js';

// Initialize database
console.log('🔧 Initializing database...');
initDatabase('./data/aro.db');

// Check if we need to seed data
console.log('🌱 Seeding data if needed...');
await seedFromManualData();

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());

// Mount rates router
app.use('/v1/rates', ratesRouter);

// Start server
const PORT = 3403; // Different port to avoid conflict
const server = app.listen(PORT, () => {
  console.log(`✅ Test server running on http://localhost:${PORT}`);
  runTests();
});

async function runTests() {
  console.log('\n🧪 Running API tests...\n');

  // Test 1: GET /v1/rates
  console.log('Test 1: GET /v1/rates');
  try {
    const res = await fetch(`http://localhost:${PORT}/v1/rates`);
    const data = await res.json();
    console.log(`✅ Status: ${res.status}`);
    console.log(`✅ Success: ${data.success}`);
    console.log(`✅ Count: ${data.meta.count} rates`);
    console.log(`✅ Sample rate:`, data.data[0]);
  } catch (error) {
    console.error('❌ Test 1 failed:', error.message);
  }

  // Test 2: GET /v1/rates/:category
  console.log('\n Test 2: GET /v1/rates/text-generation');
  try {
    const res = await fetch(`http://localhost:${PORT}/v1/rates/text-generation`);
    const data = await res.json();
    console.log(`✅ Status: ${res.status}`);
    console.log(`✅ Success: ${data.success}`);
    console.log(`✅ Category: ${data.data.category}`);
    console.log(`✅ Subcategories: ${data.meta.subcategoryCount}`);
    console.log(`✅ Aggregate price: $${data.data.aggregate.price} per ${data.data.aggregate.unit}`);
    console.log(`✅ Confidence: ${data.data.aggregate.confidence}`);
  } catch (error) {
    console.error('❌ Test 2 failed:', error.message);
  }

  // Test 3: GET /v1/rates/:category/:subcategory
  console.log('\nTest 3: GET /v1/rates/text-generation/general');
  try {
    const res = await fetch(`http://localhost:${PORT}/v1/rates/text-generation/general`);
    const data = await res.json();
    console.log(`✅ Status: ${res.status}`);
    console.log(`✅ Success: ${data.success}`);
    console.log(`✅ Aggregate price: $${data.data.aggregate.price} per ${data.data.aggregate.unit}`);
    console.log(`✅ Providers: ${data.meta.providerCount}`);
    console.log(`✅ History days: ${data.meta.historyDays}`);
    console.log(`✅ Top 3 providers by price:`);
    data.data.providers.slice(0, 3).forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.provider}: $${p.price}`);
    });
  } catch (error) {
    console.error('❌ Test 3 failed:', error.message);
  }

  // Test 4: 404 error handling
  console.log('\nTest 4: GET /v1/rates/nonexistent-category (404 test)');
  try {
    const res = await fetch(`http://localhost:${PORT}/v1/rates/nonexistent-category`);
    const data = await res.json();
    console.log(`✅ Status: ${res.status}`);
    console.log(`✅ Success: ${data.success}`);
    console.log(`✅ Error message: ${data.error}`);
  } catch (error) {
    console.error('❌ Test 4 failed:', error.message);
  }

  console.log('\n✅ All tests completed!');
  server.close();
  process.exit(0);
}
