/**
 * JSK OS
 * Module: Policy Database Migration
 * Version: 1.0.0
 *
 * Creates and maintains the Google Sheets schema required
 * by the Policy Management module.
 *
 * Google Apps Script V8 compatible.
 */

var JSK_POLICY_SCHEMA = Object.freeze({
  VERSION: 2,
  SHEET_NAME: 'Policies',
  AUDIT_SHEET_NAME: 'Audit_Log',
  HEADER_ROW: 1,
  FREEZE_ROWS: 1,
  HEADER_SCAN_LIMIT: 10,
  PROPERTY_KEY: 'JSK_OS_POLICY_SCHEMA_VERSION',

  HEADERS: Object.freeze([
    'Policy ID',
    'Policy Number',
    'Proposal Number',
    'Policy Type',
    'Product Name',
    'Insurer Name',
    'Company ID',
    'Person ID',
    'Family ID',
    'Insured Name',
    'Risk Category',
    'Sum Insured',
    'Net Premium',
    'GST Amount',
    'Total Premium',
    'Start Date',
    'End Date',
    'Renewal Date',
    'Policy Status',
    'Renewal Stage',
    'Payment Frequency',
    'Agent / Broker',
    'Branch',
    'Nominee',
    'Policy Document URL',
    'Previous Policy Number',
    'Claims Count',
    'Last Claim Date',
    'Remarks',
    'Created At',
    'Created By',
    'Updated At',
    'Updated By',
    'Record Version',
    'Is Deleted'
  ]),

  COLUMN_WIDTHS: Object.freeze({
    'Policy ID': 190,
    'Policy Number': 180,
    'Proposal Number': 170,
    'Policy Type': 180,
    'Product Name': 210,
    'Insurer Name': 190,
    'Company ID': 190,
    'Person ID': 190,
    'Family ID': 190,
    'Insured Name': 210,
    'Risk Category': 150,
    'Sum Insured': 130,
    'Net Premium': 125,
    'GST Amount': 115,
    'Total Premium': 130,
    'Start Date': 110,
    'End Date': 110,
    'Renewal Date': 115,
    'Policy Status': 135,
    'Renewal Stage': 150,
    'Payment Frequency': 140,
    'Agent / Broker': 180,
    'Branch': 150,
    'Nominee': 180,
    'Policy Document URL': 260,
    'Previous Policy Number': 190,
    'Claims Count': 105,
    'Last Claim Date': 115,
    'Remarks': 320,
    'Created At': 165,
    'Created By': 190,
    'Updated At': 165,
    'Updated By': 190,
    'Record Version': 120,
    'Is Deleted': 105
  }),

  POLICY_TYPE_VALUES: Object.freeze([
    'Life Insurance',
    'Health Insurance',
    'Group Mediclaim',
    'Group Personal Accident',
    'Group Term Life',
    'Workmen Compensation',
    'Fire Insurance',
    'Property Insurance',
    'Industrial All Risk',
    'Machinery Breakdown',
    'Electronic Equipment',
    'Marine Insurance',
    'Motor Insurance',
    'Public Liability',
    'Product Liability',
    'Professional Indemnity',
    'Directors and Officers',
    'Cyber Insurance',
    'Fidelity Guarantee',
    'Keyman Insurance',
    'Other'
  ]),

  POLICY_STATUS_VALUES: Object.freeze([
    'Draft',
    'Proposed',
    'Issued',
    'Active',
    'Renewal Due',
    'Renewed',
    'Expired',
    'Lapsed',
    'Cancelled',
    'Rejected'
  ]),

  RENEWAL_STAGE_VALUES: Object.freeze([
    'Call Pending',
    'WhatsApp Sent',
    'Quote Sent',
    'Negotiation',
    'Won',
    'Lost'
  ]),

  PAYMENT_FREQUENCY_VALUES: Object.freeze([
    'Single',
    'Monthly',
    'Quarterly',
    'Half-Yearly',
    'Annual',
    'Not Applicable'
  ]),

  RISK_CATEGORY_VALUES: Object.freeze([
    'Low',
    'Medium',
    'High',
    'Critical',
    'Not Assessed'
  ]),

  BOOLEAN_VALUES: Object.freeze([
    'TRUE',
    'FALSE'
  ]),

  DATE_FORMAT: 'dd-mmm-yyyy',
  DATETIME_FORMAT: 'dd-mmm-yyyy hh:mm:ss',
  MONEY_FORMAT: '₹#,##0.00',
  INTEGER_FORMAT: '0'
});

/**
 * Creates or upgrades the Policy database schema.
 *
 * The migration is idempotent and preserves existing records,
 * custom columns and existing column order.
 *
 * Run manually from the Apps Script editor.
 *
 * @return {Object} Migration result.
 */
function migratePolicyDatabase() {
  var lock = LockService.getScriptLock();

  lock.waitLock(getPolicyMigrationLockTimeout_());

  try {
    var spreadsheet = getPolicyMigrationSpreadsheet_();
    var sheet = spreadsheet.getSheetByName(
      JSK_POLICY_SCHEMA.SHEET_NAME
    );
    var created = false;
    var headersAdded = [];

    if (!sheet) {
      sheet = spreadsheet.insertSheet(
        JSK_POLICY_SCHEMA.SHEET_NAME
      );
      created = true;
    }

    var headerRow = findPolicyHeaderRow_(sheet);

    if (!headerRow) {
      if (hasPolicySheetData_(sheet)) {
        throw new Error(
          'Policies sheet exists but the Policy ID and Policy Number ' +
          'header row was not found. Rename the existing sheet or move ' +
          'its data before running the migration.'
        );
      }

      headerRow = JSK_POLICY_SCHEMA.HEADER_ROW;
      writePolicyHeaders_(sheet, headerRow);
      headersAdded = JSK_POLICY_SCHEMA.HEADERS.slice();
    } else {
      validatePolicyHeaderIntegrity_(sheet, headerRow);
      headersAdded = upgradePolicyHeaders_(sheet, headerRow);
    }

    formatPolicySheet_(sheet, headerRow);
    configurePolicyValidations_(sheet, headerRow);
    ensurePolicyAuditSheet_(spreadsheet);
    savePolicySchemaVersion_();

    SpreadsheetApp.flush();

    var result = {
      success: true,
      module: 'Policy Management',
      schemaVersion: JSK_POLICY_SCHEMA.VERSION,
      sheetName: sheet.getName(),
      sheetCreated: created,
      headerRow: headerRow,
      headerCount: readPolicyHeaders_(sheet, headerRow).length,
      headersAdded: headersAdded,
      spreadsheetId: spreadsheet.getId(),
      timestamp: new Date().toISOString()
    };

    console.info(JSON.stringify(result));

    return result;
  } finally {
    lock.releaseLock();
  }
}

/** @private @return {number} */
function getPolicyMigrationLockTimeout_() {
  return (
    typeof JSKOS !== 'undefined' &&
    JSKOS.Config &&
    JSKOS.Config.LOCKS &&
    JSKOS.Config.LOCKS.TIMEOUT_MS
  )
    ? JSKOS.Config.LOCKS.TIMEOUT_MS
    : 30000;
}

/**
 * Returns the configured JSK OS spreadsheet.
 *
 * @private
 * @return {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function getPolicyMigrationSpreadsheet_() {
  if (
    typeof JSKOS !== 'undefined' &&
    JSKOS.ConfigService &&
    typeof JSKOS.ConfigService.getSpreadsheet === 'function'
  ) {
    return JSKOS.ConfigService.getSpreadsheet();
  }

  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  if (!spreadsheet) {
    throw new Error('JSK OS spreadsheet is not available.');
  }

  return spreadsheet;
}

/**
 * Finds the Policy header row.
 *
 * @private
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet Policy sheet.
 * @return {number|null}
 */
function findPolicyHeaderRow_(sheet) {
  var scanLimit = Math.min(
    Math.max(sheet.getLastRow(), 1),
    JSK_POLICY_SCHEMA.HEADER_SCAN_LIMIT
  );
  var columnCount = Math.max(
    sheet.getLastColumn(),
    JSK_POLICY_SCHEMA.HEADERS.length
  );
  var values = sheet
    .getRange(1, 1, scanLimit, columnCount)
    .getDisplayValues();

  for (var rowIndex = 0; rowIndex < values.length; rowIndex++) {
    var normalized = values[rowIndex].map(function (value) {
      return String(value || '').trim().toLowerCase();
    });

    if (
      normalized.indexOf('policy id') !== -1 &&
      normalized.indexOf('policy number') !== -1
    ) {
      return rowIndex + 1;
    }
  }

  return null;
}

/** @private @param {GoogleAppsScript.Spreadsheet.Sheet} sheet @return {boolean} */
function hasPolicySheetData_(sheet) {
  if (sheet.getLastRow() < 1 || sheet.getLastColumn() < 1) {
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

/** @private @param {GoogleAppsScript.Spreadsheet.Sheet} sheet @param {number} headerRow */
function writePolicyHeaders_(sheet, headerRow) {
  sheet
    .getRange(
      headerRow,
      1,
      1,
      JSK_POLICY_SCHEMA.HEADERS.length
    )
    .setValues([JSK_POLICY_SCHEMA.HEADERS.slice()]);
}

/**
 * Appends missing canonical headers without deleting or reordering data.
 *
 * @private
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet Policy sheet.
 * @param {number} headerRow Header row.
 * @return {string[]} Added headers.
 */
function upgradePolicyHeaders_(sheet, headerRow) {
  var existingHeaders = readPolicyHeaders_(sheet, headerRow);
  var existingMap = {};

  existingHeaders.forEach(function (header) {
    if (header) {
      existingMap[header.toLowerCase()] = true;
    }
  });

  var missingHeaders = JSK_POLICY_SCHEMA.HEADERS.filter(function (header) {
    return !existingMap[header.toLowerCase()];
  });

  if (missingHeaders.length === 0) {
    return [];
  }

  var startColumn = findLastMeaningfulPolicyHeaderColumn_(
    existingHeaders
  ) + 1;

  sheet
    .getRange(
      headerRow,
      startColumn,
      1,
      missingHeaders.length
    )
    .setValues([missingHeaders]);

  return missingHeaders;
}

/**
 * Fails safely when duplicate normalized headers exist.
 *
 * @private
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet Policy sheet.
 * @param {number} headerRow Header row.
 */
function validatePolicyHeaderIntegrity_(sheet, headerRow) {
  var headers = readPolicyHeaders_(sheet, headerRow);
  var seen = {};
  var duplicates = [];

  headers.forEach(function (header) {
    var normalized = String(header || '').trim().toLowerCase();

    if (!normalized) {
      return;
    }

    if (seen[normalized] && duplicates.indexOf(header) === -1) {
      duplicates.push(header);
    }

    seen[normalized] = true;
  });

  if (duplicates.length > 0) {
    throw new Error(
      'Duplicate Policy headers were found: ' +
      duplicates.join(', ') +
      '. Resolve the duplicate columns before running the migration.'
    );
  }
}

/** @private @param {string[]} headers @return {number} */
function findLastMeaningfulPolicyHeaderColumn_(headers) {
  for (var index = headers.length - 1; index >= 0; index--) {
    if (String(headers[index] || '').trim()) {
      return index + 1;
    }
  }

  return 0;
}

/** @private @param {GoogleAppsScript.Spreadsheet.Sheet} sheet @param {number} headerRow @return {string[]} */
function readPolicyHeaders_(sheet, headerRow) {
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

/** @private @param {GoogleAppsScript.Spreadsheet.Sheet} sheet @param {number} headerRow */
function formatPolicySheet_(sheet, headerRow) {
  var headers = readPolicyHeaders_(sheet, headerRow);
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

  sheet.setFrozenRows(JSK_POLICY_SCHEMA.FREEZE_ROWS);
  sheet.setRowHeight(headerRow, 42);

  headers.forEach(function (header, index) {
    sheet.setColumnWidth(
      index + 1,
      JSK_POLICY_SCHEMA.COLUMN_WIDTHS[header] || 145
    );
  });

  var dataRowCount = Math.max(
    sheet.getMaxRows() - headerRow,
    1
  );

  [
    'Start Date',
    'End Date',
    'Renewal Date',
    'Last Claim Date'
  ].forEach(function (header) {
    applyPolicyColumnFormat_(
      sheet,
      headerRow,
      headers,
      header,
      dataRowCount,
      JSK_POLICY_SCHEMA.DATE_FORMAT
    );
  });

  ['Created At', 'Updated At'].forEach(function (header) {
    applyPolicyColumnFormat_(
      sheet,
      headerRow,
      headers,
      header,
      dataRowCount,
      JSK_POLICY_SCHEMA.DATETIME_FORMAT
    );
  });

  [
    'Sum Insured',
    'Net Premium',
    'GST Amount',
    'Total Premium'
  ].forEach(function (header) {
    applyPolicyColumnFormat_(
      sheet,
      headerRow,
      headers,
      header,
      dataRowCount,
      JSK_POLICY_SCHEMA.MONEY_FORMAT
    );
  });

  ['Claims Count', 'Record Version'].forEach(function (header) {
    applyPolicyColumnFormat_(
      sheet,
      headerRow,
      headers,
      header,
      dataRowCount,
      JSK_POLICY_SCHEMA.INTEGER_FORMAT
    );
  });

  [
    'Policy ID',
    'Policy Number',
    'Proposal Number',
    'Company ID',
    'Person ID',
    'Family ID',
    'Previous Policy Number'
  ].forEach(function (header) {
    applyPolicyColumnFormat_(
      sheet,
      headerRow,
      headers,
      header,
      dataRowCount,
      '@'
    );
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

/** @private */
function applyPolicyColumnFormat_(
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

/** @private @param {GoogleAppsScript.Spreadsheet.Sheet} sheet @param {number} headerRow */
function configurePolicyValidations_(sheet, headerRow) {
  var headers = readPolicyHeaders_(sheet, headerRow);
  var rowCount = Math.max(
    sheet.getMaxRows() - headerRow,
    1
  );

  setPolicyListValidation_(
    sheet,
    headerRow,
    headers,
    'Policy Type',
    JSK_POLICY_SCHEMA.POLICY_TYPE_VALUES,
    rowCount
  );

  setPolicyListValidation_(
    sheet,
    headerRow,
    headers,
    'Policy Status',
    JSK_POLICY_SCHEMA.POLICY_STATUS_VALUES,
    rowCount
  );

  setPolicyListValidation_(
    sheet,
    headerRow,
    headers,
    'Renewal Stage',
    JSK_POLICY_SCHEMA.RENEWAL_STAGE_VALUES,
    rowCount
  );

  setPolicyListValidation_(
    sheet,
    headerRow,
    headers,
    'Payment Frequency',
    JSK_POLICY_SCHEMA.PAYMENT_FREQUENCY_VALUES,
    rowCount
  );

  setPolicyListValidation_(
    sheet,
    headerRow,
    headers,
    'Risk Category',
    JSK_POLICY_SCHEMA.RISK_CATEGORY_VALUES,
    rowCount
  );

  setPolicyListValidation_(
    sheet,
    headerRow,
    headers,
    'Is Deleted',
    JSK_POLICY_SCHEMA.BOOLEAN_VALUES,
    rowCount
  );
}

/** @private */
function setPolicyListValidation_(
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
    .setHelpText('Select a valid ' + headerName + ' value.')
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

/** @private @param {GoogleAppsScript.Spreadsheet.Spreadsheet} spreadsheet */
function ensurePolicyAuditSheet_(spreadsheet) {
  var sheet = spreadsheet.getSheetByName(
    JSK_POLICY_SCHEMA.AUDIT_SHEET_NAME
  );

  if (sheet) {
    return;
  }

  sheet = spreadsheet.insertSheet(
    JSK_POLICY_SCHEMA.AUDIT_SHEET_NAME
  );

  sheet
    .getRange(1, 1, 1, 8)
    .setValues([[
      'Audit ID',
      'Timestamp',
      'Entity Type',
      'Entity ID',
      'Action',
      'Actor',
      'Before Data',
      'After Data'
    ]])
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  sheet.setFrozenRows(1);
}

/** @private */
function savePolicySchemaVersion_() {
  PropertiesService
    .getScriptProperties()
    .setProperty(
      JSK_POLICY_SCHEMA.PROPERTY_KEY,
      String(JSK_POLICY_SCHEMA.VERSION)
    );
}

/**
 * Verifies the installed Policy database schema.
 * Run manually after migratePolicyDatabase().
 *
 * @return {Object} Test result.
 */
function testPolicyDatabaseMigration() {
  var spreadsheet = getPolicyMigrationSpreadsheet_();
  var sheet = spreadsheet.getSheetByName(
    JSK_POLICY_SCHEMA.SHEET_NAME
  );

  assertPolicyMigration_(
    Boolean(sheet),
    'Policies sheet was not created.'
  );

  var headerRow = findPolicyHeaderRow_(sheet);

  assertPolicyMigration_(
    Boolean(headerRow),
    'Policy header row was not found.'
  );

  validatePolicyHeaderIntegrity_(sheet, headerRow);

  var headers = readPolicyHeaders_(sheet, headerRow);
  var headerMap = {};

  headers.forEach(function (header) {
    headerMap[String(header || '').trim().toLowerCase()] = true;
  });

  var missingHeaders = JSK_POLICY_SCHEMA.HEADERS.filter(function (header) {
    return !headerMap[header.toLowerCase()];
  });

  assertPolicyMigration_(
    missingHeaders.length === 0,
    'Missing Policy columns: ' + missingHeaders.join(', ')
  );

  var storedVersion = PropertiesService
    .getScriptProperties()
    .getProperty(JSK_POLICY_SCHEMA.PROPERTY_KEY);

  assertPolicyMigration_(
    Number(storedVersion) === JSK_POLICY_SCHEMA.VERSION,
    'Policy schema version was not saved correctly.'
  );

  var auditSheet = spreadsheet.getSheetByName(
    JSK_POLICY_SCHEMA.AUDIT_SHEET_NAME
  );

  assertPolicyMigration_(
    Boolean(auditSheet),
    'Audit_Log sheet is not available.'
  );

  var result = {
    success: true,
    message: 'Policy database migration test passed.',
    schemaVersion: JSK_POLICY_SCHEMA.VERSION,
    sheetName: sheet.getName(),
    headerRow: headerRow,
    headerCount: headers.length,
    timestamp: new Date().toISOString()
  };

  console.info(JSON.stringify(result));

  return result;
}

/** @private @param {boolean} condition @param {string} message */
function assertPolicyMigration_(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
