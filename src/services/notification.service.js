// src/services/notification.service.js
import { pool } from '../db/pool.js';
import * as wsService from './websocket.service.js';
import logger from '../utils/logger.js';

const ADMIN_ROLES = ['super_admin', 'org_admin', 'berm_incharge'];

/**
 * Finds user IDs having any of the specified roles (and optionally org unit).
 */
export async function getUserIdsByRoles(roles, orgUnitId = null) {
  try {
    const rolesArray = Array.isArray(roles) ? roles : [roles];
    const { rows } = await pool.query(
      `SELECT DISTINCT ur.user_id 
       FROM user_roles ur
       JOIN users u ON u.id = ur.user_id
       WHERE u.is_active = true
         AND ur.role = ANY($1::text[])
         AND (ur.term_start IS NULL OR ur.term_start <= CURRENT_DATE)
         AND (ur.term_end IS NULL OR ur.term_end >= CURRENT_DATE)
         AND ($2::uuid IS NULL OR ur.org_unit_id = $2::uuid OR ur.role = 'super_admin')`,
      [rolesArray, orgUnitId]
    );
    return rows.map((r) => r.user_id);
  } catch (error) {
    logger.error({ err: error }, 'Failed to query user IDs by roles');
    return [];
  }
}

/**
 * Dispatches a notification to target users, records it in the database,
 * and delivers it in real time via WebSocket.
 */
export async function createAndSendNotification({
  userIds = [],
  roles = [],
  orgUnitId = null,
  type = 'system_notification',
  title,
  message,
  entity_type = null,
  entity_id = null,
  actor = null,
  excludeActor = false,
  broadcastEntityChange = true,
}) {
  try {
    const targetUserIds = new Set(userIds);

    // If roles specified, fetch user IDs with those roles
    if (roles.length > 0) {
      const roleUserIds = await getUserIdsByRoles(roles, orgUnitId);
      for (const id of roleUserIds) {
        targetUserIds.add(id);
      }
    }

    // Exclude the actor if requested
    if (excludeActor && actor?.id) {
      targetUserIds.delete(actor.id);
    }

    const createdNotifications = [];

    // Insert notification records in database for each target user
    for (const userId of targetUserIds) {
      try {
        const { rows } = await pool.query(
          `INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *, (read_at IS NOT NULL) AS is_read`,
          [userId, type, title, message, entity_type, entity_id || null]
        );

        if (rows[0]) {
          createdNotifications.push(rows[0]);

          // Push to user's active WebSocket sessions
          wsService.sendToUser(userId, {
            type: 'NOTIFICATION',
            data: {
              ...rows[0],
              actor: actor ? { id: actor.id, name: actor.full_name || actor.email } : null,
            },
          });
        }
      } catch (err) {
        logger.error({ err, userId }, 'Failed to insert notification record');
      }
    }

    // Emit real-time entity change event so all pages re-fetch data live
    if (broadcastEntityChange && entity_type) {
      wsService.broadcast({
        type: 'ENTITY_CHANGED',
        entity: entity_type,
        action: type,
        id: entity_id,
        actor: actor ? { id: actor.id, name: actor.full_name || actor.email } : null,
        timestamp: new Date().toISOString(),
      });
    }

    logger.info(
      {
        type,
        entity_type,
        entity_id,
        recipientsCount: targetUserIds.size,
      },
      'Dispatched real-time notification'
    );

    return createdNotifications;
  } catch (error) {
    logger.error({ err: error }, 'Failed in createAndSendNotification');
    return [];
  }
}

/**
 * Convenience helper to broadcast a change made by any user to admins and target users.
 */
export async function notifyChange({
  entity,
  action,
  title,
  message,
  entityId = null,
  actor = null,
  targetUserIds = [],
  orgUnitId = null,
  notifyAdmins = true,
}) {
  const roles = notifyAdmins ? ADMIN_ROLES : [];
  return createAndSendNotification({
    userIds: targetUserIds,
    roles,
    orgUnitId,
    type: `${entity}_${action}`,
    title,
    message,
    entity_type: entity,
    entity_id: entityId,
    actor,
    excludeActor: false, // Allows admins to see their own changes reflected in real-time
    broadcastEntityChange: true,
  });
}

export default {
  getUserIdsByRoles,
  createAndSendNotification,
  notifyChange,
};

