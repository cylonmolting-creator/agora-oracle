import { WebSocketServer } from 'ws';
import { getAgentByKey } from '../db/agents.js';
import logger from '../logger.js';

/**
 * Active WebSocket connections
 * Map<agentId, WebSocket>
 */
const connections = new Map();

/**
 * Initialize WebSocket server for real-time price alerts
 * @param {Object} httpServer - HTTP server instance
 * @returns {WebSocketServer} WebSocket server instance
 */
export function initAlertWebSocket(httpServer) {
  try {
    // Create WebSocket server on same port as HTTP (upgrade connection)
    const wss = new WebSocketServer({
      server: httpServer,
      path: '/ws/alerts'
    });

    logger.info('websocket_server_init', { path: '/ws/alerts' });

    wss.on('connection', (ws, req) => {
      logger.info('websocket_connection_attempt', { ip: req.socket.remoteAddress });

      let authenticatedAgentId = null;

      // Set connection timeout for auth
      const authTimeout = setTimeout(() => {
        if (!authenticatedAgentId) {
          logger.warn('websocket_auth_timeout', { ip: req.socket.remoteAddress });
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Authentication timeout (10s)'
          }));
          ws.close(1008, 'Auth timeout');
        }
      }, 10000); // 10s timeout

      // Handle incoming messages
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());

          if (message.type === 'auth') {
            // Authentication message
            const { agentId, apiKey } = message;

            if (!agentId || !apiKey) {
              logger.warn('websocket_auth_missing_fields', { agentId });
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Missing agentId or apiKey'
              }));
              ws.close(1008, 'Invalid auth');
              return;
            }

            // Validate API key
            const agent = getAgentByKey(apiKey);

            if (!agent) {
              logger.warn('websocket_auth_invalid_key', { agentId });
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Invalid API key'
              }));
              ws.close(1008, 'Invalid credentials');
              return;
            }

            // Verify agentId matches
            if (agent.id !== parseInt(agentId, 10)) {
              logger.warn('websocket_auth_id_mismatch', {
                requestedId: agentId,
                actualId: agent.id
              });
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Agent ID mismatch'
              }));
              ws.close(1008, 'ID mismatch');
              return;
            }

            // Authentication successful
            clearTimeout(authTimeout);
            authenticatedAgentId = agent.id;

            // Store connection
            connections.set(agent.id, ws);

            logger.info('websocket_auth_success', {
              agentId: agent.id,
              agentName: agent.name
            });

            // Send connected confirmation
            ws.send(JSON.stringify({
              type: 'connected',
              agentId: agent.id,
              message: 'Successfully connected to AGORA price alert stream'
            }));

          } else if (message.type === 'ping') {
            // Heartbeat
            ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          } else {
            // Unknown message type
            logger.warn('websocket_unknown_message', { type: message.type });
          }

        } catch (error) {
          logger.error('websocket_message_parse_error', { error: error.message });
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format'
          }));
        }
      });

      // Handle connection close
      ws.on('close', (code, reason) => {
        clearTimeout(authTimeout);

        if (authenticatedAgentId) {
          connections.delete(authenticatedAgentId);
          logger.info('websocket_connection_closed', {
            agentId: authenticatedAgentId,
            code,
            reason: reason.toString()
          });
        } else {
          logger.info('websocket_connection_closed_unauth', { code });
        }
      });

      // Handle errors
      ws.on('error', (error) => {
        logger.error('websocket_error', {
          agentId: authenticatedAgentId,
          error: error.message
        });
      });
    });

    logger.info('websocket_server_ready', {
      path: '/ws/alerts',
      connections: connections.size
    });

    return wss;

  } catch (error) {
    logger.error('websocket_server_init_failed', { error: error.message });
    throw error;
  }
}

/**
 * Broadcast price alert to specific agent
 * @param {number} agentId - Agent ID to send alert to
 * @param {Object} payload - Alert payload
 * @returns {boolean} Success status
 */
export function broadcastAlert(agentId, payload) {
  try {
    const ws = connections.get(agentId);

    if (!ws) {
      logger.warn('websocket_broadcast_no_connection', { agentId });
      return false;
    }

    // Check if connection is open
    if (ws.readyState !== 1) { // 1 = OPEN
      logger.warn('websocket_broadcast_connection_closed', {
        agentId,
        readyState: ws.readyState
      });
      connections.delete(agentId);
      return false;
    }

    // Send alert
    ws.send(JSON.stringify(payload));

    logger.info('websocket_broadcast_success', {
      agentId,
      alertType: payload.type
    });

    return true;

  } catch (error) {
    logger.error('websocket_broadcast_failed', {
      agentId,
      error: error.message
    });

    // Remove dead connection
    connections.delete(agentId);

    return false;
  }
}

/**
 * Get number of active WebSocket connections
 * @returns {number} Active connection count
 */
export function getActiveConnections() {
  return connections.size;
}

/**
 * Close all WebSocket connections (for graceful shutdown)
 */
export function closeAllConnections() {
  try {
    logger.info('websocket_closing_all', { count: connections.size });

    for (const [agentId, ws] of connections) {
      ws.close(1001, 'Server shutdown');
    }

    connections.clear();

    logger.info('websocket_all_closed');
  } catch (error) {
    logger.error('websocket_close_all_failed', { error: error.message });
  }
}

export default {
  initAlertWebSocket,
  broadcastAlert,
  getActiveConnections,
  closeAllConnections
};
