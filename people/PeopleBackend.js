/**
 * JSK OS
 * Module: People Backend
 * Version: 1.1.1
 *
 * Service and CRUD API layer for People CRM.
 * Google Apps Script V8 compatible.
 */

/**
 * People service layer.
 */
class PeopleService {
  /**
   * @param {PeopleRepository=} repository Repository instance.
   */
  constructor(repository) {
    this.repository = repository || new PeopleRepository();
  }

  /**
   * @param {Object} payload Person data.
   * @param {string=} actor Actor.
   * @return {Object}
   */
  create(payload, actor) {
    return this.repository.create(payload, actor);
  }

  /**
   * @param {string} personId Person ID.
   * @return {Object}
   */
  get(personId) {
    var person = this.repository.findById(personId);

    if (!person) {
      throw new PeopleNotFoundError(personId);
    }

    return person;
  }

  /**
   * @param {string} personId Person ID.
   * @param {Object} payload Changes.
   * @param {string=} actor Actor.
   * @return {Object}
   */
  update(personId, payload, actor) {
    return this.repository.update(personId, payload, actor);
  }

  /**
   * @param {string} personId Person ID.
   * @param {string=} actor Actor.
   * @return {Object}
   */
  archive(personId, actor) {
    return this.repository.archive(personId, actor);
  }

  /**
   * @param {string} personId Person ID.
   * @param {string=} actor Actor.
   * @return {Object}
   */
  restore(personId, actor) {
    return this.repository.restore(personId, actor);
  }

  /**
   * @param {Object=} criteria Search criteria.
   * @return {Object}
   */
  search(criteria) {
    return this.repository.search(criteria || {});
  }

  /**
   * @param {string} companyId Company ID.
   * @param {boolean=} includeArchived Include archived.
   * @return {Object[]}
   */
  findByCompanyId(companyId, includeArchived) {
    return this.repository.findByCompanyId(
      companyId,
      Boolean(includeArchived)
    );
  }

  /**
   * @param {Date|string=} dueDate Due date.
   * @return {Object[]}
   */
  findFollowupsDue(dueDate) {
    return this.repository.findFollowupsDue(dueDate);
  }
}

/**
 * Creates a person.
 *
 * Request:
 * {
 *   data: {...},
 *   actor: "..."
 * }
 *
 * @param {Object|string} payload Request payload.
 * @return {Object}
 */
function apiPeopleCreate(payload) {
  return peopleApiExecute_(function () {
    var request = peopleNormalizeRequest_(payload);

    return new PeopleService().create(
      request.data || {},
      request.actor
    );
  });
}

/**
 * Gets a person by ID.
 *
 * @param {Object|string} payload Request payload.
 * @return {Object}
 */
function apiPeopleGet(payload) {
  return peopleApiExecute_(function () {
    var request = peopleNormalizeRequest_(payload);

    peopleRequireText_(
      request.personId,
      'personId',
      'Person ID is required.'
    );

    return new PeopleService().get(request.personId);
  });
}

/**
 * Updates a person.
 *
 * @param {Object|string} payload Request payload.
 * @return {Object}
 */
function apiPeopleUpdate(payload) {
  return peopleApiExecute_(function () {
    var request = peopleNormalizeRequest_(payload);

    peopleRequireText_(
      request.personId,
      'personId',
      'Person ID is required.'
    );

    return new PeopleService().update(
      request.personId,
      request.data || {},
      request.actor
    );
  });
}

/**
 * Archives a person.
 *
 * @param {Object|string} payload Request payload.
 * @return {Object}
 */
function apiPeopleArchive(payload) {
  return peopleApiExecute_(function () {
    var request = peopleNormalizeRequest_(payload);

    peopleRequireText_(
      request.personId,
      'personId',
      'Person ID is required.'
    );

    return new PeopleService().archive(
      request.personId,
      request.actor
    );
  });
}

/**
 * Restores a person.
 *
 * @param {Object|string} payload Request payload.
 * @return {Object}
 */
function apiPeopleRestore(payload) {
  return peopleApiExecute_(function () {
    var request = peopleNormalizeRequest_(payload);

    peopleRequireText_(
      request.personId,
      'personId',
      'Person ID is required.'
    );

    return new PeopleService().restore(
      request.personId,
      request.actor
    );
  });
}

/**
 * Searches People records.
 *
 * @param {Object|string=} payload Search criteria.
 * @return {Object}
 */
function apiPeopleSearch(payload) {
  return peopleApiExecute_(function () {
    var request = peopleNormalizeRequest_(payload || {});

    return new PeopleService().search({
      query: request.query,
      companyId: request.companyId,
      familyId: request.familyId,
      area: request.area,
      zone: request.zone,
      leadSource: request.leadSource,
      status: request.status,
      priority: request.priority,
      designation: request.designation,
      includeArchived: Boolean(request.includeArchived),
      page: request.page,
      pageSize: request.pageSize
    });
  });
}

/**
 * Returns people linked to a company.
 *
 * @param {Object|string} payload Request payload.
 * @return {Object}
 */
function apiPeopleByCompany(payload) {
  return peopleApiExecute_(function () {
    var request = peopleNormalizeRequest_(payload);

    peopleRequireText_(
      request.companyId,
      'companyId',
      'Company ID is required.'
    );

    return new PeopleService().findByCompanyId(
      request.companyId,
      request.includeArchived
    );
  });
}

/**
 * Returns follow-ups due on or before a date.
 *
 * @param {Object|string=} payload Request payload.
 * @return {Object}
 */
function apiPeopleFollowupsDue(payload) {
  return peopleApiExecute_(function () {
    var request = peopleNormalizeRequest_(payload || {});

    return new PeopleService().findFollowupsDue(
      request.dueDate
    );
  });
}

/**
 * Health check.
 *
 * @return {Object}
 */
function apiPeopleHealth() {
  return peopleApiExecute_(function () {
    var repository = new PeopleRepository();

    return {
      module: 'People CRM',
      version: '1.1.1',
      sheetName: JSK_PEOPLE_CONFIG.SHEET_NAME,
      activeRecords: repository.count({
        includeArchived: false
      }),
      totalRecords: repository.count({
        includeArchived: true
      }),
      timestamp: new Date().toISOString()
    };
  });
}

/**
 * Normalizes API request.
 *
 * @private
 * @param {*} payload Request.
 * @return {Object}
 */
function peopleNormalizeRequest_(payload) {
  if (payload === null || payload === undefined) {
    return {};
  }

  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload);
    } catch (error) {
      throw new PeopleValidationError([
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
    throw new PeopleValidationError([
      {
        field: 'request',
        message: 'Request must be an object.'
      }
    ]);
  }

  return payload;
}

/**
 * Validates required text.
 *
 * @private
 * @param {*} value Value.
 * @param {string} field Field.
 * @param {string} message Message.
 * @return {void}
 */
function peopleRequireText_(value, field, message) {
  if (!String(value || '').trim()) {
    throw new PeopleValidationError([
      {
        field: field,
        message: message
      }
    ]);
  }
}

/**
 * Standard API execution wrapper.
 *
 * @private
 * @param {Function} callback Callback.
 * @return {Object}
 */
function peopleApiExecute_(callback) {
  var requestId = Utilities.getUuid();

  try {
    return {
      success: true,
      data: callback(),
      error: null,
      meta: {
        requestId: requestId,
        version: '1.1.1',
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error(
      JSON.stringify({
        module: 'People CRM',
        requestId: requestId,
        error: error && error.stack
          ? error.stack
          : String(error)
      })
    );

    return {
      success: false,
      data: null,
      error: peopleFormatError_(error),
      meta: {
        requestId: requestId,
        version: '1.1.1',
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Formats errors for API consumers.
 *
 * @private
 * @param {Error} error Error.
 * @return {Object}
 */
function peopleFormatError_(error) {
  return {
    code: error && error.code
      ? error.code
      : 'INTERNAL_ERROR',

    message: error && error.message
      ? error.message
      : 'An unexpected People API error occurred.',

    status: Number(error && error.status) || 500,

    fields: error && Array.isArray(error.errors)
      ? error.errors
      : [],

    personId: error && error.personId
      ? error.personId
      : null,

    duplicatePersonId:
      error && error.duplicatePersonId
        ? error.duplicatePersonId
        : null
  };
}
