import { randomBytes } from 'crypto';
import { runQuery, getOne, getAll } from './database.js';
import logger from '../logger.js';

/**
 * Create a new agent with a unique API key
 * @param {string} name - Agent name
 * @returns {Object} { id, name, apiKey }
 */
export const createAgent = (name) => {
  try {
    // Generate random 32-char hex API key
    const apiKey = 'aro_' + randomBytes(16).toString('hex');

    // Insert into database
    const result = runQuery(
      'INSERT INTO agents (name, api_key) VALUES (?, ?)',
      [name, apiKey]
    );

    logger.info('agent_created', { id: result.lastInsertRowid, name });

    return {
      id: result.lastInsertRowid,
      name,
      apiKey
    };
  } catch (error) {
    logger.error('agent_creation_failed', { error: error.message });
    throw error;
  }
};

/**
 * Get agent by API key
 * @param {string} apiKey - API key
 * @returns {Object|null} Agent row or null
 */
export const getAgentByKey = (apiKey) => {
  try {
    const agent = getOne('SELECT * FROM agents WHERE api_key = ?', [apiKey]);
    return agent || null;
  } catch (error) {
    logger.error('get_agent_by_key_failed', { error: error.message });
    throw error;
  }
};

/**
 * Get agent by ID
 * @param {number} id - Agent ID
 * @returns {Object|null} Agent row or null
 */
export const getAgentById = (id) => {
  try {
    const agent = getOne('SELECT * FROM agents WHERE id = ?', [id]);
    return agent || null;
  } catch (error) {
    logger.error('get_agent_by_id_failed', { error: error.message });
    throw error;
  }
};

/**
 * List all agents
 * @returns {Array} All agent rows
 */
export const listAgents = () => {
  try {
    const agents = getAll('SELECT * FROM agents ORDER BY created_at DESC');
    return agents;
  } catch (error) {
    logger.error('list_agents_failed', { error: error.message });
    throw error;
  }
};

export default {
  createAgent,
  getAgentByKey,
  getAgentById,
  listAgents
};
