/** JSK OS production release operations. */

function createJSKOSProductionBackup() {
  var spreadsheet = JSKOS.ConfigService.getSpreadsheet();
  var sourceFile = DriveApp.getFileById(spreadsheet.getId());
  var folders = DriveApp.getFoldersByName('JSK OS Backups');
  var folder = folders.hasNext()
    ? folders.next()
    : DriveApp.createFolder('JSK OS Backups');
  var timestamp = Utilities.formatDate(
    new Date(),
    JSKOS.Config.APP.TIMEZONE,
    'yyyy-MM-dd_HH-mm-ss'
  );
  var copy = sourceFile.makeCopy(
    'JSK_OS_Backup_' + timestamp,
    folder
  );
  var result = {
    success: true,
    fileId: copy.getId(),
    fileName: copy.getName(),
    url: copy.getUrl(),
    createdAt: new Date().toISOString()
  };
  console.info(JSON.stringify(result));
  return result;
}

function getJSKOSReleaseReadinessStatus() {
  var triggerAudit = auditAutomationTriggers();
  var version = JSKOS.Config.APP.VERSION;
  return {
    success: true,
    currentVersion: version,
    betaVersion: /-beta$/i.test(version),
    triggerAudit: triggerAudit,
    requiredManualChecks: [
      'Rotate the exposed WA Lead API key',
      'Run testJSKOSStableReleaseReadiness',
      'Create a production spreadsheet backup',
      'Deploy a new stable Web App version'
    ]
  };
}

function testReleaseOperationsPlan() {
  var status = getJSKOSReleaseReadinessStatus();
  if (
    !status.success ||
    !Array.isArray(status.requiredManualChecks) ||
    typeof createJSKOSProductionBackup !== 'function'
  ) {
    throw new Error('Release operations plan failed.');
  }
  return {
    success: true,
    currentVersion: status.currentVersion,
    manualCheckCount: status.requiredManualChecks.length
  };
}
