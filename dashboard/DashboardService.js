/**
 * JSK OS v1.0 Enterprise
 * Module: Dashboard Service
 *
 * Owns dashboard business logic and keeps repository access out of the UI.
 */

var JSKOS = JSKOS || {};

JSKOS.DashboardService = Object.freeze({
  /**
   * Returns the complete dashboard model.
   *
   * @return {{summary: Object}}
   */
  getDashboard: function () {
    return {
      summary: JSKOS.DashboardService.getSummary()
    };
  },

  /**
   * Returns dashboard summary metrics.
   * A failed metric is isolated and returned as zero so that the dashboard
   * remains available even when one repository operation fails.
   *
   * @return {{
   *   companies: number,
   *   people: number,
   *   followups: number,
   *   highRiskCompanies: number,
   *   generatedAt: string
   * }}
   */
  getSummary: function () {
    return {
      companies: JSKOS.DashboardService.safeMetric_(function () {
        return new CompanyRepository().count({
          includeDeleted: false
        });
      }),

      people: JSKOS.DashboardService.safeMetric_(function () {
        return new PeopleRepository().count({
          includeArchived: false
        });
      }),

      followups: JSKOS.DashboardService.safeMetric_(function () {
        return new PeopleRepository()
          .findFollowupsDue(new Date())
          .length;
      }),

      highRiskCompanies: JSKOS.DashboardService.safeMetric_(function () {
        var result = new CompanyRepository().search({
          riskCategory: 'High',
          includeDeleted: false,
          page: 1,
          pageSize: 1
        });

        return result && result.pagination
          ? result.pagination.totalItems
          : 0;
      }),

      generatedAt: new Date().toISOString()
    };
  },

  /**
   * Executes a dashboard metric safely.
   *
   * @param {Function} callback Metric callback.
   * @return {number} A finite, non-negative metric value or zero.
   * @private
   */
  safeMetric_: function (callback) {
    try {
      if (typeof callback !== 'function') {
        throw new TypeError('Dashboard metric callback must be a function.');
      }

      var value = Number(callback());

      return isFinite(value) && value > 0
        ? value
        : 0;
    } catch (error) {
      console.warn(
        'Dashboard metric unavailable: ' +
        (error && error.message
          ? error.message
          : String(error))
      );

      return 0;
    }
  }
});
