/**
 * JSK OS
 * Module: Core Configuration
 * Version: 1.0.0
 */

var JSKOS = JSKOS || {};

JSKOS.Config = Object.freeze({
  APP: Object.freeze({
    NAME: 'JSK OS',
    VERSION: '1.5.0-beta',
    ENVIRONMENT: 'PRODUCTION',
    TIMEZONE: 'Asia/Kolkata'
  }),

  DATABASE: Object.freeze({
    SPREADSHEET_ID:
      '1eCvBQ9Jr4ccthN1GNTezkBm9gx5X5tqC_EHj266J-vk',

    PROPERTY_KEY: 'JSK_OS_SPREADSHEET_ID'
  }),

  SHEETS: Object.freeze({
    COMPANIES: 'Companies',
    PEOPLE: 'People',
    TASKS: 'Tasks',
    DASHBOARD: 'Dashboard',
    AUDIT_LOG: 'Audit_Log',
    SYSTEM_LOGS: 'System_Logs',
    MIGRATIONS: 'Database_Migrations',
    SETTINGS: 'System_Settings'
  }),

  PAGINATION: Object.freeze({
    DEFAULT_PAGE_SIZE: 25,
    MAX_PAGE_SIZE: 100
  }),

  LOCKS: Object.freeze({
    TIMEOUT_MS: 30000
  })
});

JSKOS.ConfigService = Object.freeze({
  getSpreadsheetId: function () {
    var storedId = PropertiesService
      .getScriptProperties()
      .getProperty(
        JSKOS.Config.DATABASE.PROPERTY_KEY
      );

    return String(
      storedId ||
      JSKOS.Config.DATABASE.SPREADSHEET_ID ||
      ''
    ).trim();
  },

  getSpreadsheet: function () {
    var spreadsheetId = this.getSpreadsheetId();

    if (!spreadsheetId) {
      throw new Error(
        'JSK OS Spreadsheet ID is not configured.'
      );
    }

    return SpreadsheetApp.openById(spreadsheetId);
  },

  getSheet: function (sheetName) {
    var normalizedName = String(
      sheetName || ''
    ).trim();

    if (!normalizedName) {
      throw new Error('Sheet name is required.');
    }

    var sheet = this
      .getSpreadsheet()
      .getSheetByName(normalizedName);

    if (!sheet) {
      throw new Error(
        'Required sheet not found: ' +
        normalizedName
      );
    }

    return sheet;
  },

  getOrCreateSheet: function (sheetName) {
    var normalizedName = String(
      sheetName || ''
    ).trim();

    if (!normalizedName) {
      throw new Error('Sheet name is required.');
    }

    var spreadsheet = this.getSpreadsheet();
    var sheet = spreadsheet.getSheetByName(
      normalizedName
    );

    return sheet ||
      spreadsheet.insertSheet(normalizedName);
  },

  getCurrentUser: function () {
    var email = '';

    try {
      email = Session.getActiveUser().getEmail();
    } catch (error) {
      email = '';
    }

    return email || 'SYSTEM';
  },

  formatDate: function (value, format) {
    var date =
      value instanceof Date
        ? value
        : new Date(value);

    if (isNaN(date.getTime())) {
      throw new Error('Invalid date supplied.');
    }

    return Utilities.formatDate(
      date,
      JSKOS.Config.APP.TIMEZONE,
      format || 'yyyy-MM-dd HH:mm:ss'
    );
  }
});
