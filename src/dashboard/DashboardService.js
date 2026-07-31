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
      summary: getSummary()
    };
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
    getSummary: getSummary
  };
})();