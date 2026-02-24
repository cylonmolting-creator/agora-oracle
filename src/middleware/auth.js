import { getAgentByKey } from '../db/agents.js';
import logger from '../logger.js';

/**
 * Authentication middleware for Smart Router API endpoints
 * Checks for API key in Authorization header or query param
 * Sets req.agent = { id, name } if valid
 */
export const requireAuth = async (req, res, next) => {
  try {
    // Check Authorization header: "Bearer aro_xxxxx"
    let apiKey = null;

    if (req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        apiKey = parts[1];
      }
    }

    // Fallback to query param: ?api_key=aro_xxxxx
    if (!apiKey && req.query.api_key) {
      apiKey = req.query.api_key;
    }

    // No API key provided
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key required',
        message: 'Provide API key via Authorization header (Bearer aro_xxxxx) or ?api_key=aro_xxxxx query param'
      });
    }

    // Validate API key
    const agent = getAgentByKey(apiKey);

    if (!agent) {
      logger.warn('invalid_api_key_attempt', { apiKey: apiKey.substring(0, 10) + '...' });

      return res.status(401).json({
        success: false,
        error: 'Invalid API key',
        message: 'The provided API key is not valid. Create a new agent at POST /v1/agents'
      });
    }

    // Valid key — attach agent to request
    req.agent = {
      id: agent.id,
      name: agent.name
    };

    logger.info('auth_success', { agentId: agent.id, agentName: agent.name });

    next();
  } catch (error) {
    logger.error('auth_middleware_error', { error: error.message });

    res.status(500).json({
      success: false,
      error: 'Authentication error',
      message: error.message
    });
  }
};

export default {
  requireAuth
};
