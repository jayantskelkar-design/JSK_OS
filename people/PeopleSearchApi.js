/**
 * JSK OS
 * Module: People Search API
 * Version: 1.1.1
 */

/**
 * General People search alias.
 *
 * @param {Object|string=} payload Search criteria.
 * @return {Object}
 */
function searchPeople(payload) {
  return apiPeopleSearch(payload || {});
}

/**
 * Exact Person ID lookup.
 *
 * @param {string} personId Person ID.
 * @return {Object}
 */
function searchPersonById(personId) {
  return apiPeopleGet({
    personId: personId
  });
}

/**
 * People autocomplete.
 *
 * @param {Object|string=} payload Request.
 * @return {Object}
 */
function searchPeopleSuggestions(payload) {
  return peopleApiExecute_(function () {
    var request = peopleNormalizeRequest_(payload || {});
    var query = String(request.query || '').trim();

    if (query.length < 2) {
      return [];
    }

    var result = new PeopleRepository().search({
      query: query,
      includeArchived: false,
      page: 1,
      pageSize: Math.min(
        20,
        Math.max(1, Number(request.limit) || 10)
      )
    });

    return result.items.map(function (person) {
      return {
        personId: person.personId,
        fullName: person.fullName,
        mobile: person.mobile,
        designation: person.designation,
        companyId: person.companyId,
        status: person.status,
        label:
          person.fullName +
          (person.designation
            ? ' — ' + person.designation
            : '')
      };
    });
  });
}

/**
 * Distinct filter values.
 *
 * @return {Object}
 */
function getPeopleSearchFilters() {
  return peopleApiExecute_(function () {
    var repository = new PeopleRepository();
    var firstPage = repository.search({
      includeArchived: false,
      page: 1,
      pageSize: 100
    });

    var items = firstPage.items.slice();
    var page = 2;

    while (
      page <= firstPage.pagination.totalPages
    ) {
      var result = repository.search({
        includeArchived: false,
        page: page,
        pageSize: 100
      });

      items = items.concat(result.items);
      page += 1;
    }

    return {
      areas: peopleUniqueSorted_(
        items.map(function (item) {
          return item.area;
        })
      ),
      zones: peopleUniqueSorted_(
        items.map(function (item) {
          return item.zone;
        })
      ),
      statuses: peopleUniqueSorted_(
        items.map(function (item) {
          return item.status;
        })
      ),
      priorities: peopleUniqueSorted_(
        items.map(function (item) {
          return item.priority;
        })
      ),
      designations: peopleUniqueSorted_(
        items.map(function (item) {
          return item.designation;
        })
      ),
      leadSources: peopleUniqueSorted_(
        items.map(function (item) {
          return item.leadSource;
        })
      )
    };
  });
}

/**
 * Returns distinct sorted strings.
 *
 * @private
 * @param {Array<*>} values Values.
 * @return {string[]}
 */
function peopleUniqueSorted_(values) {
  var map = {};

  values.forEach(function (value) {
    var normalized = String(value || '').trim();

    if (normalized) {
      map[normalized.toLowerCase()] = normalized;
    }
  });

  return Object.keys(map)
    .map(function (key) {
      return map[key];
    })
    .sort(function (left, right) {
      return left.localeCompare(right);
    });
}
