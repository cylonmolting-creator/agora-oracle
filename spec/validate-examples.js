#!/usr/bin/env node

/**
 * Validate agent-pricing.example.json files against agent-pricing.schema.json
 */

import { readFileSync } from 'fs';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true, verbose: true });
addFormats(ajv);

// Load schema
const schemaPath = './spec/agent-pricing.schema.json';
const examplesPath = './spec/agent-pricing.example.json';

try {
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
  const examples = JSON.parse(readFileSync(examplesPath, 'utf8'));

  const validate = ajv.compile(schema);

  console.log('🔍 Validating agent-pricing examples...\n');

  let allValid = true;
  examples.forEach((example, index) => {
    const valid = validate(example);
    const exampleName = example.provider?.name || `Example ${index + 1}`;

    if (valid) {
      console.log(`✅ ${exampleName} — VALID`);
      console.log(`   agentId: ${example.agentId}`);
      console.log(`   services: ${example.services.length}`);
      console.log(`   skill: ${example.services[0].skill}`);
      console.log(`   pricing type: ${example.services[0].pricing.type}`);
      console.log('');
    } else {
      console.log(`❌ ${exampleName} — INVALID`);
      console.log('   Errors:');
      validate.errors.forEach((err) => {
        console.log(`   - ${err.instancePath} ${err.message}`);
      });
      console.log('');
      allValid = false;
    }
  });

  if (allValid) {
    console.log('✅ All examples are valid!\n');
    process.exit(0);
  } else {
    console.log('❌ Some examples failed validation.\n');
    process.exit(1);
  }
} catch (err) {
  console.error('❌ Error:', err.message);
  process.exit(1);
}
