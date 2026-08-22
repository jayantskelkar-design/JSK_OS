/** JSK OS Build 1025 - legacy mutation and trusted-system authority. */

var JSKOS = JSKOS || {};

var JSK_LEGACY_AUTHORITY_PRIVATE_ = (function () {
  'use strict';

  var token = {};
  var systemLabels = Object.freeze({
    DOCUMENT_EXPIRY_AUTOMATION: 'Document Expiry Automation',
    TASK_AUTOMATION: 'Task Automation',
    TASK_NOTIFICATIONS: 'Task Notifications',
    MEETING_AUTOMATION: 'Meeting Automation',
    META_WHATSAPP_SENDER: 'Meta WhatsApp Sender',
    WALEAD_WHATSAPP_SENDER: 'WA Lead Sender',
    RENEWAL_AUTOMATION: 'Renewal Automation',
    ENDORSEMENT_AUTOMATION: 'Endorsement Automation',
    QUOTE_AUTOMATION: 'Quote Automation',
    REVENUE_AUTOMATION: 'Revenue Automation',
    EXECUTIVE_REPORT_SENDER: 'Executive Report Sender'
  });

  function normalizedEmail_(value) {
    return String(value || '').trim().toLowerCase();
  }

  function requireServerActor_(context) {
    var actor = normalizedEmail_(context && context.email);
    if (!/^[a-z0-9._%+\-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(actor) || actor === 'system') {
      var error = new Error('An authenticated server actor is required.');
      error.name = 'UnauthorizedError';
      error.code = 'UNAUTHORIZED';
      error.status = 401;
      throw error;
    }
    return actor;
  }

  function capability_(kind, actor, moduleName, operation) {
    return Object.freeze({
      authorityToken: token,
      kind: kind,
      actor: actor,
      moduleName: String(moduleName || ''),
      operation: String(operation || '')
    });
  }

  function requireUser(moduleName, operation) {
    var context = JSKOS.AccessControl.requireModuleOperation(moduleName, operation);
    return capability_('USER', requireServerActor_(context), moduleName, operation);
  }

  function requireAdmin(operation) {
    var context = JSKOS.AccessControl.requirePermission('access.manage');
    return capability_('ADMIN', requireServerActor_(context), 'access', operation || 'manage');
  }

  function assertCapability_(authority, kinds) {
    if (!authority || authority.authorityToken !== token || kinds.indexOf(authority.kind) === -1) {
      var error = new Error('A valid server authority is required.');
      error.name = 'ForbiddenError';
      error.code = 'FORBIDDEN';
      error.status = 403;
      throw error;
    }
    return authority;
  }

  function actor(authority) {
    return assertCapability_(authority, ['USER', 'ADMIN', 'SYSTEM']).actor;
  }

  function runTrusted(labelKey, callback) {
    var actor = systemLabels[String(labelKey || '')];
    if (!actor || typeof callback !== 'function') {
      throw new Error('Trusted-system execution contract is invalid.');
    }
    return callback(capability_('SYSTEM', actor, 'system', labelKey));
  }

  function migrationRequired(moduleName) {
    var error = new Error(
      String(moduleName || 'Module') +
      ' requires an Administrator to run its database migration.'
    );
    error.name = 'MigrationRequiredError';
    error.code = 'MIGRATION_REQUIRED';
    error.status = 503;
    error.action = 'ADMIN_MIGRATION_REQUIRED';
    return error;
  }

  function requireSchema(definition) {
    definition = definition || {};
    var spreadsheet = definition.spreadsheet || JSKOS.ConfigService.getSpreadsheet();
    var sheet = spreadsheet.getSheetByName(String(definition.sheetName || ''));
    if (!sheet || sheet.getLastColumn() < 1) throw migrationRequired(definition.moduleName);

    var rows = Math.min(Math.max(sheet.getLastRow(), 1), Number(definition.headerScanLimit) || 1);
    var values = sheet.getRange(1, 1, rows, sheet.getLastColumn()).getDisplayValues();
    var required = (definition.headers || []).map(function (header) {
      return Array.isArray(header) ? header.map(String) : [String(header)];
    });
    var headerRow = -1;
    var headers = [];
    values.some(function (row, index) {
      var normalized = row.map(function (value) { return String(value || '').trim(); });
      var complete = required.every(function (alternatives) {
        return alternatives.some(function (header) { return normalized.indexOf(header) !== -1; });
      });
      if (complete) {
        headerRow = index + 1;
        headers = normalized;
      }
      return complete;
    });
    if (headerRow === -1) throw migrationRequired(definition.moduleName);

    if (definition.propertyKey) {
      var version = Number(PropertiesService.getScriptProperties().getProperty(definition.propertyKey) || 0);
      if (version < Number(definition.version || 1)) throw migrationRequired(definition.moduleName);
    }
    return { spreadsheet: spreadsheet, sheet: sheet, headers: headers, headerRow: headerRow };
  }

  return Object.freeze({
    requireUser: requireUser,
    requireAdmin: requireAdmin,
    assertCapability: assertCapability_,
    actor: actor,
    runTrusted: runTrusted,
    migrationRequired: migrationRequired,
    requireSchema: requireSchema,
    systemLabels: systemLabels
  });
})();

JSKOS.LegacyMutationAuthority = Object.freeze({
  requireUser: JSK_LEGACY_AUTHORITY_PRIVATE_.requireUser,
  requireAdmin: JSK_LEGACY_AUTHORITY_PRIVATE_.requireAdmin,
  assertUser: function (authority) {
    return JSK_LEGACY_AUTHORITY_PRIVATE_.assertCapability(authority, ['USER', 'ADMIN']);
  },
  assertAdmin: function (authority) {
    return JSK_LEGACY_AUTHORITY_PRIVATE_.assertCapability(authority, ['ADMIN']);
  },
  assertMutation: function (authority) {
    return JSK_LEGACY_AUTHORITY_PRIVATE_.assertCapability(authority, ['USER', 'ADMIN', 'SYSTEM']);
  },
  actor: JSK_LEGACY_AUTHORITY_PRIVATE_.actor,
  migrationRequired: JSK_LEGACY_AUTHORITY_PRIVATE_.migrationRequired,
  requireSchema: JSK_LEGACY_AUTHORITY_PRIVATE_.requireSchema
});

function legacyRunTrustedSystem_(labelKey, callback) {
  return JSK_LEGACY_AUTHORITY_PRIVATE_.runTrusted(labelKey, callback);
}

function legacyRequireTrustedSystem_(authority) {
  return JSK_LEGACY_AUTHORITY_PRIVATE_.assertCapability(authority, ['SYSTEM']);
}
