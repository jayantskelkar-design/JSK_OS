/**
 * JSK OS v1.0 Enterprise
 * Module: Application Router
 * Google Apps Script V8
 */

var JSKOS = JSKOS || {};

JSKOS.RouteConfig = Object.freeze({
  DEFAULT_ROUTE: 'dashboard',

  ROUTES: Object.freeze({
    dashboard: Object.freeze({
      key: 'dashboard',
      title: 'Dashboard',
      icon: '⌂',
      enabled: true
    }),

    companies: Object.freeze({
      key: 'companies',
      title: 'Companies',
      icon: '▦',
      enabled: true
    }),

    people: Object.freeze({
      key: 'people',
      title: 'People',
      icon: '♟',
      enabled: true
    }),

    tasks: Object.freeze({
      key: 'tasks',
      title: 'Tasks',
      icon: '✓',
      enabled: false
    }),

    meetings: Object.freeze({
      key: 'meetings',
      title: 'Meetings',
      icon: '◷',
      enabled: false
    })
  })
});

/**
 * Web App entry point.
 *
 * @param {Object=} event Apps Script web event.
 * @return {GoogleAppsScript.HTML.HtmlOutput}
 */
function doGet(event) {
  var route = JSKOS.Router.resolve(event);

  return JSKOS.Router.render(route);
}

JSKOS.Router = Object.freeze({
  /**
   * Resolves the requested route safely.
   *
   * @param {Object=} event Web event.
   * @return {string}
   */
  resolve: function (event) {
    var parameters =
      event && event.parameter
        ? event.parameter
        : {};

    var requested = String(
      parameters.page ||
      JSKOS.RouteConfig.DEFAULT_ROUTE
    )
      .trim()
      .toLowerCase();

    var route =
      JSKOS.RouteConfig.ROUTES[requested];

    if (!route || route.enabled !== true) {
      return JSKOS.RouteConfig.DEFAULT_ROUTE;
    }

    return route.key;
  },

  /**
   * Renders a route.
   *
   * Existing Company and People screens remain usable while
   * Dashboard is delivered through the new shared shell.
   *
   * @param {string} route Route key.
   * @return {GoogleAppsScript.HTML.HtmlOutput}
   */
  
    switch (route) {
      case 'companies':
        if (typeof renderCompanyUi !== 'function') {
          throw new Error(
            'Company UI renderer is unavailable.'
          );
        }

        return renderCompanyUi();

      case 'people':
        if (typeof renderPeopleUi !== 'function') {
          render: function (route) {
  try {
    switch (route) {
      case 'companies':
        if (typeof renderCompanyUi !== 'function') {
          throw new Error(
            'renderCompanyUi function is not available.'
          );
        }

        return renderCompanyUi();

      case 'people':
        if (typeof renderPeopleUi !== 'function') {
          throw new Error(
            'renderPeopleUi function is not available.'
          );
        }

        return renderPeopleUi();

      case 'dashboard':
      default:
        return renderEnterpriseDashboardUi();
    }
  } catch (error) {
    console.error(
      'Route rendering failed: ' +
      route +
      ' | ' +
      (
        error && error.stack
          ? error.stack
          : String(error)
      )
    );

    return HtmlService
      .createHtmlOutput(
        '<!DOCTYPE html>' +
        '<html>' +
        '<head>' +
        '<meta name="viewport" content="width=device-width, initial-scale=1">' +
        '<style>' +
        'body{font-family:Arial,sans-serif;padding:40px;background:#f4f6f9;color:#142033}' +
        '.box{max-width:900px;margin:auto;background:white;padding:28px;border-radius:14px;border:1px solid #ddd}' +
        'h1{color:#b42318}' +
        'pre{white-space:pre-wrap;background:#fff4f2;padding:18px;border-radius:8px}' +
        'a{color:#0b1f3a}' +
        '</style>' +
        '</head>' +
        '<body>' +
        '<div class="box">' +
        '<h1>JSK OS Route Error</h1>' +
        '<p><strong>Route:</strong> ' +
        escapeRouterHtml_(route) +
        '</p>' +
        '<pre>' +
        escapeRouterHtml_(
          error && error.stack
            ? error.stack
            : String(error)
        ) +
        '</pre>' +
        '<p><a href="?page=dashboard">Return to Dashboard</a></p>' +
        '</div>' +
        '</body>' +
        '</html>'
      )
      .setTitle('JSK OS Error');
  }
},

        return renderPeopleUi();

      case 'dashboard':
      default:
        return renderEnterpriseDashboardUi();
    }
  },

  /**
   * Returns navigation items for templates.
   *
   * @param {string} activeRoute Active route.
   * @return {Object[]}
   */
  getNavigation: function (activeRoute) {
    return Object.keys(
      JSKOS.RouteConfig.ROUTES
    ).map(function (key) {
      var route =
        JSKOS.RouteConfig.ROUTES[key];

      return {
        key: route.key,
        title: route.title,
        icon: route.icon,
        enabled: route.enabled,
        active: route.key === activeRoute,
        href: route.enabled
          ? '?page=' + encodeURIComponent(route.key)
          : '#'
      };
    });
  }
});function escapeRouterHtml_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
