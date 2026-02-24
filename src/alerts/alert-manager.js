/**
 * Alert Manager
 * CRUD operations for price_alerts table
 * Part of ROADMAP v3 Phase 2 (Real-Time Price Alerts)
 */

import { runQuery, getOne, getAll } from '../db/database.js';
import logger from '../logger.js';

/**
 * Create a new price alert
 * @param {Object} options - Alert configuration
 * @param {number} options.agentId - Agent ID (FK to agents table)
 * @param {string} options.alertType - 'price_drop' | 'price_threshold' | 'any_change'
 * @param {string} [options.targetSkill] - Target skill category (e.g., 'text-generation/chat')
 * @param {string} [options.targetProvider] - Target provider (e.g., 'openai')
 * @param {number} [options.maxPrice] - Maximum price threshold (for price_threshold alerts)
 * @param {string} options.notifyMethod - 'webhook' | 'email' | 'websocket'
 * @param {string} [options.webhookUrl] - Webhook URL (required if notifyMethod='webhook')
 * @param {string} [options.email] - Email address (required if notifyMethod='email')
 * @returns {Promise<Object>} Created alert { id, agentId, alertType, status }
 */
export async function createAlert({
  agentId,
  alertType,
  targetSkill,
  targetProvider,
  maxPrice,
  notifyMethod,
  webhookUrl,
  email
}) {
  try {
    // Validation
    if (!agentId) {
      throw new Error('agentId is required');
    }

    const validAlertTypes = ['price_drop', 'price_threshold', 'any_change'];
    if (!validAlertTypes.includes(alertType)) {
      throw new Error(`Invalid alertType. Must be one of: ${validAlertTypes.join(', ')}`);
    }

    const validNotifyMethods = ['webhook', 'email', 'websocket'];
    if (!validNotifyMethods.includes(notifyMethod)) {
      throw new Error(`Invalid notifyMethod. Must be one of: ${validNotifyMethods.join(', ')}`);
    }

    // Ensure at least one target is specified
    if (!targetSkill && !targetProvider) {
      throw new Error('Either targetSkill or targetProvider must be specified');
    }

    // Validate notification method requirements
    if (notifyMethod === 'webhook' && !webhookUrl) {
      throw new Error('webhookUrl is required when notifyMethod is webhook');
    }

    if (notifyMethod === 'email' && !email) {
      throw new Error('email is required when notifyMethod is email');
    }

    // Insert alert
    const result = runQuery(
      `INSERT INTO price_alerts
        (agent_id, alert_type, target_skill, target_provider, max_price, notify_method, webhook_url, email, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [agentId, alertType, targetSkill || null, targetProvider || null, maxPrice || null, notifyMethod, webhookUrl || null, email || null, 'active']
    );

    const alert = {
      id: result.lastInsertRowid,
      agentId,
      alertType,
      targetSkill,
      targetProvider,
      maxPrice,
      notifyMethod,
      status: 'active'
    };

    logger.info('Alert created', {
      alertId: alert.id,
      agentId,
      alertType,
      targetSkill,
      targetProvider,
      notifyMethod
    });

    return alert;
  } catch (error) {
    logger.error(`Failed to create alert: ${error.message}`, { agentId, alertType });
    throw error;
  }
}

/**
 * Get all alerts for a specific agent
 * @param {number} agentId - Agent ID
 * @returns {Promise<Array>} Array of alerts
 */
export async function getAlertsByAgent(agentId) {
  try {
    const alerts = getAll(
      `SELECT
        id, agent_id, alert_type, target_skill, target_provider,
        max_price, notify_method, webhook_url, email, status,
        last_triggered, created_at
       FROM price_alerts
       WHERE agent_id = ?
       ORDER BY created_at DESC`,
      [agentId]
    );

    logger.info('Fetched alerts for agent', { agentId, count: alerts.length });

    // Convert snake_case to camelCase for API response
    return alerts.map(alert => ({
      id: alert.id,
      agentId: alert.agent_id,
      alertType: alert.alert_type,
      targetSkill: alert.target_skill,
      targetProvider: alert.target_provider,
      maxPrice: alert.max_price,
      notifyMethod: alert.notify_method,
      webhookUrl: alert.webhook_url,
      email: alert.email,
      status: alert.status,
      lastTriggered: alert.last_triggered,
      createdAt: alert.created_at
    }));
  } catch (error) {
    logger.error(`Failed to fetch alerts for agent: ${error.message}`, { agentId });
    throw error;
  }
}

/**
 * Update alert status
 * @param {number} alertId - Alert ID
 * @param {string} status - New status ('active' | 'paused' | 'expired')
 * @returns {Promise<Object>} Updated alert { id, status }
 */
export async function updateAlertStatus(alertId, status) {
  try {
    // Validation
    const validStatuses = ['active', 'paused', 'expired'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    // Update alert
    const result = runQuery(
      'UPDATE price_alerts SET status = ? WHERE id = ?',
      [status, alertId]
    );

    if (result.changes === 0) {
      throw new Error('Alert not found');
    }

    logger.info('Alert status updated', { alertId, status });

    return { id: alertId, status };
  } catch (error) {
    logger.error(`Failed to update alert status: ${error.message}`, { alertId, status });
    throw error;
  }
}

/**
 * Delete an alert
 * @param {number} alertId - Alert ID
 * @returns {Promise<void>}
 */
export async function deleteAlert(alertId) {
  try {
    const result = runQuery(
      'DELETE FROM price_alerts WHERE id = ?',
      [alertId]
    );

    if (result.changes === 0) {
      throw new Error('Alert not found');
    }

    logger.info('Alert deleted', { alertId });
  } catch (error) {
    logger.error(`Failed to delete alert: ${error.message}`, { alertId });
    throw error;
  }
}

/**
 * Get specific alert by ID
 * @param {number} alertId - Alert ID
 * @returns {Promise<Object|null>} Alert object or null if not found
 */
export async function getAlertById(alertId) {
  try {
    const alert = getOne(
      `SELECT
        id, agent_id, alert_type, target_skill, target_provider,
        max_price, notify_method, webhook_url, email, status,
        last_triggered, created_at
       FROM price_alerts
       WHERE id = ?`,
      [alertId]
    );

    if (!alert) {
      return null;
    }

    // Convert snake_case to camelCase
    return {
      id: alert.id,
      agentId: alert.agent_id,
      alertType: alert.alert_type,
      targetSkill: alert.target_skill,
      targetProvider: alert.target_provider,
      maxPrice: alert.max_price,
      notifyMethod: alert.notify_method,
      webhookUrl: alert.webhook_url,
      email: alert.email,
      status: alert.status,
      lastTriggered: alert.last_triggered,
      createdAt: alert.created_at
    };
  } catch (error) {
    logger.error(`Failed to fetch alert: ${error.message}`, { alertId });
    throw error;
  }
}

/**
 * Update last_triggered timestamp
 * @param {number} alertId - Alert ID
 * @returns {Promise<void>}
 */
export async function updateLastTriggered(alertId) {
  try {
    runQuery(
      'UPDATE price_alerts SET last_triggered = CURRENT_TIMESTAMP WHERE id = ?',
      [alertId]
    );

    logger.info('Alert last_triggered updated', { alertId });
  } catch (error) {
    logger.error(`Failed to update last_triggered: ${error.message}`, { alertId });
    throw error;
  }
}

/**
 * Mark alert trigger as notified
 * @param {number} triggerId - Trigger ID from alert_triggers table
 * @returns {Promise<void>}
 */
export async function updateAlertTriggerNotified(triggerId) {
  try {
    runQuery(
      'UPDATE alert_triggers SET notified = 1 WHERE id = ?',
      [triggerId]
    );

    logger.info('Alert trigger marked as notified', { triggerId });
  } catch (error) {
    logger.error(`Failed to update alert trigger notified status: ${error.message}`, { triggerId });
    throw error;
  }
}

/**
 * Get alert trigger history (last 50 triggers)
 * @param {number} alertId - Alert ID
 * @returns {Promise<Array>} Array of trigger events
 */
export async function getAlertTriggerHistory(alertId) {
  try {
    const triggers = getAll(
      `SELECT
        id, alert_id, old_price, new_price, provider, skill, triggered_at, notified
       FROM alert_triggers
       WHERE alert_id = ?
       ORDER BY triggered_at DESC
       LIMIT 50`,
      [alertId]
    );

    logger.info('Fetched alert trigger history', { alertId, count: triggers.length });

    // Convert snake_case to camelCase
    return triggers.map(trigger => ({
      id: trigger.id,
      alertId: trigger.alert_id,
      oldPrice: trigger.old_price,
      newPrice: trigger.new_price,
      provider: trigger.provider,
      skill: trigger.skill,
      triggeredAt: trigger.triggered_at,
      notified: trigger.notified
    }));
  } catch (error) {
    logger.error(`Failed to fetch alert trigger history: ${error.message}`, { alertId });
    throw error;
  }
}

export default {
  createAlert,
  getAlertsByAgent,
  updateAlertStatus,
  deleteAlert,
  getAlertById,
  updateLastTriggered,
  updateAlertTriggerNotified,
  getAlertTriggerHistory
};
