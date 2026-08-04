/** JSK OS Build 1012 - Reports and Analytics foundation. */
var JSK_REPORT_SCHEMA = Object.freeze({
  VERSION: 1,
  BUILD: 1012
});

function reportApi_(callback) {
  try {
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
  if (Array.isArray(data.items)) return data.items.length;
  throw new Error(moduleName + ' report source has no total.');
}

/**
 * Consolidated, read-only management summary across operational modules.
 * @return {Object}
 */
function apiReportExecutiveSummary() {
  return reportApi_(function () {
    var revenue = reportData_(apiRevenueSummary(), 'Revenue');
    var endorsements = reportData_(apiEndorsementSummary(), 'Endorsement');
    var documentExpiry = reportData_(
      apiDocumentExpirySummary(),
      'Document'
    );
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
  });
}

function getReportFilters() {
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
