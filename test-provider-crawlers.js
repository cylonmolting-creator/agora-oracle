import { initDatabase, closeDatabase } from './src/db/database.js';
import { seedOpenAI } from './src/crawler/providers/openai.js';
import { seedAnthropic } from './src/crawler/providers/anthropic.js';

console.log('🧪 Testing OpenAI and Anthropic Provider Crawlers\n');

// Initialize database
initDatabase('./data/aro.db');

console.log('--- Testing OpenAI Crawler ---');
const openaiResult = await seedOpenAI();
console.log(`Result: ${JSON.stringify(openaiResult)}\n`);

console.log('--- Testing Anthropic Crawler ---');
const anthropicResult = await seedAnthropic();
console.log(`Result: ${JSON.stringify(anthropicResult)}\n`);

// Verify database state
import { getDb } from './src/db/database.js';
const db = getDb();

const providers = db.prepare('SELECT * FROM providers WHERE name IN (?, ?)').all('OpenAI', 'Anthropic');
console.log('--- Providers in Database ---');
console.log(providers.map(p => `${p.name} (${p.type})`).join('\n'));

const services = db.prepare(`
  SELECT s.*, p.name as provider_name
  FROM services s
  JOIN providers p ON s.provider_id = p.id
  WHERE p.name IN (?, ?)
  ORDER BY p.name, s.category
`).all('OpenAI', 'Anthropic');
console.log(`\n--- Services in Database (${services.length} total) ---`);
services.forEach(s => {
  console.log(`${s.provider_name} | ${s.category}/${s.subcategory} | ${s.description}`);
});

const rates = db.prepare(`
  SELECT r.*, s.description as service_name, p.name as provider_name
  FROM rates r
  JOIN services s ON r.service_id = s.id
  JOIN providers p ON s.provider_id = p.id
  WHERE p.name IN (?, ?)
  ORDER BY p.name, r.price DESC
`).all('OpenAI', 'Anthropic');
console.log(`\n--- Rates in Database (${rates.length} total) ---`);
rates.forEach(r => {
  console.log(`${r.provider_name} | ${r.service_name} | $${r.price.toFixed(2)} per ${r.unit}`);
});

closeDatabase();
console.log('\n✅ Test Complete');
