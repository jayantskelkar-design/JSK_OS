/** JSK OS Build 1004 - Task database migration. */

var JSK_TASK_SCHEMA = Object.freeze({
  VERSION: 1,
  SHEET_NAME: 'Tasks',
  PROPERTY_KEY: 'JSK_OS_TASK_SCHEMA_VERSION',
  HEADERS: Object.freeze([
    'Task ID', 'Title', 'Description', 'Task Type', 'Status', 'Priority',
    'Owner', 'Due Date', 'Company ID', 'Person ID', 'Policy ID',
    'Completed At', 'Created At', 'Created By', 'Updated At', 'Updated By',
    'Record Version', 'Is Deleted'
  ]),
  STATUS_VALUES: Object.freeze(['Open', 'In Progress', 'Waiting', 'Completed', 'Cancelled']),
  PRIORITY_VALUES: Object.freeze(['Low', 'Medium', 'High', 'Critical']),
  TYPE_VALUES: Object.freeze(['Follow-up', 'Call', 'Email', 'WhatsApp', 'Document', 'Renewal', 'General'])
});

function migrateTaskDatabase() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var spreadsheet = JSKOS.ConfigService.getSpreadsheet();
    var sheet = spreadsheet.getSheetByName(JSK_TASK_SCHEMA.SHEET_NAME);
    var created = false;
    if (!sheet) {
      sheet = spreadsheet.insertSheet(JSK_TASK_SCHEMA.SHEET_NAME);
      created = true;
    }

    var currentHeaders = sheet.getLastColumn() > 0
      ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0]
      : [];
    if (!currentHeaders.some(function (value) { return String(value).trim(); })) {
      sheet.getRange(1, 1, 1, JSK_TASK_SCHEMA.HEADERS.length)
        .setValues([JSK_TASK_SCHEMA.HEADERS.slice()]);
    } else {
      var normalized = currentHeaders.map(function (value) { return String(value || '').trim(); });
      if (normalized.indexOf('Task ID') === -1 || normalized.indexOf('Title') === -1) {
        throw new Error(
          'Tasks sheet contains data but its Task ID and Title headers were not found.'
        );
      }
      JSK_TASK_SCHEMA.HEADERS.forEach(function (header) {
        if (normalized.indexOf(header) === -1) {
          sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
          normalized.push(header);
        }
      });
    }

    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0]
      .map(function (value) { return String(value || '').trim(); });
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold').setBackground('#0b1f3a').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    var rows = Math.max(sheet.getMaxRows() - 1, 1);
    setTaskValidation_(sheet, headers, 'Task Type', JSK_TASK_SCHEMA.TYPE_VALUES, rows);
    setTaskValidation_(sheet, headers, 'Status', JSK_TASK_SCHEMA.STATUS_VALUES, rows);
    setTaskValidation_(sheet, headers, 'Priority', JSK_TASK_SCHEMA.PRIORITY_VALUES, rows);
    ['Due Date', 'Completed At', 'Created At', 'Updated At'].forEach(function (header) {
      var index = headers.indexOf(header);
      if (index !== -1) sheet.getRange(2, index + 1, rows, 1).setNumberFormat('yyyy-mm-dd hh:mm');
    });
    PropertiesService.getScriptProperties().setProperty(
      JSK_TASK_SCHEMA.PROPERTY_KEY,
      String(JSK_TASK_SCHEMA.VERSION)
    );
    SpreadsheetApp.flush();
    return { success: true, created: created, schemaVersion: JSK_TASK_SCHEMA.VERSION };
  } finally {
    lock.releaseLock();
  }
}

function setTaskValidation_(sheet, headers, header, values, rows) {
  var index = headers.indexOf(header);
  if (index === -1) return;
  var validation = SpreadsheetApp.newDataValidation()
    .requireValueInList(values.slice(), true)
    .setAllowInvalid(false)
    .setHelpText('Select a valid ' + header + ' value.')
    .build();
  sheet.getRange(2, index + 1, rows, 1).setDataValidation(validation);
}

function ensureBuild1004Tasks() {
  var version = Number(PropertiesService.getScriptProperties()
    .getProperty(JSK_TASK_SCHEMA.PROPERTY_KEY)) || 0;
  return version < JSK_TASK_SCHEMA.VERSION
    ? migrateTaskDatabase()
    : { success: true, created: false, schemaVersion: JSK_TASK_SCHEMA.VERSION };
}
