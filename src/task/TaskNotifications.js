/** JSK OS Build 1004 - Task owner reminders and escalation alerts. */

var JSKOS = JSKOS || {};

JSKOS.TaskNotifications = (function () {
  'use strict';

  var TIMEZONE = 'Asia/Kolkata';
  var OWNER_EMAILS_KEY = 'JSK_OS_TASK_OWNER_EMAILS';
  var RECIPIENTS_KEY = 'JSK_OS_TASK_DASHBOARD_RECIPIENTS';
  var FALLBACK_RECIPIENTS_KEY = 'JSK_OS_RENEWAL_DASHBOARD_RECIPIENTS';
  var LOG_SHEET = 'Task_Notification_Log';

  function sendDaily(tasks, referenceDate) {
    var properties = PropertiesService.getScriptProperties();
    var admin = String(properties.getProperty(RECIPIENTS_KEY) || properties.getProperty(FALLBACK_RECIPIENTS_KEY) || '').trim();
    var ownerEmails = parseOwnerEmails_(properties.getProperty(OWNER_EMAILS_KEY));
    var plan = buildPlan_(tasks, referenceDate || new Date(), ownerEmails, admin);
    var result = { planned: plan.length, sent: 0, skipped: 0 };

    plan.forEach(function (message) {
      if (wasSent_(message.key)) {
        result.skipped += 1;
        return;
      }
      MailApp.sendEmail({ to: message.to, subject: message.subject, body: message.body });
      logSent_(message);
      result.sent += 1;
    });
    return result;
  }

  function buildPlan_(tasks, referenceDate, ownerEmails, adminRecipients) {
    var today = formatDate_(referenceDate);
    var open = (Array.isArray(tasks) ? tasks : []).filter(function (task) {
      return task.status !== 'Completed' && task.status !== 'Cancelled';
    });
    var ownerGroups = {};
    open.forEach(function (task) {
      if (!task.dueDate || task.dueDate > today) return;
      var owner = String(task.owner || 'Unassigned').trim() || 'Unassigned';
      if (!ownerGroups[owner]) ownerGroups[owner] = [];
      ownerGroups[owner].push(task);
    });

    var messages = [];
    Object.keys(ownerGroups).sort().forEach(function (owner) {
      var email = resolveOwnerEmail_(owner, ownerEmails || {}, adminRecipients);
      if (!email) return;
      var items = ownerGroups[owner];
      messages.push({
        key: [today, 'OWNER_DIGEST', owner.toLowerCase()].join('|'),
        to: email,
        subject: 'JSK OS Task Reminder - ' + owner,
        body: buildOwnerBody_(owner, items, today)
      });
    });

    var critical = open.filter(function (task) {
      return task.priority === 'Critical' && task.dueDate && task.dueDate <= today;
    });
    if (critical.length && validRecipients_(adminRecipients)) {
      messages.push({
        key: [today, 'CRITICAL_ESCALATION'].join('|'),
        to: adminRecipients,
        subject: 'ACTION REQUIRED: ' + critical.length + ' Critical JSK OS Task(s)',
        body: buildCriticalBody_(critical, today)
      });
    }
    return messages;
  }

  function buildOwnerBody_(owner, tasks, today) {
    var overdue = tasks.filter(function (task) { return task.dueDate < today; });
    var dueToday = tasks.filter(function (task) { return task.dueDate === today; });
    var lines = ['JSK OS Task Reminder - ' + today, 'Owner: ' + owner, '',
      'Due today: ' + dueToday.length, 'Overdue: ' + overdue.length, ''];
    tasks.forEach(function (task) {
      lines.push('- [' + task.priority + '] ' + task.title + ' | Due: ' + task.dueDate +
        (task.policyId ? ' | Policy: ' + task.policyId : ''));
    });
    return lines.join('\n');
  }

  function buildCriticalBody_(tasks, today) {
    var lines = ['JSK OS Critical Task Escalation - ' + today, 'Immediate attention required.', ''];
    tasks.forEach(function (task) {
      lines.push('- ' + task.title + ' | Owner: ' + (task.owner || 'Unassigned') +
        ' | Due: ' + task.dueDate + (task.policyId ? ' | Policy: ' + task.policyId : ''));
    });
    return lines.join('\n');
  }

  function parseOwnerEmails_(value) {
    if (!String(value || '').trim()) return {};
    try {
      var parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      console.warn('Invalid ' + OWNER_EMAILS_KEY + ' JSON; admin fallback will be used.');
      return {};
    }
  }

  function resolveOwnerEmail_(owner, ownerEmails, fallback) {
    var direct = String(owner || '').trim();
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(direct)) return direct;
    var mapped = String(ownerEmails[owner] || ownerEmails[direct.toLowerCase()] || '').trim();
    return validRecipients_(mapped) ? mapped : validRecipients_(fallback) ? fallback : '';
  }

  function validRecipients_(value) {
    return String(value || '').split(',').some(function (email) {
      return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
    });
  }

  function getLogSheet_() {
    var spreadsheet = JSKOS.ConfigService.getSpreadsheet();
    var sheet = spreadsheet.getSheetByName(LOG_SHEET) || spreadsheet.insertSheet(LOG_SHEET);
    if (sheet.getLastRow() === 0) sheet.appendRow(['Sent At', 'Notification Key', 'Recipient', 'Subject']);
    return sheet;
  }

  function wasSent_(key) {
    var sheet = getLogSheet_();
    if (sheet.getLastRow() < 2) return false;
    return sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getDisplayValues().some(function (row) {
      return row[0] === key;
    });
  }

  function logSent_(message) {
    getLogSheet_().appendRow([new Date(), message.key, message.to, message.subject]);
  }

  function formatDate_(value) {
    var date = value instanceof Date ? value : new Date(value);
    return Utilities.formatDate(date, TIMEZONE, 'yyyy-MM-dd');
  }

  return { sendDaily: sendDaily, buildPlan: buildPlan_ };
})();

function runDailyTaskNotifications() {
  ensureBuild1004Tasks();
  return JSKOS.TaskNotifications.sendDaily(new TaskRepository().search({}).items || [], new Date());
}
