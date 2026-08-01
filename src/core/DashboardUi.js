/**
 * JSK OS v1.0 Enterprise
 * Module: Enterprise Dashboard UI
 */

function renderEnterpriseDashboardUi() {
  var template =
    HtmlService.createTemplateFromFile(
      'Ui/Core/AppShell'
    );

  var model =
    JSKOS.TemplateService.createModel(
      'dashboard'
    );

  var dashboard =
    JSKOS.DashboardService.getDashboard();

  model.dashboard = Object.assign(
    {},
    dashboard.summary,
    {
      renewals: dashboard.renewals,
      renewalPipeline: dashboard.renewalPipeline,
      garudaInsights: dashboard.garudaInsights,
      workQueue: dashboard.workQueue
    }
  );

  Object.keys(model).forEach(function (key) {
    template[key] = model[key];
  });

  JSKOS.TemplateService.setActiveModel(model);

  try {
    return template.evaluate()
      .setTitle('Dashboard | JSK OS')
      .setXFrameOptionsMode(
        HtmlService.XFrameOptionsMode.ALLOWALL
      )
      .addMetaTag(
        'viewport',
        'width=device-width, initial-scale=1'
      );
  } finally {
    JSKOS.TemplateService.clearActiveModel();
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
    JSKOS.Router.resolve({
      parameter: {
        page: 'people'
      }
    }) === 'people',
    'People route resolution failed.'
  );

  assertEnterpriseLayout_(
    JSKOS.Router.resolve({
      parameter: {
        page: 'unknown'
      }
    }) === 'dashboard',
    'Unknown route fallback failed.'
  );

  var result = {
    success: true,
    message:
      'Enterprise layout engine tests passed.',
    contentLength: content.length,
    timestamp: new Date().toISOString()
  };

  console.info(JSON.stringify(result));

  return result;
}

function assertEnterpriseLayout_(
  condition,
  message
) {
  if (!condition) {
    throw new Error(
      'Enterprise Layout Test Failed: ' +
      message
    );
  }
}
