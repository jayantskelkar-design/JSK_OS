/** JSK OS Build 1027 - GARUDA Lead IQ UI. */
function renderGarudaUi() {
  JSKOS.AccessControl.requirePermission('garuda.view');
  var model = JSKOS.TemplateService.createModel('garuda');
  var template = HtmlService.createTemplateFromFile('Ui/Garuda/Garuda');
  Object.keys(model).forEach(function (key) { template[key] = model[key]; });
  return template.evaluate().setTitle('GARUDA Lead IQ | JSK OS')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
