/** Non-network Meta WhatsApp provider tests. */
function testMetaWhatsAppProvider() {
  var payload = buildMetaWhatsAppTextPayload_('+91 98765 43210', 'Renewal reminder');
  if (payload.to !== '919876543210' || payload.text.body !== 'Renewal reminder') throw new Error('Meta payload test failed.');
  var statuses = parseMetaWhatsAppStatuses_({ entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.TEST', status: 'delivered', timestamp: '1785628800' }] } }] }] });
  if (statuses.length !== 1 || statuses[0].id !== 'wamid.TEST' || statuses[0].status !== 'delivered') throw new Error('Meta webhook parser test failed.');
  var report = { success: true, payload: true, webhookParser: true, config: metaWhatsAppConfigStatus_() };
  console.info(JSON.stringify(report));
  return report;
}
