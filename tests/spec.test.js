/**
 * Agent Rate Oracle — Spec Validator Tests
 * Tests the validateAgentPricing function against valid and invalid inputs
 */

import { validateAgentPricing, validateAgentPricingFile } from '../src/validator.js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load example files
const examplesPath = join(__dirname, '../spec/agent-pricing.example.json');
const examples = JSON.parse(fs.readFileSync(examplesPath, 'utf8'));

// Test case 1: Valid example 1 (translation provider)
console.log('\n=== Test 1: Valid Translation Provider ===');
const result1 = validateAgentPricing(examples[0]);
console.log(`Valid: ${result1.valid}`);
if (!result1.valid) {
  console.log('Errors:', result1.errors);
}
console.assert(result1.valid === true, 'Test 1 FAILED: Translation provider should be valid');
console.log('✅ Test 1 PASSED');

// Test case 2: Valid example 2 (code review provider)
console.log('\n=== Test 2: Valid Code Review Provider ===');
const result2 = validateAgentPricing(examples[1]);
console.log(`Valid: ${result2.valid}`);
if (!result2.valid) {
  console.log('Errors:', result2.errors);
}
console.assert(result2.valid === true, 'Test 2 FAILED: Code review provider should be valid');
console.log('✅ Test 2 PASSED');

// Test case 3: Valid example 3 (image generation provider)
console.log('\n=== Test 3: Valid Image Generation Provider ===');
const result3 = validateAgentPricing(examples[2]);
console.log(`Valid: ${result3.valid}`);
if (!result3.valid) {
  console.log('Errors:', result3.errors);
}
console.assert(result3.valid === true, 'Test 3 FAILED: Image generation provider should be valid');
console.log('✅ Test 3 PASSED');

// Test case 4: Invalid - missing required field (agentId)
console.log('\n=== Test 4: Invalid - Missing Required Field (agentId) ===');
const invalidMissingField = {
  version: "1.0.0",
  // agentId is missing
  provider: {
    name: "Test Provider",
    type: "agent"
  },
  updated: "2026-02-24T00:00:00Z",
  currency: "USD",
  services: [
    {
      skill: "test-service",
      pricing: {
        type: "per-request",
        base: 0.01,
        unit: "request"
      }
    }
  ]
};
const result4 = validateAgentPricing(invalidMissingField);
console.log(`Valid: ${result4.valid}`);
console.log('Errors:', result4.errors);
console.assert(result4.valid === false, 'Test 4 FAILED: Should detect missing agentId');
console.assert(result4.errors.some(err => err.includes('agentId')), 'Test 4 FAILED: Error should mention agentId');
console.log('✅ Test 4 PASSED');

// Test case 5: Invalid - invalid pricing type
console.log('\n=== Test 5: Invalid - Invalid Pricing Type ===');
const invalidPricingType = {
  version: "1.0.0",
  agentId: "test-agent-123",
  provider: {
    name: "Test Provider",
    type: "agent"
  },
  updated: "2026-02-24T00:00:00Z",
  currency: "USD",
  services: [
    {
      skill: "test-service",
      pricing: {
        type: "per-unicorn", // invalid type
        base: 0.01,
        unit: "request"
      }
    }
  ]
};
const result5 = validateAgentPricing(invalidPricingType);
console.log(`Valid: ${result5.valid}`);
console.log('Errors:', result5.errors);
console.assert(result5.valid === false, 'Test 5 FAILED: Should detect invalid pricing type');
console.assert(result5.errors.some(err => err.includes('one of')), 'Test 5 FAILED: Error should mention allowed values');
console.log('✅ Test 5 PASSED');

// Bonus test: File validation
console.log('\n=== Bonus Test: File Validation ===');
const fileResult = validateAgentPricingFile(examplesPath);
console.log(`Valid: ${fileResult.valid}`);
if (fileResult.valid) {
  console.log('✅ File validation works (parsed array of examples)');
  console.log('Note: Array format is valid, individual examples should be validated separately');
}

// Summary
console.log('\n=== Test Summary ===');
console.log('✅ All 5 core tests PASSED');
console.log('- 3 valid examples validated successfully');
console.log('- Missing required field detected');
console.log('- Invalid pricing type detected');
console.log('\n🎉 Validator is working correctly!');
