/** Non-network WA Lead provider tests. */
function testWaLeadWhatsAppProvider() {
  if (normalizeWaLeadPhone_('+91 98765 43210') !== '919876543210') throw new Error('WA Lead phone normalization failed.');
  var success = parseWaLeadJson_('{"status":"1","wa_message_id":"wamid.TEST","message":"Message sent successfully."}');
  if (String(success.status) !== '1' || success.wa_message_id !== 'wamid.TEST') throw new Error('WA Lead response parser failed.');
  var report = { success: true, phoneNormalization: true, responseParser: true,
    config: getWaLeadWhatsAppConfigStatus() };
  console.info(JSON.stringify(report));
  return report;
}
