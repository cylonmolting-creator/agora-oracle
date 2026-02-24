/**
 * x402 Bazaar Agent Services Crawler
 *
 * Fetches agent service listings from x402 Bazaar (or mock data in Phase 1)
 * Maps x402 format to AGORA agent_services schema
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../../logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// x402 Bazaar API endpoint (when available)
const X402_BAZAAR_API = 'https://bazaar.x402.org/api/services';
const MOCK_DATA_PATH = path.join(__dirname, '../../../data/x402-agents.json');
const TIMEOUT = 10000; // 10s timeout

/**
 * Main crawler function
 * Strategy: Try live API first, fallback to mock data
 * @returns {Promise<Array>} Array of agent service objects
 */
export async function crawlX402Bazaar() {
  const start = Date.now();
  logger.info('x402 Bazaar crawler: Starting...');

  try {
    // Phase 1: Try live API (will likely timeout in Phase 1)
    const liveData = await fetchLiveAPI();
    if (liveData && liveData.length > 0) {
      logger.info(`x402 Bazaar crawler: Fetched ${liveData.length} agents from live API`);
      return liveData;
    }
  } catch (error) {
    logger.warn(`x402 Bazaar crawler: Live API failed (${error.message}), falling back to mock data`);
  }

  // Phase 1 default: Use mock data
  const mockData = await fetchMockData();
  const elapsed = Date.now() - start;
  logger.info(`x402 Bazaar crawler: Loaded ${mockData.length} agents from mock data (${elapsed}ms)`);
  return mockData;
}

/**
 * Fetch from live x402 Bazaar API (Phase 2)
 * @returns {Promise<Array|null>}
 */
async function fetchLiveAPI() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const response = await fetch(X402_BAZAAR_API, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'AGORA/1.0 (Agent Rate Oracle)'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Parse x402 Bazaar response format
    const agents = data.services || data.agents || data;

    if (!Array.isArray(agents)) {
      throw new Error('Invalid API response format');
    }

    // Map x402 format to AGORA format
    return agents.map(parseX402Agent);

  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('API request timeout');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Load mock data from data/x402-agents.json (Phase 1)
 * @returns {Promise<Array>}
 */
async function fetchMockData() {
  try {
    const rawData = fs.readFileSync(MOCK_DATA_PATH, 'utf-8');
    const data = JSON.parse(rawData);

    if (!data.agents || !Array.isArray(data.agents)) {
      throw new Error('Invalid mock data format');
    }

    // Mock data is already in AGORA format, minimal parsing needed
    return data.agents.map(agent => ({
      agentId: agent.agentId,
      agentName: agent.agentName,
      skill: agent.skill,
      price: agent.price,
      unit: agent.unit,
      currency: agent.currency || 'USD',
      uptime: agent.uptime,
      avgLatency: agent.avgLatency,
      rating: agent.rating,
      reviews: agent.reviews,
      x402Endpoint: agent.x402Endpoint,
      bazaarUrl: agent.bazaarUrl,
      metadata: agent.metadata
    }));

  } catch (error) {
    logger.error(`x402 Bazaar crawler: Failed to load mock data - ${error.message}`);
    return [];
  }
}

/**
 * Parse x402 Bazaar agent to AGORA format
 * Maps x402 API response structure to AGORA agent_services schema
 * @param {Object} x402Agent - Raw agent data from x402 Bazaar API
 * @returns {Object} AGORA-formatted agent service
 */
function parseX402Agent(x402Agent) {
  // Handle both live API format and mock format
  const agentId = x402Agent.serviceId || x402Agent.agentId;
  const agentName = x402Agent.agentName || x402Agent.name || 'Unknown Agent';

  // Skill normalization: combine category + skill
  const skill = parseSkill(x402Agent);

  // Price extraction from x402.payment or direct price field
  const { price, unit, currency } = parsePrice(x402Agent);

  // SLA data
  const uptime = x402Agent.sla?.uptime || x402Agent.uptime || null;
  const avgLatency = x402Agent.sla?.avgLatencyMs || x402Agent.avgLatency || null;

  // Quality metrics
  const rating = x402Agent.agentCard?.reputation || x402Agent.rating || null;
  const reviews = x402Agent.agentCard?.reviewsCount || x402Agent.reviews || 0;

  // Endpoints
  const x402Endpoint = x402Agent.endpoint || x402Agent.x402Endpoint || null;
  const bazaarUrl = x402Agent.bazaarUrl || `https://bazaar.x402.org/agents/${agentId}`;

  // Metadata (store as object, will be JSON.stringified in DB layer)
  const metadata = parseMetadata(x402Agent);

  return {
    agentId,
    agentName,
    skill,
    price,
    unit,
    currency,
    uptime,
    avgLatency,
    rating,
    reviews,
    x402Endpoint,
    bazaarUrl,
    metadata
  };
}

/**
 * Parse skill from x402 category + skill fields
 * Normalizes to AGORA format: "category/subcategory"
 * @param {Object} agent
 * @returns {String}
 */
function parseSkill(agent) {
  // Check if already in AGORA format
  if (agent.skill && agent.skill.includes('/')) {
    return agent.skill;
  }

  // Build from category + skill
  const category = agent.category || 'general';
  const skill = agent.skill || 'default';

  return `${category}/${skill}`;
}

/**
 * Parse price from x402.payment or direct price field
 * @param {Object} agent
 * @returns {Object} { price, unit, currency }
 */
function parsePrice(agent) {
  // Check for x402.payment format (live API)
  if (agent.x402?.payment) {
    return {
      price: parseFloat(agent.x402.payment.amount) || 0,
      unit: agent.x402.payment.unit || 'per_request',
      currency: agent.x402.payment.currency || 'USD'
    };
  }

  // Check for direct format (mock data)
  return {
    price: parseFloat(agent.price) || 0,
    unit: agent.unit || 'per_request',
    currency: agent.currency || 'USD'
  };
}

/**
 * Parse metadata from x402 agent
 * Extracts useful fields for AGORA display
 * @param {Object} agent
 * @returns {Object}
 */
function parseMetadata(agent) {
  const metadata = agent.metadata || {};

  // Add blockchain info if available
  if (agent.x402?.payment?.chain) {
    metadata.chain = agent.x402.payment.chain;
  }

  // Add verification status
  if (agent.metadata?.verified !== undefined) {
    metadata.verified = agent.metadata.verified;
  } else if (agent.verified !== undefined) {
    metadata.verified = agent.verified;
  }

  // Add model/capability info
  if (agent.metadata?.maxTokens) {
    metadata.maxTokens = agent.metadata.maxTokens;
  }

  if (agent.metadata?.models) {
    metadata.models = agent.metadata.models;
  }

  return metadata;
}

/**
 * Get crawler metadata (for logging/monitoring)
 * @returns {Object}
 */
export function getCrawlerInfo() {
  return {
    name: 'x402-bazaar',
    source: X402_BAZAAR_API,
    timeout: TIMEOUT,
    fallbackMode: 'mock-data',
    mockDataPath: MOCK_DATA_PATH
  };
}

export default {
  crawlX402Bazaar,
  getCrawlerInfo
};
