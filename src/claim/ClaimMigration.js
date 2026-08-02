/** JSK OS Build 1007 - Claim database migration. */

var JSK_CLAIM_SCHEMA = Object.freeze({
  VERSION: 1,
  SHEET_NAME: 'Claims',
  PROPERTY_KEY: 'JSK_OS_CLAIM_SCHEMA_VERSION',
  HEADERS: Object.freeze([
    'Claim ID', 'Claim Number', 'Claim Type', 'Status', 'Priority',
    'Intimation Date', 'Incident Date', 'Admission Date', 'Discharge Date',
    'Claim Amount', 'Approved Amount', 'Settled Amount', 'Insurer Reference',
    'TPA Name', 'Surveyor Name', 'Assigned Owner', 'Next Action Date',
    'SLA Due Date', 'Closed At', 'Description', 'Notes', 'Rejection Reason',
    'Document URL', 'Company ID', 'Person ID', 'Policy ID', 'Task ID',
    'Meeting ID', 'Created At', 'Created By', 'Updated At', 'Updated By',
    'Record Version', 'Is Deleted'
  ]),
  TYPE_VALUES: Object.freeze(['Health', 'Motor', 'Property', 'Marine', 'Liability', 'Life', 'Other']),
  STATUS_VALUES: Object.freeze(['Draft', 'Intimated', 'Documents Pending', 'Under Review', 'Survey', 'Approved', 'Partially Approved', 'Settled', 'Rejected', 'Closed', 'Withdrawn']),
  PRIORITY_VALUES: Object.freeze(['Low', 'Medium', 'High', 'Critical'])
});

function migrateClaimDatabase() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var spreadsheet = JSKOS.ConfigService.getSpreadsheet();
    var sheet = spreadsheet.getSheetByName(JSK_CLAIM_SCHEMA.SHEET_NAME);
    var created = false;
    if (!sheet) { sheet = spreadsheet.insertSheet(JSK_CLAIM_SCHEMA.SHEET_NAME); created = true; }

    var current = sheet.getLastColumn() > 0
      ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0]
      : [];
    var headers = current.map(function (value) { return String(value || '').trim(); });
    if (!headers.some(function (value) { return value; })) {
      sheet.getRange(1, 1, 1, JSK_CLAIM_SCHEMA.HEADERS.length).setValues([JSK_CLAIM_SCHEMA.HEADERS.slice()]);
      headers = JSK_CLAIM_SCHEMA.HEADERS.slice();
    } else {
      if (headers.indexOf('Claim ID') === -1) {
        throw new Error('Claims sheet contains an unsupported schema. Rename it before running the Build 1007 migration.');
      }
      JSK_CLAIM_SCHEMA.HEADERS.forEach(function (header) {
        if (headers.indexOf(header) === -1) {
          sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
          headers.push(header);
        }
      });
    }

    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#0b1f3a').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    var rows = Math.max(sheet.getMaxRows() - 1, 1);
    setClaimValidation_(sheet, headers, 'Claim Type', JSK_CLAIM_SCHEMA.TYPE_VALUES, rows);
    setClaimValidation_(sheet, headers, 'Status', JSK_CLAIM_SCHEMA.STATUS_VALUES, rows);
    setClaimValidation_(sheet, headers, 'Priority', JSK_CLAIM_SCHEMA.PRIORITY_VALUES, rows);
    ['Intimation Date', 'Incident Date', 'Admission Date', 'Discharge Date', 'Next Action Date', 'SLA Due Date', 'Closed At', 'Created At', 'Updated At'].forEach(function (header) {
      var index = headers.indexOf(header);
      if (index !== -1) sheet.getRange(2, index + 1, rows, 1).setNumberFormat('yyyy-mm-dd hh:mm');
    });
    ['Claim Amount', 'Approved Amount', 'Settled Amount'].forEach(function (header) {
      var index = headers.indexOf(header);
      if (index !== -1) sheet.getRange(2, index + 1, rows, 1).setNumberFormat('₹#,##0.00');
    });
    PropertiesService.getScriptProperties().setProperty(JSK_CLAIM_SCHEMA.PROPERTY_KEY, String(JSK_CLAIM_SCHEMA.VERSION));
    SpreadsheetApp.flush();
    return { success: true, created: created, schemaVersion: JSK_CLAIM_SCHEMA.VERSION };
  } finally { lock.releaseLock(); }
}

function setClaimValidation_(sheet, headers, header, values, rows) {
  var index = headers.indexOf(header);
  if (index === -1) return;
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(values.slice(), true)
    .setAllowInvalid(false).setHelpText('Select a valid ' + header + ' value.').build();
  sheet.getRange(2, index + 1, rows, 1).setDataValidation(rule);
}

function ensureBuild1007Claims() {
  var version = Number(PropertiesService.getScriptProperties().getProperty(JSK_CLAIM_SCHEMA.PROPERTY_KEY)) || 0;
  return version < JSK_CLAIM_SCHEMA.VERSION
    ? migrateClaimDatabase()
    : { success: true, created: false, schemaVersion: JSK_CLAIM_SCHEMA.VERSION };
}
