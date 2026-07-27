/**
 * JSK OS v1.0 Enterprise
 * Module: Enterprise Dashboard UI
 */

function renderEnterpriseDashboardUi() {
  var template = HtmlService.createTemplateFromFile('Ui/Core/AppShell');
  var model = JSKOS.TemplateService.createModel('dashboard');

  model.dashboard = getEnterpriseDashboardData_();

  Object.keys(model).forEach(function (key) {
    template[key] = model[key];
  });

  JSKOS.TemplateService.setActiveModel(model);

  try {
    return template.evaluate()
      .setTitle('Dashboard | JSK OS')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } finally {
    JSKOS.TemplateService.clearActiveModel();
  }
}

function getEnterpriseDashboardData_() {
  return {
    companies: safeDashboardMetric_(function () {
      return new CompanyRepository().count({ includeDeleted: false });
    }),
    people: safeDashboardMetric_(function () {
      return new PeopleRepository().count({ includeArchived: false });
    }),
    followups: safeDashboardMetric_(function () {
      return new PeopleRepository().findFollowupsDue(new Date()).length;
    }),
    highRiskCompanies: safeDashboardMetric_(function () {
      var result = new CompanyRepository().search({
        riskCategory: 'High',
        includeDeleted: false,
        page: 1,
        pageSize: 1
      });
      return result && result.pagination
        ? result.pagination.totalItems
        : 0;
    }),
    generatedAt: new Date().toISOString()
  };
}

function safeDashboardMetric_(callback) {
  try {
    return Number(callback()) || 0;
  } catch (error) {
    console.warn(
      'Dashboard metric unavailable: ' +
      (error && error.message ? error.message : String(error))
    );
    return 0;
  }
}

function testEnterpriseLayoutEngine() {
  var output = renderEnterpriseDashboardUi();
  var content = output.getContent();

  assertEnterpriseLayout_(
    content.indexOf('JSK OS Enterprise') !== -1,
    'Enterprise dashboard marker was not found.'
  );

  assertEnterpriseLayout_(
    JSKOS.Router.resolve({ parameter: { page: 'people' } }) === 'people',
    'People route resolution failed.'
  );

  assertEnterpriseLayout_(
    JSKOS.Router.resolve({ parameter: { page: 'unknown' } }) === 'dashboard',
    'Unknown route fallback failed.'
  );

  var result = {
    success: true,
    message: 'Enterprise layout engine tests passed.',
    contentLength: content.length,
    timestamp: new Date().toISOString()
  };

  console.info(JSON.stringify(result));
  return result;
}

function assertEnterpriseLayout_(condition, message) {
  if (!condition) {
    throw new Error('Enterprise Layout Test Failed: ' + message);
  }
}
