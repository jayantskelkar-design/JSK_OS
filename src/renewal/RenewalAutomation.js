/**
 * JSK OS Build 1002
 * Module: Renewal Automation
 *
 * Email reminders are sent through MailApp. WhatsApp reminders are queued
 * with a wa.me link until an approved provider integration is configured.
 */

var JSKOS = JSKOS || {};

JSKOS.RenewalAutomation = (function () {
  'use strict';

  var CONFIG = Object.freeze({
    TIMEZONE: 'Asia/Kolkata',
    TRIGGER_HOUR: 8,
    DASHBOARD_RECIPIENTS_KEY: 'JSK_OS_RENEWAL_DASHBOARD_RECIPIENTS',
    LOG_SHEET: 'Renewal_Automation_Log',
    WHATSAPP_QUEUE_SHEET: 'Renewal_WhatsApp_Queue',
    REMINDER_DAYS: Object.freeze([30, 7, 1, 0])
  });

  function runDaily(referenceDate) {
    var today = startOfDay_(referenceDate || new Date());
    var policies = collectPolicies_();
    var candidates = buildReminderCandidates_(policies, today);
    var peopleRepository = new PeopleRepository();
    var result = {
      candidates: candidates.length,
      emailsSent: 0,
      whatsappQueued: 0,
      skipped: 0,
      dashboardSent: false,
      generatedAt: new Date().toISOString()
    };

    candidates.forEach(function (candidate) {
      var contact = resolveContact_(candidate.policy, peopleRepository);
      var message = buildReminderMessage_(candidate);

      if (contact.email && !wasProcessed_('EMAIL', candidate, today)) {
        MailApp.sendEmail({
          to: contact.email,
          subject: 'Policy renewal reminder: ' + candidate.policy.policyNumber,
          body: message
        });
        logProcessed_('EMAIL', candidate, contact.email, today, 'SENT');
        result.emailsSent += 1;
      }

      if (contact.whatsapp && !wasProcessed_('WHATSAPP', candidate, today)) {
        queueWhatsApp_(candidate, contact, message, today);
        logProcessed_('WHATSAPP', candidate, contact.whatsapp, today, 'QUEUED');
        result.whatsappQueued += 1;
      }

      if (!contact.email && !contact.whatsapp) result.skipped += 1;
    });

    result.dashboardSent = sendDailyDashboard_(policies, today);
    return result;
  }

  function buildReminderCandidates_(policies, referenceDate) {
    var today = startOfDay_(referenceDate || new Date());
    var actionableStatuses = { issued: true, active: true, 'renewal due': true };

    return (Array.isArray(policies) ? policies : []).reduce(function (items, policy) {
      var status = String(policy && policy.policyStatus || '').trim().toLowerCase();
      var renewalDate = startOfDay_(policy && policy.renewalDate);
      if (!actionableStatuses[status] || !renewalDate) return items;

      var daysUntilRenewal = daysBetween_(today, renewalDate);
      var scheduled = CONFIG.REMINDER_DAYS.indexOf(daysUntilRenewal) !== -1;
      var weeklyOverdue = daysUntilRenewal < 0 && Math.abs(daysUntilRenewal) % 7 === 0;
      if (!scheduled && !weeklyOverdue) return items;

      items.push({
        policy: policy,
        renewalDate: renewalDate,
        daysUntilRenewal: daysUntilRenewal,
        reminderKey: daysUntilRenewal < 0
          ? 'OVERDUE_' + Math.abs(daysUntilRenewal)
          : 'DUE_' + daysUntilRenewal
      });
      return items;
    }, []);
  }

  function installDailyTrigger() {
    removeDailyTriggers();
    return ScriptApp.newTrigger('runDailyRenewalAutomation')
      .timeBased()
      .atHour(CONFIG.TRIGGER_HOUR)
      .everyDays(1)
      .inTimezone(CONFIG.TIMEZONE)
      .create()
      .getUniqueId();
  }

  function removeDailyTriggers() {
    var removed = 0;
    ScriptApp.getProjectTriggers().forEach(function (trigger) {
      if (trigger.getHandlerFunction() === 'runDailyRenewalAutomation') {
        ScriptApp.deleteTrigger(trigger);
        removed += 1;
      }
    });
    return removed;
  }

  function collectPolicies_() {
    var repository = new PolicyRepository();
    var policies = [];
    var page = 1;
    var result;
    do {
      result = repository.search({ includeDeleted: false, page: page, pageSize: 100 });
      if (result && Array.isArray(result.items)) policies = policies.concat(result.items);
      page += 1;
    } while (result && result.pagination && result.pagination.hasNext);
    return policies;
  }

  function resolveContact_(policy, peopleRepository) {
    if (!policy || !policy.personId) return { name: policy && policy.insuredName || '', email: '', whatsapp: '' };
    try {
      var person = peopleRepository.findById(policy.personId);
      return {
        name: person.fullName || policy.insuredName || '',
        email: String(person.email || '').trim(),
        whatsapp: normalizeIndianMobile_(person.whatsApp || person.whatsapp || person.mobile)
      };
    } catch (error) {
      return { name: policy.insuredName || '', email: '', whatsapp: '' };
    }
  }

  function buildReminderMessage_(candidate) {
    var policy = candidate.policy;
    var timing = candidate.daysUntilRenewal < 0
      ? 'is overdue by ' + Math.abs(candidate.daysUntilRenewal) + ' day(s)'
      : candidate.daysUntilRenewal === 0
        ? 'is due today'
        : 'is due in ' + candidate.daysUntilRenewal + ' day(s)';
    return 'Dear ' + (policy.insuredName || 'Client') + ',\n\n' +
      'Your policy ' + (policy.policyNumber || policy.policyId) + ' ' + timing + '.\n' +
      'Renewal date: ' + formatDate_(candidate.renewalDate) + '.\n\n' +
      'Please contact JSK OS for renewal assistance.\n\nJSK OS';
  }

  function queueWhatsApp_(candidate, contact, message, today) {
    var sheet = getOrCreateSheet_(CONFIG.WHATSAPP_QUEUE_SHEET, [
      'Queued At', 'Policy ID', 'Policy Number', 'Person ID', 'Client',
      'WhatsApp', 'Renewal Date', 'Reminder Key', 'Message', 'Send Link', 'Status'
    ]);
    sheet.appendRow([
      new Date(), candidate.policy.policyId, candidate.policy.policyNumber,
      candidate.policy.personId, contact.name, contact.whatsapp,
      candidate.renewalDate, candidate.reminderKey, message,
      'https://wa.me/' + contact.whatsapp + '?text=' + encodeURIComponent(message),
      'Pending'
    ]);
  }

  function sendDailyDashboard_(policies, today) {
    var recipients = PropertiesService.getScriptProperties()
      .getProperty(CONFIG.DASHBOARD_RECIPIENTS_KEY);
    if (!String(recipients || '').trim()) return false;

    var renewals = JSKOS.DashboardService.summarizeRenewals(policies, today);
    var pipeline = JSKOS.DashboardService.summarizeRenewalPipeline(policies, today);
    var body = [
      'JSK OS Daily Renewal Dashboard - ' + formatDate_(today), '',
      'Due in 30 days: ' + renewals.due30Days,
      'Due in 31-60 days: ' + renewals.due60Days,
      'Due in 61-90 days: ' + renewals.due90Days,
      'Overdue: ' + renewals.overdue,
      'Renewed: ' + renewals.renewed, '',
      'Call Pending: ' + pipeline.callPending,
      'WhatsApp Sent: ' + pipeline.whatsappSent,
      'Quote Sent: ' + pipeline.quoteSent,
      'Negotiation: ' + pipeline.negotiation,
      'Won: ' + pipeline.won,
      'Lost: ' + pipeline.lost
    ].join('\n');
    MailApp.sendEmail(String(recipients), 'JSK OS Daily Renewal Dashboard', body);
    return true;
  }

  function wasProcessed_(channel, candidate, today) {
    var sheet = getOrCreateSheet_(CONFIG.LOG_SHEET, [
      'Processed At', 'Date Key', 'Channel', 'Policy ID', 'Reminder Key', 'Recipient', 'Status'
    ]);
    if (sheet.getLastRow() < 2) return false;
    var key = [formatDate_(today), channel, candidate.policy.policyId, candidate.reminderKey].join('|');
    return sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues().some(function (row) {
      return [String(row[1]), String(row[2]), String(row[3]), String(row[4])].join('|') === key;
    });
  }

  function logProcessed_(channel, candidate, recipient, today, status) {
    getOrCreateSheet_(CONFIG.LOG_SHEET, [
      'Processed At', 'Date Key', 'Channel', 'Policy ID', 'Reminder Key', 'Recipient', 'Status'
    ]).appendRow([
      new Date(), formatDate_(today), channel, candidate.policy.policyId,
      candidate.reminderKey, recipient, status
    ]);
  }

  function getOrCreateSheet_(name, headers) {
    var spreadsheet = JSKOS.ConfigService.getSpreadsheet();
    var sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
    if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return sheet;
  }

  function normalizeIndianMobile_(value) {
    var digits = String(value || '').replace(/\D/g, '');
    if (digits.length === 10) digits = '91' + digits;
    return digits.length === 12 && digits.indexOf('91') === 0 ? digits : '';
  }

  function startOfDay_(value) {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    var date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (isNaN(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function daysBetween_(fromDate, toDate) {
    return Math.round((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000));
  }

  function formatDate_(date) {
    return Utilities.formatDate(date, CONFIG.TIMEZONE, 'yyyy-MM-dd');
  }

  return {
    runDaily: runDaily,
    buildReminderCandidates: buildReminderCandidates_,
    installDailyTrigger: installDailyTrigger,
    removeDailyTriggers: removeDailyTriggers
  };
})();

function runDailyRenewalAutomation() {
  return JSKOS.RenewalAutomation.runDaily();
}

function installDailyRenewalAutomation() {
  return JSKOS.RenewalAutomation.installDailyTrigger();
}

function removeDailyRenewalAutomation() {
  return JSKOS.RenewalAutomation.removeDailyTriggers();
}
