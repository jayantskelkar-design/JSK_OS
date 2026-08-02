/** JSK OS Build 1006 - Communication Center UI. */
function renderCommunicationUi(){
  ensureBuild1006Communications();
  var template=HtmlService.createTemplateFromFile('Ui/Communication/Communication');
  template.applicationName=JSKOS.Config.APP.NAME;
  template.applicationVersion=JSKOS.Config.APP.VERSION;
  template.currentUser=JSKOS.ConfigService.getCurrentUser();
  template.routeUrls=JSKOS.Router.getRouteUrls();
  return template.evaluate().setTitle('Communications | JSK OS').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL).addMetaTag('viewport','width=device-width, initial-scale=1');
}
function testCommunicationUiRendering(){
  var content=renderCommunicationUi().getContent();
  ['Communication Center','communicationTableBody','apiCommunicationSearch','apiCommunicationRetry'].forEach(function(marker){if(content.indexOf(marker)===-1)throw new Error('Missing Communication UI marker: '+marker);});
  var result={success:true,contentLength:content.length};console.info(JSON.stringify(result));return result;
}
