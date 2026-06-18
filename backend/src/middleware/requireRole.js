const { createError } = require('./errorHandler');

/**
 * Role constants — use these everywhere instead of bare strings.
 */
const ROLES = {
  STAFF:             'staff',
  WAREHOUSE_MANAGER: 'warehouse_manager',
  ADMIN:             'admin',
};

/**
 * Role hierarchy: each level includes all roles below it.
 * Index 0 = lowest privilege.
 */
const ROLE_HIERARCHY = [
  ROLES.STAFF,
  ROLES.WAREHOUSE_MANAGER,
  ROLES.ADMIN,
];

/**
 * Returns true if the user's role meets the minimum required role.
 *
 * @param {string} userRole   - role from JWT payload
 * @param {string} minRole    - minimum required role
 */
function hasMinRole(userRole, minRole) {
  return ROLE_HIERARCHY.indexOf(userRole) >= ROLE_HIERARCHY.indexOf(minRole);
}

/**
 * Middleware factory — restrict a route to specific roles.
 *
 * Usage (any of):
 *   requireRole('admin')
 *   requireRole('warehouse_manager', 'admin')
 *   requireRole(ROLES.ADMIN)
 *
 * Must be used AFTER authenticate middleware.
 *
 * @param {...string} roles - allowed role(s)
 */
function requireRole(...roles) {
  const allowed = roles.flat();

  return (req, res, next) => {
    if (!req.user) {
      return next(createError(401, 'Authentifizierung erforderlich'));
    }

    if (!allowed.includes(req.user.role)) {
      return next(createError(403, 'Keine Berechtigung für diese Aktion'));
    }

    next();
  };
}

/**
 * Middleware factory — require AT LEAST the given role level.
 * Convenient shorthand for hierarchy checks.
 *
 * Usage:
 *   requireMinRole('warehouse_manager')  // allows warehouse_manager + admin
 *
 * @param {string} minRole
 */
function requireMinRole(minRole) {
  return (req, res, next) => {
    if (!req.user) {
      return next(createError(401, 'Authentifizierung erforderlich'));
    }

    if (!hasMinRole(req.user.role, minRole)) {
      return next(createError(403, 'Keine Berechtigung für diese Aktion'));
    }

    next();
  };
}

module.exports = { ROLES, ROLE_HIERARCHY, hasMinRole, requireRole, requireMinRole };
