
  /**
 * JSK OS v0.7.3
 * CompanySearchApi.js
 *
 * Dedicated search and lookup APIs.
 */


/**
 * General company search.
 *
 * Request:
 * {
 *   query: "builder",
 *   industry: "Construction",
 *   status: "Prospect",
 *   area: "Kothrud",
 *   zone: "West",
 *   riskCategory: "High",
 *   includeDeleted: false,
 *   page: 1,
 *   pageSize: 25
 * }
 */
function searchCompanies(payload) {
  return apiCompanySearch(payload || {});
}


/**
 * Exact Company ID lookup.
 */
function searchCompanyById(companyId) {
  return apiCompanyGet({
    companyId: companyId,
    includeDeleted: false
  });
}


/**
 * GSTIN lookup.
 */
function searchCompanyByGstin(gstin) {
  return companyApiExecute_(function () {
    var normalizedGstin = String(
      gstin || ''
    )
      .replace(/\s+/g, '')
      .toUpperCase();

    if (!normalizedGstin) {
      throw new CompanyValidationError([
        {
          field: 'gstin',
          message: 'GSTIN is required.'
        }
      ]);
    }

    var result =
      new CompanyRepository().search({
        query: normalizedGstin,
        includeDeleted: false,
        page: 1,
        pageSize: 10
      });

    var exactMatches = result.items.filter(
      function (company) {
        return (
          String(company.gstin || '')
            .toUpperCase() ===
          normalizedGstin
        );
      }
    );

    return {
      items: exactMatches,
      found: exactMatches.length > 0
    };
  });
}


/**
 * Autocomplete search.
 *
 * Returns small records suitable for dropdowns.
 */
function searchCompanySuggestions(payload) {
  return companyApiExecute_(function () {
    payload = companyNormalizeRequest_(
      payload || {}
    );

    var query = String(
      payload.query || ''
    ).trim();

    if (query.length < 2) {
      return [];
    }

    var result =
      new CompanyRepository().search({
        query: query,
        includeDeleted: false,
        page: 1,
        pageSize: Math.min(
          20,
          Math.max(
            1,
            Number(payload.limit) || 10
          )
        )
      });

    return result.items.map(function (
      company
    ) {
      return {
        companyId: company.companyId,
        companyName: company.companyName,
        industry: company.industry,
        area: company.area,
        status: company.status,
        label:
          company.companyName +
          (company.area
            ? ' — ' + company.area
            : '')
      };
    });
  });
}


/**
 * Returns distinct filter values from active records.
 */
function getCompanySearchFilters() {
  return companyApiExecute_(function () {
    var result =
      new CompanyRepository().search({
        includeDeleted: false,
        page: 1,
        pageSize: 100
      });

    var allItems = result.items.slice();
    var page = 2;

    while (page <= result.pagination.totalPages) {
      var nextResult =
        new CompanyRepository().search({
          includeDeleted: false,
          page: page,
          pageSize: 100
        });

      allItems = allItems.concat(
        nextResult.items
      );

      page++;
    }

    return {
      industries: companyUniqueSorted_(
        allItems.map(function (item) {
          return item.industry;
        })
      ),

      areas: companyUniqueSorted_(
        allItems.map(function (item) {
          return item.area;
        })
      ),

      zones: companyUniqueSorted_(
        allItems.map(function (item) {
          return item.zone;
        })
      ),

      statuses: companyUniqueSorted_(
        allItems.map(function (item) {
          return item.status;
        })
      ),

      riskCategories:
        companyUniqueSorted_(
          allItems.map(function (item) {
            return item.riskCategory;
          })
        )
    };
  });
}


function companyUniqueSorted_(values) {
  var uniqueMap = {};

  values.forEach(function (value) {
    var normalized = String(
      value || ''
    ).trim();

    if (normalized) {
      uniqueMap[normalized.toLowerCase()] =
        normalized;
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

