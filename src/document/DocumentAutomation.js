/** JSK OS Build 1008 Phase 4 - Document expiry intelligence and reminders. */
var JSKOS = JSKOS || {};

JSKOS.DocumentAutomation = (function () {
  'use strict';
  var TIMEZONE = 'Asia/Kolkata';
  var RECIPIENTS_KEY = 'JSK_OS_DOCUMENT_EXPIRY_RECIPIENTS';
  var FALLBACK_KEY = 'JSK_OS_RENEWAL_DASHBOARD_RECIPIENTS';

  function summarize(items, referenceDate) {
    var today = startOfDay_(referenceDate || new Date());
    var result = { due30: 0, due60: 0, due90: 0, expired: 0, missingFile: 0, expiring: [] };
    (items || []).forEach(function (item) {
      if (!item.fileUrl && !item.driveFileId) result.missingFile += 1;
      var expiry = startOfDay_(item.expiryDate);
      if (!expiry) return;
      var days = Math.round((expiry.getTime() - today.getTime()) / 86400000);
      if (days < 0) result.expired += 1;
      else if (days <= 30) result.due30 += 1;
      else if (days <= 60) result.due60 += 1;
      else if (days <= 90) result.due90 += 1;
      if (days <= 90) result.expiring.push({ documentId: item.documentId, documentName: item.documentName, expiryDate: formatDate_(expiry), daysRemaining: days });
    });
    result.expiring.sort(function (a, b) { return a.daysRemaining - b.daysRemaining; });
    return result;
  }

  function runDaily(referenceDate) {
    ensureBuild1008Documents();
    var repository = new DocumentRepository();
    var items = repository.search({}).items || [];
    var summary = summarize(items, referenceDate || new Date());
    var updated = 0;
    items.forEach(function (item) {
      var expiry = startOfDay_(item.expiryDate);
      if (!expiry || expiry >= startOfDay_(referenceDate || new Date()) || item.status === 'Expired') return;
      try { repository.update(item.documentId, { status: 'Expired' }, 'Document Expiry Automation', item.recordVersion); updated += 1; }
      catch (error) { console.error('Document expiry update failed: ' + (error.stack || error)); }
    });
    return { summary: summary, statusesUpdated: updated, emailSent: sendDigest_(summary) };
  }

  function sendDigest_(summary) {
    var properties = PropertiesService.getScriptProperties();
    var recipients = String(properties.getProperty(RECIPIENTS_KEY) || properties.getProperty(FALLBACK_KEY) || '').trim();
    if (!recipients || (!summary.expired && !summary.due30)) return false;
    var lines = ['JSK OS Document Expiry Digest', '', 'Expired: ' + summary.expired, 'Due in 30 days: ' + summary.due30, 'Due in 31-60 days: ' + summary.due60, 'Due in 61-90 days: ' + summary.due90, ''];
    summary.expiring.slice(0, 25).forEach(function (item) { lines.push('- ' + item.documentName + ' | ' + item.expiryDate + ' | ' + item.daysRemaining + ' days'); });
    MailApp.sendEmail(recipients, 'JSK OS Document Expiry Digest', lines.join('\n'));
    return true;
  }

  function startOfDay_(value) { if (!value) return null; var date=value instanceof Date?new Date(value.getTime()):new Date(value); if(isNaN(date.getTime()))return null; date.setHours(0,0,0,0); return date; }
  function formatDate_(date) { return Utilities.formatDate(date, TIMEZONE, 'yyyy-MM-dd'); }
  return { summarize: summarize, runDaily: runDaily };
})();

function runDailyDocumentExpiryAutomation() { return JSKOS.DocumentAutomation.runDaily(new Date()); }

function installDocumentExpiryTrigger() {
  var handler = 'runDailyDocumentExpiryAutomation';
  ScriptApp.getProjectTriggers().forEach(function (trigger) { if (trigger.getHandlerFunction() === handler) ScriptApp.deleteTrigger(trigger); });
  var trigger = ScriptApp.newTrigger(handler).timeBased().everyDays(1).atHour(8).create();
  return { success: true, handler: handler, triggerId: trigger.getUniqueId() };
}
