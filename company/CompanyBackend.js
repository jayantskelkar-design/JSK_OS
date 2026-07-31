
  /**
 * JSK OS v0.7.3
 * CompanyBackend.js
 *
 * Service and CRUD backend.
 * These functions can be called directly using google.script.run.
 */


class CompanyService {
  constructor(repository) {
    this.repository =
      repository || new CompanyRepository();
  }

  create(payload, actor) {
    return this.repository.create(payload, actor);
  }

  get(companyId, options) {
    var company = this.repository.findById(
      companyId,
      options || {}
    );

    if (!company) {
      throw new CompanyNotFoundError(companyId);
    }

    return company;
  }

  update(companyId, payload, actor, expectedVersion) {
    return this.repository.update(
      companyId,
      payload,
      actor,
      expectedVersion
    );
  }

  archive(companyId, actor, expectedVersion) {
    return this.repository.archive(
      companyId,
      actor,
      expectedVersion
    );
  }

  restore(companyId, actor) {
    return this.repository.restore(companyId, actor);
  }

  search(criteria) {
    return this.repository.search(criteria || {});
  }
}


/**
 * CREATE
 *
 * Frontend:
 * google.script.run
 *   .withSuccessHandler(console.log)
 *   .apiCompanyCreate(payload);
 */
function apiCompanyCreate(payload) {
  return companyApiExecute_(function () {
    var request = companyNormalizeRequest_(payload);
console.log("API GET REQUEST");
console.log(JSON.stringify(request));
    return new CompanyService().create(
      request.data,
      request.actor
    );
  });
}


/**
 * READ
 */
function apiCompanyGet(payload) {
  return companyApiExecute_(function () {
    var request = companyNormalizeRequest_(payload);

    return new CompanyService().get(
      request.companyId,
      {
        includeDeleted: Boolean(request.includeDeleted)
      }
    );
  });
}


/**
 * UPDATE
 */
function apiCompanyUpdate(payload) {
  return companyApiExecute_(function () {
    var request = companyNormalizeRequest_(payload);

    return new CompanyService().update(
      request.companyId,
      request.data,
      request.actor,
      request.expectedVersion
    );
  });
}


/**
 * ARCHIVE / SOFT DELETE
 */
function apiCompanyArchive(payload) {
  return companyApiExecute_(function () {
    var request = companyNormalizeRequest_(payload);

    return new CompanyService().archive(
      request.companyId,
      request.actor,
      request.expectedVersion
    );
  });
}


/**
 * RESTORE
 */
function apiCompanyRestore(payload) {
  return companyApiExecute_(function () {
    var request = companyNormalizeRequest_(payload);

    return new CompanyService().restore(
      request.companyId,
      request.actor
    );
  });
}


/**
 * SEARCH
 */
function apiCompanySearch(payload) {
  return companyApiExecute_(function () {
    var request = companyNormalizeRequest_(payload);

    return new CompanyService().search({
      query: request.query,
      status: request.status,
      industry: request.industry,
      area: request.area,
      zone: request.zone,
      riskCategory: request.riskCategory,
      includeDeleted: request.includeDeleted,
      page: request.page,
      pageSize: request.pageSize
    });
  });
}


/**
 * Lightweight API health check.
 */
function apiCompanyHealth() {
  return companyApiExecute_(function () {
    var repository = new CompanyRepository();

    return {
      module: 'Company CRM',
      version: '0.7.3',
      sheetName: JSK_COMPANY_CONFIG.SHEET_NAME,
      headerRow: repository.headerRow,
      activeRecords: repository.count({
        includeDeleted: false
      }),
      totalRecords: repository.count({
        includeDeleted: true
      }),
      timestamp: new Date().toISOString()
    };
  });
}


/**
 * Converts frontend request into a safe object.
 */
function companyNormalizeRequest_(payload) {
  if (payload === null || payload === undefined) {
    return {};
  }

  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload);
    } catch (error) {
      throw new CompanyValidationError([
        {
          field: 'request',
          message: 'Request JSON is invalid.'
        }
      ]);
    }
  }

  if (typeof payload !== 'object') {
    throw new CompanyValidationError([
      {
        field: 'request',
        message: 'Request must be an object.'
      }
    ]);
  }

  return payload;
}


/**
 * Standard API response envelope.
 */
function companyApiExecute_(callback) {
  try {
    var result = callback();

    return {
      success: true,
      data: result,
      error: null,
      meta: {
        version: '0.7.3',
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error(
      'Company API Error',
      error && error.stack ? error.stack : error
    );

    return {
      success: false,
      data: null,
      error: companyFormatError_(error),
      meta: {
        version: '0.7.3',
        timestamp: new Date().toISOString()
      }
    };
  }
}


function companyFormatError_(error) {
  return {
    code: error.code || 'INTERNAL_ERROR',
    message:
      error.message || 'An unexpected company API error occurred.',
    status: Number(error.status) || 500,
    fields: error.errors || [],
    companyId: error.companyId || null,
    duplicateCompanyId:
      error.duplicateCompanyId || null,
    currentVersion:
      error.currentVersion === undefined
        ? null
        : error.currentVersion
  };
}
