/**
 * JSK OS v1.0 Enterprise
 * Module: Template Service
 */

var JSKOS = JSKOS || {};

/**
 * Current template model for partial files.
 * This remains available only during the current Apps Script execution.
 */
var JSKOS_ACTIVE_TEMPLATE_MODEL_ = null;

JSKOS.TemplateService = Object.freeze({
  /**
   * Includes and evaluates an HTML partial.
   *
   * @param {string} fileName Apps Script file path.
   * @return {string} Evaluated HTML.
   */
  include: function (fileName) {
    var normalized = String(fileName || '').trim();

    if (!normalized) {
      throw new Error(
        'Template include file name is required.'
      );
    }

    var template =
      HtmlService.createTemplateFromFile(normalized);

    var model =
      JSKOS_ACTIVE_TEMPLATE_MODEL_ || {};

    Object.keys(model).forEach(function (key) {
      template[key] = model[key];
    });

    return template.evaluate().getContent();
  },

  /**
   * Creates the standard shared layout model.
   *
   * @param {string} route Active route.
   * @return {Object}
   */
  createModel: function (route) {
    var applicationName = 'JSK OS';
    var applicationVersion = '1.0.0';
    var currentUser = 'SYSTEM';

    if (
      JSKOS.Config &&
      JSKOS.Config.APP
    ) {
      applicationName =
        JSKOS.Config.APP.NAME ||
        applicationName;

      applicationVersion =
        JSKOS.Config.APP.VERSION ||
        applicationVersion;
    }

    if (
      JSKOS.ConfigService &&
      typeof JSKOS.ConfigService.getCurrentUser ===
        'function'
    ) {
      currentUser =
        JSKOS.ConfigService.getCurrentUser() ||
        currentUser;
    }

    return {
      applicationName: applicationName,
      applicationVersion: applicationVersion,
      currentUser: currentUser,
      activeRoute: route,
      navigation:
        JSKOS.Router.getNavigation(route)
    };
  },

  /**
   * Makes the model available to included partial templates.
   *
   * @param {Object} model Template model.
   * @return {void}
   */
  setActiveModel: function (model) {
    JSKOS_ACTIVE_TEMPLATE_MODEL_ = model || {};
  },

  /**
   * Clears the temporary model.
   *
   * @return {void}
   */
  clearActiveModel: function () {
    JSKOS_ACTIVE_TEMPLATE_MODEL_ = null;
  }
});

/**
 * Backward-compatible include helper.
 *
 * @param {string} fileName File path.
 * @return {string}
 */
function include(fileName) {
  return JSKOS.TemplateService.include(fileName);
}