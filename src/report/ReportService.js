/** JSK OS Build 1012 - Reports and Analytics foundation. */
var JSK_REPORT_SCHEMA = Object.freeze({
  VERSION: 1,
  BUILD: 1012
});

function reportApi_(callback) {
  try {
    JSKOS.AccessControl.requireModuleOperation('reports', 'view');
    return {
      success: true,
      data: JSON.parse(JSON.stringify(callback())),
      error: null,
      meta: {
        build: JSK_REPORT_SCHEMA.BUILD,
        schemaVersion: JSK_REPORT_SCHEMA.VERSION,
        generatedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: { message: error.message || String(error) },
      meta: {
        build: JSK_REPORT_SCHEMA.BUILD,
        schemaVersion: JSK_REPORT_SCHEMA.VERSION
      }
    };
  }
}

function reportData_(response, moduleName) {
  if (!response || response.success !== true) {
    var message = response && response.error
      ? response.error.message
      : 'No response';
    throw new Error(moduleName + ' report source failed: ' + message);
  }
  return response.data || {};
}

function reportTotal_(response, moduleName) {
  var data = reportData_(response, moduleName);
  if (typeof data.total === 'number') return data.total;
  if (
    data.pagination &&
    typeof data.pagination.totalItems === 'number'
  ) {
    return data.pagination.totalItems;
  }
  if (typeof data.totalCount === 'number') return data.totalCount;
  if (Array.isArray(data.items)) return data.items.length;
  if (Array.isArray(data.records)) return data.records.length;
  throw new Error(moduleName + ' report source has no total.');
}

/**
 * Consolidated, read-only management summary across operational modules.
 * @return {Object}
 */
function apiReportExecutiveSummary() {
  return reportApi_(reportExecutiveSummaryFromApis_);
}

function reportExecutiveSummaryFromApis_() {
  var revenue = reportData_(apiRevenueSummary(), 'Revenue');
  var endorsements = reportData_(apiEndorsementSummary(), 'Endorsement');
  var documentExpiry = reportData_(apiDocumentExpirySummary(), 'Document');
  var quoteExpiry = reportData_(apiQuoteExpirySummary(), 'Quote');
  return {
    clients: {
      companies: reportTotal_(apiCompanySearch({ pageSize: 1 }), 'Company'),
      people: reportTotal_(apiPeopleSearch({ pageSize: 1 }), 'People')
    },
    business: {
      policies: reportTotal_(apiPolicySearch({ pageSize: 1 }), 'Policy'),
      claims: reportTotal_(apiClaimSearch({ pageSize: 1 }), 'Claim'),
      quotes: reportTotal_(apiQuoteSearch({}), 'Quote'),
      endorsementsOpen: Number(endorsements.totalOpen || 0)
    },
    servicing: {
      documents: reportTotal_(apiDocumentSearch({}), 'Document'),
      documentsExpired: Number(documentExpiry.expired || 0),
      endorsementsOverdue: Number(endorsements.overdue || 0),
      quotesExpiring7Days: Number(quoteExpiry.due7 || 0)
    },
    finance: {
      expected: Number(revenue.expected || 0),
      received: Number(revenue.received || 0),
      outstanding: Number(revenue.outstanding || 0),
      overdue: Number(revenue.overdue || 0)
    }
  };
}

function reportExecutiveSummaryTrusted_() {
  requireCompanySchema_();
  requirePeopleSchema_();
  requirePolicySchema_();
  requireBuild1007Claims_();
  requireBuild1008Documents_();
  requireBuild1009Endorsements_();
  requireBuild1010Quotes_();
  requireBuild1011Revenue_();

  function items_(repository, criteria) {
    var result = repository.search(criteria || {});
    return result && Array.isArray(result.items) ? result.items : [];
  }
  function count_(repository) {
    var result = repository.search({ page: 1, pageSize: 1 });
    if (result && typeof result.total === 'number') return result.total;
    if (result && typeof result.totalItems === 'number') return result.totalItems;
    if (result && result.pagination && typeof result.pagination.totalItems === 'number') {
      return result.pagination.totalItems;
    }
    return result && Array.isArray(result.items) ? result.items.length : 0;
  }
  function day_(value) {
    if (!value) return null;
    var date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (isNaN(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    return date;
  }

  var today = day_(new Date());
  var endorsements = items_(new EndorsementRepository());
  var documents = items_(new DocumentRepository());
  var documentExpiry = JSKOS.DocumentAutomation.summarize(
    documents,
    today
  );
  var quotes = items_(new QuoteRepository());
  var revenues = items_(new RevenueRepository({ readOnly: true }));
  var openEndorsements = endorsements.filter(function (item) {
    return ['Completed', 'Rejected', 'Cancelled'].indexOf(item.status) === -1;
  });
  var overdueEndorsements = openEndorsements.filter(function (item) {
    var due = day_(item.nextActionDate || item.slaDueDate);
    return due && due < today;
  });
  var expiringQuotes = quotes.filter(function (item) {
    var expiry = day_(item.expiryDate);
    if (!expiry || ['Converted', 'Rejected'].indexOf(item.status) !== -1) return false;
    var days = Math.floor((expiry.getTime() - today.getTime()) / 86400000);
    return days >= 0 && days <= 7;
  });
  var expected = 0;
  var received = 0;
  var outstanding = 0;
  var overdue = 0;
  revenues.forEach(function (item) {
    expected += Number(item.netReceivable || 0);
    received += Number(item.amountReceived || 0);
    outstanding += Number(item.outstandingAmount || 0);
    if (item.paymentStatus === 'Overdue') overdue += 1;
  });

  return {
    clients: {
      companies: count_(new CompanyRepository()),
      people: count_(new PeopleRepository())
    },
    business: {
      policies: count_(new PolicyRepository()),
      claims: count_(new ClaimRepository()),
      quotes: quotes.length,
      endorsementsOpen: openEndorsements.length
    },
    servicing: {
      documents: documents.length,
      documentsExpired: Number(documentExpiry.expired || 0),
      endorsementsOverdue: overdueEndorsements.length,
      quotesExpiring7Days: expiringQuotes.length
    },
    finance: {
      expected: expected,
      received: received,
      outstanding: outstanding,
      overdue: overdue
    }
  };
}

function getReportFilters() {
  JSKOS.AccessControl.requireModuleOperation('reports', 'filters');
  return {
    periods: ['Today', 'This Week', 'This Month', 'This Quarter', 'This Year'],
    modules: [
      'Clients',
      'Policies',
      'Claims',
      'Documents',
      'Endorsements',
      'Quotes',
      'Revenue'
    ]
  };
}
