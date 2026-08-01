/**
 * JSK OS v1.0 Enterprise
 * Module: Dashboard Service
 *
 * Responsibility:
 * - Collect dashboard metrics
 * - Isolate repository errors
 * - Return a stable dashboard model to the UI
 */

var JSKOS = JSKOS || {};

JSKOS.DashboardService = (function () {
  'use strict';

  /**
   * Returns the complete dashboard payload.
   *
   * @return {Object}
   */
  function getDashboard() {
    return {
      summary: getSummary(),
      renewals: getRenewalSummary(),
      renewalPipeline: getRenewalPipeline(),
      garudaInsights: getGarudaInsights(),
      workQueue: getWorkQueue(),
      tasks: getTaskDashboard(),
      meetings: getMeetingDashboard()
    };
  }

  function getMeetingDashboard(referenceDate) {
    try {
      ensureBuild1005Meetings();
      return summarizeMeetings_(new MeetingRepository().search({}).items || [], referenceDate || new Date(), 8);
    } catch (error) {
      console.warn('Meeting dashboard unavailable: ' + getErrorMessage_(error));
      return emptyMeetingDashboard_();
    }
  }

  function summarizeMeetings_(meetings, referenceDate, limit) {
    var now = referenceDate instanceof Date ? new Date(referenceDate.getTime()) : new Date(referenceDate);
    var today = formatDashboardDate_(now);
    var next7 = new Date(now.getTime() + 7 * 86400000);
    var summary = { today: 0, upcoming: 0, missed: 0, completed: 0, unassigned: 0 };
    var ownerWorkload = {}, actionable = [];
    (Array.isArray(meetings) ? meetings : []).forEach(function (meeting) {
      var start = new Date(meeting.startAt), status = String(meeting.status || 'Scheduled');
      if (status === 'Completed') { summary.completed += 1; return; }
      if (status === 'Cancelled') return;
      if (isNaN(start.getTime())) return;
      var owner = String(meeting.owner || '').trim();
      if (!owner) summary.unassigned += 1;
      ownerWorkload[owner || 'Unassigned'] = (ownerWorkload[owner || 'Unassigned'] || 0) + 1;
      var day = formatDashboardDate_(start), state = '';
      if (status === 'Scheduled' && day === today) summary.today += 1;
      if ((status === 'Scheduled' || status === 'No Show') && start < now) { summary.missed += 1; state = 'Missed'; }
      else if (status === 'Scheduled' && day === today) { state = 'Today'; }
      else if (status === 'Scheduled' && start <= next7) { summary.upcoming += 1; state = 'Upcoming'; }
      if (state) actionable.push(Object.assign({}, meeting, { state: state }));
    });
    actionable.sort(function (left, right) { return String(left.startAt).localeCompare(String(right.startAt)); });
    return { summary: summary, items: actionable.slice(0, Math.max(1, Number(limit) || 8)), ownerWorkload: Object.keys(ownerWorkload).sort().map(function (owner) { return { owner: owner, count: ownerWorkload[owner] }; }) };
  }

  function emptyMeetingDashboard_() {
    return { summary: { today: 0, upcoming: 0, missed: 0, completed: 0, unassigned: 0 }, items: [], ownerWorkload: [] };
  }

  function getTaskDashboard(referenceDate) {
    try {
      ensureBuild1004Tasks();
      var result = new TaskRepository().search({});
      return summarizeTasks_(result.items || [], referenceDate || new Date(), 8);
    } catch (error) {
      console.warn('Task dashboard unavailable: ' + getErrorMessage_(error));
      return emptyTaskDashboard_();
    }
  }

  function summarizeTasks_(tasks, referenceDate, limit) {
    var today = formatDashboardDate_(referenceDate || new Date());
    var summary = { totalOpen: 0, dueToday: 0, overdue: 0, highPriority: 0, unassigned: 0 };
    var ownerWorkload = {};
    var actionable = [];

    (Array.isArray(tasks) ? tasks : []).forEach(function (task) {
      var status = String(task.status || 'Open').trim().toLowerCase();
      if (status === 'completed' || status === 'cancelled') return;
      var dueDate = String(task.dueDate || '');
      var priority = String(task.priority || 'Medium').trim();
      var owner = String(task.owner || '').trim();
      summary.totalOpen += 1;
      if (dueDate === today) summary.dueToday += 1;
      if (dueDate && dueDate < today) summary.overdue += 1;
      if (priority === 'High' || priority === 'Critical') summary.highPriority += 1;
      if (!owner) summary.unassigned += 1;
      ownerWorkload[owner || 'Unassigned'] = (ownerWorkload[owner || 'Unassigned'] || 0) + 1;

      if ((dueDate && dueDate <= today) || priority === 'High' || priority === 'Critical') {
        actionable.push(Object.assign({}, task, {
          state: dueDate && dueDate < today ? 'Overdue' : dueDate === today ? 'Today' : 'Priority'
        }));
      }
    });

    actionable.sort(function (left, right) {
      var rank = { Critical: 0, High: 1, Medium: 2, Low: 3 };
      var dateCompare = String(left.dueDate || '9999').localeCompare(String(right.dueDate || '9999'));
      var leftRank = rank[left.priority] !== undefined ? rank[left.priority] : 9;
      var rightRank = rank[right.priority] !== undefined ? rank[right.priority] : 9;
      return dateCompare || leftRank - rightRank;
    });
    return {
      summary: summary,
      items: actionable.slice(0, Math.max(1, Number(limit) || 8)),
      ownerWorkload: Object.keys(ownerWorkload).sort().map(function (owner) {
        return { owner: owner, count: ownerWorkload[owner] };
      })
    };
  }

  function emptyTaskDashboard_() {
    return {
      summary: { totalOpen: 0, dueToday: 0, overdue: 0, highPriority: 0, unassigned: 0 },
      items: [],
      ownerWorkload: []
    };
  }

  function formatDashboardDate_(value) {
    return Utilities.formatDate(
      value instanceof Date ? value : new Date(value),
      'Asia/Kolkata',
      'yyyy-MM-dd'
    );
  }

  function getWorkQueue(referenceDate) {
    try {
      return JSKOS.RenewalWorkQueue.build(
        collectPolicies_(new PolicyRepository()),
        referenceDate || new Date(),
        8
      );
    } catch (error) {
      console.warn('Renewal work queue unavailable: ' + getErrorMessage_(error));
      return {
        summary: { dueToday: 0, overdue: 0, next7Days: 0, unassigned: 0 },
        items: [],
        asOf: new Date().toISOString()
      };
    }
  }

  function getGarudaInsights(referenceDate) {
    try {
      return JSKOS.GarudaRenewalIntelligence.analyzePolicies(
        collectPolicies_(new PolicyRepository()),
        referenceDate || new Date(),
        5
      );
    } catch (error) {
      console.warn('GARUDA renewal intelligence unavailable: ' + getErrorMessage_(error));
      return [];
    }
  }

  /**
   * Returns counts for each Build 1002 renewal pipeline stage.
   * Blank stages on actionable renewals are treated as Call Pending.
   *
   * @param {Date=} referenceDate
   * @return {Object}
   */
  function getRenewalPipeline(referenceDate) {
    try {
      return summarizeRenewalPipeline_(
        collectPolicies_(new PolicyRepository()),
        referenceDate || new Date()
      );
    } catch (error) {
      console.warn(
        'Renewal pipeline unavailable: ' +
        getErrorMessage_(error)
      );
      return emptyRenewalPipeline_();
    }
  }

  /** @private */
  function summarizeRenewalPipeline_(policies, referenceDate) {
    var summary = emptyRenewalPipeline_();
    var today = startOfDay_(referenceDate || new Date());
    var actionableStatuses = {
      issued: true,
      active: true,
      'renewal due': true
    };
    var stageKeys = {
      'call pending': 'callPending',
      'whatsapp sent': 'whatsappSent',
      'quote sent': 'quoteSent',
      negotiation: 'negotiation',
      won: 'won',
      lost: 'lost'
    };

    (Array.isArray(policies) ? policies : []).forEach(function (policy) {
      var stage = String(policy && policy.renewalStage || '')
        .trim()
        .toLowerCase();
      var stageKey = stageKeys[stage];

      if (stageKey) {
        summary[stageKey] += 1;
        return;
      }

      var status = String(policy && policy.policyStatus || '')
        .trim()
        .toLowerCase();
      var renewalDate = startOfDay_(policy && policy.renewalDate);

      if (
        actionableStatuses[status] &&
        renewalDate &&
        daysBetween_(today, renewalDate) <= 90
      ) {
        summary.callPending += 1;
      }
    });

    return summary;
  }

  /** @private */
  function emptyRenewalPipeline_() {
    return {
      callPending: 0,
      whatsappSent: 0,
      quoteSent: 0,
      negotiation: 0,
      won: 0,
      lost: 0
    };
  }

  /** @private */
  function daysBetween_(fromDate, toDate) {
    return Math.round(
      (toDate.getTime() - fromDate.getTime()) /
      (24 * 60 * 60 * 1000)
    );
  }

  /**
   * Returns renewal intelligence metrics for the dashboard.
   *
   * @param {Date=} referenceDate
   * @return {Object}
   */
  function getRenewalSummary(referenceDate) {
    try {
      return summarizeRenewals_(
        collectPolicies_(new PolicyRepository()),
        referenceDate || new Date()
      );
    } catch (error) {
      console.warn(
        'Renewal dashboard unavailable: ' +
        getErrorMessage_(error)
      );

      return emptyRenewalSummary_(referenceDate || new Date());
    }
  }

  /**
   * Builds deterministic renewal buckets from policy records.
   * Exposed through summarizeRenewals() to support boundary tests.
   *
   * @param {Object[]} policies
   * @param {Date=} referenceDate
   * @return {Object}
   * @private
   */
  function summarizeRenewals_(policies, referenceDate) {
    var summary = emptyRenewalSummary_(referenceDate || new Date());
    var eligibleStatuses = {
      issued: true,
      active: true,
      'renewal due': true
    };
    var today = startOfDay_(referenceDate || new Date());
    var dayMilliseconds = 24 * 60 * 60 * 1000;

    (Array.isArray(policies) ? policies : []).forEach(function (policy) {
      var status = String(policy && policy.policyStatus || '')
        .trim()
        .toLowerCase();

      if (status === 'renewed') {
        summary.renewed += 1;
        return;
      }

      if (!eligibleStatuses[status]) return;

      var renewalDate = startOfDay_(policy && policy.renewalDate);
      if (!renewalDate) return;

      var daysUntilRenewal = Math.round(
        (renewalDate.getTime() - today.getTime()) /
        dayMilliseconds
      );

      if (daysUntilRenewal < 0) {
        summary.overdue += 1;
      } else if (daysUntilRenewal <= 30) {
        summary.due30Days += 1;
      } else if (daysUntilRenewal <= 60) {
        summary.due60Days += 1;
      } else if (daysUntilRenewal <= 90) {
        summary.due90Days += 1;
      }
    });

    return summary;
  }

  /** @private */
  function collectPolicies_(repository) {
    var policies = [];
    var page = 1;
    var result;

    do {
      result = repository.search({
        includeDeleted: false,
        page: page,
        pageSize: 200
      });

      if (result && Array.isArray(result.items)) {
        policies = policies.concat(result.items);
      }

      page += 1;
    } while (
      result &&
      result.pagination &&
      result.pagination.hasNext
    );

    return policies;
  }

  /** @private */
  function emptyRenewalSummary_(referenceDate) {
    var date = startOfDay_(referenceDate) || startOfDay_(new Date());

    return {
      due30Days: 0,
      due60Days: 0,
      due90Days: 0,
      overdue: 0,
      renewed: 0,
      asOf: date.toISOString()
    };
  }

  /** @private */
  function startOfDay_(value) {
    if (
      value === null ||
      value === undefined ||
      String(value).trim() === ''
    ) {
      return null;
    }

    var date = value instanceof Date
      ? new Date(value.getTime())
      : new Date(value);

    if (isNaN(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    return date;
  }

  /**
   * Returns dashboard summary metrics.
   *
   * @return {{
   *   companies: number,
   *   people: number,
   *   followups: number,
   *   highRiskCompanies: number,
   *   generatedAt: string
   * }}
   */
  function getSummary() {
    var companyRepository = new CompanyRepository();
    var peopleRepository = new PeopleRepository();

    return {
      companies: safeMetric_(function () {
        return companyRepository.count({
          includeDeleted: false
        });
      }),

      people: safeMetric_(function () {
        return peopleRepository.count({
          includeArchived: false
        });
      }),

      followups: safeMetric_(function () {
        var records = peopleRepository.findFollowupsDue(new Date());

        return Array.isArray(records)
          ? records.length
          : 0;
      }),

      highRiskCompanies: safeMetric_(function () {
        var result = companyRepository.search({
          riskCategory: 'High',
          includeDeleted: false,
          page: 1,
          pageSize: 1
        });

        if (
          result &&
          result.pagination &&
          result.pagination.totalItems !== undefined
        ) {
          return result.pagination.totalItems;
        }

        return 0;
      }),

      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Executes a metric callback safely.
   *
   * Repository failure in one metric must not stop the complete dashboard.
   *
   * @param {Function} callback
   * @return {number}
   * @private
   */
  function safeMetric_(callback) {
    try {
      var value = Number(callback());

      if (!isFinite(value) || value < 0) {
        return 0;
      }

      return value;
    } catch (error) {
      console.warn(
        'Dashboard metric unavailable: ' +
        getErrorMessage_(error)
      );

      return 0;
    }
  }

  /**
   * Returns a safe error message.
   *
   * @param {*} error
   * @return {string}
   * @private
   */
  function getErrorMessage_(error) {
    if (error && error.message) {
      return String(error.message);
    }

    return String(error);
  }

  return {
    getDashboard: getDashboard,
    getSummary: getSummary,
    getRenewalSummary: getRenewalSummary,
    summarizeRenewals: summarizeRenewals_,
    getRenewalPipeline: getRenewalPipeline,
    summarizeRenewalPipeline: summarizeRenewalPipeline_,
    getGarudaInsights: getGarudaInsights,
    getWorkQueue: getWorkQueue,
    getTaskDashboard: getTaskDashboard,
    summarizeTasks: summarizeTasks_,
    getMeetingDashboard: getMeetingDashboard,
    summarizeMeetings: summarizeMeetings_
  };
})();
