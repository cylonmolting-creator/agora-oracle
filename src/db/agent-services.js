import { runQuery, getOne, getAll } from './database.js';
import logger from '../logger.js';

/**
 * Create a new agent service listing
 * @param {Object} params - Service parameters
 * @param {string} params.agentId - Unique agent ID from x402
 * @param {string} params.agentName - Agent display name
 * @param {string} params.skill - Service skill/category
 * @param {number} params.price - Service price
 * @param {string} params.unit - Pricing unit (e.g., 'per_request', 'per_hour')
 * @param {number} [params.uptime] - Service uptime percentage (0-100)
 * @param {number} [params.avgLatency] - Average latency in milliseconds
 * @param {string} [params.x402Endpoint] - x402 protocol endpoint URL
 * @param {string} [params.bazaarUrl] - x402 Bazaar listing URL
 * @param {Object} [params.metadata] - Additional metadata (stored as JSON string)
 * @returns {Object} { id, agentId }
 */
export const createAgentService = ({
  agentId,
  agentName,
  skill,
  price,
  unit,
  uptime = null,
  avgLatency = null,
  x402Endpoint = null,
  bazaarUrl = null,
  metadata = null
}) => {
  try {
    const metadataStr = metadata ? JSON.stringify(metadata) : null;

    const result = runQuery(
      `INSERT INTO agent_services
      (agent_id, agent_name, skill, price, unit, uptime, avg_latency_ms, x402_endpoint, bazaar_url, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [agentId, agentName, skill, price, unit, uptime, avgLatency, x402Endpoint, bazaarUrl, metadataStr]
    );

    logger.info('agent_service_created', {
      id: result.lastInsertRowid,
      agentId,
      skill,
      price
    });

    return {
      id: result.lastInsertRowid,
      agentId
    };
  } catch (error) {
    logger.error('agent_service_creation_failed', {
      agentId,
      error: error.message
    });
    throw error;
  }
};

/**
 * Get agent service by agent ID
 * @param {string} agentId - Agent ID
 * @returns {Object|null} Agent service row or null
 */
export const getAgentServiceById = (agentId) => {
  try {
    const service = getOne(
      'SELECT * FROM agent_services WHERE agent_id = ?',
      [agentId]
    );

    // Parse metadata if exists
    if (service && service.metadata) {
      try {
        service.metadata = JSON.parse(service.metadata);
      } catch (e) {
        logger.warn('metadata_parse_failed', { agentId, error: e.message });
      }
    }

    return service || null;
  } catch (error) {
    logger.error('get_agent_service_failed', {
      agentId,
      error: error.message
    });
    throw error;
  }
};

/**
 * Get all agent services for a given skill
 * @param {string} skill - Service skill/category
 * @returns {Array} Agent services sorted by price (ascending)
 */
export const getAgentServicesBySkill = (skill) => {
  try {
    const services = getAll(
      'SELECT * FROM agent_services WHERE skill = ? ORDER BY price ASC',
      [skill]
    );

    // Parse metadata for each service
    services.forEach(service => {
      if (service.metadata) {
        try {
          service.metadata = JSON.parse(service.metadata);
        } catch (e) {
          logger.warn('metadata_parse_failed', {
            agentId: service.agent_id,
            error: e.message
          });
        }
      }
    });

    return services;
  } catch (error) {
    logger.error('get_agent_services_by_skill_failed', {
      skill,
      error: error.message
    });
    throw error;
  }
};

/**
 * Update agent service price and record history
 * @param {string} agentId - Agent ID
 * @param {number} price - New price
 * @returns {Object} { updated: true }
 */
export const updateAgentServicePrice = (agentId, price) => {
  try {
    // Get current service data for history
    const currentService = getAgentServiceById(agentId);

    if (!currentService) {
      throw new Error(`Agent service not found: ${agentId}`);
    }

    // Update price in agent_services
    runQuery(
      `UPDATE agent_services
       SET price = ?, last_updated = CURRENT_TIMESTAMP
       WHERE agent_id = ?`,
      [price, agentId]
    );

    // Insert into history
    runQuery(
      `INSERT INTO agent_service_history
       (agent_id, price, uptime, avg_latency_ms)
       VALUES (?, ?, ?, ?)`,
      [agentId, price, currentService.uptime, currentService.avg_latency_ms]
    );

    logger.info('agent_service_price_updated', {
      agentId,
      oldPrice: currentService.price,
      newPrice: price
    });

    return { updated: true };
  } catch (error) {
    logger.error('update_agent_service_price_failed', {
      agentId,
      error: error.message
    });
    throw error;
  }
};

/**
 * List all agent services
 * @returns {Array} All agent services
 */
export const listAllAgentServices = () => {
  try {
    const services = getAll(
      'SELECT * FROM agent_services ORDER BY skill, price ASC'
    );

    // Parse metadata for each service
    services.forEach(service => {
      if (service.metadata) {
        try {
          service.metadata = JSON.parse(service.metadata);
        } catch (e) {
          logger.warn('metadata_parse_failed', {
            agentId: service.agent_id,
            error: e.message
          });
        }
      }
    });

    return services;
  } catch (error) {
    logger.error('list_all_agent_services_failed', {
      error: error.message
    });
    throw error;
  }
};

/**
 * Get price history for an agent service
 * @param {string} agentId - Agent ID
 * @param {number} [days=30] - Number of days of history to retrieve
 * @returns {Array} Price history records
 */
export const getAgentServiceHistory = (agentId, days = 30) => {
  try {
    const history = getAll(
      `SELECT * FROM agent_service_history
       WHERE agent_id = ?
       AND recorded_at >= datetime('now', '-' || ? || ' days')
       ORDER BY recorded_at DESC`,
      [agentId, days]
    );

    return history;
  } catch (error) {
    logger.error('get_agent_service_history_failed', {
      agentId,
      error: error.message
    });
    throw error;
  }
};

export default {
  createAgentService,
  getAgentServiceById,
  getAgentServicesBySkill,
  updateAgentServicePrice,
  listAllAgentServices,
  getAgentServiceHistory
};
