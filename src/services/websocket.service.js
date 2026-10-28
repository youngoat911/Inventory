// src/services/websocket.service.js
import { WebSocketServer, WebSocket } from 'ws';
import { verifyToken } from '../utils/paseto.util.js';
import { getUserById } from '../modules/users/users.repository.js';
import { getActiveRolesForUser } from '../modules/roles/roles.repository.js';
import logger from '../utils/logger.js';

let wss = null;
// Map of userId -> Set of WebSocket instances
const userSockets = new Map();
// Set of all connected active WebSocket instances
const activeSockets = new Set();

/**
 * Authenticates a token and returns user details with roles.
 */
async function authenticateToken(token) {
  if (!token || typeof token !== 'string') return null;

  try {
    let payload;
    if (process.env.NODE_ENV === 'test' && token.startsWith('mock.token.')) {
      payload = { sub: token.replace('mock.token.', '') };
    } else {
      payload = await verifyToken(token);
    }

    if (!payload?.sub) return null;

    const user = await getUserById(payload.sub);
    if (!user || !user.is_active) return null;

    const roles = await getActiveRolesForUser(user.id);

    return {
      id: user.id,
      email: user.institute_email,
      full_name: user.full_name,
      roles: roles.map((r) => r.role),
      org_unit_ids: roles.map((r) => r.org_unit_id).filter(Boolean),
    };
  } catch (err) {
    logger.debug({ err: err.message }, 'WebSocket token verification failed');
    return null;
  }
}

/**
 * Registers an authenticated socket.
 */
function registerSocket(ws, user) {
  ws.user = user;
  if (!userSockets.has(user.id)) {
    userSockets.set(user.id, new Set());
  }
  userSockets.get(user.id).add(ws);

  logger.info(
    { userId: user.id, email: user.email, totalConnected: activeSockets.size },
    'WebSocket client authenticated'
  );

  // Send authentication acknowledgement
  safeSend(ws, {
    type: 'AUTHENTICATED',
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      roles: user.roles,
    },
  });
}

/**
 * Unregisters a socket upon close or error.
 */
function unregisterSocket(ws) {
  activeSockets.delete(ws);
  if (ws.user?.id) {
    const userSet = userSockets.get(ws.user.id);
    if (userSet) {
      userSet.delete(ws);
      if (userSet.size === 0) {
        userSockets.delete(ws.user.id);
      }
    }
  }
}

/**
 * Safely sends a JSON message over a WebSocket.
 */
function safeSend(ws, payload) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(payload));
      return true;
    } catch (err) {
      logger.error({ err }, 'Error sending WebSocket message');
    }
  }
  return false;
}

/**
 * Initializes the WebSocket server attached to the HTTP server.
 */
export function initWebSocketServer(server) {
  wss = new WebSocketServer({
    server,
    path: '/ws',
  });

  logger.info('WebSocket server initialized on /ws');

  // Heartbeat ping interval
  const pingInterval = setInterval(() => {
    for (const ws of activeSockets) {
      if (ws.isAlive === false) {
        logger.debug({ userId: ws.user?.id }, 'Terminating unresponsive WebSocket client');
        ws.terminate();
        unregisterSocket(ws);
        continue;
      }
      ws.isAlive = false;
      try {
        ws.ping();
      } catch {
        ws.terminate();
        unregisterSocket(ws);
      }
    }
  }, 30_000);

  wss.on('close', () => {
    clearInterval(pingInterval);
  });

  wss.on('connection', async (ws, req) => {
    ws.isAlive = true;
    activeSockets.add(ws);

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Extract token from query params or Sec-WebSocket-Protocol
    let token = null;
    try {
      const url = new URL(req.url, 'http://localhost');
      token = url.searchParams.get('token');
      if (!token && req.headers['sec-websocket-protocol']) {
        token = req.headers['sec-websocket-protocol'].split(',')[0].trim();
      }
    } catch (e) {
      logger.debug({ err: e.message }, 'Failed parsing WebSocket connection URL');
    }

    if (token) {
      const user = await authenticateToken(token);
      if (user) {
        registerSocket(ws, user);
      } else {
        safeSend(ws, { type: 'AUTH_REQUIRED', message: 'Token invalid or expired' });
      }
    } else {
      safeSend(ws, { type: 'AUTH_REQUIRED', message: 'Please provide authentication token' });
    }

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());

        // Heartbeat / ping
        if (msg.type === 'PING') {
          safeSend(ws, { type: 'PONG', timestamp: Date.now() });
          return;
        }

        // Deferred authentication via message
        if (msg.type === 'AUTH' && msg.token) {
          const user = await authenticateToken(msg.token);
          if (user) {
            registerSocket(ws, user);
          } else {
            safeSend(ws, { type: 'AUTH_ERROR', message: 'Invalid authentication token' });
          }
          return;
        }
      } catch (err) {
        logger.debug({ err: err.message }, 'Failed parsing WebSocket client message');
      }
    });

    ws.on('close', () => {
      unregisterSocket(ws);
    });

    ws.on('error', (err) => {
      logger.debug({ err: err.message }, 'WebSocket client connection error');
      unregisterSocket(ws);
    });
  });

  return wss;
}

/**
 * Sends a message to a specific user across all their open tabs/devices.
 */
export function sendToUser(userId, payload) {
  const sockets = userSockets.get(userId);
  if (!sockets || sockets.size === 0) return 0;

  let count = 0;
  for (const ws of sockets) {
    if (safeSend(ws, payload)) count++;
  }
  return count;
}

/**
 * Sends a message to all users who have any of the specified roles.
 * If orgUnitId is provided, matches org-scoped admins as well as super_admin.
 */
export function sendToRoles(roles, payload, orgUnitId = null) {
  const targetRoles = new Set(Array.isArray(roles) ? roles : [roles]);
  let count = 0;

  for (const ws of activeSockets) {
    const user = ws.user;
    if (!user || !user.roles) continue;

    const isSuperAdmin = user.roles.includes('super_admin');
    const hasRole = user.roles.some((r) => targetRoles.has(r));

    if (isSuperAdmin || (hasRole && (!orgUnitId || user.org_unit_ids?.includes(orgUnitId)))) {
      if (safeSend(ws, payload)) count++;
    }
  }

  return count;
}

/**
 * Broadcasts a message to all connected and authenticated users (or with optional filter).
 */
export function broadcast(payload, filterFn = null) {
  let count = 0;
  for (const ws of activeSockets) {
    if (!ws.user) continue; // Only broadcast to authenticated users
    if (!filterFn || filterFn(ws.user)) {
      if (safeSend(ws, payload)) count++;
    }
  }
  return count;
}

/**
 * Returns number of connected clients.
 */
export function getConnectedClientsCount() {
  return activeSockets.size;
}

export default {
  initWebSocketServer,
  sendToUser,
  sendToRoles,
  broadcast,
  getConnectedClientsCount,
};

