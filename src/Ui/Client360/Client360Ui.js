/** JSK OS Client 360 v0.1 UI renderer. */
function renderClient360Ui(options) {
  JSKOS.AccessControl.requirePermission('client360.view');
  options = options || {};
  var model = JSKOS.TemplateService.createModel('client360');
  model.initialCompanyId = String(options.companyId || '');
  model.initialPersonId = String(options.personId || '');
  var template = HtmlService.createTemplateFromFile('Ui/Client360/Client360');
  Object.keys(model).forEach(function (key) { template[key] = model[key]; });
  return template.evaluate().setTitle('Client 360 | JSK OS')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
