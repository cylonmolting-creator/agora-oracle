import { Router } from 'express';
import { createAgent, listAgents } from '../db/agents.js';
import logger from '../logger.js';

const router = Router();

/**
 * POST /v1/agents
 * Create a new agent and get API key
 *
 * Body:
 *   - name: string (required) - Agent name
 *
 * Response:
 *   - success: boolean
 *   - data: { id, name, apiKey }
 */
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid required field: name (non-empty string)'
      });
    }

    const agent = createAgent(name.trim());

    res.status(201).json({
      success: true,
      data: agent
    });
  } catch (error) {
    logger.error('create_agent_api_error', { error: error.message });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /v1/agents
 * List all agents (without API keys for security)
 *
 * Response:
 *   - success: boolean
 *   - data: [{ id, name, created_at }]
 */
router.get('/', async (req, res) => {
  try {
    const agents = listAgents();

    // Remove api_key from response for security
    const sanitized = agents.map(agent => ({
      id: agent.id,
      name: agent.name,
      created_at: agent.created_at
    }));

    res.json({
      success: true,
      data: sanitized
    });
  } catch (error) {
    logger.error('list_agents_api_error', { error: error.message });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

export default router;
