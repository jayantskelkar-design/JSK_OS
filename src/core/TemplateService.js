/**
 * JSK OS v1.0 Enterprise
 * Module: Template Service
 *
 * Purpose:
 * Creates shared template models and safely evaluates
 * HTML partial files.
 */

var JSKOS = JSKOS || {};

/**
 * Active template model used by nested HTML includes.
 *
 * @type {?Object}
 */
var JSKOS_ACTIVE_TEMPLATE_MODEL_ = null;

/**
 * Safely returns the deployed Web App URL.
 *
 * @return {string}
 * @private
 */
function getJSKOSWebAppUrl_() {
  try {
    return ScriptApp.getService().getUrl() || '';
  } catch (error) {
    return '';
  }
}

/**
 * Creates fallback values required by every HTML template.
 *
 * @return {Object}
 * @private
 */
function getJSKOSDefaultTemplateModel_() {
  return {
    applicationName: 'JSK OS',
    applicationVersion:
      (JSKOS.Config && JSKOS.Config.APP && JSKOS.Config.APP.VERSION) ||
      '1.5.0-beta',
    currentUser: 'SYSTEM',
    activeRoute: 'dashboard',
    webAppUrl: getJSKOSWebAppUrl_(),
    navigation: [],
    routeUrls: {}
  };
}

/**
 * Combines default values with the current active model.
 *
 * @return {Object}
 * @private
 */
function getJSKOSResolvedTemplateModel_() {
  var defaults = getJSKOSDefaultTemplateModel_();
  var activeModel = JSKOS_ACTIVE_TEMPLATE_MODEL_ || {};
  var resolvedModel = {};

  Object.keys(defaults).forEach(function (key) {
    resolvedModel[key] = defaults[key];
  });

  Object.keys(activeModel).forEach(function (key) {
    resolvedModel[key] = activeModel[key];
  });

  /*
   * Always define webAppUrl, even when an older model
   * does not contain it.
   */
  if (
    typeof resolvedModel.webAppUrl === 'undefined' ||
    resolvedModel.webAppUrl === null
  ) {
    resolvedModel.webAppUrl =
      getJSKOSWebAppUrl_();
  }

  return resolvedModel;
}

JSKOS.TemplateService = Object.freeze({

  /**
   * Includes and evaluates an HTML partial.
   *
   * @param {string} fileName Apps Script HTML file path.
   * @return {string} Evaluated HTML content.
   */
  include: function (fileName) {
    var normalized =
      String(fileName || '').trim();

    if (!normalized) {
      throw new Error(
        'Template include file name is required.'
      );
    }

    var template =
      HtmlService.createTemplateFromFile(normalized);

    var model =
      getJSKOSResolvedTemplateModel_();

    Object.keys(model).forEach(function (key) {
      template[key] = model[key];
    });

    /*
     * Explicit assignment protects partial templates
     * that directly reference webAppUrl.
     */
    template.webAppUrl =
      model.webAppUrl ||
      getJSKOSWebAppUrl_();

    return template.evaluate().getContent();
  },

  /**
   * Creates the standard shared layout model.
   *
   * @param {string} route Active application route.
   * @return {Object}
   */
  createModel: function (route) {
    var model =
      getJSKOSDefaultTemplateModel_();

    model.activeRoute =
      String(route || 'dashboard');

    if (
      JSKOS.Config &&
      JSKOS.Config.APP
    ) {
      model.applicationName =
        JSKOS.Config.APP.NAME ||
        model.applicationName;

      model.applicationVersion =
        JSKOS.Config.APP.VERSION ||
        model.applicationVersion;
    }

    if (
      JSKOS.ConfigService &&
      typeof JSKOS.ConfigService.getCurrentUser ===
        'function'
    ) {
      model.currentUser =
        JSKOS.ConfigService.getCurrentUser() ||
        model.currentUser;
    }

    if (
      JSKOS.Router &&
      typeof JSKOS.Router.getNavigation ===
        'function'
    ) {
      model.navigation =
        JSKOS.Router.getNavigation(
          model.activeRoute
        ) || [];

      /*
       * Claims is a first-class Build 1007 module. Keep it visible even
       * when an older cached RouteConfig object survives in a long-lived
       * Apps Script runtime while a new deployment is warming up.
       */
      var hasClaims = model.navigation.some(function (item) {
        return item && item.key === 'claims';
      });

      if (!hasClaims) {
        var claimsItem = {
          key: 'claims',
          title: 'Claims',
          icon: '\u25c6',
          enabled: true,
          active: model.activeRoute === 'claims',
          href: JSKOS.Router.buildRouteUrl('claims')
        };
        var taskIndex = model.navigation.findIndex(function (item) {
          return item && item.key === 'tasks';
        });

        if (taskIndex === -1) {
          model.navigation.push(claimsItem);
        } else {
          model.navigation.splice(taskIndex, 0, claimsItem);
        }
      }
    }

    if (
      JSKOS.Router &&
      typeof JSKOS.Router.getRouteUrls ===
        'function'
    ) {
      model.routeUrls =
        JSKOS.Router.getRouteUrls() || {};
    }

    model.webAppUrl =
      getJSKOSWebAppUrl_();

    return model;
  },

  /**
   * Makes a model available to all nested partial files.
   *
   * @param {Object} model Template model.
   * @return {void}
   */
  setActiveModel: function (model) {
    var safeModel =
      model && typeof model === 'object'
        ? model
        : {};

    JSKOS_ACTIVE_TEMPLATE_MODEL_ =
      safeModel;

    if (
      typeof JSKOS_ACTIVE_TEMPLATE_MODEL_.webAppUrl ===
        'undefined'
    ) {
      JSKOS_ACTIVE_TEMPLATE_MODEL_.webAppUrl =
        getJSKOSWebAppUrl_();
    }
  },

  /**
   * Returns the currently active template model.
   *
   * @return {Object}
   */
  getActiveModel: function () {
    return getJSKOSResolvedTemplateModel_();
  },

  /**
   * Clears the temporary template model.
   *
   * @return {void}
   */
  clearActiveModel: function () {
    JSKOS_ACTIVE_TEMPLATE_MODEL_ = null;
  }

});

/**
 * Backward-compatible global include helper.
 *
 * Used inside HTML templates:
 *
 * <?!= include('Ui/Core/Header'); ?>
 *
 * @param {string} fileName HTML file path.
 * @return {string}
 */
function include(fileName) {
  return JSKOS.TemplateService.include(
    fileName
  );
}
