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
    REMINDER_DAYS: Object.freeze([30, 7, 1, 0]),
    ESCALATION_DAYS: 3
  });

  function runDaily(referenceDate) {
    var today = startOfDay_(referenceDate || new Date());
    var policies = collectPolicies_();
    var followUpResult = synchronizeFollowUpActions_(policies, today);
    if (followUpResult.updated) policies = collectPolicies_();
    var candidates = buildReminderCandidates_(policies, today);
    var peopleRepository = new PeopleRepository();
    var result = {
      candidates: candidates.length,
      emailsSent: 0,
      whatsappQueued: 0,
      skipped: 0,
      dashboardSent: false,
      actionsAutoCreated: followUpResult.created,
      terminalActionsClosed: followUpResult.closed,
      overdueEscalations: 0,
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

    var dashboardResult = sendDailyDashboard_(policies, today);
    result.dashboardSent = dashboardResult.sent;
    result.overdueEscalations = dashboardResult.escalations;
    result.taskAutomation = JSKOS.TaskAutomation.runDaily(policies, today);
    return result;
  }

  function synchronizeFollowUpActions_(policies, today) {
    var plan = buildFollowUpPlan_(policies, today);
    var repository = new PolicyRepository();
    var result = { created: 0, closed: 0, updated: 0 };

    plan.forEach(function (item) {
      try {
        repository.update(
          item.policyId,
          item.data,
          'GARUDA Follow-up Automation',
          item.expectedVersion
        );
        result[item.type === 'CLOSE' ? 'closed' : 'created'] += 1;
        result.updated += 1;
      } catch (error) {
        console.error(
          'Follow-up automation skipped ' + item.policyId + ': ' +
          (error && error.stack ? error.stack : error)
        );
      }
    });
    return result;
  }

  function buildFollowUpPlan_(policies, referenceDate) {
    var today = startOfDay_(referenceDate || new Date());
    var active = { issued: true, active: true, 'renewal due': true };
    var insights = JSKOS.GarudaRenewalIntelligence.analyzePolicies(
      policies, today, 1000
    );
    var insightMap = {};
    insights.forEach(function (insight) {
      insightMap[insight.policyId] = insight;
    });

    return (Array.isArray(policies) ? policies : []).reduce(function (plan, policy) {
      var stage = String(policy.renewalStage || '').trim().toLowerCase();
      var status = String(policy.policyStatus || '').trim().toLowerCase();
      var hasAction = Boolean(startOfDay_(policy.nextActionDate));
      if ((stage === 'won' || stage === 'lost') && hasAction) {
        plan.push({
          type: 'CLOSE',
          policyId: policy.policyId,
          expectedVersion: policy.recordVersion,
          data: { nextActionDate: '' }
        });
        return plan;
      }
      if (!active[status] || stage === 'won' || stage === 'lost' || hasAction) {
        return plan;
      }

      var insight = insightMap[policy.policyId];
      if (!insight) return plan;
      var offset = insight.daysUntilRenewal <= 7 ? 0 :
        insight.daysUntilRenewal <= 30 ? 2 : 7;
      var actionDate = new Date(today.getTime());
      actionDate.setDate(actionDate.getDate() + offset);
      var data = { nextActionDate: formatDate_(actionDate) };
      if (!String(policy.followUpNotes || '').trim()) {
        data.followUpNotes = 'GARUDA: ' + insight.suggestedFollowUp;
      }
      plan.push({
        type: 'CREATE',
        policyId: policy.policyId,
        expectedVersion: policy.recordVersion,
        data: data
      });
      return plan;
    }, []);
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

  /**
   * Idempotently upgrades the schema and installs the daily trigger.
   * Safe to call from the web-app bootstrap on every request.
   */
  function ensureReady() {
    var properties = PropertiesService.getScriptProperties();
    var installedVersion = Number(
      properties.getProperty(JSK_POLICY_SCHEMA.PROPERTY_KEY)
    ) || 0;
    var migration = null;

    if (installedVersion < JSK_POLICY_SCHEMA.VERSION) {
      migration = migratePolicyDatabase();
    }

    var trigger = findDailyTrigger_();
    var triggerCreated = false;
    if (!trigger) {
      trigger = ScriptApp.newTrigger('runDailyRenewalAutomation')
        .timeBased()
        .atHour(CONFIG.TRIGGER_HOUR)
        .everyDays(1)
        .inTimezone(CONFIG.TIMEZONE)
        .create();
      triggerCreated = true;
    }

    return {
      ready: true,
      schemaVersion: JSK_POLICY_SCHEMA.VERSION,
      migration: migration,
      triggerId: trigger.getUniqueId(),
      triggerCreated: triggerCreated
    };
  }

  /** @private */
  function findDailyTrigger_() {
    var matches = ScriptApp.getProjectTriggers().filter(function (trigger) {
      return trigger.getHandlerFunction() === 'runDailyRenewalAutomation';
    });
    return matches.length ? matches[0] : null;
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
    if (!String(recipients || '').trim()) return { sent: false, escalations: 0 };

    var renewals = JSKOS.DashboardService.summarizeRenewals(policies, today);
    var pipeline = JSKOS.DashboardService.summarizeRenewalPipeline(policies, today);
    var workQueue = JSKOS.RenewalWorkQueue.build(policies, today, 1000);
    var ownerGroups = {};
    workQueue.items.forEach(function (item) {
      var owner = item.assignedOwner || 'Unassigned';
      if (!ownerGroups[owner]) ownerGroups[owner] = [];
      ownerGroups[owner].push(item);
    });
    var escalations = workQueue.items.filter(function (item) {
      return item.daysUntilAction <= -CONFIG.ESCALATION_DAYS;
    });
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
      'Lost: ' + pipeline.lost, '',
      'OWNER-WISE FOLLOW-UP SUMMARY'
    ];
    Object.keys(ownerGroups).sort().forEach(function (owner) {
      body.push(owner + ': ' + ownerGroups[owner].length + ' action(s)');
      ownerGroups[owner].forEach(function (item) {
        body.push('  - ' + item.policyNumber + ' | ' + item.state +
          ' | ' + item.nextActionDate + ' | ' + item.renewalStage);
      });
    });
    body.push('', 'ESCALATIONS (3+ DAYS OVERDUE): ' + escalations.length);
    escalations.forEach(function (item) {
      body.push('  - ' + item.policyNumber + ' | ' + item.assignedOwner +
        ' | overdue ' + Math.abs(item.daysUntilAction) + ' day(s)');
    });
    MailApp.sendEmail(
      String(recipients),
      'JSK OS Daily Renewal Dashboard',
      body.join('\n')
    );
    return { sent: true, escalations: escalations.length };
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
    buildFollowUpPlan: buildFollowUpPlan_,
    ensureReady: ensureReady,
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

function ensureBuild1002Automation() {
  return JSKOS.RenewalAutomation.ensureReady();
}
