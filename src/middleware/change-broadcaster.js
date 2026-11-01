// src/middleware/change-broadcaster.js
import { notifyChange } from '../services/notification.service.js';
import logger from '../utils/logger.js';

const EXCLUDED_PATHS = [
  '/api/v1/auth/login',
  '/api/v1/auth/refresh',
  '/api/v1/auth/logout',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
  '/api/v1/notifications',
];

const ENTITY_LABELS = {
  assets: 'Asset',
  issues: 'Borrowing Loan',
  transfers: 'Transfer',
  maintenance: 'Maintenance',
  disposals: 'Disposal',
  alerts: 'Alert',
  categories: 'Category',
  locations: 'Location',
  vendors: 'Vendor',
  purchases: 'Purchase',
  users: 'User',
  blocks: 'Borrower Block',
  verifications: 'Verification',
};

/**
 * Middleware that detects successful mutating requests and broadcasts
 * notifications and entity changes via WebSockets.
 */
export function changeBroadcaster(req, res, next) {
  // Only watch state-changing HTTP methods
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  // Intercept the response JSON to capture the created/updated entity details
  let responseBody = null;
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    responseBody = body;
    return originalJson(body);
  };

  res.on('finish', async () => {
    try {
      // Only process successful mutations
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return;
      }

      const path = req.originalUrl || req.url;

      // Skip excluded paths
      if (EXCLUDED_PATHS.some((p) => path.startsWith(p))) {
        return;
      }

      // Extract entity from route (e.g., /api/v1/assets/123 -> assets)
      const segments = path.replace(/^\/api\/v1\//, '').split('?')[0].split('/');
      const entity = segments[0];

      if (!entity || !ENTITY_LABELS[entity]) {
        return;
      }

      const entityLabel = ENTITY_LABELS[entity];
      const actor = req.user;
      const actorName = actor?.full_name || actor?.email || 'A user';

      let action = 'update';
      let actionVerb = 'updated';

      if (req.method === 'POST') {
        action = segments[1] || 'create';
        actionVerb = action === 'create' ? 'created' : action;
      } else if (req.method === 'DELETE') {
        action = 'delete';
        actionVerb = 'deleted';
      }

      // Check if there is an item name or identifier
      const data = responseBody?.data;
      const itemName = data?.name || data?.title || data?.asset_tag || data?.code || '';
      const entityId = data?.id || req.params?.id || null;

      const title = `${entityLabel} ${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)}`;
      const message = `${actorName} ${actionVerb} ${entityLabel.toLowerCase()}${itemName ? ` "${itemName}"` : ''}.`;

      // Check for target user (e.g., borrower in an issue, recipient in a transfer)
      const targetUserIds = [];
      const recipientId = data?.borrower_id || data?.user_id || data?.to_user_id || req.body?.borrower_id;
      if (recipientId && recipientId !== actor?.id) {
        targetUserIds.push(recipientId);
      }

      const orgUnitId = data?.org_unit_id || req.body?.org_unit_id || null;

      // Broadcast asynchronously without blocking the response
      notifyChange({
        entity,
        action,
        title,
        message,
        entityId,
        actor,
        targetUserIds,
        orgUnitId,
        notifyAdmins: true,
      }).catch((err) => {
        logger.error({ err }, 'Error in changeBroadcaster notification dispatch');
      });
    } catch (err) {
      logger.error({ err }, 'Error in changeBroadcaster finish handler');
    }
  });

  next();
}

export default changeBroadcaster;

