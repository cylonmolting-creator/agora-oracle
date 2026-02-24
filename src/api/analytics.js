import { Router } from 'express';
import { getAll, getOne } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';
import logger from '../logger.js';

const router = Router();

// No auth middleware needed - x402 payment handles access control

/**
 * GET /v1/analytics/:agentId
 * Get analytics summary for an agent
 *
 * Response:
 *   - success: boolean
 *   - data: {
 *       period,
 *       totalSpent,
 *       totalRequests,
 *       avgCostPerRequest,
 *       byProvider: { name: spent },
 *       byTask: { category: spent },
 *       daily: [{ date, spent, requests }]
 *     }
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

    // Get current period
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Total spent and requests this month
    const summary = getOne(`
      SELECT
        SUM(cost) as totalSpent,
        COUNT(*) as totalRequests,
        AVG(cost) as avgCostPerRequest
      FROM request_log
      WHERE agent_id = ? AND strftime('%Y-%m', created_at) = ?
    `, [agentId, period]);

    // By provider
    const byProvider = {};
    const providerData = getAll(`
      SELECT provider, SUM(cost) as spent
      FROM request_log
      WHERE agent_id = ? AND strftime('%Y-%m', created_at) = ?
      GROUP BY provider
    `, [agentId, period]);

    providerData.forEach(row => {
      byProvider[row.provider] = row.spent;
    });

    // By task category
    const byTask = {};
    const taskData = getAll(`
      SELECT category, SUM(cost) as spent
      FROM request_log
      WHERE agent_id = ? AND strftime('%Y-%m', created_at) = ?
      GROUP BY category
    `, [agentId, period]);

    taskData.forEach(row => {
      byTask[row.category || 'unknown'] = row.spent;
    });

    // Daily breakdown
    const daily = getAll(`
      SELECT
        DATE(created_at) as date,
        SUM(cost) as spent,
        COUNT(*) as requests
      FROM request_log
      WHERE agent_id = ? AND strftime('%Y-%m', created_at) = ?
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [agentId, period]);

    res.json({
      success: true,
      data: {
        period,
        totalSpent: summary?.totalSpent || 0,
        totalRequests: summary?.totalRequests || 0,
        avgCostPerRequest: summary?.avgCostPerRequest || 0,
        byProvider,
        byTask,
        daily
      }
    });
  } catch (error) {
    logger.error('analytics_api_error', { error: error.message });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /v1/analytics/:agentId/savings
 * Calculate savings vs. most expensive provider
 *
 * Response:
 *   - success: boolean
 *   - data: { totalSavings, savingsPercent, comparedTo }
 */
router.get('/:agentId/savings', async (req, res) => {
  try {
    const agentId = parseInt(req.params.agentId);

    if (isNaN(agentId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid agentId'
      });
    }

    // Get current period
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Get all requests this month
    const requests = getAll(`
      SELECT provider, category, tokens_in, tokens_out, cost
      FROM request_log
      WHERE agent_id = ? AND strftime('%Y-%m', created_at) = ? AND status = 'success'
    `, [agentId, period]);

    if (requests.length === 0) {
      return res.json({
        success: true,
        data: {
          totalSavings: 0,
          savingsPercent: 0,
          comparedTo: 'No requests yet'
        }
      });
    }

    // For each request, find the most expensive provider for that category
    let totalActualCost = 0;
    let totalExpensiveCost = 0;

    for (const request of requests) {
      totalActualCost += request.cost;

      // Find most expensive rate for this category
      const expensiveRate = getOne(`
        SELECT MAX(input_price + output_price) as max_price, p.name as provider_name
        FROM rates r
        JOIN providers p ON r.provider_id = p.id
        WHERE r.category = ?
        GROUP BY p.name
        ORDER BY max_price DESC
        LIMIT 1
      `, [request.category || '']);

      if (expensiveRate) {
        // Calculate what this request would have cost with most expensive provider
        const hypotheticalCost = (
          (request.tokens_in / 1_000_000) * (expensiveRate.max_price / 2) +
          (request.tokens_out / 1_000_000) * (expensiveRate.max_price / 2)
        );
        totalExpensiveCost += hypotheticalCost;
      } else {
        totalExpensiveCost += request.cost; // no comparison available
      }
    }

    const totalSavings = totalExpensiveCost - totalActualCost;
    const savingsPercent = totalExpensiveCost > 0 ? (totalSavings / totalExpensiveCost) * 100 : 0;

    res.json({
      success: true,
      data: {
        totalSavings: Math.round(totalSavings * 100) / 100,
        savingsPercent: Math.round(savingsPercent * 10) / 10,
        comparedTo: 'Most expensive provider for each category'
      }
    });
  } catch (error) {
    logger.error('savings_api_error', { error: error.message });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

export default router;
