/** JSK OS Build 1004 - Renewal task automation. */

var JSKOS = JSKOS || {};

JSKOS.TaskAutomation = (function () {
  'use strict';

  var TIMEZONE = 'Asia/Kolkata';
  var RECIPIENTS_KEY = 'JSK_OS_TASK_DASHBOARD_RECIPIENTS';
  var FALLBACK_RECIPIENTS_KEY = 'JSK_OS_RENEWAL_DASHBOARD_RECIPIENTS';

  function runDaily(policies, referenceDate) {
    ensureBuild1004Tasks();
    var repository = new TaskRepository();
    var tasks = repository.search({}).items || [];
    var plan = buildPlan_(policies || [], tasks, referenceDate || new Date());
    var result = { created: 0, updated: 0, closed: 0, escalated: 0, summarySent: false };

    plan.forEach(function (action) {
      if (action.type === 'CREATE') {
        repository.create(action.data, 'Task Automation');
        result.created += 1;
        return;
      }
      repository.update(action.taskId, action.data, 'Task Automation', action.expectedVersion);
      result[action.type === 'CLOSE' ? 'closed' : 'updated'] += 1;
      if (action.escalated) result.escalated += 1;
    });

    var refreshedTasks = repository.search({}).items || [];
    result.summarySent = sendSummary_(refreshedTasks, result, referenceDate || new Date());
    result.notifications = JSKOS.TaskNotifications.sendDaily(refreshedTasks, referenceDate || new Date());
    return result;
  }

  function buildPlan_(policies, tasks, referenceDate) {
    var today = startOfDay_(referenceDate);
    var todayKey = formatDate_(today);
    var activeStatuses = { active: true, issued: true, 'renewal due': true };
    var taskMap = {};

    (tasks || []).forEach(function (task) {
      var match = String(task.description || '').match(/\[AUTO-RENEWAL:([^:\]]+):([^\]]+)\]/);
      if (match) taskMap[match[1] + '|' + match[2]] = task;
    });

    return (policies || []).reduce(function (plan, policy) {
      var renewalDate = startOfDay_(policy.renewalDate);
      if (!policy.policyId || !renewalDate) return plan;
      var renewalKey = formatDate_(renewalDate);
      var key = String(policy.policyId) + '|' + renewalKey;
      var existing = taskMap[key];
      var stage = String(policy.renewalStage || '').trim().toLowerCase();
      var status = String(policy.policyStatus || '').trim().toLowerCase();
      var terminal = stage === 'won' || stage === 'lost' || status === 'renewed' || status === 'cancelled';

      if (terminal) {
        if (existing && existing.status !== 'Completed' && existing.status !== 'Cancelled') {
          plan.push({ type: 'CLOSE', taskId: existing.taskId, expectedVersion: existing.recordVersion, data: { status: 'Completed' } });
        }
        return plan;
      }

      var days = daysBetween_(today, renewalDate);
      if (!activeStatuses[status] || days > 30) return plan;
      var priority = days < -2 ? 'Critical' : days <= 7 ? 'High' : 'Medium';
      if (!existing) {
        plan.push({
          type: 'CREATE',
          data: {
            title: 'Renew policy ' + (policy.policyNumber || policy.policyId),
            description: '[AUTO-RENEWAL:' + policy.policyId + ':' + renewalKey + '] Automated renewal follow-up.',
            taskType: 'Renewal', status: 'Open', priority: priority,
            owner: policy.assignedOwner || '', dueDate: todayKey,
            companyId: policy.companyId || '', personId: policy.personId || '', policyId: policy.policyId
          }
        });
        return plan;
      }

      if (existing.status === 'Completed' || existing.status === 'Cancelled') return plan;
      var changes = {};
      if (existing.priority !== priority) changes.priority = priority;
      if (!existing.owner && policy.assignedOwner) changes.owner = policy.assignedOwner;
      if (Object.keys(changes).length) {
        plan.push({
          type: 'UPDATE', taskId: existing.taskId, expectedVersion: existing.recordVersion,
          data: changes, escalated: priority === 'Critical' && existing.priority !== 'Critical'
        });
      }
      return plan;
    }, []);
  }

  function sendSummary_(tasks, result, referenceDate) {
    var properties = PropertiesService.getScriptProperties();
    var recipients = properties.getProperty(RECIPIENTS_KEY) || properties.getProperty(FALLBACK_RECIPIENTS_KEY);
    if (!String(recipients || '').trim()) return false;
    var today = formatDate_(startOfDay_(referenceDate));
    var open = (tasks || []).filter(function (task) { return task.status !== 'Completed' && task.status !== 'Cancelled'; });
    var overdue = open.filter(function (task) { return task.dueDate && task.dueDate < today; });
    var dueToday = open.filter(function (task) { return task.dueDate === today; });
    var critical = open.filter(function (task) { return task.priority === 'Critical'; });
    MailApp.sendEmail(String(recipients), 'JSK OS Daily Task Summary', [
      'JSK OS Daily Task Summary - ' + today, '',
      'Open: ' + open.length,
      'Due today: ' + dueToday.length,
      'Overdue: ' + overdue.length,
      'Critical: ' + critical.length, '',
      'Automation created: ' + result.created,
      'Automation updated: ' + result.updated,
      'Automation closed: ' + result.closed,
      'Escalated: ' + result.escalated
    ].join('\n'));
    return true;
  }

  function startOfDay_(value) {
    var date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (isNaN(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function daysBetween_(fromDate, toDate) {
    return Math.round((toDate.getTime() - fromDate.getTime()) / 86400000);
  }

  function formatDate_(date) { return Utilities.formatDate(date, TIMEZONE, 'yyyy-MM-dd'); }

  return { runDaily: runDaily, buildPlan: buildPlan_ };
})();

function runDailyTaskAutomation() {
  var repository = new PolicyRepository();
  var policies = [], page = 1, result;
  do {
    result = repository.search({ includeDeleted: false, page: page, pageSize: 100 });
    if (result && Array.isArray(result.items)) policies = policies.concat(result.items);
    page += 1;
  } while (result && result.pagination && result.pagination.hasNext);
  return JSKOS.TaskAutomation.runDaily(policies, new Date());
}
