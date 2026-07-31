/**
 * JSK OS
 * Module: Universal Search
 * Version: 0.9.3
 */

/**
 * Searches Companies and People using one query.
 *
 * @param {Object|string=} payload Search request.
 * @return {Object}
 */
function apiUniversalSearch(payload) {
  try {
    var request = normalizeUniversalSearchRequest_(payload);
    var query = String(request.query || '').trim();

    if (query.length < 2) {
      return {
        success: true,
        data: {
          query: query,
          companies: [],
          people: [],
          totalResults: 0
        },
        error: null,
        meta: {
          version: '0.9.3',
          timestamp: new Date().toISOString()
        }
      };
    }

    var limit = Math.min(
      20,
      Math.max(1, Number(request.limit) || 8)
    );

    var companyResponse = searchCompanies({
      query: query,
      includeDeleted: false,
      page: 1,
      pageSize: limit
    });

    var peopleResponse = searchPeople({
      query: query,
      includeArchived: false,
      page: 1,
      pageSize: limit
    });

    var companies = extractUniversalItems_(
      companyResponse
    );

    var people = extractUniversalItems_(
      peopleResponse
    );

    return {
      success: true,
      data: {
        query: query,
        companies: companies,
        people: people,
        totalResults:
          companies.length + people.length
      },
      error: null,
      meta: {
        version: '0.9.3',
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error(
      'Universal Search Error',
      error && error.stack
        ? error.stack
        : error
    );

    return {
      success: false,
      data: null,
      error: {
        code: 'UNIVERSAL_SEARCH_ERROR',
        message:
          error && error.message
            ? error.message
            : 'Universal search failed.'
      },
      meta: {
        version: '0.9.3',
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Normalizes search request.
 *
 * @private
 * @param {*} payload Request.
 * @return {Object}
 */
function normalizeUniversalSearchRequest_(payload) {
  if (payload === null || payload === undefined) {
    return {};
  }

  if (typeof payload === 'string') {
    return {
      query: payload
    };
  }

  if (
    typeof payload !== 'object' ||
    Array.isArray(payload)
  ) {
    throw new Error(
      'Universal search request must be an object or text.'
    );
  }

  return payload;
}

/**
 * Extracts repository items from an API response.
 *
 * @private
 * @param {Object} response API response.
 * @return {Object[]}
 */
function extractUniversalItems_(response) {
  if (
    !response ||
    response.success !== true ||
    !response.data
  ) {
    return [];
  }

  if (Array.isArray(response.data.items)) {
    return response.data.items;
  }

  if (
    response.data.data &&
    Array.isArray(response.data.data.items)
  ) {
    return response.data.data.items;
  }

  return [];
}

/**
 * Tests Universal Search backend.
 *
 * @return {Object}
 */
function testUniversalSearch() {
  var response = apiUniversalSearch({
    query: 'Jayant',
    limit: 10
  });

  if (!response || response.success !== true) {
    throw new Error(
      'Universal Search test failed.'
    );
  }

  if (!response.data) {
    throw new Error(
      'Universal Search returned no data.'
    );
  }

  if (!Array.isArray(response.data.companies)) {
    throw new Error(
      'Company search results are invalid.'
    );
  }

  if (!Array.isArray(response.data.people)) {
    throw new Error(
      'People search results are invalid.'
    );
  }

  var result = {
    success: true,
    message: 'Universal Search backend passed.',
    query: response.data.query,
    companyResults:
      response.data.companies.length,
    peopleResults:
      response.data.people.length,
    totalResults:
      response.data.totalResults,
    timestamp: new Date().toISOString()
  };

  console.info(JSON.stringify(result));

  return result;
}