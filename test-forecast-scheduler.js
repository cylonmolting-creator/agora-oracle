#!/usr/bin/env node
/**
 * Test forecast scheduler functionality
 */

import { initDatabase, initMigrations } from './src/db/database.js';
import { generateAllForecasts, getForecastStatus } from './src/forecast/scheduler.js';

async function test() {
  console.log('=== Test Forecast Scheduler ===\n');

  // Initialize database
  console.log('1. Initializing database...');
  initDatabase('./data/aro.db');
  initMigrations();
  console.log('   ✓ Database ready\n');

  // Check current forecast status (before generation)
  console.log('2. Checking current forecast status...');
  const statusBefore = await getForecastStatus();
  console.log(`   Total skills with forecasts: ${statusBefore.totalSkills}`);
  console.log(`   Total forecasts: ${statusBefore.totalForecasts}`);
  if (statusBefore.skills.length > 0) {
    console.log('   Skills:', statusBefore.skills.map(s => s.skill).join(', '));
  }
  console.log('');

  // Generate forecasts for all skills
  console.log('3. Generating forecasts for all skills...');
  const result = await generateAllForecasts();
  console.log(`   ✓ Skills processed: ${result.skills}`);
  console.log(`   ✓ Forecasts generated: ${result.forecastsGenerated}`);
  if (result.errors.length > 0) {
    console.log(`   ⚠ Errors: ${result.errors.length}`);
    result.errors.forEach(err => {
      console.log(`     - ${err.skill}: ${err.error}`);
    });
  }
  console.log('');

  // Check forecast status after generation
  console.log('4. Checking forecast status after generation...');
  const statusAfter = await getForecastStatus();
  console.log(`   Total skills with forecasts: ${statusAfter.totalSkills}`);
  console.log(`   Total forecasts: ${statusAfter.totalForecasts}`);
  if (statusAfter.skills.length > 0) {
    console.log('\n   Forecast details:');
    statusAfter.skills.forEach(s => {
      console.log(`   - ${s.skill}:`);
      console.log(`     Forecasts: ${s.forecast_count} (${s.earliest_date} → ${s.latest_date})`);
      console.log(`     Last generated: ${s.last_generated}`);
    });
  }
  console.log('');

  console.log('✅ Test complete!');
  process.exit(0);
}

test().catch(error => {
  console.error('❌ Test failed:', error.message);
  console.error(error);
  process.exit(1);
});
