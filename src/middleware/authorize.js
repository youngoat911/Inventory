// src/middleware/authorize.js

import { pool } from '../db/pool.js';

/**
 * Authorization middleware factory
 * Checks if the authenticated user has the required role(s) and scope
 */

const formatError = (code, message) => ({
  error: { code, message, details: [] },
});

export const ADMIN_ROLES = ['super_admin', 'org_admin', 'berm_incharge'];
export const READ_ROLES = [...ADMIN_ROLES, 'borrower', 'auditor'];

export function hasRole(user, ...roles) {
  return user?.roles?.some((userRole) => roles.includes(userRole.role)) ?? false;
}

export function isAdmin(user) {
  return hasRole(user, ...ADMIN_ROLES);
}

export function getAdminOrgIds(user) {
  if (hasRole(user, 'super_admin')) return null;
  return [...new Set(
    (user?.roles || [])
      .filter((role) => ['org_admin', 'berm_incharge'].includes(role.role))
      .map((role) => role.org_unit_id)
      .filter(Boolean)
  )];
}

export function scopeOrgFilters(user, filters, field = 'org_unit_ids') {
  const orgIds = getAdminOrgIds(user);
  return orgIds === null ? filters : { ...filters, [field]: orgIds };
}

const scopedResources = {
  asset: 'SELECT owner_org_id AS org_id FROM assets WHERE id = $1',
  issue: `SELECT a.owner_org_id AS org_id, i.on_behalf_of_org AS related_org_id
          FROM issues i JOIN assets a ON a.id = i.asset_id WHERE i.id = $1`,
  purchase: 'SELECT org_unit_id AS org_id FROM purchases WHERE id = $1',
  transfer: `SELECT t.from_org_id AS org_id, t.to_org_id AS related_org_id, a.owner_org_id AS asset_org_id
             FROM transfers t JOIN assets a ON a.id = t.asset_id WHERE t.id = $1`,
  disposal: 'SELECT a.owner_org_id AS org_id FROM disposals d JOIN assets a ON a.id = d.asset_id WHERE d.id = $1',
  maintenance: 'SELECT a.owner_org_id AS org_id FROM maintenance_records m JOIN assets a ON a.id = m.asset_id WHERE m.id = $1',
  verification_cycle: 'SELECT org_unit_id AS org_id FROM verification_cycles WHERE id = $1',
  location: 'SELECT org_unit_id AS org_id FROM locations WHERE id = $1',
  dropbox: 'SELECT org_unit_id AS org_id FROM drop_boxes WHERE id = $1',
  alert: `SELECT COALESCE(al.org_unit_id, asset.owner_org_id, issue_asset.owner_org_id, i.on_behalf_of_org) AS org_id
          FROM alerts al
          LEFT JOIN assets asset ON asset.id = al.asset_id
          LEFT JOIN issues i ON i.id = al.issue_id
          LEFT JOIN assets issue_asset ON issue_asset.id = i.asset_id
          WHERE al.id = $1`,
  user: `SELECT ur.org_unit_id AS org_id
         FROM user_roles ur
         WHERE ur.user_id = $1 AND ur.org_unit_id IS NOT NULL
         UNION
         SELECT a.owner_org_id AS org_id
         FROM issues i JOIN assets a ON a.id = i.asset_id
         WHERE i.borrower_id = $1 AND a.owner_org_id IS NOT NULL`,
  block: `SELECT ARRAY(
            SELECT DISTINCT scoped.org_id
            FROM borrower_blocks bb
            LEFT JOIN issues i ON i.id = bb.issue_id
            LEFT JOIN assets a ON a.id = i.asset_id
            LEFT JOIN user_roles ur ON ur.user_id = bb.user_id
            CROSS JOIN LATERAL (VALUES (a.owner_org_id), (ur.org_unit_id)) scoped(org_id)
            WHERE bb.id = $1 AND scoped.org_id IS NOT NULL
          ) AS org_ids
          FROM borrower_blocks bb WHERE bb.id = $1`,
};

export function requireScopedResource(resource, param = 'id') {
  const query = scopedResources[resource];
  if (!query) throw new Error(`Unknown scoped resource: ${resource}`);

  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(formatError('UNAUTHORIZED', 'Authentication required'));
    }
    if (!isAdmin(req.user)) return next();
    const orgIds = getAdminOrgIds(req.user);
    if (orgIds === null) return next();
    if (orgIds.length === 0) {
      return res.status(403).json(formatError('FORBIDDEN', 'No organization scope assigned'));
    }

    try {
      const { rows } = await pool.query(query, [req.params[param]]);
      if (resource === 'user' && rows.length === 0) {
        return res.status(403).json(formatError('FORBIDDEN', 'User is outside your organization scope'));
      }
      if (!rows[0]) return next();
      const relatedOrgIds = rows.flatMap((row) => Object.values(row).flat()).filter(Boolean);
      const outsideScope = resource === 'transfer'
        ? !relatedOrgIds.some((orgId) => orgIds.includes(orgId))
        : relatedOrgIds.length === 0 || relatedOrgIds.some((orgId) => !orgIds.includes(orgId));
      if (outsideScope) {
        return res.status(403).json(formatError('FORBIDDEN', 'Resource is outside your organization scope'));
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireScopedBodyResource(resource, field) {
  const query = scopedResources[resource];
  if (!query) throw new Error(`Unknown scoped resource: ${resource}`);
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(formatError('UNAUTHORIZED', 'Authentication required'));
    }
    if (!isAdmin(req.user)) return next();
    const orgIds = getAdminOrgIds(req.user);
    if (orgIds === null) return next();
    if (orgIds.length === 0) {
      return res.status(403).json(formatError('FORBIDDEN', 'No organization scope assigned'));
    }

    try {
      const resourceId = req.validated?.body?.[field];
      if (resourceId == null) return next();
      const { rows } = await pool.query(query, [resourceId]);
      if (!rows[0]) {
        return res.status(404).json(formatError('NOT_FOUND', 'Resource not found'));
      }
      const relatedOrgIds = rows.flatMap((row) => Object.values(row).flat()).filter(Boolean);
      if (relatedOrgIds.length === 0 || relatedOrgIds.some((orgId) => !orgIds.includes(orgId))) {
        return res.status(403).json(formatError('FORBIDDEN', 'Resource is outside your organization scope'));
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireAssignedOrg(getOrgIds) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(formatError('UNAUTHORIZED', 'Authentication required'));
    }
    if (!isAdmin(req.user)) return next();
    const assignedOrgIds = getAdminOrgIds(req.user);
    if (assignedOrgIds === null) return next();
    if (assignedOrgIds.length === 0) {
      return res.status(403).json(formatError('FORBIDDEN', 'No organization scope assigned'));
    }
    const orgIds = getOrgIds(req);
    if (orgIds.some((orgId) => orgId === null)) {
      return res.status(403).json(formatError('FORBIDDEN', 'Organization cannot be cleared outside super administrator access'));
    }
    const requestedOrgIds = orgIds.filter(Boolean);
    if (requestedOrgIds.some((orgId) => !assignedOrgIds.includes(orgId))) {
      return res.status(403).json(formatError('FORBIDDEN', 'Organization is outside your scope'));
    }
    next();
  };
}

export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json(formatError('UNAUTHORIZED', 'Authentication required'));
  }
  if (!isAdmin(req.user)) {
    return res.status(403).json(formatError('FORBIDDEN', 'Insufficient permissions'));
  }
  next();
}

export function assignAdminOrg(field, arrayField = null) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(formatError('UNAUTHORIZED', 'Authentication required'));
    }
    const orgIds = getAdminOrgIds(req.user);
    if (orgIds === null) return next();
    const body = req.validated?.body;
    if (!body) return next(new Error('Request body must be validated before assigning its organization'));
    const targets = arrayField ? body[arrayField] : [body];
    for (const target of targets) {
      if (target[field]) {
        if (!orgIds.includes(target[field])) {
          return res.status(403).json(formatError('FORBIDDEN', 'Organization is outside your scope'));
        }
      } else if (orgIds.length > 0) {
        target[field] = orgIds[0];
      } else {
        return res.status(403).json(formatError('FORBIDDEN', `Select an organization for ${field}`));
      }
    }
    next();
  };
}

export function requireSuperAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json(formatError('UNAUTHORIZED', 'Authentication required'));
  }
  if (!hasRole(req.user, 'super_admin')) {
    return res.status(403).json(formatError('FORBIDDEN', 'Super administrator access required'));
  }
  next();
}

export function requireReadAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json(formatError('UNAUTHORIZED', 'Authentication required'));
  }
  if (!hasRole(req.user, ...READ_ROLES)) {
    return res.status(403).json(formatError('FORBIDDEN', 'Insufficient permissions'));
  }
  next();
}

export function requireIssueOwner(req, res, next) {
  if (!req.user) {
    return res.status(401).json(formatError('UNAUTHORIZED', 'Authentication required'));
  }
  if (isAdmin(req.user)) return next();
  if (!hasRole(req.user, 'borrower')) {
    return res.status(403).json(formatError('FORBIDDEN', 'Insufficient permissions'));
  }

  pool.query('SELECT borrower_id FROM issues WHERE id = $1', [req.params.id])
    .then(({ rows }) => {
      if (rows[0] && rows[0].borrower_id !== req.user.id) {
        return res.status(403).json(formatError('FORBIDDEN', 'You can only access your own loans'));
      }
      next();
    })
    .catch(next);
}

/**
 * Check if user has any of the specified roles
 * @param {Array<string>} allowedRoles - Array of role names
 * @returns {Function} Express middleware
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(formatError('UNAUTHORIZED', 'Authentication required'));
    }

    const hasAllowedRole = hasRole(req.user, ...allowedRoles);

    if (!hasAllowedRole) {
      return res.status(403).json(formatError('FORBIDDEN', 'Insufficient permissions'));
    }

    next();
  };
}

/**
 * Check if user has a specific role within a specific org unit
 * @param {Array<string>} allowedRoles - Array of role names
 * @param {Function} getOrgId - Function to extract org_unit_id from request
 * @returns {Function} Express middleware
 */
export function requireOrgRole(allowedRoles, getOrgId) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(formatError('UNAUTHORIZED', 'Authentication required'));
    }

    const orgId = typeof getOrgId === 'function' ? getOrgId(req) : null;
    
    // super_admin bypasses org scope checks
    const isSuperAdmin = hasRole(req.user, 'super_admin');
    if (isSuperAdmin) {
      return next();
    }

    // Check if user has the required role in the specified org
    const hasOrgRole = req.user.roles?.some((r) => {
      const roleMatches = allowedRoles.includes(r.role);
      const orgMatches = !orgId || r.org_unit_id === orgId;
      return roleMatches && orgMatches;
    });

    if (!hasOrgRole) {
      return res.status(403).json(formatError('FORBIDDEN', 'Insufficient permissions for this organization'));
    }

    next();
  };
}

/**
 * Check if user is accessing their own resource
 * @param {Function} getUserId - Function to extract user_id from request
 * @returns {Function} Express middleware
 */
export function requireSelfOrRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(formatError('UNAUTHORIZED', 'Authentication required'));
    }

    const targetUserId = req.params.id || req.validated?.params?.id;
    const isSelf = targetUserId === req.user.id;

    if (isSelf) {
      return next();
    }

    // Check if user has privileged role
    const hasAllowedRole = hasRole(req.user, ...allowedRoles);

    if (!hasAllowedRole) {
      return res.status(403).json(formatError('FORBIDDEN', 'You can only access your own resources'));
    }

    next();
  };
}

/**
 * Policy helper functions for complex authorization logic
 */
export const can = {
  /**
   * Check if user can perform an action on users
   */
  manageUsers: (user) => {
    return hasRole(user, 'super_admin', 'org_admin');
  },

  /**
   * Check if user can manage assets
   */
  manageAssets: (user, orgId = null) => {
    const roles = user?.roles || [];
    
    // super_admin can manage all assets
    if (hasRole(user, 'super_admin')) {
      return true;
    }

    // org_admin and berm_incharge can manage assets in their org
    if (orgId) {
      return roles.some(
        (r) =>
          (r.role === 'org_admin' || r.role === 'berm_incharge') &&
          r.org_unit_id === orgId
      );
    }

    return roles.some((r) => r.role === 'org_admin' || r.role === 'berm_incharge');
  },

  /**
   * Check if user can issue/receive assets
   */
  issueAssets: (user, orgId = null) => {
    const roles = user?.roles || [];
    
    if (hasRole(user, 'super_admin')) {
      return true;
    }

    if (orgId) {
      return roles.some(
        (r) =>
          (r.role === 'org_admin' || r.role === 'berm_incharge') &&
          r.org_unit_id === orgId
      );
    }

    return roles.some((r) => r.role === 'org_admin' || r.role === 'berm_incharge');
  },

  /**
   * Check if user can approve workflows (transfers, disposals, etc.)
   */
  approveWorkflows: (user, orgId = null) => {
    const roles = user?.roles || [];
    
    if (hasRole(user, 'super_admin')) {
      return true;
    }

    if (orgId) {
      return roles.some(
        (r) => r.role === 'org_admin' && r.org_unit_id === orgId
      );
    }

    return roles.some((r) => r.role === 'org_admin');
  },

  /**
   * Check if user has read-only access (auditor)
   */
  isAuditor: (user) => {
    return hasRole(user, 'auditor');
  },

  /**
   * Check if user is a borrower
   */
  isBorrower: (user) => {
    return hasRole(user, 'borrower');
  },
};
