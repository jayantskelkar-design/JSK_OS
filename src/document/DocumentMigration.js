/** JSK OS Build 1008 - Document Vault database migration. */

var JSK_DOCUMENT_SCHEMA = Object.freeze({
  VERSION: 1,
  SHEET_NAME: 'Documents',
  PROPERTY_KEY: 'JSK_OS_DOCUMENT_SCHEMA_VERSION',
  HEADERS: Object.freeze([
    'Document ID', 'Document Name', 'Document Type', 'Category', 'Status',
    'File URL', 'Drive File ID', 'Mime Type', 'File Size',
    'Issue Date', 'Expiry Date', 'Verified At', 'Verified By',
    'Description', 'Notes',
    'Company ID', 'Person ID', 'Policy ID', 'Claim ID', 'Task ID', 'Meeting ID',
    'Created At', 'Created By', 'Updated At', 'Updated By',
    'Record Version', 'Is Deleted'
  ]),
  TYPE_VALUES: Object.freeze([
    'Policy', 'Proposal', 'KYC', 'Claim', 'Endorsement', 'Invoice', 'Receipt',
    'Medical', 'Inspection', 'Other'
  ]),
  CATEGORY_VALUES: Object.freeze([
    'Insurance', 'Identity', 'Financial', 'Legal', 'Medical', 'Operational', 'Other'
  ]),
  STATUS_VALUES: Object.freeze([
    'Draft', 'Pending', 'Verified', 'Rejected', 'Expired', 'Archived'
  ])
});

function migrateDocumentDatabase() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var spreadsheet = JSKOS.ConfigService.getSpreadsheet();
    var sheet = spreadsheet.getSheetByName(JSK_DOCUMENT_SCHEMA.SHEET_NAME);
    if (!sheet) sheet = spreadsheet.insertSheet(JSK_DOCUMENT_SCHEMA.SHEET_NAME);

    var required = JSK_DOCUMENT_SCHEMA.HEADERS.slice();
    var lastColumn = sheet.getLastColumn();
    var existing = lastColumn ? sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0] : [];
    var hasData = sheet.getLastRow() > 0 && existing.some(function (value) { return String(value).trim(); });

    if (!hasData) {
      sheet.getRange(1, 1, 1, required.length).setValues([required]);
    } else {
      if (existing.indexOf('Document ID') === -1) {
        throw new Error('Documents sheet contains data but its Document ID header was not found.');
      }
      var missing = required.filter(function (header) { return existing.indexOf(header) === -1; });
      if (missing.length) {
        sheet.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]);
      }
    }

    sheet.getRange(1, 1, 1, required.length)
      .setFontWeight('bold')
      .setBackground('#0b1f3a')
      .setFontColor('#ffffff');
    sheet.setFrozenRows(1);

    setDocumentValidation_(sheet, 'Document Type', JSK_DOCUMENT_SCHEMA.TYPE_VALUES);
    setDocumentValidation_(sheet, 'Category', JSK_DOCUMENT_SCHEMA.CATEGORY_VALUES);
    setDocumentValidation_(sheet, 'Status', JSK_DOCUMENT_SCHEMA.STATUS_VALUES);
    setDocumentValidation_(sheet, 'Is Deleted', ['TRUE', 'FALSE']);

    ['Issue Date', 'Expiry Date'].forEach(function (header) {
      formatDocumentColumn_(sheet, header, 'dd-mmm-yyyy');
    });
    ['Verified At', 'Created At', 'Updated At'].forEach(function (header) {
      formatDocumentColumn_(sheet, header, 'dd-mmm-yyyy hh:mm:ss');
    });
    formatDocumentColumn_(sheet, 'File Size', '#,##0');

    PropertiesService.getScriptProperties().setProperty(
      JSK_DOCUMENT_SCHEMA.PROPERTY_KEY,
      String(JSK_DOCUMENT_SCHEMA.VERSION)
    );
    SpreadsheetApp.flush();
    return {
      success: true,
      schemaVersion: JSK_DOCUMENT_SCHEMA.VERSION,
      sheetName: JSK_DOCUMENT_SCHEMA.SHEET_NAME,
      headers: required.length
    };
  } finally {
    lock.releaseLock();
  }
}

function ensureBuild1008Documents() {
  var properties = PropertiesService.getScriptProperties();
  var current = Number(properties.getProperty(JSK_DOCUMENT_SCHEMA.PROPERTY_KEY) || 0);
  var sheet = JSKOS.ConfigService.getSpreadsheet().getSheetByName(JSK_DOCUMENT_SCHEMA.SHEET_NAME);
  var complete = false;
  if (sheet && sheet.getLastColumn()) {
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
    complete = JSK_DOCUMENT_SCHEMA.HEADERS.every(function (header) {
      return headers.indexOf(header) !== -1;
    });
  }
  if (current < JSK_DOCUMENT_SCHEMA.VERSION || !complete) return migrateDocumentDatabase();
  return { success: true, schemaVersion: current, sheetName: JSK_DOCUMENT_SCHEMA.SHEET_NAME };
}

function setDocumentValidation_(sheet, header, values) {
  var column = documentHeaderColumn_(sheet, header);
  if (!column) return;
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(values.slice(), true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, column, Math.max(sheet.getMaxRows() - 1, 1), 1).setDataValidation(rule);
}

function formatDocumentColumn_(sheet, header, format) {
  var column = documentHeaderColumn_(sheet, header);
  if (column) sheet.getRange(2, column, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat(format);
}

function documentHeaderColumn_(sheet, header) {
  if (!sheet.getLastColumn()) return 0;
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  var index = headers.indexOf(header);
  return index === -1 ? 0 : index + 1;
}
