/**
 * JSK OS
 * Module: People Backend Tests
 * Version: 1.1.1
 */

/**
 * Runs non-destructive People backend tests.
 *
 * @return {Object}
 */
function testPeopleBackend() {
  var health = apiPeopleHealth();

  assertPeopleBackendTest_(
    health.success === true,
    'Health check must succeed.'
  );

  assertPeopleBackendTest_(
    health.data &&
    health.data.module === 'People CRM',
    'Health check module is invalid.'
  );

  var search = apiPeopleSearch({
    page: 1,
    pageSize: 5,
    includeArchived: true
  });

  assertPeopleBackendTest_(
    search.success === true,
    'Search must succeed.'
  );

  assertPeopleBackendTest_(
    Array.isArray(search.data.items),
    'Search items must be an array.'
  );

  assertPeopleBackendTest_(
    Boolean(search.data.pagination),
    'Search pagination is required.'
  );

  var invalidGet = apiPeopleGet({});

  assertPeopleBackendTest_(
    invalidGet.success === false,
    'Invalid get must fail.'
  );

  assertPeopleBackendTest_(
    invalidGet.error.code ===
      'VALIDATION_ERROR',
    'Invalid get must return VALIDATION_ERROR.'
  );

  var result = {
    success: true,
    message: 'People backend tests passed.',
    totalRecords: health.data.totalRecords,
    returnedItems: search.data.items.length,
    timestamp: new Date().toISOString()
  };

  console.info(JSON.stringify(result));

  return result;
}

/**
 * @private
 * @param {boolean} condition Condition.
 * @param {string} message Failure message.
 * @return {void}
 */
function assertPeopleBackendTest_(
  condition,
  message
) {
  if (!condition) {
    throw new Error(
      'People Backend Test Failed: ' + message
    );
  }
}
/**
 * Tests people linked to an existing company.
 *
 * @return {Object}
 */
function testPeopleByCompanyLink() {
  var companyId = 'COM-20260727120222-D22EBA';

  var response = apiPeopleByCompany({
    companyId: companyId,
    includeArchived: false
  });

  if (!response || response.success !== true) {
    throw new Error(
      'Company-People link API test failed.'
    );
  }

  var people = Array.isArray(response.data)
    ? response.data
    : [];

  var result = {
    success: true,
    message: 'Company-People link API passed.',
    companyId: companyId,
    peopleCount: people.length,
    people: people,
    timestamp: new Date().toISOString()
  };

  console.info(JSON.stringify(result));

  return result;
}