/**
 * JSK OS
 * Module: Policy Backend
 * Version: 1.0.0
 *
 * Service and public API layer for Policy Management.
 * Google Apps Script V8 compatible.
 */

var JSK_POLICY_BACKEND_VERSION = '1.0.0';
var JSK_POLICY_BACKEND_MODULE = 'Policy Management';

/**
 * Policy service layer.
 */
class PolicyService {
  /**
   * @param {PolicyRepository=} repository Repository instance.
   */
  constructor(repository) {
    this.repository = repository || new PolicyRepository();
  }

  create(payload, actor) {
    return this.repository.create(payload, actor);
  }

  get(policyId, options) {
    var policy = this.repository.findById(policyId, options || {});

    if (!policy) {
      throw new PolicyNotFoundError(policyId);
    }

    return policy;
  }

  getByPolicyNumber(policyNumber, options) {
    var policy = this.repository.findByPolicyNumber(
      policyNumber,
      options || {}
    );

    if (!policy) {
      throw new PolicyNotFoundError(policyNumber);
    }

    return policy;
  }

  update(policyId, payload, actor, expectedVersion) {
    return this.repository.update(
      policyId,
      payload,
      actor,
      expectedVersion
    );
  }

  archive(policyId, actor, expectedVersion) {
    return this.repository.archive(
      policyId,
      actor,
      expectedVersion
    );
  }

  restore(policyId, actor, expectedVersion) {
    return this.repository.restore(
      policyId,
      actor,
      expectedVersion
    );
  }

  search(criteria) {
    return this.repository.search(criteria || {});
  }

  findByCompanyId(companyId, options) {
    return this.repository.findByCompanyId(
      companyId,
      options || {}
    );
  }

  findByPersonId(personId, options) {
    return this.repository.findByPersonId(
      personId,
      options || {}
    );
  }

  findRenewalsDue(dueDate, options) {
    return this.repository.findRenewalsDue(
      dueDate,
      options || {}
    );
  }

  getHealth() {
    return {
      module: JSK_POLICY_BACKEND_MODULE,
      version: JSK_POLICY_BACKEND_VERSION,
      sheetName: JSK_POLICY_REPOSITORY_CONFIG.SHEET_NAME,
      activeRecords: this.repository.count({
        includeDeleted: false
      }),
      totalRecords: this.repository.count({
        includeDeleted: true
      }),
      timestamp: new Date().toISOString()
    };
  }
}

/** Creates a policy. */
function apiPolicyCreate(payload) {
  return policyApiExecute_('create', function () {
    var request = policyNormalizeRequest_(payload);
    var data = policyRequireDataObject_(
      request.data,
      'Policy data is required.'
    );

    return policyGetService_().create(data, request.actor);
  });
}

/** Gets a policy by Policy ID. */
function apiPolicyGet(payload) {
  return policyApiExecute_('get', function () {
    var request = policyNormalizeRequest_(payload);
    var policyId = policyRequireText_(
      request.policyId,
      'policyId',
      'Policy ID is required.'
    );

    return policyGetService_().get(policyId, {
      includeDeleted: policyNormalizeBoolean_(
        request.includeDeleted
      )
    });
  });
}

/** Gets a policy by Policy Number. */
function apiPolicyGetByNumber(payload) {
  return policyApiExecute_('getByPolicyNumber', function () {
    var request = policyNormalizeRequest_(payload);
    var policyNumber = policyRequireText_(
      request.policyNumber,
      'policyNumber',
      'Policy Number is required.'
    );

    return policyGetService_().getByPolicyNumber(
      policyNumber,
      {
        includeDeleted: policyNormalizeBoolean_(
          request.includeDeleted
        )
      }
    );
  });
}

/** Updates a policy. */
function apiPolicyUpdate(payload) {
  return policyApiExecute_('update', function () {
    var request = policyNormalizeRequest_(payload);
    var policyId = policyRequireText_(
      request.policyId,
      'policyId',
      'Policy ID is required.'
    );
    var data = policyRequireDataObject_(
      request.data,
      'Policy update data is required.'
    );

    if (!Object.keys(data).length) {
      throw new PolicyValidationError([
        {
          field: 'data',
          message: 'At least one policy field is required.'
        }
      ]);
    }

    return policyGetService_().update(
      policyId,
      data,
      request.actor,
      request.expectedVersion
    );
  });
}

/** Archives a policy. */
function apiPolicyArchive(payload) {
  return policyApiExecute_('archive', function () {
    var request = policyNormalizeRequest_(payload);
    var policyId = policyRequireText_(
      request.policyId,
      'policyId',
      'Policy ID is required.'
    );

    return policyGetService_().archive(
      policyId,
      request.actor,
      request.expectedVersion
    );
  });
}

/** Restores a policy. */
function apiPolicyRestore(payload) {
  return policyApiExecute_('restore', function () {
    var request = policyNormalizeRequest_(payload);
    var policyId = policyRequireText_(
      request.policyId,
      'policyId',
      'Policy ID is required.'
    );

    return policyGetService_().restore(
      policyId,
      request.actor,
      request.expectedVersion
    );
  });
}

/** Searches policies. */
function apiPolicySearch(payload) {
  return policyApiExecute_('search', function () {
    var request = policyNormalizeRequest_(payload || {});

    return policyGetService_().search({
      query: request.query,
      policyType: request.policyType,
      insurerName: request.insurerName,
      companyId: request.companyId,
      personId: request.personId,
      familyId: request.familyId,
      policyStatus: request.policyStatus,
      renewalStage: request.renewalStage,
      riskCategory: request.riskCategory,
      renewalFrom: request.renewalFrom,
      renewalTo: request.renewalTo,
      includeDeleted: policyNormalizeBoolean_(
        request.includeDeleted
      ),
      page: request.page,
      pageSize: request.pageSize
    });
  });
}

/** Returns policies linked to a company. */
function apiPolicyByCompany(payload) {
  return policyApiExecute_('findByCompanyId', function () {
    var request = policyNormalizeRequest_(payload);
    var companyId = policyRequireText_(
      request.companyId,
      'companyId',
      'Company ID is required.'
    );

    return policyGetService_().findByCompanyId(companyId, {
      includeDeleted: policyNormalizeBoolean_(
        request.includeDeleted
      )
    });
  });
}

/** Returns policies linked to a person. */
function apiPolicyByPerson(payload) {
  return policyApiExecute_('findByPersonId', function () {
    var request = policyNormalizeRequest_(payload);
    var personId = policyRequireText_(
      request.personId,
      'personId',
      'Person ID is required.'
    );

    return policyGetService_().findByPersonId(personId, {
      includeDeleted: policyNormalizeBoolean_(
        request.includeDeleted
      )
    });
  });
}

/** Returns renewals due on or before the supplied date. */
function apiPolicyRenewalsDue(payload) {
  return policyApiExecute_('findRenewalsDue', function () {
    var request = policyNormalizeRequest_(payload || {});

    policyValidateOptionalDate_(
      request.dueDate,
      'dueDate',
      'Due Date'
    );
    policyValidateOptionalDate_(
      request.fromDate,
      'fromDate',
      'From Date'
    );

    return policyGetService_().findRenewalsDue(
      request.dueDate,
      {
        fromDate: request.fromDate,
        policyStatus: request.policyStatus,
        includeDeleted: policyNormalizeBoolean_(
          request.includeDeleted
        )
      }
    );
  });
}

/** Policy module health check. */
function apiPolicyHealth() {
  return policyApiExecute_('health', function () {
    return policyGetService_().getHealth();
  });
}

/** Factory kept separate to support test substitution. */
function policyGetService_() {
  return new PolicyService();
}

/** Normalizes an Apps Script API payload. */
function policyNormalizeRequest_(payload) {
  if (payload === null || payload === undefined) {
    return {};
  }

  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch (error) {
      throw new PolicyValidationError([
        {
          field: 'request',
          message: 'Request JSON is invalid.'
        }
      ]);
    }
  }

  if (
    typeof payload !== 'object' ||
    Array.isArray(payload)
  ) {
    throw new PolicyValidationError([
      {
        field: 'request',
        message: 'Request must be an object.'
      }
    ]);
  }

  return payload;
}

/** Validates and returns a trimmed required text value. */
function policyRequireText_(value, field, message) {
  var normalized = String(value || '').trim();

  if (!normalized) {
    throw new PolicyValidationError([
      {
        field: field,
        message: message
      }
    ]);
  }

  return normalized;
}

/** Validates a data object. */
function policyRequireDataObject_(value, message) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    throw new PolicyValidationError([
      {
        field: 'data',
        message: message
      }
    ]);
  }

  return value;
}

/** Normalizes booleans received from HTML forms or JSON. */
function policyNormalizeBoolean_(value) {
  if (value === true || value === false) {
    return value;
  }

  if (value === null || value === undefined) {
    return false;
  }

  var normalized = String(value).trim().toLowerCase();

  if (
    normalized === 'true' ||
    normalized === '1' ||
    normalized === 'yes'
  ) {
    return true;
  }

  if (
    normalized === 'false' ||
    normalized === '0' ||
    normalized === 'no' ||
    normalized === ''
  ) {
    return false;
  }

  return Boolean(value);
}

/** Validates an optional date without silently replacing invalid input. */
function policyValidateOptionalDate_(value, field, label) {
  if (value === null || value === undefined || value === '') {
    return;
  }

  var date = value instanceof Date ? value : new Date(value);

  if (isNaN(date.getTime())) {
    throw new PolicyValidationError([
      {
        field: field,
        message: label + ' is not a valid date.'
      }
    ]);
  }
}

/** Standard API response wrapper. */
function policyApiExecute_(operation, callback) {
  var requestId = Utilities.getUuid();
  var startedAt = new Date().getTime();
  var logger = policyCreateLogger_(requestId, operation);

  try {
    var result = callback();
    var durationMs = new Date().getTime() - startedAt;

    if (logger) {
      logger.info('Policy API request completed.', {
        operation: operation,
        durationMs: durationMs,
        success: true
      });
    }

    return {
      success: true,
      data: result,
      error: null,
      meta: policyBuildMeta_(requestId, durationMs)
    };
  } catch (error) {
    var durationMs = new Date().getTime() - startedAt;

    if (logger) {
      logger.exception(
        error,
        {
          operation: operation,
          durationMs: durationMs,
          success: false
        },
        'Policy API request failed.'
      );
    }

    return {
      success: false,
      data: null,
      error: policyFormatError_(error),
      meta: policyBuildMeta_(requestId, durationMs)
    };
  }
}

/** Creates a logger using the repository's existing logging framework. */
function policyCreateLogger_(requestId, operation) {
  try {
    if (
      typeof JSKLoggerFactory !== 'undefined' &&
      typeof JSKLoggerFactory.createConsoleLogger === 'function'
    ) {
      return JSKLoggerFactory.createConsoleLogger(
        JSK_POLICY_BACKEND_MODULE,
        {
          requestId: requestId,
          user: policyGetCurrentUser_(),
          defaultContext: {
            module: JSK_POLICY_BACKEND_MODULE,
            operation: operation
          }
        }
      );
    }
  } catch (error) {
    // Logging must never interrupt the API.
  }

  return null;
}

/** Returns the current Apps Script user when available. */
function policyGetCurrentUser_() {
  try {
    if (
      typeof JSKOS !== 'undefined' &&
      JSKOS.ConfigService &&
      typeof JSKOS.ConfigService.getCurrentUser === 'function'
    ) {
      return JSKOS.ConfigService.getCurrentUser();
    }

    return Session.getActiveUser().getEmail() || 'SYSTEM';
  } catch (error) {
    return 'SYSTEM';
  }
}

/** Builds stable response metadata. */
function policyBuildMeta_(requestId, durationMs) {
  return {
    requestId: requestId,
    version: JSK_POLICY_BACKEND_VERSION,
    timestamp: new Date().toISOString(),
    durationMs: Number(durationMs) || 0
  };
}

/** Converts repository errors into a safe public API representation. */
function policyFormatError_(error) {
  var code = error && error.code
    ? String(error.code)
    : 'INTERNAL_ERROR';
  var knownCodes = {
    VALIDATION_ERROR: true,
    POLICY_NOT_FOUND: true,
    DUPLICATE_POLICY: true,
    VERSION_CONFLICT: true
  };
  var isKnown = Boolean(knownCodes[code]);

  return {
    code: code,
    message: isKnown && error && error.message
      ? error.message
      : 'An unexpected Policy API error occurred.',
    status: isKnown
      ? Number(error && error.status) || 500
      : 500,
    fields: error && Array.isArray(error.errors)
      ? error.errors
      : [],
    policyId: error && error.policyId
      ? error.policyId
      : null,
    duplicatePolicyId:
      error && error.duplicatePolicyId
        ? error.duplicatePolicyId
        : null,
    currentVersion:
      error && error.currentVersion !== undefined
        ? error.currentVersion
        : null
  };
}
