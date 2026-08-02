/** JSK OS Build 1006 - WA Lead WhatsApp API provider. */
var JSKOS = JSKOS || {};

var JSK_WALEAD_WA = Object.freeze({
  API_KEY: 'JSK_OS_WALEAD_API_KEY',
  PHONE_NUMBER_ID: 'JSK_OS_WALEAD_PHONE_NUMBER_ID',
  TEST_RECIPIENT: 'JSK_OS_META_WA_TEST_RECIPIENT',
  RENEWAL_BOT_FLOW_ID: 'JSK_OS_WALEAD_RENEWAL_BOT_FLOW_ID',
  ENDPOINT: 'https://walead.in/api/v1/whatsapp/send',
  TRIGGER_BOT_ENDPOINT: 'https://walead.in/api/v1/whatsapp/trigger-bot',
  PROVIDER: 'WA Lead',
  MAX_ATTEMPTS: 3,
  RETRY_MINUTES: Object.freeze([5, 30, 120])
});

JSKOS.WaLeadWhatsAppProvider = Object.freeze({
  configStatus: getWaLeadWhatsAppConfigStatus,
  sendQueued: sendQueuedWaLeadWhatsApp
});

function getWaLeadWhatsAppConfigStatus() {
  var values = PropertiesService.getScriptProperties().getProperties();
  return {
    ready: Boolean(values[JSK_WALEAD_WA.API_KEY] && values[JSK_WALEAD_WA.PHONE_NUMBER_ID]),
    apiKeyConfigured: Boolean(values[JSK_WALEAD_WA.API_KEY]),
    phoneNumberIdConfigured: Boolean(values[JSK_WALEAD_WA.PHONE_NUMBER_ID]),
    testRecipientConfigured: Boolean(values[JSK_WALEAD_WA.TEST_RECIPIENT]),
    renewalBotFlowConfigured: Boolean(values[JSK_WALEAD_WA.RENEWAL_BOT_FLOW_ID])
  };
}

function sendQueuedWaLeadWhatsApp(limit) {
  ensureBuild1006Communications();
  var config = getWaLeadWhatsAppConfig_();
  var repository = new CommunicationRepository();
  var now = new Date();
  var candidates = repository.search({ channel: 'WhatsApp' }).items.filter(function (item) {
    if (String(item.idempotencyKey || '').indexOf('WALEAD-LIVE-TEST-') === 0) return false;
    var provider = String(item.provider || '');
    if (provider && provider !== 'Pending Configuration' && provider !== JSK_WALEAD_WA.PROVIDER) return false;
    var scheduled = item.scheduledAt ? new Date(item.scheduledAt) : now;
    var retry = item.nextRetryAt ? new Date(item.nextRetryAt) : now;
    return (item.status === 'Queued' && scheduled <= now) ||
      (item.status === 'Failed' && Number(item.attemptCount || 0) < JSK_WALEAD_WA.MAX_ATTEMPTS && retry <= now);
  }).slice(0, Math.max(1, Math.min(Number(limit) || 20, 50)));
  var report = { selected: candidates.length, sent: 0, failed: 0, skipped: 0 };
  candidates.forEach(function (item) {
    try {
      var claimed = repository.update(item.communicationId, {
        status: 'Sending', provider: JSK_WALEAD_WA.PROVIDER, lastError: ''
      }, 'WA Lead Sender', item.recordVersion);
      sendWaLeadWhatsAppItem_(repository, claimed, config);
      report.sent += 1;
    } catch (error) {
      if (error && error.code === 'VERSION_CONFLICT') { report.skipped += 1; return; }
      report.failed += 1;
      console.error('WA Lead send failed: ' + sanitizeWaLeadError_(error));
    }
  });
  console.info(JSON.stringify(report));
  return report;
}

function sendWaLeadWhatsAppItem_(repository, item, config) {
  var attempts = Number(item.attemptCount || 0) + 1;
  try {
    var response = UrlFetchApp.fetch(JSK_WALEAD_WA.ENDPOINT, {
      method: 'post', muteHttpExceptions: true,
      payload: { apiToken: config.apiKey, phone_number_id: config.phoneNumberId,
        message: String(item.message || ''), phone_number: normalizeWaLeadPhone_(item.recipient) }
    });
    var code = response.getResponseCode();
    var body = parseWaLeadJson_(response.getContentText());
    if (code < 200 || code >= 300 || String(body.status) !== '1' || !body.wa_message_id) {
      var message = String(body.message || 'Request failed');
      if (/outside 24 hour window/i.test(message) && config.renewalBotFlowId) {
        body = triggerWaLeadBotFlow_(config, item.recipient);
        body.wa_message_id = 'WALEAD-BOT-' + item.communicationId;
      } else {
        throw new Error('WA Lead HTTP ' + code + ': ' + message);
      }
    }
    repository.update(item.communicationId, {
      status: 'Sent', provider: JSK_WALEAD_WA.PROVIDER,
      providerMessageId: String(body.wa_message_id), sentAt: new Date(),
      attemptCount: attempts, nextRetryAt: '', lastError: ''
    }, 'WA Lead Sender', item.recordVersion);
  } catch (error) {
    var minutes = JSK_WALEAD_WA.RETRY_MINUTES[Math.min(attempts - 1, JSK_WALEAD_WA.RETRY_MINUTES.length - 1)];
    repository.update(item.communicationId, {
      status: 'Failed', provider: JSK_WALEAD_WA.PROVIDER,
      attemptCount: attempts, nextRetryAt: new Date(Date.now() + minutes * 60000),
      lastError: sanitizeWaLeadError_(error)
    }, 'WA Lead Sender', item.recordVersion);
    throw error;
  }
}

function sendWaLeadWhatsAppLiveTest() {
  ensureBuild1006Communications();
  var properties = PropertiesService.getScriptProperties();
  var recipient = normalizeWaLeadPhone_(properties.getProperty(JSK_WALEAD_WA.TEST_RECIPIENT));
  var repository = new CommunicationRepository();
  var queued = repository.queue({
    channel: 'WhatsApp', recipient: recipient,
    message: 'JSK OS WA Lead WhatsApp integration test successful.',
    provider: JSK_WALEAD_WA.PROVIDER,
    idempotencyKey: 'WALEAD-LIVE-TEST-' + Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyyMMddHHmmss')
  }, 'WA Lead Live Test');
  var claimed = repository.update(queued.communicationId, {
    status: 'Sending', provider: JSK_WALEAD_WA.PROVIDER, lastError: ''
  }, 'WA Lead Live Test', queued.recordVersion);
  sendWaLeadWhatsAppItem_(repository, claimed, getWaLeadWhatsAppConfig_());
  var result = repository.findById(queued.communicationId, true);
  console.info(JSON.stringify({ success: true, communicationId: result.communicationId,
    status: result.status, providerMessageIdConfigured: Boolean(result.providerMessageId) }));
  return result;
}

function processWaLeadWhatsAppOutbox() { return sendQueuedWaLeadWhatsApp(20); }

/** Installable-trigger entry point for queued WhatsApp communications. */
function runWaLeadCommunicationAutomation() { return sendQueuedWaLeadWhatsApp(20); }

function ensureWaLeadCommunicationAutomation() {
  var handler = 'runWaLeadCommunicationAutomation';
  var triggers = ScriptApp.getProjectTriggers().filter(function (trigger) {
    return trigger.getHandlerFunction() === handler;
  });
  if (!triggers.length) {
    ScriptApp.newTrigger(handler).timeBased().everyMinutes(5).create();
  }
  var report = { success: true, handler: handler, intervalMinutes: 5,
    existingTriggerCount: triggers.length, created: triggers.length === 0 };
  console.info(JSON.stringify(report));
  return report;
}

/** Controlled approved-template test; sends only to the configured test recipient. */
function triggerWaLeadRenewalTemplateLiveTest() {
  var config = getWaLeadWhatsAppConfig_();
  var recipient = normalizeWaLeadPhone_(PropertiesService.getScriptProperties().getProperty(JSK_WALEAD_WA.TEST_RECIPIENT));
  var response = triggerWaLeadBotFlow_(config, recipient);
  var report = { success: String(response.status) === '1', provider: JSK_WALEAD_WA.PROVIDER,
    flowConfigured: true, recipientConfigured: true };
  console.info(JSON.stringify(report));
  return report;
}

function triggerWaLeadBotFlow_(config, recipient) {
  if (!config.renewalBotFlowId) throw new Error('JSK_OS_WALEAD_RENEWAL_BOT_FLOW_ID is not configured.');
  var response = UrlFetchApp.fetch(JSK_WALEAD_WA.TRIGGER_BOT_ENDPOINT, {
    method: 'post', muteHttpExceptions: true,
    payload: { apiToken: config.apiKey, phone_number_id: config.phoneNumberId,
      bot_flow_unique_id: config.renewalBotFlowId, phone_number: normalizeWaLeadPhone_(recipient) }
  });
  var code = response.getResponseCode();
  var body = parseWaLeadJson_(response.getContentText());
  if (code < 200 || code >= 300 || String(body.status) !== '1') {
    throw new Error('WA Lead bot trigger HTTP ' + code + ': ' + String(body.message || 'Request failed'));
  }
  return body;
}

function getWaLeadWhatsAppConfig_() {
  var properties = PropertiesService.getScriptProperties();
  var config = { apiKey: String(properties.getProperty(JSK_WALEAD_WA.API_KEY) || '').trim(),
    phoneNumberId: String(properties.getProperty(JSK_WALEAD_WA.PHONE_NUMBER_ID) || '').trim(),
    renewalBotFlowId: String(properties.getProperty(JSK_WALEAD_WA.RENEWAL_BOT_FLOW_ID) || '').trim() };
  if (!config.apiKey || !config.phoneNumberId) throw new Error('WA Lead Script Properties are incomplete.');
  return config;
}

function normalizeWaLeadPhone_(value) {
  var digits = String(value || '').replace(/\D/g, '');
  if (!/^\d{10,15}$/.test(digits)) throw new Error('WA Lead recipient number is invalid.');
  return digits;
}

function parseWaLeadJson_(text) { try { return JSON.parse(String(text || '{}')); } catch (error) { throw new Error('WA Lead returned invalid JSON.'); } }
function sanitizeWaLeadError_(error) { return String(error && error.message ? error.message : error || 'Unknown error').replace(/\d+\|[A-Za-z0-9_-]+/g, '[REDACTED]').substring(0, 500); }
