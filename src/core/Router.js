/**
 * JSK OS Stable Router
 * Version: 1.0.3
 */
var JSKOS = JSKOS || {};

JSKOS.RouteConfig = Object.freeze({
  DEFAULT_ROUTE: 'dashboard',
  ROUTES: Object.freeze({
    dashboard: Object.freeze({ key: 'dashboard', title: 'Dashboard', icon: '⌂', enabled: true }),
    companies: Object.freeze({ key: 'companies', title: 'Companies', icon: '▦', enabled: true }),
    people: Object.freeze({ key: 'people', title: 'People', icon: '♟', enabled: true }),
    policies: Object.freeze({ key: 'policies', title: 'Policies', icon: '▤', enabled: true }),
    claims: Object.freeze({ key: 'claims', title: 'Claims', icon: '◆', enabled: true }),
    documents: Object.freeze({ key: 'documents', title: 'Documents', icon: '▣', enabled: true }),
    endorsements: Object.freeze({ key: 'endorsements', title: 'Endorsements', icon: '↺', enabled: true }),
    quotes: Object.freeze({ key: 'quotes', title: 'Quotes', icon: '≋', enabled: true }),
    revenue: Object.freeze({ key: 'revenue', title: 'Revenue', icon: '₹', enabled: true }),
    reports: Object.freeze({ key: 'reports', title: 'Reports', icon: '#', enabled: true }),
    tasks: Object.freeze({ key: 'tasks', title: 'Tasks', icon: '✓', enabled: true }),
    meetings: Object.freeze({ key: 'meetings', title: 'Meetings', icon: '◷', enabled: true }),
    communications: Object.freeze({ key: 'communications', title: 'Communications', icon: '✉', enabled: true }),
    client360: Object.freeze({ key: 'client360', title: 'Client 360', icon: '360', enabled: true }),
    access: Object.freeze({ key: 'access', title: 'User Access', icon: '@', enabled: true })
  })
});

/**
 * Single Web App entry point.
 *
 * @param {Object=} event Google Apps Script web event.
 * @return {GoogleAppsScript.HTML.HtmlOutput}
 */
function doGet(event) {
  if (event && event.parameter && event.parameter['hub.mode']) {
    return handleMetaWhatsAppWebhookVerification(event);
  }
  var route = JSKOS.Router.resolve(event);
  if (
    JSKOS.AccessControl &&
    typeof JSKOS.AccessControl.canAccessRoute === 'function' &&
    !JSKOS.AccessControl.canAccessRoute(route)
  ) {
    return JSKOS.Router.renderAccessDenied(route);
  }
  return applyJSKOSBranding_(JSKOS.Router.render(route, event), route);
}

/**
 * Replaces the legacy text badge with the company logo on every rendered page.
 * Keeping this at the router boundary also covers modules with their own sidebar.
 *
 * @param {GoogleAppsScript.HTML.HtmlOutput} output Rendered application page.
 * @return {GoogleAppsScript.HTML.HtmlOutput}
 * @private
 */
function applyJSKOSBranding_(output, activeRoute) {
  if (!output || typeof output.getContent !== 'function') return output;
  var brandMark = HtmlService
    .createHtmlOutputFromFile('Ui/Core/BrandMark')
    .getContent();
  var brandedContent = output.getContent().replace(
    /<div class="brand-mark"[^>]*>\s*JSK\s*<\/div>/g,
    brandMark
  );
  if (brandedContent.indexOf('</body>') !== -1) {
    brandedContent = brandedContent.replace('</body>',
      HtmlService.createHtmlOutputFromFile('Ui/Core/ClientContextBanner').getContent() + '</body>');
  }
  if (
    brandedContent.indexOf('class="sidebar"') !== -1 &&
    /<nav\b[^>]*>[\s\S]*?<\/nav>/i.test(brandedContent)
  ) {
    brandedContent = brandedContent.replace(
      /<nav\b[^>]*>[\s\S]*?<\/nav>/i,
      buildJSKOSNavigationHtml_(activeRoute)
    );
  }
  output.setContent(brandedContent);
  return output;
}

function buildJSKOSNavigationHtml_(activeRoute) {
  var links = Object.keys(JSKOS.RouteConfig.ROUTES).filter(function (key) {
    return !JSKOS.AccessControl ||
      typeof JSKOS.AccessControl.canAccessRoute !== 'function' ||
      JSKOS.AccessControl.canAccessRoute(key);
  }).map(function (key) {
    var route = JSKOS.RouteConfig.ROUTES[key];
    var active = route.key === activeRoute;
    return '<a class="nav-item' + (active ? ' active' : '') +
      '" href="' + escapeRouterHtml_(JSKOS.Router.buildRouteUrl(route.key)) +
      '"' + (active ? ' aria-current="page"' : '') + '>' +
      '<span class="nav-icon" aria-hidden="true">' +
      escapeRouterHtml_(route.icon) + '</span>' +
      '<span>' + escapeRouterHtml_(route.title) + '</span></a>';
  });
  return '<nav class="navigation" aria-label="JSK OS modules">' +
    links.join('') + '</nav>';
}

/** Meta WhatsApp webhook entry point. */
function doPost(event) {
  return handleMetaWhatsAppWebhook(event);
}

JSKOS.Router = Object.freeze({
  resolve: function (event) {
    var parameters = event && event.parameter ? event.parameter : {};
    var requestedRoute = String(
      parameters.page || JSKOS.RouteConfig.DEFAULT_ROUTE
    ).trim().toLowerCase();

    var route = JSKOS.RouteConfig.ROUTES[requestedRoute];

    if (!route || route.enabled !== true) {
      return JSKOS.RouteConfig.DEFAULT_ROUTE;
    }

    return route.key;
  },

  render: function (route, event) {
    try {
      switch (route) {
        case 'companies':
          return JSKOS.Router.renderCompanies();

        case 'people':
          return JSKOS.Router.renderPeople();

        case 'policies':
          return JSKOS.Router.renderPolicies(event);

        case 'claims':
          return JSKOS.Router.renderClaims();

        case 'documents':
          return JSKOS.Router.renderDocuments();

        case 'endorsements':
          return JSKOS.Router.renderEndorsements();

        case 'quotes':
          return JSKOS.Router.renderQuotes();

        case 'revenue':
          return JSKOS.Router.renderRevenue();

        case 'reports':
          return JSKOS.Router.renderReports();

        case 'tasks':
          return JSKOS.Router.renderTasks();

        case 'meetings':
          return JSKOS.Router.renderMeetings();

        case 'communications':
          return JSKOS.Router.renderCommunications();

        case 'client360':
          return JSKOS.Router.renderClient360(event);

        case 'access':
          return JSKOS.Router.renderAccess();

        case 'dashboard':
        default:
          return JSKOS.Router.renderDashboard();
      }
    } catch (error) {
      return JSKOS.Router.renderError(route, error);
    }
  },

  renderDashboard: function () {
    if (typeof renderEnterpriseDashboardUi !== 'function') {
      throw new Error('renderEnterpriseDashboardUi() is unavailable.');
    }

    return renderEnterpriseDashboardUi();
  },

  renderCompanies: function () {
    if (typeof renderCompanyUi !== 'function') {
      throw new Error('renderCompanyUi() is unavailable.');
    }

    return renderCompanyUi();
  },

  renderPeople: function () {
    if (typeof renderPeopleUi !== 'function') {
      throw new Error('renderPeopleUi() is unavailable.');
    }

    return renderPeopleUi();
  },

  renderPolicies: function (event) {
    if (typeof renderPolicyUi !== 'function') {
      throw new Error('renderPolicyUi() is unavailable.');
    }

    return renderPolicyUi({
      workMode: Boolean(
        event && event.parameter && event.parameter.mode === 'work'
      )
    });
  },

  renderClaims: function () {
    if (typeof renderClaimUi !== 'function') {
      throw new Error('renderClaimUi() is unavailable.');
    }
    return renderClaimUi();
  },

  renderDocuments: function () {
    if (typeof renderDocumentUi !== 'function') {
      throw new Error('renderDocumentUi() is unavailable.');
    }
    return renderDocumentUi();
  },

  renderEndorsements: function () {
    if (typeof renderEndorsementUi !== 'function') throw new Error('renderEndorsementUi() is unavailable.');
    return renderEndorsementUi();
  },

  renderQuotes: function () {
    if (typeof renderQuoteUi !== 'function') throw new Error('renderQuoteUi() is unavailable.');
    return renderQuoteUi();
  },

  renderRevenue: function () { if(typeof renderRevenueUi!=='function')throw new Error('renderRevenueUi() is unavailable.');return renderRevenueUi(); },

  renderReports: function () {
    if (typeof renderReportUi !== 'function') {
      throw new Error('renderReportUi() is unavailable.');
    }
    return renderReportUi();
  },

  renderTasks: function () {
    if (typeof renderTaskUi !== 'function') {
      throw new Error('renderTaskUi() is unavailable.');
    }
    return renderTaskUi();
  },

  renderMeetings: function () {
    if (typeof renderMeetingUi !== 'function') {
      throw new Error('renderMeetingUi() is unavailable.');
    }
    return renderMeetingUi();
  },

  renderCommunications: function () {
    if (typeof renderCommunicationUi !== 'function') {
      throw new Error('renderCommunicationUi() is unavailable.');
    }
    return renderCommunicationUi();
  },

  renderAccess: function () {
    if (typeof renderAccessUi !== 'function') {
      throw new Error('renderAccessUi() is unavailable.');
    }
    return renderAccessUi();
  },

  renderClient360: function (event) {
    if (typeof renderClient360Ui !== 'function') {
      throw new Error('renderClient360Ui() is unavailable.');
    }
    var parameters = event && event.parameter ? event.parameter : {};
    return renderClient360Ui({
      companyId: parameters.companyId || '',
      personId: parameters.personId || ''
    });
  },

  /**
   * Returns the deployed Web App URL when available.
   * Editor tests may return an empty string; that is expected.
   *
   * @return {string}
   */
  getWebAppUrl: function () {
    try {
      return String(ScriptApp.getService().getUrl() || '').trim();
    } catch (error) {
      console.warn('Web App URL is unavailable during editor testing.');
      return '';
    }
  },

  /**
   * Builds a route URL. It is absolute in the deployed Web App and
   * relative only during Apps Script editor tests.
   *
   * @param {string} routeKey Route key.
   * @return {string}
   */
  buildRouteUrl: function (routeKey) {
    var baseUrl = JSKOS.Router.getWebAppUrl();
    var query = '?page=' + encodeURIComponent(routeKey);
    return baseUrl ? baseUrl + query : query;
  },

  getRouteUrls: function () {
    return {
      dashboard: JSKOS.Router.buildRouteUrl('dashboard'),
      companies: JSKOS.Router.buildRouteUrl('companies'),
      people: JSKOS.Router.buildRouteUrl('people'),
      policies: JSKOS.Router.buildRouteUrl('policies'),
      claims: JSKOS.Router.buildRouteUrl('claims'),
      documents: JSKOS.Router.buildRouteUrl('documents'),
      endorsements: JSKOS.Router.buildRouteUrl('endorsements'),
      quotes: JSKOS.Router.buildRouteUrl('quotes'),
      revenue: JSKOS.Router.buildRouteUrl('revenue'),
      reports: JSKOS.Router.buildRouteUrl('reports'),
      tasks: JSKOS.Router.buildRouteUrl('tasks'),
      meetings: JSKOS.Router.buildRouteUrl('meetings'),
      communications: JSKOS.Router.buildRouteUrl('communications'),
      client360: JSKOS.Router.buildRouteUrl('client360'),
      access: JSKOS.Router.buildRouteUrl('access')
    };
  },

  getNavigation: function (activeRoute) {
    return Object.keys(JSKOS.RouteConfig.ROUTES).filter(function (key) {
      return !JSKOS.AccessControl ||
        typeof JSKOS.AccessControl.canAccessRoute !== 'function' ||
        JSKOS.AccessControl.canAccessRoute(key);
    }).map(function (key) {
      var route = JSKOS.RouteConfig.ROUTES[key];

      return {
        key: route.key,
        title: route.title,
        icon: route.icon,
        enabled: route.enabled,
        active: route.key === activeRoute,
        href: route.enabled
          ? JSKOS.Router.buildRouteUrl(route.key)
          : '#'
      };
    });
  },

  renderAccessDenied: function (route) {
    var context = JSKOS.AccessControl.getContext();
    var dashboardUrl = JSKOS.Router.buildRouteUrl('dashboard');
    var html = '<!DOCTYPE html><html><head><base target="_top">' +
      '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<style>body{font-family:Arial,sans-serif;background:#f4f6f9;padding:32px;color:#142033}.card{max-width:680px;margin:60px auto;background:#fff;border:1px solid #dfe4eb;border-radius:16px;padding:28px}h1{color:#b42318}a{display:inline-block;margin-top:16px;padding:10px 14px;background:#0b1f3a;color:#fff;text-decoration:none;border-radius:8px}</style>' +
      '</head><body><div class="card"><h1>Access denied</h1>' +
      '<p>You do not have permission to open <strong>' + escapeRouterHtml_(route) + '</strong>.</p>' +
      '<p>Signed in as ' + escapeRouterHtml_(context.email || 'Unknown user') +
      ' (' + escapeRouterHtml_(context.role) + ').</p>' +
      '<a href="' + escapeRouterHtml_(dashboardUrl) + '">Return to Dashboard</a>' +
      '</div></body></html>';
    return HtmlService.createHtmlOutput(html)
      .setTitle('Access denied | JSK OS')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  },

  renderError: function (route, error) {
    var diagnostic = error && error.stack ? error.stack : String(error);
    console.error('JSK OS route error | route=' + route + ' | ' + diagnostic);
    var message = 'The requested page could not be loaded. Please contact an Administrator if the problem continues.';

    var dashboardUrl = JSKOS.Router.buildRouteUrl('dashboard');
    var html = '<!DOCTYPE html><html><head><base target="_top">' +
      '<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<style>body{font-family:Arial,sans-serif;background:#f4f6f9;padding:32px;color:#142033}.card{max-width:900px;margin:40px auto;background:#fff;border:1px solid #dfe4eb;border-radius:16px;padding:28px}h1{color:#b42318}pre{white-space:pre-wrap;background:#fff4f2;padding:16px;border-radius:10px}a{display:inline-block;margin-top:16px;padding:10px 14px;background:#0b1f3a;color:#fff;text-decoration:none;border-radius:8px}</style>' +
      '</head><body><div class="card"><h1>JSK OS Route Error</h1>' +
      '<p><strong>Route:</strong> ' + escapeRouterHtml_(route) + '</p>' +
      '<pre>' + escapeRouterHtml_(message) + '</pre>' +
      '<a href="' + escapeRouterHtml_(dashboardUrl) + '">Return to Dashboard</a></div></body></html>';

    return HtmlService.createHtmlOutput(html)
      .setTitle('JSK OS Route Error')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
});

function escapeRouterHtml_(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function testRouterRepair() {
  var checks = {
    dashboard: JSKOS.Router.resolve({ parameter: { page: 'dashboard' } }),
    companies: JSKOS.Router.resolve({ parameter: { page: 'companies' } }),
    people: JSKOS.Router.resolve({ parameter: { page: 'people' } }),
    policies: JSKOS.Router.resolve({ parameter: { page: 'policies' } }),
    tasks: JSKOS.Router.resolve({ parameter: { page: 'tasks' } }),
    unknown: JSKOS.Router.resolve({ parameter: { page: 'unknown' } })
  };

  if (checks.dashboard !== 'dashboard') throw new Error('Dashboard route test failed.');
  if (checks.companies !== 'companies') throw new Error('Companies route test failed.');
  if (checks.people !== 'people') throw new Error('People route test failed.');
  if (checks.policies !== 'policies') throw new Error('Policies route test failed.');
  if (checks.tasks !== 'tasks') throw new Error('Tasks route test failed.');
  if (checks.unknown !== 'dashboard') throw new Error('Unknown route fallback test failed.');

  var result = {
    success: true,
    message: 'Router repair tests passed.',
    routes: checks,
    timestamp: new Date().toISOString()
  };

  console.info(JSON.stringify(result));
  return result;
}

function testAllWebRoutes() {
  var tests = [
    { route: 'dashboard', marker: 'JSK OS Enterprise' },
    { route: 'companies', marker: 'JSK Company CRM' },
    { route: 'people', marker: 'JSK People CRM' },
    { route: 'policies', marker: 'JSK Policy Management' },
    { route: 'claims', marker: 'Claim Management' },
    { route: 'documents', marker: 'Document Vault' },
    { route: 'endorsements', marker: 'Endorsement Management' },
    { route: 'quotes', marker: 'Quote Management' },
    { route: 'revenue', marker: 'Revenue & Commission' },
    { route: 'reports', marker: 'Reports & Analytics' },
    { route: 'tasks', marker: 'Task Management' },
    { route: 'meetings', marker: 'Meeting Management' },
    { route: 'communications', marker: 'Communication Center' },
    { route: 'client360', marker: 'Client 360' },
    { route: 'access', marker: 'User Access & Security' }
  ];

  var results = tests.map(function (test) {
    var output = doGet({ parameter: { page: test.route } });
    var content = output.getContent();
    var passed = Boolean(content) && content.indexOf(test.marker) !== -1;

    if (!passed) {
      throw new Error('Route rendering failed: ' + test.route);
    }

    return {
      route: test.route,
      success: true,
      contentLength: content.length
    };
  });

  var result = {
    success: true,
    message: 'Dashboard, Company, People, Policy and Task routes passed.',
    routes: results,
    webAppUrl: JSKOS.Router.getWebAppUrl(),
    timestamp: new Date().toISOString()
  };

  console.info(JSON.stringify(result));
  return result;
}

/**
 * Verifies the Build 1007 route and shared sidebar model in the exact
 * Apps Script runtime used by editor tests and deployments.
 *
 * @return {Object}
 */
function testBuild1007RuntimeNavigation() {
  var resolvedRoute = JSKOS.Router.resolve({
    parameter: { page: 'claims' }
  });
  var navigation = JSKOS.Router.getNavigation('claims');
  var model = JSKOS.TemplateService.createModel('claims');
  var routeKeys = Object.keys(JSKOS.RouteConfig.ROUTES);
  var navigationKeys = navigation.map(function (item) { return item.key; });
  var modelNavigationKeys = model.navigation.map(function (item) { return item.key; });
  var output = doGet({ parameter: { page: 'claims' } });
  var content = output.getContent();
  var result = {
    success:
      resolvedRoute === 'claims' &&
      navigationKeys.indexOf('claims') !== -1 &&
      modelNavigationKeys.indexOf('claims') !== -1 &&
      content.indexOf('Claim Management') !== -1,
    version: JSKOS.Config.APP.VERSION,
    resolvedRoute: resolvedRoute,
    routeKeys: routeKeys,
    navigationKeys: navigationKeys,
    modelNavigationKeys: modelNavigationKeys,
    claimPageRendered: content.indexOf('Claim Management') !== -1,
    webAppUrl: JSKOS.Router.getWebAppUrl()
  };

  if (!result.success) {
    throw new Error('Build 1007 runtime navigation failed: ' + JSON.stringify(result));
  }

  console.info(JSON.stringify(result));
  return result;
}
