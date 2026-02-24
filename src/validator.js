/**
 * Agent Rate Oracle — Validator Module
 * Validates agent-pricing.json files against the standard schema
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load schema from spec/
const schemaPath = join(__dirname, '../spec/agent-pricing.schema.json');
let schema;

try {
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found at ${schemaPath}`);
  }
  const schemaText = fs.readFileSync(schemaPath, 'utf8');
  schema = JSON.parse(schemaText);
} catch (error) {
  throw new Error(`Failed to load schema from ${schemaPath}: ${error.message}`);
}

// Initialize Ajv with format support
const ajv = new Ajv({
  allErrors: true,
  verbose: true,
  strict: false
});
addFormats(ajv);

// Compile schema once
const validate = ajv.compile(schema);

/**
 * Validates an agent-pricing.json object against the standard schema
 * @param {Object} json - The agent pricing JSON object to validate
 * @returns {{valid: boolean, errors: string[]}} - Validation result
 */
export function validateAgentPricing(json) {
  // Check if input is valid
  if (json === null || json === undefined) {
    return {
      valid: false,
      errors: ['Input is null or undefined']
    };
  }

  if (typeof json !== 'object') {
    return {
      valid: false,
      errors: ['Input is not a valid JSON object']
    };
  }

  // Run validation
  const valid = validate(json);

  if (valid) {
    return {
      valid: true,
      errors: []
    };
  }

  // Extract error messages
  const errors = validate.errors.map(err => {
    const path = err.instancePath || 'root';
    const message = err.message || 'Unknown error';

    // Build human-readable error message
    if (err.keyword === 'required') {
      return `${path}: missing required field '${err.params.missingProperty}'`;
    } else if (err.keyword === 'enum') {
      return `${path}: must be one of ${JSON.stringify(err.params.allowedValues)}`;
    } else if (err.keyword === 'type') {
      return `${path}: must be ${err.params.type}`;
    } else if (err.keyword === 'minimum' || err.keyword === 'maximum') {
      return `${path}: ${message} (${err.keyword}: ${err.params.limit})`;
    } else {
      return `${path}: ${message}`;
    }
  });

  return {
    valid: false,
    errors
  };
}

/**
 * Validates an agent-pricing.json file
 * @param {string} filePath - Path to the JSON file
 * @returns {{valid: boolean, errors: string[]}} - Validation result
 */
export function validateAgentPricingFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(content);
    return validateAgentPricing(json);
  } catch (error) {
    return {
      valid: false,
      errors: [`Failed to read or parse file: ${error.message}`]
    };
  }
}

export default { validateAgentPricing, validateAgentPricingFile };
