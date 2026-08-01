/** JSK OS Build 1005 - Meeting database migration. */

var JSK_MEETING_SCHEMA = Object.freeze({
  VERSION: 1,
  SHEET_NAME: 'Meetings',
  PROPERTY_KEY: 'JSK_OS_MEETING_SCHEMA_VERSION',
  HEADERS: Object.freeze([
    'Meeting ID', 'Title', 'Meeting Type', 'Status', 'Start At', 'End At',
    'Location', 'Meeting Link', 'Agenda', 'Notes', 'Owner',
    'Company ID', 'Person ID', 'Policy ID', 'Task ID', 'Reminder Minutes',
    'Created At', 'Created By', 'Updated At', 'Updated By',
    'Record Version', 'Is Deleted'
  ]),
  TYPE_VALUES: Object.freeze(['Client Meeting', 'Renewal Review', 'Claim Review', 'Internal', 'Video Call', 'Phone Call', 'Other']),
  STATUS_VALUES: Object.freeze(['Scheduled', 'Completed', 'Cancelled', 'No Show'])
});

function migrateMeetingDatabase() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var spreadsheet = JSKOS.ConfigService.getSpreadsheet();
    var sheet = spreadsheet.getSheetByName(JSK_MEETING_SCHEMA.SHEET_NAME);
    var created = false;
    if (!sheet) {
      sheet = spreadsheet.insertSheet(JSK_MEETING_SCHEMA.SHEET_NAME);
      created = true;
    }
    var currentHeaders = sheet.getLastColumn() > 0
      ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0]
      : [];
    var hasHeaders = currentHeaders.some(function (value) { return String(value || '').trim(); });
    var normalized = currentHeaders.map(function (value) { return String(value || '').trim(); });
    var valid = normalized.indexOf('Meeting ID') !== -1 && normalized.indexOf('Title') !== -1;
    if (hasHeaders && !valid && sheet.getLastRow() > 1) {
      throw new Error('Meetings sheet contains legacy data. Back it up before Build 1005 migration.');
    }
    if (!hasHeaders || !valid) {
      sheet.clear();
      sheet.getRange(1, 1, 1, JSK_MEETING_SCHEMA.HEADERS.length).setValues([JSK_MEETING_SCHEMA.HEADERS.slice()]);
    } else {
      JSK_MEETING_SCHEMA.HEADERS.forEach(function (header) {
        if (normalized.indexOf(header) === -1) {
          sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
          normalized.push(header);
        }
      });
    }
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, sheet.getLastColumn()).setFontWeight('bold').setBackground('#0b1f3a').setFontColor('#ffffff');
    sheet.autoResizeColumns(1, Math.min(sheet.getLastColumn(), 22));
    PropertiesService.getScriptProperties().setProperty(JSK_MEETING_SCHEMA.PROPERTY_KEY, String(JSK_MEETING_SCHEMA.VERSION));
    SpreadsheetApp.flush();
    return { success: true, created: created, schemaVersion: JSK_MEETING_SCHEMA.VERSION, sheetName: sheet.getName() };
  } finally {
    lock.releaseLock();
  }
}

function ensureBuild1005Meetings() {
  var version = Number(PropertiesService.getScriptProperties().getProperty(JSK_MEETING_SCHEMA.PROPERTY_KEY)) || 0;
  var spreadsheet = JSKOS.ConfigService.getSpreadsheet();
  var sheet = spreadsheet.getSheetByName(JSK_MEETING_SCHEMA.SHEET_NAME);
  if (version < JSK_MEETING_SCHEMA.VERSION || !sheet) return migrateMeetingDatabase();
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  var missing = JSK_MEETING_SCHEMA.HEADERS.some(function (header) { return headers.indexOf(header) === -1; });
  return missing ? migrateMeetingDatabase() : { success: true, created: false, schemaVersion: version, sheetName: sheet.getName() };
}
