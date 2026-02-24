/**
 * AGORA Alert Notifiers
 * Handles sending notifications via webhook, email, and websocket
 */

import logger from '../logger.js';
import { updateAlertTriggerNotified } from './alert-manager.js';

/**
 * Send webhook notification
 * @param {string} webhookUrl - Target webhook URL
 * @param {object} payload - Alert payload
 * @param {number} triggerId - Alert trigger ID (to mark as notified)
 * @returns {Promise<boolean>} - Success status
 */
export async function sendWebhook(webhookUrl, payload, triggerId) {
  try {
    logger.info(`Sending webhook notification to ${webhookUrl}`, {
      event: 'webhook_send_start',
      triggerId,
      alertId: payload.alertId,
      skill: payload.skill,
      provider: payload.provider
    });

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'AGORA-Alert-System/1.0'
      },
      body: JSON.stringify({
        event: 'price_alert',
        ...payload,
        source: 'AGORA',
        version: '0.3.0'
      }),
      signal: AbortSignal.timeout(5000) // 5s timeout
    });

    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}: ${response.statusText}`);
    }

    logger.info(`Webhook sent successfully to ${webhookUrl}`, {
      event: 'webhook_send_success',
      triggerId,
      alertId: payload.alertId,
      status: response.status
    });

    // Mark as notified (non-blocking, continues on failure)
    try {
      await updateAlertTriggerNotified(triggerId);
    } catch (dbError) {
      logger.warn(`Failed to update notified flag (non-blocking): ${dbError.message}`, {
        event: 'webhook_db_update_failed',
        triggerId
      });
    }

    return true;

  } catch (error) {
    logger.error(`Webhook send failed to ${webhookUrl}: ${error.message}`, {
      event: 'webhook_send_failed',
      triggerId,
      alertId: payload.alertId,
      error: error.message
    });

    // Retry once
    try {
      logger.info(`Retrying webhook to ${webhookUrl}`, {
        event: 'webhook_retry',
        triggerId
      });

      const retryResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'AGORA-Alert-System/1.0'
        },
        body: JSON.stringify({
          event: 'price_alert',
          ...payload,
          source: 'AGORA',
          version: '0.3.0',
          retry: true
        }),
        signal: AbortSignal.timeout(5000)
      });

      if (!retryResponse.ok) {
        throw new Error(`Retry failed: ${retryResponse.status}`);
      }

      logger.info(`Webhook retry succeeded to ${webhookUrl}`, {
        event: 'webhook_retry_success',
        triggerId
      });

      // Mark as notified (non-blocking)
      try {
        await updateAlertTriggerNotified(triggerId);
      } catch (dbError) {
        logger.warn(`Failed to update notified flag (non-blocking): ${dbError.message}`, {
          event: 'webhook_db_update_failed',
          triggerId
        });
      }

      return true;

    } catch (retryError) {
      logger.error(`Webhook retry failed to ${webhookUrl}: ${retryError.message}`, {
        event: 'webhook_retry_failed',
        triggerId,
        error: retryError.message
      });

      return false;
    }
  }
}

/**
 * Send email notification
 * @param {string} email - Recipient email address
 * @param {object} payload - Alert payload
 * @param {number} triggerId - Alert trigger ID
 * @returns {Promise<boolean>} - Success status
 */
export async function sendEmail(email, payload, triggerId) {
  try {
    logger.info(`Sending email notification to ${email}`, {
      event: 'email_send_start',
      triggerId,
      alertId: payload.alertId,
      skill: payload.skill,
      provider: payload.provider
    });

    // Check if nodemailer is available
    let nodemailer;
    try {
      nodemailer = await import('nodemailer');
    } catch (importError) {
      logger.warn('nodemailer not installed, email notification skipped. Install with: npm install nodemailer', {
        event: 'email_dependency_missing',
        triggerId
      });
      return false;
    }

    // SMTP config from environment variables
    const smtpConfig = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    };

    // Validate SMTP config
    if (!smtpConfig.auth.user || !smtpConfig.auth.pass) {
      logger.warn('SMTP credentials not configured. Set SMTP_USER and SMTP_PASS in .env', {
        event: 'email_config_missing',
        triggerId
      });
      return false;
    }

    // Create transporter
    const transporter = nodemailer.default.createTransport(smtpConfig);

    // Email subject and body
    const subject = `AGORA Price Alert: ${payload.skill || payload.provider} dropped to $${payload.newPrice.toFixed(4)}`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; background-color: #0a0a0a; color: #e0e0e0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background-color: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 30px; }
    .header { color: #00ff88; font-size: 24px; font-weight: bold; margin-bottom: 20px; }
    .price-change { background-color: #0d2818; border-left: 4px solid #00ff88; padding: 15px; margin: 20px 0; }
    .old-price { text-decoration: line-through; color: #888; }
    .new-price { color: #00ff88; font-size: 28px; font-weight: bold; }
    .savings { color: #00ff88; font-size: 18px; margin-top: 10px; }
    .details { background-color: #0f0f0f; padding: 15px; border-radius: 4px; margin: 20px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #2a2a2a; }
    .detail-label { color: #888; }
    .detail-value { color: #e0e0e0; font-weight: 500; }
    .cta { background-color: #00ff88; color: #0a0a0a; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin-top: 20px; font-weight: bold; }
    .footer { color: #666; font-size: 12px; margin-top: 30px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">🎯 AGORA Price Alert Triggered</div>

    <div class="price-change">
      <div style="font-size: 16px; color: #888; margin-bottom: 10px;">
        ${payload.skill ? `Skill: ${payload.skill}` : `Provider: ${payload.provider}`}
      </div>
      <div class="old-price">Was: $${payload.oldPrice.toFixed(4)}</div>
      <div class="new-price">Now: $${payload.newPrice.toFixed(4)}</div>
      <div class="savings">You save: ${payload.savings}%</div>
    </div>

    <div class="details">
      <div class="detail-row">
        <span class="detail-label">Alert Type:</span>
        <span class="detail-value">${payload.alertType}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Triggered At:</span>
        <span class="detail-value">${new Date(payload.timestamp).toLocaleString()}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Alert ID:</span>
        <span class="detail-value">#${payload.alertId}</span>
      </div>
    </div>

    <a href="http://localhost:3402" class="cta">View in AGORA Dashboard</a>

    <div class="footer">
      This is an automated alert from AGORA (Agent Rate Oracle).<br>
      Powered by AGORA v0.3.0 | <a href="http://localhost:3402" style="color: #00ff88;">Dashboard</a>
    </div>
  </div>
</body>
</html>
    `;

    // Send email
    const info = await transporter.sendMail({
      from: `"AGORA Alert System" <${smtpConfig.auth.user}>`,
      to: email,
      subject: subject,
      html: htmlBody
    });

    logger.info(`Email sent successfully to ${email}`, {
      event: 'email_send_success',
      triggerId,
      alertId: payload.alertId,
      messageId: info.messageId
    });

    // Mark as notified (non-blocking)
    try {
      await updateAlertTriggerNotified(triggerId);
    } catch (dbError) {
      logger.warn(`Failed to update notified flag (non-blocking): ${dbError.message}`, {
        event: 'email_db_update_failed',
        triggerId
      });
    }

    return true;

  } catch (error) {
    logger.error(`Email send failed to ${email}: ${error.message}`, {
      event: 'email_send_failed',
      triggerId,
      alertId: payload.alertId,
      error: error.message
    });

    return false;
  }
}

/**
 * Send WebSocket notification
 * @param {number} agentId - Agent ID to notify
 * @param {object} payload - Alert payload
 * @param {number} triggerId - Alert trigger ID
 * @returns {Promise<boolean>} - Success status
 */
export async function sendWebSocketNotification(agentId, payload, triggerId) {
  try {
    logger.info(`Sending WebSocket notification to agent ${agentId}`, {
      event: 'websocket_send_start',
      triggerId,
      agentId,
      alertId: payload.alertId
    });

    // WebSocket server implementation will be in Task 17 (websocket-alerts.js)
    // For now, we check if the WebSocket broadcast function is available

    // Try to import WebSocket server module (optional dependency)
    let websocketAlerts;
    try {
      websocketAlerts = await import('../gateway/websocket-alerts.js');
    } catch (importError) {
      logger.warn('WebSocket server not initialized yet (Task 17 pending). Notification skipped.', {
        event: 'websocket_not_available',
        triggerId,
        agentId
      });
      return false;
    }

    // Broadcast alert to agent's WebSocket connection
    const sent = await websocketAlerts.broadcastAlert(agentId, {
      type: 'price_alert',
      data: payload
    });

    if (sent) {
      logger.info(`WebSocket notification sent to agent ${agentId}`, {
        event: 'websocket_send_success',
        triggerId,
        agentId,
        alertId: payload.alertId
      });

      // Mark as notified (non-blocking)
      try {
        await updateAlertTriggerNotified(triggerId);
      } catch (dbError) {
        logger.warn(`Failed to update notified flag (non-blocking): ${dbError.message}`, {
          event: 'websocket_db_update_failed',
          triggerId
        });
      }

      return true;
    } else {
      logger.warn(`WebSocket notification failed: no active connection for agent ${agentId}`, {
        event: 'websocket_no_connection',
        triggerId,
        agentId
      });

      return false;
    }

  } catch (error) {
    logger.error(`WebSocket send failed for agent ${agentId}: ${error.message}`, {
      event: 'websocket_send_failed',
      triggerId,
      agentId,
      alertId: payload.alertId,
      error: error.message
    });

    return false;
  }
}

/**
 * Dispatch notification based on notify method
 * @param {object} alert - Alert object
 * @param {object} payload - Alert payload
 * @param {number} triggerId - Trigger ID
 * @returns {Promise<boolean>} - Success status
 */
export async function dispatchNotification(alert, payload, triggerId) {
  const { notify_method, webhook_url, email, agent_id } = alert;

  logger.info(`Dispatching notification via ${notify_method}`, {
    event: 'notification_dispatch',
    triggerId,
    alertId: alert.id,
    notifyMethod: notify_method
  });

  try {
    let success = false;

    switch (notify_method) {
      case 'webhook':
        if (!webhook_url) {
          logger.error('Webhook URL not configured for alert', {
            event: 'notification_config_error',
            alertId: alert.id,
            notifyMethod: 'webhook'
          });
          return false;
        }
        success = await sendWebhook(webhook_url, payload, triggerId);
        break;

      case 'email':
        if (!email) {
          logger.error('Email address not configured for alert', {
            event: 'notification_config_error',
            alertId: alert.id,
            notifyMethod: 'email'
          });
          return false;
        }
        success = await sendEmail(email, payload, triggerId);
        break;

      case 'websocket':
        success = await sendWebSocketNotification(agent_id, payload, triggerId);
        break;

      default:
        logger.error(`Unknown notify method: ${notify_method}`, {
          event: 'notification_unknown_method',
          alertId: alert.id,
          notifyMethod: notify_method
        });
        return false;
    }

    if (success) {
      logger.info(`Notification dispatched successfully via ${notify_method}`, {
        event: 'notification_dispatch_success',
        triggerId,
        alertId: alert.id,
        notifyMethod: notify_method
      });
    } else {
      logger.warn(`Notification dispatch failed via ${notify_method}`, {
        event: 'notification_dispatch_failed',
        triggerId,
        alertId: alert.id,
        notifyMethod: notify_method
      });
    }

    return success;

  } catch (error) {
    logger.error(`Notification dispatch error: ${error.message}`, {
      event: 'notification_dispatch_error',
      triggerId,
      alertId: alert.id,
      notifyMethod: notify_method,
      error: error.message
    });

    return false;
  }
}
