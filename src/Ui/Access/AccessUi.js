/** JSK OS Build 1013 Phase 2 - User Access UI renderer. */
function renderAccessUi() {
  JSKOS.AccessControl.requirePermission('access.manage');
  var model = JSKOS.TemplateService.createModel('access');
  var template = HtmlService.createTemplateFromFile('Ui/Access/Access');
  Object.keys(model).forEach(function (key) { template[key] = model[key]; });
  return template.evaluate().setTitle('User Access | JSK OS')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
