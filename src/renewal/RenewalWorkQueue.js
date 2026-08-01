/** JSK OS Build 1003 - Renewal Work Queue. */

var JSKOS = JSKOS || {};

JSKOS.RenewalWorkQueue = (function () {
  'use strict';

  function build(policies, referenceDate, limit) {
    var today = startOfDay_(referenceDate || new Date());
    var summary = { dueToday: 0, overdue: 0, next7Days: 0, unassigned: 0 };
    var terminalStages = { won: true, lost: true };
    var actionableStatuses = { issued: true, active: true, 'renewal due': true };
    var items = [];

    (Array.isArray(policies) ? policies : []).forEach(function (policy) {
      var status = normalize_(policy && policy.policyStatus);
      var stage = normalize_(policy && policy.renewalStage);
      if (!actionableStatuses[status] || terminalStages[stage]) return;

      var actionDate = startOfDay_(policy && policy.nextActionDate);
      var owner = String(policy && policy.assignedOwner || '').trim();
      if (!owner) summary.unassigned += 1;
      if (!actionDate) return;

      var daysUntilAction = daysBetween_(today, actionDate);
      if (daysUntilAction < 0) summary.overdue += 1;
      else if (daysUntilAction === 0) summary.dueToday += 1;
      else if (daysUntilAction <= 7) summary.next7Days += 1;
      else return;

      items.push({
        policyId: String(policy.policyId || ''),
        policyNumber: String(policy.policyNumber || policy.policyId || 'Unnumbered'),
        insuredName: String(policy.insuredName || 'Unknown Client'),
        assignedOwner: owner || 'Unassigned',
        nextActionDate: actionDate.toISOString(),
        daysUntilAction: daysUntilAction,
        renewalStage: policy.renewalStage || 'Call Pending',
        followUpNotes: String(policy.followUpNotes || ''),
        state: daysUntilAction < 0 ? 'Overdue' : daysUntilAction === 0 ? 'Today' : 'Upcoming'
      });
    });

    items.sort(function (left, right) {
      if (left.daysUntilAction !== right.daysUntilAction) {
        return left.daysUntilAction - right.daysUntilAction;
      }
      return left.policyNumber.localeCompare(right.policyNumber);
    });

    return {
      summary: summary,
      items: items.slice(0, Math.max(1, Number(limit) || 8)),
      asOf: today.toISOString()
    };
  }

  function normalize_(value) {
    return String(value || '').trim().toLowerCase();
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

  return { build: build };
})();
