/**
 * JSK OS Clean Router v1.0.1
 */
var JSKOS = JSKOS || {};

JSKOS.RouteConfig = Object.freeze({
  DEFAULT_ROUTE: 'dashboard',
  ROUTES: Object.freeze({
    dashboard: Object.freeze({ key: 'dashboard', title: 'Dashboard', icon: '⌂', enabled: true }),
    companies: Object.freeze({ key: 'companies', title: 'Companies', icon: '▦', enabled: true }),
    people: Object.freeze({ key: 'people', title: 'People', icon: '♟', enabled: true }),
    tasks: Object.freeze({ key: 'tasks', title: 'Tasks', icon: '✓', enabled: false }),
    meetings: Object.freeze({ key: 'meetings', title: 'Meetings', icon: '◷', enabled: false })
  })
});

function doGet(event) {
  var route = JSKOS.Router.resolve(event);
  return JSKOS.Router.render(route);
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

  render: function (route) {
    try {
      switch (route) {
        case 'companies':
          return JSKOS.Router.renderCompanies();
        case 'people':
          return JSKOS.Router.renderPeople();
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

  getNavigation: function (activeRoute) {
    return Object.keys(JSKOS.RouteConfig.ROUTES).map(function (key) {
      var route = JSKOS.RouteConfig.ROUTES[key];
      return {
        key: route.key,
        title: route.title,
        icon: route.icon,
        enabled: route.enabled,
        active: route.key === activeRoute,
        href: route.enabled
  ? (
      JSKOS.Router.getWebAppUrl()
        ? JSKOS.Router.getWebAppUrl() +
          '?page=' +
          encodeURIComponent(route.key)
        : '?page=' +
          encodeURIComponent(route.key)
    )
  : '#'
    });
  },

  getWebAppUrl: function () {
  try {
    return String(
      ScriptApp.getService().getUrl() || ''
    ).trim();
  } catch (error) {
    console.warn(
      'Web App URL is unavailable during editor testing.'
    );

    return '';
  }
},
  },

  renderError: function (route, error) {
    var message = error && error.stack ? error.stack : String(error);
    console.error('JSK OS route error | route=' + route + ' | ' + message);

    var html = '<!DOCTYPE html><html><head><base target="_top">' +
      '<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<style>body{font-family:Arial,sans-serif;background:#f4f6f9;padding:32px;color:#142033}.card{max-width:900px;margin:40px auto;background:#fff;border:1px solid #dfe4eb;border-radius:16px;padding:28px}h1{color:#b42318}pre{white-space:pre-wrap;background:#fff4f2;padding:16px;border-radius:10px}a{display:inline-block;margin-top:16px;padding:10px 14px;background:#0b1f3a;color:#fff;text-decoration:none;border-radius:8px}</style>' +
      '</head><body><div class="card"><h1>JSK OS Route Error</h1>' +
      '<p><strong>Route:</strong> ' + escapeRouterHtml_(route) + '</p>' +
      '<pre>' + escapeRouterHtml_(message) + '</pre>' +
      '<a href="?page=dashboard">Return to Dashboard</a></div></body></html>';

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
    unknown: JSKOS.Router.resolve({ parameter: { page: 'unknown' } })
  };

  if (checks.dashboard !== 'dashboard') throw new Error('Dashboard route test failed.');
  if (checks.companies !== 'companies') throw new Error('Companies route test failed.');
  if (checks.people !== 'people') throw new Error('People route test failed.');
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


/**
 * Tests server-side rendering for all live routes.
 *
 * @return {Object}
 */
function testAllWebRoutes() {
  var tests = [
    { route: 'dashboard', marker: 'JSK OS Enterprise' },
    { route: 'companies', marker: 'JSK Company CRM' },
    { route: 'people', marker: 'JSK People CRM' }
  ];

  var results = tests.map(function (test) {
    var output = doGet({
      parameter: { page: test.route }
    });

    var content = output.getContent();
    var passed =
      Boolean(content) &&
      content.indexOf(test.marker) !== -1;

    if (!passed) {
      throw new Error(
        'Route rendering failed: ' + test.route
      );
    }

    return {
      route: test.route,
      success: true,
      contentLength: content.length
    };
  });

  var result = {
    success: true,
    message: 'Dashboard, Company and People routes passed.',
    routes: results,
    webAppUrl: JSKOS.Router.getWebAppUrl(),
    timestamp: new Date().toISOString()
  };

  console.info(JSON.stringify(result));
  return result;
}
