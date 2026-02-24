import { Router } from 'express';
import { setBudget, getBudgetStatus } from '../router/budget.js';
import { getAll } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';
import logger from '../logger.js';

const router = Router();

// Apply auth middleware - budget is a FREE endpoint (no x402 payment)
router.use(requireAuth);

/**
 * POST /v1/budget
 * Set monthly budget for authenticated agent
 *
 * Body:
 *   - monthlyLimit: number (required) - Monthly spending limit in USD
 *
 * Response:
 *   - success: boolean
 *   - data: { id, agentId, monthlyLimit, period }
 */
router.post('/', async (req, res) => {
  try {
    const { monthlyLimit } = req.body;

    if (!req.agent) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (typeof monthlyLimit !== 'number' || monthlyLimit < 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid required field: monthlyLimit (positive number)'
      });
    }

    const result = setBudget(req.agent.id, monthlyLimit);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('set_budget_api_error', { error: error.message });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /v1/budget/:agentId
 * Get budget status for an agent
 *
 * Response:
 *   - success: boolean
 *   - data: { period, spent, limit, remaining, daysLeft, projectedMonthEnd }
 */
router.get('/:agentId', async (req, res) => {
  try {
    const agentId = parseInt(req.params.agentId);

    if (isNaN(agentId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid agentId'
      });
    }

    const status = getBudgetStatus(agentId);

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('get_budget_api_error', { error: error.message });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /v1/budget/:agentId/history
 * Get spending history for last 30 days
 *
 * Response:
 *   - success: boolean
 *   - data: [{ date, totalCost, requests, topProvider }]
 */
router.get('/:agentId/history', async (req, res) => {
  try {
    const agentId = parseInt(req.params.agentId);

    if (isNaN(agentId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid agentId'
      });
    }

    // Query last 30 days of request_log
    const history = getAll(`
      SELECT
        DATE(created_at) as date,
        SUM(cost) as totalCost,
        COUNT(*) as requests,
        (
          SELECT provider
          FROM request_log
          WHERE agent_id = ? AND DATE(created_at) = DATE(r.created_at)
          GROUP BY provider
          ORDER BY COUNT(*) DESC
          LIMIT 1
        ) as topProvider
      FROM request_log r
      WHERE agent_id = ? AND created_at >= DATE('now', '-30 days')
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `, [agentId, agentId]);

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    logger.error('get_budget_history_api_error', { error: error.message });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

export default router;
