/** JSK OS Build 1013 - User access and security foundation. */

var JSKOS = JSKOS || {};

var JSK_ACCESS = Object.freeze({
  ROLE_MAP_KEY: 'JSK_OS_USER_ROLES',
  ADMIN_EMAILS_KEY: 'JSK_OS_ADMIN_EMAILS',
  AUDIT_SHEET: 'Access_Audit_Log',
  ROLES: Object.freeze({
    ADMINISTRATOR: 'Administrator',
    MANAGER: 'Manager',
    EXECUTIVE: 'Executive',
    STAFF: 'Staff',
    READ_ONLY: 'Read-only'
  }),
  ROUTE_PERMISSIONS: Object.freeze({
    dashboard: 'dashboard.view', companies: 'companies.view',
    people: 'people.view', policies: 'policies.view', claims: 'claims.view',
    documents: 'documents.view', endorsements: 'endorsements.view',
    quotes: 'quotes.view', revenue: 'revenue.view', reports: 'reports.view',
    tasks: 'tasks.view', meetings: 'meetings.view',
    communications: 'communications.view', access: 'access.manage'
  })
});

JSKOS.AccessControl = (function () {
  'use strict';

  var ALL_MODULES = [
    'dashboard', 'companies', 'people', 'policies', 'claims', 'documents',
    'endorsements', 'quotes', 'revenue', 'reports', 'tasks', 'meetings',
    'communications'
  ];

  function permissionsForRole_(role) {
    var permissions = {};
    function allow(moduleName, actions) {
      actions.forEach(function (action) {
        permissions[moduleName + '.' + action] = true;
      });
    }
    if (role === JSK_ACCESS.ROLES.ADMINISTRATOR) {
      permissions['*'] = true;
      return permissions;
    }
    if (role === JSK_ACCESS.ROLES.MANAGER) {
      ALL_MODULES.forEach(function (moduleName) {
        allow(moduleName, ['view', 'create', 'update']);
      });
      ['companies', 'people', 'policies', 'claims', 'documents', 'endorsements',
        'quotes', 'tasks', 'meetings', 'communications'].forEach(function (moduleName) {
        allow(moduleName, ['archive']);
      });
      return permissions;
    }
    if (role === JSK_ACCESS.ROLES.EXECUTIVE) {
      ['dashboard', 'companies', 'people', 'policies', 'claims', 'documents',
        'endorsements', 'quotes', 'revenue', 'reports', 'tasks', 'meetings']
        .forEach(function (moduleName) { allow(moduleName, ['view']); });
      return permissions;
    }
    if (role === JSK_ACCESS.ROLES.STAFF) {
      ['dashboard', 'companies', 'people', 'policies', 'claims', 'documents',
        'endorsements', 'quotes', 'tasks', 'meetings', 'communications']
        .forEach(function (moduleName) { allow(moduleName, ['view']); });
      ['claims', 'documents', 'endorsements', 'quotes', 'tasks', 'meetings',
        'communications'].forEach(function (moduleName) {
        allow(moduleName, ['create', 'update']);
      });
      return permissions;
    }
    ALL_MODULES.forEach(function (moduleName) { allow(moduleName, ['view']); });
    return permissions;
  }

  function normalizeEmail_(email) {
    return String(email || '').trim().toLowerCase();
  }

  function currentEmail_() {
    return normalizeEmail_(JSKOS.ConfigService.getCurrentUser());
  }

  function parseRoleMap_() {
    var raw = PropertiesService.getScriptProperties().getProperty(JSK_ACCESS.ROLE_MAP_KEY);
    if (!raw) return {};
    try {
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Role map must be a JSON object.');
      }
      var normalized = {};
      Object.keys(parsed).forEach(function (email) {
        normalized[normalizeEmail_(email)] = String(parsed[email] || '').trim();
      });
      return normalized;
    } catch (error) {
      throw new Error('Invalid ' + JSK_ACCESS.ROLE_MAP_KEY + ': ' + error.message);
    }
  }

  function configuredAdmins_() {
    return String(PropertiesService.getScriptProperties()
      .getProperty(JSK_ACCESS.ADMIN_EMAILS_KEY) || '')
      .split(',').map(normalizeEmail_).filter(Boolean);
  }

  function validRole_(role) {
    return Object.keys(JSK_ACCESS.ROLES).some(function (key) {
      return JSK_ACCESS.ROLES[key] === role;
    });
  }

  function getContext(email) {
    var normalizedEmail = normalizeEmail_(email || currentEmail_());
    var roleMap = parseRoleMap_();
    var admins = configuredAdmins_();
    var configured = Object.keys(roleMap).length > 0 || admins.length > 0;
    var role = roleMap[normalizedEmail] || '';
    if (admins.indexOf(normalizedEmail) !== -1) role = JSK_ACCESS.ROLES.ADMINISTRATOR;
    // Safe bootstrap: the first owner remains administrator until roles are configured.
    if (!configured && normalizedEmail && normalizedEmail !== 'system') {
      role = JSK_ACCESS.ROLES.ADMINISTRATOR;
    }
    if (!validRole_(role)) role = '';
    return {
      email: normalizedEmail,
      authenticated: Boolean(normalizedEmail && normalizedEmail !== 'system'),
      configured: configured,
      role: role || 'Unassigned',
      permissions: role ? permissionsForRole_(role) : {}
    };
  }

  function hasPermission(permission, email) {
    var context = getContext(email);
    return context.permissions['*'] === true || context.permissions[permission] === true;
  }

  function hasRolePermission(role, permission) {
    var permissions = validRole_(role) ? permissionsForRole_(role) : {};
    return permissions['*'] === true || permissions[String(permission || '')] === true;
  }

  function getAccessibleRoutesForRole(role) {
    return Object.keys(JSK_ACCESS.ROUTE_PERMISSIONS).filter(function (route) {
      return hasRolePermission(role, JSK_ACCESS.ROUTE_PERMISSIONS[route]);
    });
  }

  function requirePermission(permission, options) {
    var context = getContext(options && options.email);
    if (!context.authenticated) {
      audit_('DENIED', permission, context, 'Authentication required');
      var authError = new Error('Authentication is required.');
      authError.name = 'UnauthorizedError';
      authError.code = 'UNAUTHORIZED';
      throw authError;
    }
    if (!(context.permissions['*'] || context.permissions[permission])) {
      audit_('DENIED', permission, context, 'Permission denied');
      var accessError = new Error('You do not have permission to perform this action.');
      accessError.name = 'ForbiddenError';
      accessError.code = 'FORBIDDEN';
      throw accessError;
    }
    return context;
  }

  function canAccessRoute(route, email) {
    var permission = JSK_ACCESS.ROUTE_PERMISSIONS[String(route || '')];
    return Boolean(permission && hasPermission(permission, email));
  }

  function actionForOperation_(operation) {
    var value = String(operation || '').toLowerCase();
    if (['create', 'queue', 'upload'].indexOf(value) !== -1) return 'create';
    if (['delete', 'archive', 'remove'].indexOf(value) !== -1) return 'archive';
    if (['update', 'restore', 'complete', 'retry', 'decision', 'convert-policy',
      'record-payment'].indexOf(value) !== -1) return 'update';
    return 'view';
  }

  function requireModuleOperation(moduleName, operation) {
    return requirePermission(getOperationPermission_(moduleName, operation));
  }

  function getOperationPermission_(moduleName, operation) {
    return String(moduleName || '').toLowerCase() + '.' + actionForOperation_(operation);
  }

  function setUserRole(email, role) {
    var actor = requirePermission('access.manage');
    var normalizedEmail = normalizeEmail_(email);
    if (!normalizedEmail || normalizedEmail.indexOf('@') === -1) {
      throw new Error('A valid user email is required.');
    }
    if (!validRole_(role)) throw new Error('Select a valid access role.');
    if (normalizedEmail === actor.email && role !== JSK_ACCESS.ROLES.ADMINISTRATOR) {
      throw new Error('You cannot downgrade your own Administrator access.');
    }
    var roleMap = parseRoleMap_();
    if (!actor.configured && actor.email) {
      roleMap[actor.email] = JSK_ACCESS.ROLES.ADMINISTRATOR;
    }
    roleMap[normalizedEmail] = role;
    PropertiesService.getScriptProperties().setProperty(
      JSK_ACCESS.ROLE_MAP_KEY, JSON.stringify(roleMap)
    );
    audit_('ROLE_UPDATED', 'access.manage', getContext(), normalizedEmail + ' = ' + role);
    return { email: normalizedEmail, role: role };
  }

  function removeUserRole(email) {
    var actor = requirePermission('access.manage');
    var normalizedEmail = normalizeEmail_(email);
    if (normalizedEmail === actor.email) {
      throw new Error('You cannot remove your own access.');
    }
    if (configuredAdmins_().indexOf(normalizedEmail) !== -1) {
      throw new Error('A configured Administrator cannot be removed here.');
    }
    var roleMap = parseRoleMap_();
    delete roleMap[normalizedEmail];
    PropertiesService.getScriptProperties().setProperty(
      JSK_ACCESS.ROLE_MAP_KEY, JSON.stringify(roleMap)
    );
    audit_('ROLE_REMOVED', 'access.manage', getContext(), normalizedEmail);
    return { email: normalizedEmail, removed: true };
  }

  function listUsers() {
    requirePermission('access.manage');
    var roleMap = parseRoleMap_();
    configuredAdmins_().forEach(function (email) {
      roleMap[email] = JSK_ACCESS.ROLES.ADMINISTRATOR;
    });
    var context = getContext();
    if (!context.configured && context.authenticated) {
      roleMap[context.email] = JSK_ACCESS.ROLES.ADMINISTRATOR;
    }
    return Object.keys(roleMap).sort().map(function (email) {
      return {
        email: email,
        role: roleMap[email],
        currentUser: email === context.email,
        protectedAdmin: configuredAdmins_().indexOf(email) !== -1
      };
    });
  }

  function audit_(action, permission, context, details) {
    try {
      var sheet = JSKOS.ConfigService.getOrCreateSheet(JSK_ACCESS.AUDIT_SHEET);
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(['Timestamp', 'Action', 'Permission', 'User Email', 'Role', 'Details']);
        sheet.setFrozenRows(1);
      }
      sheet.appendRow([
        new Date(), action, permission, context.email || 'UNKNOWN',
        context.role || 'Unassigned', String(details || '')
      ]);
    } catch (error) {
      console.error('Access audit write failed: ' + (error.stack || error));
    }
  }

  return Object.freeze({
    getContext: getContext,
    hasPermission: hasPermission,
    hasRolePermission: hasRolePermission,
    getAccessibleRoutesForRole: getAccessibleRoutesForRole,
    requirePermission: requirePermission,
    canAccessRoute: canAccessRoute,
    requireModuleOperation: requireModuleOperation,
    getOperationPermission: getOperationPermission_,
    setUserRole: setUserRole,
    removeUserRole: removeUserRole,
    listUsers: listUsers,
    permissionsForRole: permissionsForRole_
  });
})();

function apiGetAccessContext() {
  return JSKResponse.success(JSKOS.AccessControl.getContext());
}

function apiAccessListUsers() {
  try { return JSKResponse.success(JSKOS.AccessControl.listUsers()); }
  catch (error) { return JSKResponse.fromException(error, { code: error.code || 'ACCESS_ERROR', exposeErrorMessage: true }); }
}

function apiAccessSetUserRole(payload) {
  try {
    payload = payload || {};
    return JSKResponse.success(JSKOS.AccessControl.setUserRole(payload.email, payload.role));
  } catch (error) {
    return JSKResponse.fromException(error, { code: error.code || 'ACCESS_ERROR', exposeErrorMessage: true });
  }
}

function apiAccessRemoveUserRole(payload) {
  try {
    payload = payload || {};
    return JSKResponse.success(JSKOS.AccessControl.removeUserRole(payload.email));
  } catch (error) {
    return JSKResponse.fromException(error, { code: error.code || 'ACCESS_ERROR', exposeErrorMessage: true });
  }
}
