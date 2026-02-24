/**
 * Alert Checker
 * Checks active alerts and triggers notifications when conditions are met
 * Part of ROADMAP v3 Phase 2 (Real-Time Price Alerts)
 * Runs every 5 minutes via scheduler
 */

import { getAll, getOne, runQuery } from '../db/database.js';
import { updateLastTriggered } from './alert-manager.js';
import { dispatchNotification } from './notifiers.js';
import logger from '../logger.js';

/**
 * Check all active price alerts and trigger if conditions are met
 * @returns {Promise<Object>} { checkedAlerts: number, triggeredAlerts: number }
 */
export async function checkPriceAlerts() {
  try {
    // Query all active alerts
    const alerts = getAll(
      `SELECT
        id, agent_id, alert_type, target_skill, target_provider,
        max_price, notify_method, webhook_url, email, last_triggered
       FROM price_alerts
       WHERE status = 'active'`
    );

    if (alerts.length === 0) {
      logger.info('alert_checker_no_alerts', { message: 'No active alerts to check' });
      return { checkedAlerts: 0, triggeredAlerts: 0 };
    }

    logger.info('alert_checker_start', { alertCount: alerts.length });

    let triggeredCount = 0;

    // Check each alert
    for (const alert of alerts) {
      try {
        const triggered = await checkSingleAlert(alert);
        if (triggered) {
          triggeredCount++;
        }
      } catch (error) {
        logger.error(`alert_checker_error: ${error.message}`, {
          alertId: alert.id,
          alertType: alert.alert_type
        });
        // Continue checking other alerts even if one fails
      }
    }

    logger.info('alert_checker_complete', {
      checkedAlerts: alerts.length,
      triggeredAlerts: triggeredCount
    });

    return { checkedAlerts: alerts.length, triggeredAlerts: triggeredCount };
  } catch (error) {
    logger.error(`alert_checker_failed: ${error.message}`);
    throw error;
  }
}

/**
 * Check a single alert and trigger if condition is met
 * @param {Object} alert - Alert object from database
 * @returns {Promise<boolean>} true if alert was triggered
 */
async function checkSingleAlert(alert) {
  try {
    // Determine where to get price from (rates or agent_services)
    let currentPrice = null;
    let provider = null;
    let skill = null;

    if (alert.target_provider) {
      // Check provider rates (e.g., openai, anthropic)
      const priceData = getCurrentProviderPrice(alert.target_provider);
      if (!priceData) {
        logger.warn('alert_checker_no_price_data', {
          alertId: alert.id,
          targetProvider: alert.target_provider
        });
        return false;
      }
      currentPrice = priceData.price;
      provider = alert.target_provider;
      skill = priceData.skill;
    } else if (alert.target_skill) {
      // Check agent services (e.g., text-generation/chat)
      const priceData = getCurrentSkillPrice(alert.target_skill);
      if (!priceData) {
        logger.warn('alert_checker_no_price_data', {
          alertId: alert.id,
          targetSkill: alert.target_skill
        });
        return false;
      }
      currentPrice = priceData.price;
      provider = priceData.provider || 'agent-service';
      skill = alert.target_skill;
    } else {
      logger.warn('alert_checker_no_target', {
        alertId: alert.id,
        message: 'Alert has no target_provider or target_skill'
      });
      return false;
    }

    // Get last known price (from previous trigger or create baseline)
    const lastTrigger = getLastTriggerPrice(alert.id);
    const oldPrice = lastTrigger || currentPrice; // If first check, use current as baseline

    // Determine if alert condition is met
    let conditionMet = false;

    switch (alert.alert_type) {
      case 'price_drop':
        // Trigger if price decreased
        conditionMet = currentPrice < oldPrice;
        break;

      case 'price_threshold':
        // Trigger if price is at or below max_price threshold
        conditionMet = alert.max_price !== null && currentPrice <= alert.max_price;
        break;

      case 'any_change':
        // Trigger if price changed at all
        conditionMet = currentPrice !== oldPrice;
        break;

      default:
        logger.warn('alert_checker_unknown_type', {
          alertId: alert.id,
          alertType: alert.alert_type
        });
        return false;
    }

    // If condition met, trigger alert
    if (conditionMet) {
      await triggerAlert(alert, oldPrice, currentPrice, provider, skill);
      return true;
    }

    return false;
  } catch (error) {
    logger.error(`check_single_alert_failed: ${error.message}`, {
      alertId: alert.id
    });
    return false;
  }
}

/**
 * Get current price for a provider
 * @param {string} providerName - Provider name (e.g., 'openai')
 * @returns {Object|null} { price, skill } or null if not found
 */
function getCurrentProviderPrice(providerName) {
  try {
    // Get most recent rate for this provider
    // Join: rates -> services -> providers to get provider name and category
    const rate = getOne(
      `SELECT r.price, s.category || '/' || s.subcategory as skill
       FROM rates r
       JOIN services s ON r.service_id = s.id
       JOIN providers p ON s.provider_id = p.id
       WHERE p.name = ?
       ORDER BY r.created_at DESC
       LIMIT 1`,
      [providerName]
    );

    if (!rate) {
      return null;
    }

    return {
      price: rate.price,
      skill: rate.skill
    };
  } catch (error) {
    logger.error(`get_current_provider_price_failed: ${error.message}`, {
      providerName
    });
    return null;
  }
}

/**
 * Get current price for a skill (cheapest agent service)
 * @param {string} skillName - Skill name (e.g., 'text-generation/chat')
 * @returns {Object|null} { price, provider } or null if not found
 */
function getCurrentSkillPrice(skillName) {
  try {
    // Get cheapest agent service for this skill
    const service = getOne(
      `SELECT price, agent_name
       FROM agent_services
       WHERE skill = ?
       ORDER BY price ASC
       LIMIT 1`,
      [skillName]
    );

    if (!service) {
      return null;
    }

    return {
      price: service.price,
      provider: service.agent_name
    };
  } catch (error) {
    logger.error(`get_current_skill_price_failed: ${error.message}`, {
      skillName
    });
    return null;
  }
}

/**
 * Get last trigger price for an alert
 * @param {number} alertId - Alert ID
 * @returns {number|null} Last trigger price or null if never triggered
 */
function getLastTriggerPrice(alertId) {
  try {
    const trigger = getOne(
      `SELECT new_price
       FROM alert_triggers
       WHERE alert_id = ?
       ORDER BY triggered_at DESC
       LIMIT 1`,
      [alertId]
    );

    return trigger ? trigger.new_price : null;
  } catch (error) {
    logger.error(`get_last_trigger_price_failed: ${error.message}`, {
      alertId
    });
    return null;
  }
}

/**
 * Trigger an alert: insert trigger record, update last_triggered, call notifier
 * @param {Object} alert - Alert object
 * @param {number} oldPrice - Previous price
 * @param {number} newPrice - Current price
 * @param {string} provider - Provider or agent name
 * @param {string} skill - Skill category
 * @returns {Promise<void>}
 */
async function triggerAlert(alert, oldPrice, newPrice, provider, skill) {
  try {
    // Insert trigger record
    const result = runQuery(
      `INSERT INTO alert_triggers
        (alert_id, old_price, new_price, provider, skill, notified)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [alert.id, oldPrice, newPrice, provider, skill]
    );

    const triggerId = result.lastInsertRowid;

    // Update last_triggered timestamp in price_alerts
    await updateLastTriggered(alert.id);

    // Calculate savings
    const savings = oldPrice > 0
      ? (((oldPrice - newPrice) / oldPrice) * 100).toFixed(2)
      : '0.00';

    logger.info('alert_triggered', {
      alertId: alert.id,
      agentId: alert.agent_id,
      alertType: alert.alert_type,
      skill,
      provider,
      oldPrice,
      newPrice,
      savings: `${savings}%`,
      notifyMethod: alert.notify_method
    });

    // Prepare notification payload
    const payload = {
      alertId: alert.id,
      agentId: alert.agent_id,
      alertType: alert.alert_type,
      skill,
      provider,
      oldPrice,
      newPrice,
      savings,
      timestamp: new Date().toISOString()
    };

    // Dispatch notification via configured method
    await dispatchNotification(alert, payload, triggerId);

  } catch (error) {
    logger.error(`trigger_alert_failed: ${error.message}`, {
      alertId: alert.id
    });
    throw error;
  }
}

export default {
  checkPriceAlerts,
  checkSingleAlert
};
