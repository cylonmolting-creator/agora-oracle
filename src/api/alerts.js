/**
 * AGORA API Router: Price Alerts
 * REST endpoints for managing price alerts
 *
 * @module api/alerts
 */

import express from 'express';
import logger from '../logger.js';
import {
  createAlert,
  getAlertsByAgent,
  getAlertById,
  updateAlertStatus,
  deleteAlert,
  getAlertTriggerHistory
} from '../alerts/alert-manager.js';

const router = express.Router();

/**
 * POST /v1/alerts — Create new price alert
 *
 * Body: {
 *   alertType: 'price_drop' | 'price_threshold' | 'any_change',
 *   targetSkill?: string,
 *   targetProvider?: string,
 *   maxPrice?: number,
 *   notifyMethod: 'webhook' | 'email' | 'websocket',
 *   webhookUrl?: string,
 *   email?: string
 * }
 *
 * Requires auth: req.agent.id set by requireAuth middleware
 */
router.post('/', async (req, res) => {
  try {
    const {
      alertType,
      targetSkill,
      targetProvider,
      maxPrice,
      notifyMethod,
      webhookUrl,
      email
    } = req.body;

    // Validation: alertType
    const validAlertTypes = ['price_drop', 'price_threshold', 'any_change'];
    if (!alertType || !validAlertTypes.includes(alertType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid alertType. Must be one of: price_drop, price_threshold, any_change',
        code: 400
      });
    }

    // Validation: notifyMethod
    const validNotifyMethods = ['webhook', 'email', 'websocket'];
    if (!notifyMethod || !validNotifyMethods.includes(notifyMethod)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid notifyMethod. Must be one of: webhook, email, websocket',
        code: 400
      });
    }

    // Validation: target (must have either targetSkill or targetProvider)
    if (!targetSkill && !targetProvider) {
      return res.status(400).json({
        success: false,
        error: 'Must specify either targetSkill or targetProvider',
        code: 400
      });
    }

    // Validation: maxPrice for price_threshold alerts
    if (alertType === 'price_threshold' && !maxPrice) {
      return res.status(400).json({
        success: false,
        error: 'maxPrice required for price_threshold alerts',
        code: 400
      });
    }

    // Validation: webhookUrl for webhook notify method
    if (notifyMethod === 'webhook' && !webhookUrl) {
      return res.status(400).json({
        success: false,
        error: 'webhookUrl required for webhook notify method',
        code: 400
      });
    }

    // Validation: email for email notify method
    if (notifyMethod === 'email' && !email) {
      return res.status(400).json({
        success: false,
        error: 'email required for email notify method',
        code: 400
      });
    }

    // Get authenticated agent ID from req.agent (set by requireAuth middleware)
    const agentId = req.agent?.id;
    if (!agentId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Missing agent ID.',
        code: 401
      });
    }

    // Create alert
    const alert = await createAlert({
      agentId,
      alertType,
      targetSkill,
      targetProvider,
      maxPrice,
      notifyMethod,
      webhookUrl,
      email
    });

    logger.info('Alert created via API', {
      alertId: alert.id,
      agentId,
      alertType,
      targetSkill,
      targetProvider,
      notifyMethod
    });

    res.status(201).json({
      success: true,
      data: {
        id: alert.id,
        agentId: alert.agentId,
        alertType: alert.alertType,
        targetSkill: alert.targetSkill,
        targetProvider: alert.targetProvider,
        maxPrice: alert.maxPrice,
        notifyMethod: alert.notifyMethod,
        status: alert.status,
        createdAt: alert.createdAt
      },
      meta: {
        timestamp: new Date().toISOString(),
        apiVersion: '0.3.0'
      }
    });
  } catch (error) {
    logger.error('Failed to create alert via API', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 500
    });
  }
});

/**
 * GET /v1/alerts — List all alerts for authenticated agent
 *
 * Returns: array of alerts for req.agent.id
 */
router.get('/', async (req, res) => {
  try {
    const agentId = req.agent?.id;
    if (!agentId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Missing agent ID.',
        code: 401
      });
    }

    const alerts = await getAlertsByAgent(agentId);

    res.status(200).json({
      success: true,
      data: alerts.map(alert => ({
        id: alert.id,
        alertType: alert.alertType,
        targetSkill: alert.targetSkill,
        targetProvider: alert.targetProvider,
        maxPrice: alert.maxPrice,
        notifyMethod: alert.notifyMethod,
        status: alert.status,
        lastTriggered: alert.lastTriggered,
        createdAt: alert.createdAt
      })),
      meta: {
        total: alerts.length,
        timestamp: new Date().toISOString(),
        apiVersion: '0.3.0'
      }
    });
  } catch (error) {
    logger.error('Failed to fetch alerts via API', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 500
    });
  }
});

/**
 * PATCH /v1/alerts/:id — Update alert status
 *
 * Body: { status: 'active' | 'paused' | 'expired' }
 *
 * Checks: alert belongs to req.agent.id (authorization)
 */
router.patch('/:id', async (req, res) => {
  try {
    const alertId = parseInt(req.params.id, 10);
    const { status } = req.body;

    // Validation: status
    const validStatuses = ['active', 'paused', 'expired'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be one of: active, paused, expired',
        code: 400
      });
    }

    const agentId = req.agent?.id;
    if (!agentId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Missing agent ID.',
        code: 401
      });
    }

    // Authorization: check alert belongs to this agent
    const alert = await getAlertById(alertId);
    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found',
        code: 404
      });
    }

    if (alert.agentId !== agentId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden. You do not own this alert.',
        code: 403
      });
    }

    // Update status
    await updateAlertStatus(alertId, status);

    logger.info('Alert status updated via API', { alertId, agentId, newStatus: status });

    res.status(200).json({
      success: true,
      data: {
        id: alertId,
        status
      },
      meta: {
        timestamp: new Date().toISOString(),
        apiVersion: '0.3.0'
      }
    });
  } catch (error) {
    logger.error('Failed to update alert status via API', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 500
    });
  }
});

/**
 * DELETE /v1/alerts/:id — Delete alert
 *
 * Checks: alert belongs to req.agent.id
 */
router.delete('/:id', async (req, res) => {
  try {
    const alertId = parseInt(req.params.id, 10);
    const agentId = req.agent?.id;

    if (!agentId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Missing agent ID.',
        code: 401
      });
    }

    // Authorization: check alert belongs to this agent
    const alert = await getAlertById(alertId);
    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found',
        code: 404
      });
    }

    if (alert.agentId !== agentId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden. You do not own this alert.',
        code: 403
      });
    }

    // Delete alert
    await deleteAlert(alertId);

    logger.info('Alert deleted via API', { alertId, agentId });

    res.status(200).json({
      success: true,
      message: 'Alert deleted',
      meta: {
        timestamp: new Date().toISOString(),
        apiVersion: '0.3.0'
      }
    });
  } catch (error) {
    logger.error('Failed to delete alert via API', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 500
    });
  }
});

/**
 * GET /v1/alerts/:id/history — Get alert trigger history
 *
 * Returns: last 50 trigger events for this alert
 */
router.get('/:id/history', async (req, res) => {
  try {
    const alertId = parseInt(req.params.id, 10);
    const agentId = req.agent?.id;

    if (!agentId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Missing agent ID.',
        code: 401
      });
    }

    // Authorization: check alert belongs to this agent
    const alert = await getAlertById(alertId);
    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found',
        code: 404
      });
    }

    if (alert.agentId !== agentId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden. You do not own this alert.',
        code: 403
      });
    }

    // Get trigger history (last 50)
    const history = await getAlertTriggerHistory(alertId);

    res.status(200).json({
      success: true,
      data: history.map(trigger => ({
        id: trigger.id,
        oldPrice: trigger.oldPrice,
        newPrice: trigger.newPrice,
        provider: trigger.provider,
        skill: trigger.skill,
        triggeredAt: trigger.triggeredAt,
        notified: trigger.notified === 1
      })),
      meta: {
        total: history.length,
        alertId,
        timestamp: new Date().toISOString(),
        apiVersion: '0.3.0'
      }
    });
  } catch (error) {
    logger.error('Failed to fetch alert history via API', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 500
    });
  }
});

export default router;
