import { Router } from 'express';
import { smartRoute } from '../router/index.js';
import { requireAuth } from '../middleware/auth.js';
import logger from '../logger.js';

const router = Router();

// No auth middleware needed - x402 payment handles access control

/**
 * POST /v1/smart-route
 * Smart routing endpoint
 *
 * Body:
 *   - prompt: string (required) - Input prompt
 *   - task: string (required) - Task category (e.g., 'chat', 'text-generation')
 *   - optimize: string (optional) - 'cost', 'speed', 'quality', 'balanced' (default: 'cost')
 *   - constraints: object (optional) - { maxCost, minConfidence, maxTokens }
 *   - agentId: number (optional) - Agent ID for budget tracking
 *
 * Response:
 *   - success: boolean
 *   - data: { provider, model, cost, latency, tokens, response, alternatives, savings }
 */
router.post('/', async (req, res) => {
  try {
    const { prompt, task, optimize, constraints, agentId } = req.body;

    // Validation
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid required field: prompt (string)'
      });
    }

    if (!task || typeof task !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid required field: task (string)'
      });
    }

    // Validate optimize enum
    const validOptimize = ['cost', 'speed', 'quality', 'balanced'];
    if (optimize && !validOptimize.includes(optimize)) {
      return res.status(400).json({
        success: false,
        error: `Invalid optimize value. Must be one of: ${validOptimize.join(', ')}`
      });
    }

    // Get adapterMap from app locals (set by server initialization)
    const adapterMap = req.app.locals.adapterMap;

    if (!adapterMap || adapterMap.size === 0) {
      return res.status(503).json({
        success: false,
        error: 'No provider API keys configured. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or DEEPSEEK_API_KEY in .env'
      });
    }

    // Call smart route
    const result = await smartRoute(
      {
        prompt,
        task,
        optimize: optimize || 'cost',
        constraints: constraints || {},
        agentId: agentId || req.agent?.id || null
      },
      adapterMap
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    // Handle custom error codes
    if (error.code === 402) {
      return res.status(402).json({
        success: false,
        error: error.message,
        details: error.details
      });
    }

    if (error.code === 503) {
      return res.status(503).json({
        success: false,
        error: error.message,
        details: error.details
      });
    }

    // Generic error
    logger.error('smart_route_api_error', { error: error.message });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

export default router;
