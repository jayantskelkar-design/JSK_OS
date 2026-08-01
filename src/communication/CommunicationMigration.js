/** JSK OS Build 1006 - Communication Hub database migration. */

var JSK_COMMUNICATION_SCHEMA = Object.freeze({
  VERSION: 1,
  SHEET_NAME: 'Communication_Outbox',
  PROPERTY_KEY: 'JSK_OS_COMMUNICATION_SCHEMA_VERSION',
  HEADERS: Object.freeze([
    'Communication ID', 'Channel', 'Direction', 'Template Key', 'Recipient',
    'Recipient Name', 'Subject', 'Message', 'Status', 'Provider',
    'Provider Message ID', 'Idempotency Key', 'Scheduled At', 'Sent At',
    'Delivered At', 'Read At', 'Attempt Count', 'Next Retry At', 'Last Error',
    'Company ID', 'Person ID', 'Policy ID', 'Task ID', 'Meeting ID',
    'Metadata JSON', 'Created At', 'Created By', 'Updated At', 'Updated By',
    'Record Version', 'Is Deleted'
  ]),
  CHANNEL_VALUES: Object.freeze(['Email', 'WhatsApp', 'SMS']),
  STATUS_VALUES: Object.freeze(['Queued', 'Sending', 'Sent', 'Delivered', 'Read', 'Failed', 'Cancelled'])
});

function migrateCommunicationDatabase() {
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var spreadsheet = JSKOS.ConfigService.getSpreadsheet();
    var sheet = spreadsheet.getSheetByName(JSK_COMMUNICATION_SCHEMA.SHEET_NAME);
    var created = false;
    if (!sheet) { sheet = spreadsheet.insertSheet(JSK_COMMUNICATION_SCHEMA.SHEET_NAME); created = true; }
    var current = sheet.getLastColumn() ? sheet.getRange(1,1,1,sheet.getLastColumn()).getDisplayValues()[0] : [];
    var headers = current.map(function (value) { return String(value || '').trim(); });
    var hasHeaders = headers.some(Boolean);
    if (hasHeaders && headers.indexOf('Communication ID') === -1 && sheet.getLastRow() > 1) throw new Error('Communication_Outbox contains unsupported existing data.');
    if (!hasHeaders || headers.indexOf('Communication ID') === -1) {
      sheet.clear(); sheet.getRange(1,1,1,JSK_COMMUNICATION_SCHEMA.HEADERS.length).setValues([JSK_COMMUNICATION_SCHEMA.HEADERS.slice()]); headers = JSK_COMMUNICATION_SCHEMA.HEADERS.slice();
    } else {
      JSK_COMMUNICATION_SCHEMA.HEADERS.forEach(function (header) { if (headers.indexOf(header) === -1) { sheet.getRange(1,sheet.getLastColumn()+1).setValue(header); headers.push(header); } });
    }
    sheet.setFrozenRows(1); sheet.getRange(1,1,1,headers.length).setFontWeight('bold').setBackground('#0b1f3a').setFontColor('#ffffff');
    var rows = Math.max(sheet.getMaxRows()-1,1);
    setCommunicationValidation_(sheet, headers, 'Channel', JSK_COMMUNICATION_SCHEMA.CHANNEL_VALUES, rows);
    setCommunicationValidation_(sheet, headers, 'Status', JSK_COMMUNICATION_SCHEMA.STATUS_VALUES, rows);
    ['Scheduled At','Sent At','Delivered At','Read At','Next Retry At','Created At','Updated At'].forEach(function (header) { var index=headers.indexOf(header); if(index!==-1) sheet.getRange(2,index+1,rows,1).setNumberFormat('yyyy-mm-dd hh:mm:ss'); });
    PropertiesService.getScriptProperties().setProperty(JSK_COMMUNICATION_SCHEMA.PROPERTY_KEY,String(JSK_COMMUNICATION_SCHEMA.VERSION)); SpreadsheetApp.flush();
    return { success:true, created:created, schemaVersion:JSK_COMMUNICATION_SCHEMA.VERSION, sheetName:sheet.getName() };
  } finally { lock.releaseLock(); }
}

function setCommunicationValidation_(sheet, headers, header, values, rows) { var index=headers.indexOf(header); if(index===-1)return; sheet.getRange(2,index+1,rows,1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(values.slice(),true).setAllowInvalid(false).build()); }
function ensureBuild1006Communications() { var version=Number(PropertiesService.getScriptProperties().getProperty(JSK_COMMUNICATION_SCHEMA.PROPERTY_KEY))||0; var sheet=JSKOS.ConfigService.getSpreadsheet().getSheetByName(JSK_COMMUNICATION_SCHEMA.SHEET_NAME); if(version<JSK_COMMUNICATION_SCHEMA.VERSION||!sheet)return migrateCommunicationDatabase(); var headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getDisplayValues()[0]; return JSK_COMMUNICATION_SCHEMA.HEADERS.some(function(h){return headers.indexOf(h)===-1;})?migrateCommunicationDatabase():{success:true,created:false,schemaVersion:version,sheetName:sheet.getName()}; }
