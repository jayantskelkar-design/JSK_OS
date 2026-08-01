/** JSK OS Build 1006 - Meta WhatsApp Cloud API provider. */
var JSKOS = JSKOS || {};

var JSK_META_WA = Object.freeze({
  TOKEN_KEY: 'JSK_OS_META_WA_ACCESS_TOKEN',
  PHONE_ID_KEY: 'JSK_OS_META_WA_PHONE_NUMBER_ID',
  VERIFY_TOKEN_KEY: 'JSK_OS_META_WA_VERIFY_TOKEN',
  GRAPH_VERSION_KEY: 'JSK_OS_META_GRAPH_VERSION',
  DEFAULT_GRAPH_VERSION: 'v24.0',
  PROVIDER: 'Meta WhatsApp',
  MAX_ATTEMPTS: 3,
  RETRY_MINUTES: Object.freeze([5, 30, 120])
});

JSKOS.MetaWhatsAppProvider = Object.freeze({
  configStatus: metaWhatsAppConfigStatus_,
  sendQueued: sendQueuedMetaWhatsApp,
  buildTextPayload: buildMetaWhatsAppTextPayload_,
  parseStatuses: parseMetaWhatsAppStatuses_
});

function metaWhatsAppConfigStatus_() {
  var properties = PropertiesService.getScriptProperties();
  var values = properties.getProperties();
  return {
    ready: Boolean(values[JSK_META_WA.TOKEN_KEY] && values[JSK_META_WA.PHONE_ID_KEY]),
    accessTokenConfigured: Boolean(values[JSK_META_WA.TOKEN_KEY]),
    phoneNumberIdConfigured: Boolean(values[JSK_META_WA.PHONE_ID_KEY]),
    verifyTokenConfigured: Boolean(values[JSK_META_WA.VERIFY_TOKEN_KEY]),
    graphVersion: values[JSK_META_WA.GRAPH_VERSION_KEY] || JSK_META_WA.DEFAULT_GRAPH_VERSION
  };
}

function sendQueuedMetaWhatsApp(limit) {
  ensureBuild1006Communications();
  var config = getMetaWhatsAppConfig_();
  var repository = new CommunicationRepository();
  var now = new Date();
  var candidates = repository.search({ channel: 'WhatsApp' }).items.filter(function (item) {
    var scheduled = item.scheduledAt ? new Date(item.scheduledAt) : now;
    var retry = item.nextRetryAt ? new Date(item.nextRetryAt) : now;
    return (item.status === 'Queued' && scheduled <= now) ||
      (item.status === 'Failed' && Number(item.attemptCount || 0) < JSK_META_WA.MAX_ATTEMPTS && retry <= now);
  }).slice(0, Math.max(1, Math.min(Number(limit) || 20, 50)));
  var report = { selected: candidates.length, sent: 0, failed: 0, skipped: 0 };
  candidates.forEach(function (item) {
    try {
      var claimed = repository.update(item.communicationId, {
        status: 'Sending', provider: JSK_META_WA.PROVIDER, lastError: ''
      }, 'Meta WhatsApp Sender', item.recordVersion);
      sendMetaWhatsAppItem_(repository, claimed, config);
      report.sent += 1;
    } catch (error) {
      if (error && error.code === 'VERSION_CONFLICT') { report.skipped += 1; return; }
      report.failed += 1;
      console.error('Meta WhatsApp send failed: ' + sanitizeMetaError_(error));
    }
  });
  console.info(JSON.stringify(report));
  return report;
}

function sendMetaWhatsAppItem_(repository, item, config) {
  var attempts = Number(item.attemptCount || 0) + 1;
  try {
    var response = UrlFetchApp.fetch(
      'https://graph.facebook.com/' + encodeURIComponent(config.graphVersion) + '/' + encodeURIComponent(config.phoneNumberId) + '/messages',
      {
        method: 'post', muteHttpExceptions: true, contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + config.accessToken },
        payload: JSON.stringify(buildMetaWhatsAppTextPayload_(item.recipient, item.message))
      }
    );
    var code = response.getResponseCode();
    var body = parseJsonSafely_(response.getContentText());
    if (code < 200 || code >= 300 || !body.messages || !body.messages[0] || !body.messages[0].id) {
      throw new Error('Meta API HTTP ' + code + ': ' + metaApiErrorMessage_(body));
    }
    repository.update(item.communicationId, {
      status: 'Sent', provider: JSK_META_WA.PROVIDER,
      providerMessageId: body.messages[0].id, sentAt: new Date(),
      attemptCount: attempts, nextRetryAt: '', lastError: ''
    }, 'Meta WhatsApp Sender', item.recordVersion);
  } catch (error) {
    var minutes = JSK_META_WA.RETRY_MINUTES[Math.min(attempts - 1, JSK_META_WA.RETRY_MINUTES.length - 1)];
    repository.update(item.communicationId, {
      status: 'Failed', provider: JSK_META_WA.PROVIDER,
      attemptCount: attempts, nextRetryAt: new Date(Date.now() + minutes * 60000),
      lastError: sanitizeMetaError_(error)
    }, 'Meta WhatsApp Sender', item.recordVersion);
    throw error;
  }
}

function buildMetaWhatsAppTextPayload_(recipient, message) {
  var digits = String(recipient || '').replace(/\D/g, '');
  if (!/^\d{10,15}$/.test(digits)) throw new Error('WhatsApp recipient is invalid.');
  if (!String(message || '').trim()) throw new Error('WhatsApp message is required.');
  return { messaging_product: 'whatsapp', recipient_type: 'individual', to: digits,
    type: 'text', text: { preview_url: false, body: String(message).trim() } };
}

function handleMetaWhatsAppWebhookVerification(event) {
  var parameters = event && event.parameter ? event.parameter : {};
  var expected = PropertiesService.getScriptProperties().getProperty(JSK_META_WA.VERIFY_TOKEN_KEY) || '';
  var valid = parameters['hub.mode'] === 'subscribe' && expected && parameters['hub.verify_token'] === expected;
  return ContentService.createTextOutput(valid ? String(parameters['hub.challenge'] || '') : 'Unauthorized')
    .setMimeType(ContentService.MimeType.TEXT);
}

function handleMetaWhatsAppWebhook(event) {
  try {
    var body = parseJsonSafely_(event && event.postData ? event.postData.contents : '{}');
    applyMetaWhatsAppStatuses_(parseMetaWhatsAppStatuses_(body));
    return metaWebhookResponse_({ success: true });
  } catch (error) {
    console.error('Meta WhatsApp webhook failed: ' + sanitizeMetaError_(error));
    return metaWebhookResponse_({ success: false });
  }
}

function parseMetaWhatsAppStatuses_(body) {
  var statuses = [];
  (body.entry || []).forEach(function (entry) {
    (entry.changes || []).forEach(function (change) {
      var value = change.value || {};
      (value.statuses || []).forEach(function (status) {
        statuses.push({ id: String(status.id || ''), status: String(status.status || '').toLowerCase(),
          at: status.timestamp ? new Date(Number(status.timestamp) * 1000) : new Date(),
          error: status.errors && status.errors[0] ? String(status.errors[0].title || status.errors[0].message || 'Meta delivery failed') : '' });
      });
    });
  });
  return statuses.filter(function (status) { return status.id; });
}

function applyMetaWhatsAppStatuses_(statuses) {
  if (!statuses.length) return;
  ensureBuild1006Communications();
  var repository = new CommunicationRepository();
  var map = { sent: 'Sent', delivered: 'Delivered', read: 'Read', failed: 'Failed' };
  statuses.forEach(function (status) {
    var item = repository.findByProviderMessageId(status.id);
    if (!item || !map[status.status]) return;
    var changes = { status: map[status.status] };
    if (status.status === 'sent') changes.sentAt = status.at;
    if (status.status === 'delivered') changes.deliveredAt = status.at;
    if (status.status === 'read') changes.readAt = status.at;
    if (status.status === 'failed') changes.lastError = status.error;
    repository.update(item.communicationId, changes, 'Meta WhatsApp Webhook', item.recordVersion);
  });
}

function getMetaWhatsAppConfig_() {
  var properties = PropertiesService.getScriptProperties();
  var config = { accessToken: properties.getProperty(JSK_META_WA.TOKEN_KEY),
    phoneNumberId: properties.getProperty(JSK_META_WA.PHONE_ID_KEY),
    graphVersion: properties.getProperty(JSK_META_WA.GRAPH_VERSION_KEY) || JSK_META_WA.DEFAULT_GRAPH_VERSION };
  if (!config.accessToken || !config.phoneNumberId) throw new Error('Meta WhatsApp Script Properties are incomplete.');
  if (!/^v\d+\.\d+$/.test(config.graphVersion)) throw new Error('Meta Graph version is invalid.');
  return config;
}

function metaWebhookResponse_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
function parseJsonSafely_(text) { try { return JSON.parse(String(text || '{}')); } catch (error) { throw new Error('Invalid JSON response.'); } }
function metaApiErrorMessage_(body) { return body && body.error ? String(body.error.message || body.error.type || 'Request failed') : 'Request failed'; }
function sanitizeMetaError_(error) { return String(error && error.message ? error.message : error || 'Unknown error').replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]').substring(0, 500); }

function getMetaWhatsAppConfigStatus() { return metaWhatsAppConfigStatus_(); }
function processMetaWhatsAppOutbox() { return sendQueuedMetaWhatsApp(20); }
