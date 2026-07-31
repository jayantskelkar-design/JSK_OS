/**
 * JSK OS
 * Module: People Database Migration
 * Version: 0.9.0-alpha
 *
 * Creates and maintains the Google Sheets schema required
 * by the People CRM module.
 *
 * Google Apps Script V8 compatible.
 */

var JSK_PEOPLE_SCHEMA = Object.freeze({
  VERSION: 1,
  SHEET_NAME: 'People',
  AUDIT_SHEET_NAME: 'Audit_Log',
  HEADER_ROW: 1,
  FREEZE_ROWS: 1,

  HEADERS: Object.freeze([
    'Person ID',
    'Company ID',
    'Title',
    'First Name',
    'Last Name',
    'Full Name',
    'Designation',
    'Department',
    'Decision Maker',
    'Mobile',
    'Alternate Mobile',
    'Email',
    'Alternate Email',
    'WhatsApp',
    'Birthday',
    'Anniversary',
    'LinkedIn',
    'Status',
    'Remarks',
    'Created At',
    'Created By',
    'Updated At',
    'Updated By',
    'Record Version',
    'Is Deleted'
  ]),

  COLUMN_WIDTHS: Object.freeze({
    'Person ID': 190,
    'Company ID': 190,
    'Title': 80,
    'First Name': 130,
    'Last Name': 130,
    'Full Name': 210,
    'Designation': 170,
    'Department': 140,
    'Decision Maker': 120,
    'Mobile': 125,
    'Alternate Mobile': 135,
    'Email': 210,
    'Alternate Email': 210,
    'WhatsApp': 125,
    'Birthday': 110,
    'Anniversary': 110,
    'LinkedIn': 240,
    'Status': 110,
    'Remarks': 300,
    'Created At': 165,
    'Created By': 190,
    'Updated At': 165,
    'Updated By': 190,
    'Record Version': 120,
    'Is Deleted': 105
  }),

  STATUS_VALUES: Object.freeze([
    'Active',
    'Prospect',
    'Customer',
    'Inactive',
    'Dormant',
    'Archived'
  ]),

  TITLE_VALUES: Object.freeze([
    'Mr.',
    'Mrs.',
    'Ms.',
    'Dr.',
    'CA',
    'Adv.',
    'Er.',
    'Prof.'
  ]),

  DEPARTMENT_VALUES: Object.freeze([
    'Management',
    'Director',
    'HR',
    'Finance',
    'Accounts',
    'Purchase',
    'Operations',
    'Production',
    'Plant',
    'Sales',
    'Marketing',
    'Administration',
    'Legal',
    'IT',
    'Other'
  ]),

  BOOLEAN_VALUES: Object.freeze([
    'TRUE',
    'FALSE'
  ]),

  DATE_FORMAT: 'dd-mmm-yyyy',
  DATETIME_FORMAT: 'dd-mmm-yyyy hh:mm:ss'
});

/**
 * Creates or upgrades the People CRM database schema.
 *
 * This migration is idempotent:
 * it may be executed repeatedly without deleting existing records.
 *
 * Run manually from the Apps Script editor.
 *
 * @return {Object} Migration result.
 */
function migratePeopleDatabase() {
  var lock = LockService.getScriptLock();

  lock.waitLock(
    JSKOS.Config &&
    JSKOS.Config.LOCKS &&
    JSKOS.Config.LOCKS.TIMEOUT_MS
      ? JSKOS.Config.LOCKS.TIMEOUT_MS
      : 30000
  );

  try {
    var spreadsheet = getPeopleMigrationSpreadsheet_();
    var sheet = spreadsheet.getSheetByName(
      JSK_PEOPLE_SCHEMA.SHEET_NAME
    );

    var created = false;

    if (!sheet) {
      sheet = spreadsheet.insertSheet(
        JSK_PEOPLE_SCHEMA.SHEET_NAME
      );

      created = true;
    }

    var headerRow = findPeopleHeaderRow_(sheet);

    if (!headerRow) {
      if (sheet.getLastRow() > 0 && hasPeopleSheetData_(sheet)) {
        throw new Error(
          'People sheet exists but the Person ID and Full Name ' +
          'header row was not found. Rename the existing sheet ' +
          'or move its data before running the migration.'
        );
      }

      headerRow = JSK_PEOPLE_SCHEMA.HEADER_ROW;

      writePeopleHeaders_(sheet, headerRow);
    } else {
      upgradePeopleHeaders_(sheet, headerRow);
    }

    formatPeopleSheet_(sheet, headerRow);
    configurePeopleValidations_(sheet, headerRow);
    ensurePeopleAuditSheet_(spreadsheet);
    savePeopleSchemaVersion_();

    SpreadsheetApp.flush();

    var result = {
      success: true,
      module: 'People CRM',
      schemaVersion: JSK_PEOPLE_SCHEMA.VERSION,
      sheetName: sheet.getName(),
      sheetCreated: created,
      headerRow: headerRow,
      headerCount: JSK_PEOPLE_SCHEMA.HEADERS.length,
      spreadsheetId: spreadsheet.getId(),
      timestamp: new Date().toISOString()
    };

    console.info(JSON.stringify(result));

    return result;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Returns the configured JSK OS spreadsheet.
 *
 * @private
 * @return {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function getPeopleMigrationSpreadsheet_() {
  if (
    typeof JSKOS !== 'undefined' &&
    JSKOS.ConfigService &&
    typeof JSKOS.ConfigService.getSpreadsheet === 'function'
  ) {
    return JSKOS.ConfigService.getSpreadsheet();
  }

  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  if (!spreadsheet) {
    throw new Error(
      'JSK OS spreadsheet is not available.'
    );
  }

  return spreadsheet;
}

/**
 * Detects the People header row.
 *
 * @private
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet People sheet.
 * @return {number|null}
 */
function findPeopleHeaderRow_(sheet) {
  var scanLimit = Math.min(
    Math.max(sheet.getLastRow(), 1),
    10
  );

  var columnCount = Math.max(
    sheet.getLastColumn(),
    JSK_PEOPLE_SCHEMA.HEADERS.length
  );

  var values = sheet
    .getRange(1, 1, scanLimit, columnCount)
    .getDisplayValues();

  for (var rowIndex = 0; rowIndex < values.length; rowIndex++) {
    var normalized = values[rowIndex].map(function (value) {
      return String(value || '')
        .trim()
        .toLowerCase();
    });

    if (
      normalized.indexOf('person id') !== -1 &&
      normalized.indexOf('full name') !== -1
    ) {
      return rowIndex + 1;
    }
  }

  return null;
}

/**
 * Determines whether a sheet contains meaningful data.
 *
 * @private
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet Sheet.
 * @return {boolean}
 */
function hasPeopleSheetData_(sheet) {
  if (
    sheet.getLastRow() < 1 ||
    sheet.getLastColumn() < 1
  ) {
    return false;
  }

  return sheet
    .getDataRange()
    .getDisplayValues()
    .some(function (row) {
      return row.some(function (value) {
        return String(value || '').trim() !== '';
      });
    });
}

/**
 * Writes a fresh People header row.
 *
 * @private
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet People sheet.
 * @param {number} headerRow Header row.
 * @return {void}
 */
function writePeopleHeaders_(sheet, headerRow) {
  var headers = JSK_PEOPLE_SCHEMA.HEADERS.slice();

  sheet
    .getRange(headerRow, 1, 1, headers.length)
    .setValues([headers]);
}

/**
 * Adds missing columns without removing or reordering existing data.
 *
 * @private
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet People sheet.
 * @param {number} headerRow Header row.
 * @return {void}
 */
function upgradePeopleHeaders_(sheet, headerRow) {
  var lastColumn = Math.max(sheet.getLastColumn(), 1);

  var existingHeaders = sheet
    .getRange(headerRow, 1, 1, lastColumn)
    .getDisplayValues()[0]
    .map(function (header) {
      return String(header || '').trim();
    });

  var existingMap = {};

  existingHeaders.forEach(function (header) {
    if (header) {
      existingMap[header.toLowerCase()] = true;
    }
  });

  var missingHeaders =
    JSK_PEOPLE_SCHEMA.HEADERS.filter(function (header) {
      return !existingMap[header.toLowerCase()];
    });

  if (missingHeaders.length === 0) {
    return;
  }

  var startColumn = existingHeaders.length + 1;

  sheet
    .getRange(
      headerRow,
      startColumn,
      1,
      missingHeaders.length
    )
    .setValues([missingHeaders]);
}

/**
 * Applies production formatting to the People sheet.
 *
 * @private
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet People sheet.
 * @param {number} headerRow Header row.
 * @return {void}
 */
function formatPeopleSheet_(sheet, headerRow) {
  var headers = readPeopleHeaders_(
    sheet,
    headerRow
  );

  var headerRange = sheet.getRange(
    headerRow,
    1,
    1,
    headers.length
  );

  headerRange
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(true);

  sheet.setFrozenRows(
    JSK_PEOPLE_SCHEMA.FREEZE_ROWS
  );

  sheet.setRowHeight(headerRow, 38);

  headers.forEach(function (header, index) {
    var width =
      JSK_PEOPLE_SCHEMA.COLUMN_WIDTHS[header] || 140;

    sheet.setColumnWidth(index + 1, width);
  });

  var dataRowCount = Math.max(
    sheet.getMaxRows() - headerRow,
    1
  );

  applyPeopleColumnFormat_(
    sheet,
    headerRow,
    headers,
    'Birthday',
    dataRowCount,
    JSK_PEOPLE_SCHEMA.DATE_FORMAT
  );

  applyPeopleColumnFormat_(
    sheet,
    headerRow,
    headers,
    'Anniversary',
    dataRowCount,
    JSK_PEOPLE_SCHEMA.DATE_FORMAT
  );

  [
    'Created At',
    'Updated At'
  ].forEach(function (header) {
    applyPeopleColumnFormat_(
      sheet,
      headerRow,
      headers,
      header,
      dataRowCount,
      JSK_PEOPLE_SCHEMA.DATETIME_FORMAT
    );
  });

  [
    'Mobile',
    'Alternate Mobile',
    'WhatsApp',
    'Person ID',
    'Company ID'
  ].forEach(function (header) {
    var columnIndex = headers.indexOf(header);

    if (columnIndex !== -1) {
      sheet
        .getRange(
          headerRow + 1,
          columnIndex + 1,
          dataRowCount,
          1
        )
        .setNumberFormat('@');
    }
  });

  if (!sheet.getFilter()) {
    sheet
      .getRange(
        headerRow,
        1,
        Math.max(sheet.getLastRow() - headerRow + 1, 1),
        headers.length
      )
      .createFilter();
  }
}

/**
 * Applies a number format to a named column.
 *
 * @private
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet Sheet.
 * @param {number} headerRow Header row.
 * @param {string[]} headers Headers.
 * @param {string} headerName Target header.
 * @param {number} rowCount Data row count.
 * @param {string} format Number format.
 * @return {void}
 */
function applyPeopleColumnFormat_(
  sheet,
  headerRow,
  headers,
  headerName,
  rowCount,
  format
) {
  var columnIndex = headers.indexOf(headerName);

  if (columnIndex === -1) {
    return;
  }

  sheet
    .getRange(
      headerRow + 1,
      columnIndex + 1,
      rowCount,
      1
    )
    .setNumberFormat(format);
}

/**
 * Configures dropdown validation rules.
 *
 * @private
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet People sheet.
 * @param {number} headerRow Header row.
 * @return {void}
 */
function configurePeopleValidations_(sheet, headerRow) {
  var headers = readPeopleHeaders_(
    sheet,
    headerRow
  );

  var rowCount = Math.max(
    sheet.getMaxRows() - headerRow,
    1
  );

  setPeopleListValidation_(
    sheet,
    headerRow,
    headers,
    'Title',
    JSK_PEOPLE_SCHEMA.TITLE_VALUES,
    rowCount
  );

  setPeopleListValidation_(
    sheet,
    headerRow,
    headers,
    'Department',
    JSK_PEOPLE_SCHEMA.DEPARTMENT_VALUES,
    rowCount
  );

  setPeopleListValidation_(
    sheet,
    headerRow,
    headers,
    'Status',
    JSK_PEOPLE_SCHEMA.STATUS_VALUES,
    rowCount
  );

  setPeopleListValidation_(
    sheet,
    headerRow,
    headers,
    'Decision Maker',
    JSK_PEOPLE_SCHEMA.BOOLEAN_VALUES,
    rowCount
  );

  setPeopleListValidation_(
    sheet,
    headerRow,
    headers,
    'Is Deleted',
    JSK_PEOPLE_SCHEMA.BOOLEAN_VALUES,
    rowCount
  );
}

/**
 * Sets a dropdown validation rule on a named column.
 *
 * @private
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet Sheet.
 * @param {number} headerRow Header row.
 * @param {string[]} headers Headers.
 * @param {string} headerName Target header.
 * @param {string[]} values Dropdown values.
 * @param {number} rowCount Data row count.
 * @return {void}
 */
function setPeopleListValidation_(
  sheet,
  headerRow,
  headers,
  headerName,
  values,
  rowCount
) {
  var columnIndex = headers.indexOf(headerName);

  if (columnIndex === -1) {
    return;
  }

  var validation = SpreadsheetApp
    .newDataValidation()
    .requireValueInList(values.slice(), true)
    .setAllowInvalid(false)
    .setHelpText(
      'Select a valid ' + headerName + ' value.'
    )
    .build();

  sheet
    .getRange(
      headerRow + 1,
      columnIndex + 1,
      rowCount,
      1
    )
    .setDataValidation(validation);
}

/**
 * Reads the complete header row.
 *
 * @private
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet Sheet.
 * @param {number} headerRow Header row.
 * @return {string[]}
 */
function readPeopleHeaders_(sheet, headerRow) {
  var lastColumn = sheet.getLastColumn();

  if (lastColumn < 1) {
    return [];
  }

  return sheet
    .getRange(headerRow, 1, 1, lastColumn)
    .getDisplayValues()[0]
    .map(function (header) {
      return String(header || '').trim();
    });
}

/**
 * Ensures the shared Audit_Log sheet exists.
 *
 * @private
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} spreadsheet Spreadsheet.
 * @return {void}
 */
function ensurePeopleAuditSheet_(spreadsheet) {
  var sheet = spreadsheet.getSheetByName(
    JSK_PEOPLE_SCHEMA.AUDIT_SHEET_NAME
  );

  if (sheet) {
    return;
  }

  sheet = spreadsheet.insertSheet(
    JSK_PEOPLE_SCHEMA.AUDIT_SHEET_NAME
  );

  sheet
    .getRange(1, 1, 1, 8)
    .setValues([
      [
        'Audit ID',
        'Timestamp',
        'Entity Type',
        'Entity ID',
        'Action',
        'Actor',
        'Before Data',
        'After Data'
      ]
    ]);

  sheet
    .getRange(1, 1, 1, 8)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  sheet.setFrozenRows(1);
}

/**
 * Stores the installed People schema version.
 *
 * @private
 * @return {void}
 */
function savePeopleSchemaVersion_() {
  PropertiesService
    .getScriptProperties()
    .setProperty(
      'JSK_OS_PEOPLE_SCHEMA_VERSION',
      String(JSK_PEOPLE_SCHEMA.VERSION)
    );
}

/**
 * Verifies the installed People database schema.
 *
 * Run manually after migratePeopleDatabase().
 *
 * @return {Object} Test result.
 */
function testPeopleDatabaseMigration() {
  var spreadsheet = getPeopleMigrationSpreadsheet_();

  var sheet = spreadsheet.getSheetByName(
    JSK_PEOPLE_SCHEMA.SHEET_NAME
  );

  assertPeopleMigration_(
    Boolean(sheet),
    'People sheet was not created.'
  );

  var headerRow = findPeopleHeaderRow_(sheet);

  assertPeopleMigration_(
    Boolean(headerRow),
    'People header row was not found.'
  );

  var headers = readPeopleHeaders_(
    sheet,
    headerRow
  );

  var missingHeaders =
    JSK_PEOPLE_SCHEMA.HEADERS.filter(function (header) {
      return headers.indexOf(header) === -1;
    });

  assertPeopleMigration_(
    missingHeaders.length === 0,
    'Missing People columns: ' +
      missingHeaders.join(', ')
  );

  var storedVersion = PropertiesService
    .getScriptProperties()
    .getProperty('JSK_OS_PEOPLE_SCHEMA_VERSION');

  assertPeopleMigration_(
    Number(storedVersion) ===
      JSK_PEOPLE_SCHEMA.VERSION,
    'People schema version was not saved correctly.'
  );

  var result = {
    success: true,
    message: 'People database migration test passed.',
    schemaVersion: JSK_PEOPLE_SCHEMA.VERSION,
    sheetName: sheet.getName(),
    headerRow: headerRow,
    headerCount: headers.length,
    timestamp: new Date().toISOString()
  };

  console.info(JSON.stringify(result));

  return result;
}

/**
 * Throws when a migration test fails.
 *
 * @private
 * @param {boolean} condition Test condition.
 * @param {string} message Failure message.
 * @return {void}
 */
function assertPeopleMigration_(condition, message) {
  if (!condition) {
    throw new Error(
      'People Migration Test Failed: ' + message
    );
  }
}