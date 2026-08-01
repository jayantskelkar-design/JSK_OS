/** JSK OS Build 1005 - Meeting Management UI. */

function renderMeetingUi() {
  ensureBuild1005Meetings();
  var template = HtmlService.createTemplateFromFile('Ui/Meeting/Meeting');
  template.applicationName = JSKOS.Config.APP.NAME;
  template.applicationVersion = JSKOS.Config.APP.VERSION;
  template.currentUser = JSKOS.ConfigService.getCurrentUser();
  template.routeUrls = JSKOS.Router.getRouteUrls();
  return template.evaluate().setTitle('Meetings | JSK OS')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function testMeetingUiRendering() {
  var content = renderMeetingUi().getContent();
  ['meetingTableBody', 'meetingModal', 'apiMeetingSearch', 'apiMeetingCreate'].forEach(function (marker) {
    if (content.indexOf(marker) === -1) throw new Error('Missing Meeting UI marker: ' + marker);
  });
  return { success: true, contentLength: content.length };
}
