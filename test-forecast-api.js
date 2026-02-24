/**
 * Test: Forecast API Endpoints
 *
 * Tests all forecast API endpoints:
 * 1. GET /v1/forecast/:skill - Get 7-day forecast
 * 2. GET /v1/forecast/:skill/accuracy - Get model accuracy
 * 3. POST /v1/forecast/generate - Trigger forecast generation
 * 4. GET /v1/forecast/status - Get forecast system status
 */

import { initDatabase, getAll } from './src/db/database.js';
import logger from './src/logger.js';

const BASE_URL = 'http://localhost:3402/v1';

async function testForecastAPI() {
  console.log('\n=== Forecast API Test ===\n');

  try {
    // Initialize database first
    await initDatabase();
    console.log('✓ Database initialized\n');

    // Pre-check: Verify we have forecasts in database
    const forecastCount = await getAll(
      `SELECT COUNT(*) as count FROM price_forecasts WHERE forecast_date >= DATE('now')`
    );
    console.log(`📊 Forecasts in DB: ${forecastCount[0].count}`);

    // If no forecasts, generate them first
    if (forecastCount[0].count === 0) {
      console.log('⚠️  No forecasts found, generating...\n');
      const genResponse = await fetch(`${BASE_URL}/forecast/generate`, {
        method: 'POST'
      });
      const genResult = await genResponse.json();
      console.log('✓ Generation result:', genResult.data);
      console.log('');
    }

    // Test 1: GET /v1/forecast/status
    console.log('Test 1: GET /v1/forecast/status');
    const statusResponse = await fetch(`${BASE_URL}/forecast/status`);
    const statusData = await statusResponse.json();
    console.log(`Status: ${statusResponse.status}`);
    console.log('Data:', JSON.stringify(statusData, null, 2));
    console.log('');

    // Test 2: GET /v1/forecast/:skill (text-generation)
    console.log('Test 2: GET /v1/forecast/text-generation');
    const forecastResponse = await fetch(`${BASE_URL}/forecast/text-generation`);
    const forecastData = await forecastResponse.json();
    console.log(`Status: ${forecastResponse.status}`);

    if (forecastData.success) {
      console.log(`✓ Skill: ${forecastData.data.skill}`);
      console.log(`✓ Current Price: $${forecastData.data.currentPrice}`);
      console.log(`✓ Trend: ${forecastData.data.trend} (${forecastData.data.trendStrength}%)`);
      console.log(`✓ Recommendation: ${forecastData.data.recommendation}`);
      console.log(`✓ Forecasts: ${forecastData.data.forecast.length} days`);
      console.log(`✓ Avg Confidence: ${forecastData.data.meta.avgConfidence}`);

      // Show first 3 forecasts
      forecastData.data.forecast.slice(0, 3).forEach((f, i) => {
        console.log(`  Day ${i+1}: ${f.date} → $${f.predictedPrice} (conf: ${f.confidence})`);
      });
    } else {
      console.log('✗ Error:', forecastData.error);
    }
    console.log('');

    // Test 3: GET /v1/forecast/:skill/accuracy
    console.log('Test 3: GET /v1/forecast/text-generation/accuracy');
    const accuracyResponse = await fetch(`${BASE_URL}/forecast/text-generation/accuracy`);
    const accuracyData = await accuracyResponse.json();
    console.log(`Status: ${accuracyResponse.status}`);

    if (accuracyData.success) {
      console.log(`✓ MAE: ${accuracyData.data.mae}`);
      console.log(`✓ RMSE: ${accuracyData.data.rmse}`);
      console.log(`✓ Accuracy: ${accuracyData.data.accuracy}%`);
      console.log(`✓ Test Days: ${accuracyData.data.testDays}`);
    } else {
      console.log('✗ Error:', accuracyData.error);
      console.log('  (This is expected if <60 days of data)');
    }
    console.log('');

    // Test 4: GET /v1/forecast/:skill (invalid skill)
    console.log('Test 4: GET /v1/forecast/nonexistent-skill (should 503)');
    const invalidResponse = await fetch(`${BASE_URL}/forecast/nonexistent-skill`);
    const invalidData = await invalidResponse.json();
    console.log(`Status: ${invalidResponse.status}`);
    console.log('Error:', invalidData.error);
    console.log('');

    // Test 5: GET /v1/forecast/:skill (empty skill - should 400)
    console.log('Test 5: GET /v1/forecast/ (empty skill - should 400)');
    const emptyResponse = await fetch(`${BASE_URL}/forecast/`);
    const emptyData = await emptyResponse.json();
    console.log(`Status: ${emptyResponse.status}`);
    console.log('Response:', emptyData);
    console.log('');

    console.log('=== Test Complete ===\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

testForecastAPI();
