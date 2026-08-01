/**
 * JSK OS
 * Module: Policy Search API
 * Version: 1.0.0
 *
 * Public search, lookup, autocomplete and filter APIs for Policy Management.
 * Google Apps Script V8 compatible.
 */

var JSK_POLICY_SEARCH_API_VERSION = '1.0.0';
var JSK_POLICY_SEARCH_MIN_QUERY_LENGTH = 2;
var JSK_POLICY_SEARCH_DEFAULT_LIMIT = 10;
var JSK_POLICY_SEARCH_MAX_LIMIT = 20;
var JSK_POLICY_SEARCH_FILTER_PAGE_SIZE = 100;

/**
 * General policy search alias.
 *
 * @param {Object|string=} payload Search criteria.
 * @return {Object} Standard Policy API response.
 */
function searchPolicies(payload) {
  return apiPolicySearch(payload || {});
}

/**
 * Exact Policy ID lookup.
 *
 * @param {string|Object} policyId Policy ID or request object.
 * @return {Object} Standard Policy API response.
 */
function searchPolicyById(policyId) {
  var request = policySearchNormalizeLookupRequest_(
    policyId,
    'policyId'
  );

  return apiPolicyGet(request);
}

/**
 * Exact Policy Number lookup.
 *
 * @param {string|Object} policyNumber Policy number or request object.
 * @return {Object} Standard Policy API response.
 */
function searchPolicyByNumber(policyNumber) {
  var request = policySearchNormalizeLookupRequest_(
    policyNumber,
    'policyNumber'
  );

  return apiPolicyGetByNumber(request);
}

/**
 * Returns policies linked to a company.
 *
 * @param {string|Object} payload Company ID or request object.
 * @return {Object} Standard Policy API response.
 */
function searchPoliciesByCompany(payload) {
  return apiPolicyByCompany(
    policySearchNormalizeLookupRequest_(payload, 'companyId')
  );
}

/**
 * Returns policies linked to a person.
 *
 * @param {string|Object} payload Person ID or request object.
 * @return {Object} Standard Policy API response.
 */
function searchPoliciesByPerson(payload) {
  return apiPolicyByPerson(
    policySearchNormalizeLookupRequest_(payload, 'personId')
  );
}

/**
 * Returns policies due for renewal.
 *
 * @param {Object|string=} payload Renewal criteria or due-date string.
 * @return {Object} Standard Policy API response.
 */
function searchPolicyRenewalsDue(payload) {
  if (typeof payload === 'string' || payload instanceof Date) {
    payload = {
      dueDate: payload
    };
  }

  return apiPolicyRenewalsDue(payload || {});
}

/**
 * Policy autocomplete.
 *
 * Request:
 * {
 *   query: "HDFC",
 *   policyType: "Health Insurance",
 *   insurerName: "HDFC ERGO",
 *   companyId: "COM-...",
 *   personId: "PER-...",
 *   policyStatus: "Active",
 *   riskCategory: "Health",
 *   limit: 10
 * }
 *
 * @param {Object|string=} payload Request.
 * @return {Object} Standard Policy API response.
 */
function searchPolicySuggestions(payload) {
  return policyApiExecute_('searchSuggestions', function () {
    var request = policyNormalizeRequest_(payload || {});
    var query = String(request.query || '').trim();

    if (query.length < JSK_POLICY_SEARCH_MIN_QUERY_LENGTH) {
      return [];
    }

    var limit = policySearchNormalizeLimit_(request.limit);
    var result = policyGetService_().search({
      query: query,
      policyType: request.policyType,
      insurerName: request.insurerName,
      companyId: request.companyId,
      personId: request.personId,
      familyId: request.familyId,
      policyStatus: request.policyStatus,
      riskCategory: request.riskCategory,
      includeDeleted: false,
      page: 1,
      pageSize: limit
    });

    return result.items.map(function (policy) {
      return {
        policyId: policy.policyId,
        policyNumber: policy.policyNumber,
        insuredName: policy.insuredName,
        policyType: policy.policyType,
        productName: policy.productName,
        insurerName: policy.insurerName,
        companyId: policy.companyId,
        personId: policy.personId,
        policyStatus: policy.policyStatus,
        renewalDate: policy.renewalDate,
        label: policySearchBuildSuggestionLabel_(policy)
      };
    });
  });
}

/**
 * Returns distinct search filter values from active Policy records.
 *
 * @return {Object} Standard Policy API response.
 */
function getPolicySearchFilters() {
  return policyApiExecute_('getSearchFilters', function () {
    var items = policySearchCollectAllActivePolicies_();

    return {
      policyTypes: policySearchUniqueSorted_(
        items.map(function (item) {
          return item.policyType;
        })
      ),
      productNames: policySearchUniqueSorted_(
        items.map(function (item) {
          return item.productName;
        })
      ),
      insurerNames: policySearchUniqueSorted_(
        items.map(function (item) {
          return item.insurerName;
        })
      ),
      policyStatuses: policySearchUniqueSorted_(
        items.map(function (item) {
          return item.policyStatus;
        })
      ),
      renewalStages: JSK_POLICY_SCHEMA.RENEWAL_STAGE_VALUES.slice(),
      assignedOwners: policySearchUniqueSorted_(
        items.map(function (item) {
          return item.assignedOwner;
        })
      ),
      riskCategories: policySearchUniqueSorted_(
        items.map(function (item) {
          return item.riskCategory;
        })
      ),
      paymentFrequencies: policySearchUniqueSorted_(
        items.map(function (item) {
          return item.paymentFrequency;
        })
      ),
      agentsOrBrokers: policySearchUniqueSorted_(
        items.map(function (item) {
          return item.agentBroker;
        })
      ),
      branches: policySearchUniqueSorted_(
        items.map(function (item) {
          return item.branch;
        })
      )
    };
  });
}

/**
 * Search API health information.
 *
 * @return {Object} Standard Policy API response.
 */
function apiPolicySearchHealth() {
  return policyApiExecute_('searchHealth', function () {
    return {
      module: 'Policy Search API',
      version: JSK_POLICY_SEARCH_API_VERSION,
      minimumQueryLength: JSK_POLICY_SEARCH_MIN_QUERY_LENGTH,
      defaultSuggestionLimit: JSK_POLICY_SEARCH_DEFAULT_LIMIT,
      maximumSuggestionLimit: JSK_POLICY_SEARCH_MAX_LIMIT,
      timestamp: new Date().toISOString()
    };
  });
}

/**
 * Converts a string lookup or request object into an API request.
 *
 * @private
 * @param {string|Object} value Lookup value or request.
 * @param {string} field Request field name.
 * @return {Object} Request object.
 */
function policySearchNormalizeLookupRequest_(value, field) {
  if (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  ) {
    return value;
  }

  var request = {};
  request[field] = value;
  return request;
}

/**
 * Normalizes the autocomplete result limit.
 *
 * @private
 * @param {*} value Requested limit.
 * @return {number} Safe limit.
 */
function policySearchNormalizeLimit_(value) {
  return Math.min(
    JSK_POLICY_SEARCH_MAX_LIMIT,
    Math.max(
      1,
      Number(value) || JSK_POLICY_SEARCH_DEFAULT_LIMIT
    )
  );
}

/**
 * Collects all non-deleted policies by paging through the Policy service.
 *
 * @private
 * @return {Object[]} Active policies.
 */
function policySearchCollectAllActivePolicies_() {
  var service = policyGetService_();
  var firstPage = service.search({
    includeDeleted: false,
    page: 1,
    pageSize: JSK_POLICY_SEARCH_FILTER_PAGE_SIZE
  });
  var items = firstPage.items.slice();
  var totalPages = firstPage.pagination.totalPages;
  var page = 2;

  while (page <= totalPages) {
    var result = service.search({
      includeDeleted: false,
      page: page,
      pageSize: JSK_POLICY_SEARCH_FILTER_PAGE_SIZE
    });

    items = items.concat(result.items);
    page += 1;
  }

  return items;
}

/**
 * Builds a compact human-readable autocomplete label.
 *
 * @private
 * @param {Object} policy Policy record.
 * @return {string} Label.
 */
function policySearchBuildSuggestionLabel_(policy) {
  var primary = String(
    policy.policyNumber || policy.policyId || ''
  ).trim();
  var parts = [];

  if (policy.insuredName) {
    parts.push(String(policy.insuredName).trim());
  }

  if (policy.insurerName) {
    parts.push(String(policy.insurerName).trim());
  }

  if (policy.policyType) {
    parts.push(String(policy.policyType).trim());
  }

  return primary + (parts.length ? ' — ' + parts.join(' • ') : '');
}

/**
 * Returns unique sorted non-empty strings.
 *
 * @private
 * @param {Array<*>} values Values.
 * @return {string[]} Unique sorted values.
 */
function policySearchUniqueSorted_(values) {
  var uniqueMap = {};

  (values || []).forEach(function (value) {
    var normalized = String(value || '').trim();

    if (normalized) {
      uniqueMap[normalized.toLowerCase()] = normalized;
    }
  });

  return Object.keys(uniqueMap)
    .map(function (key) {
      return uniqueMap[key];
    })
    .sort(function (left, right) {
      return left.localeCompare(right);
    });
}
