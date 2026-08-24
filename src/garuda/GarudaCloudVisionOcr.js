/** GARUDA Cloud Vision OCR adapter. Images and OCR text are transient and never logged. */
var JSKOS = JSKOS || {};
JSKOS.GarudaCloudVisionOcr = (function () {
  'use strict';
  var ENDPOINT = 'https://vision.googleapis.com/v1/images:annotate';
  var FEATURE = 'DOCUMENT_TEXT_DETECTION';
  var DESIGNATIONS = /^(?:(?:financial|insurance|investment|wealth|risk|business)\s*(?:&|and)?\s*)*(?:founder|co[- ]?founder|owner|partner|director|managing director|chief executive officer|ceo|chief financial officer|cfo|chief operating officer|coo|president|vice president|vp|general manager|manager|sales manager|marketing manager|business development manager|consultant|advisor|adviser|engineer|architect|proprietor)(?:\b|$)/i;
  var COMPANY = /\b(?:pvt\.?\s*ltd\.?|private\s+limited|ltd\.?|limited|llp|inc\.?|corp(?:oration)?\.?|company|co\.?|enterprises?|industries|solutions|services|associates|agency|group|investments?)\b/i;
  var ADDRESS = /\b(?:road|rd\.?|street|st\.?|lane|ln\.?|avenue|ave\.?|building|bldg\.?|floor|flr\.?|office|shop|plot|sector|nagar|colony|complex|industrial|estate|district|taluka|near|opposite|opp\.?|behind|pin|pincode)\b/i;
  var HEADING = /^(?:risk management|wealth creation|business protection|trust\s*(?:&|and)\s*support|our services|products?(?:\s*\/\s*services?)?|services|about us|contact us)$/i;
  var MARKETING = /\b(?:solutions?\s+for|services?\s+for|we\s+(?:provide|offer|help)|your\s+(?:business|family|future)|trusted\s+(?:partner|advisor))\b/i;

  function clean_(value, max) { return String(value == null ? '' : value).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().substring(0, max || 500); }
  function error_(code, message, status) { var error = new Error(message); error.code = code; error.status = status || 503; return error; }
  function unique_(values) { var out = [], seen = {}; values.forEach(function (value) { value = clean_(value); var key = value.toLowerCase(); if (value && !seen[key]) { seen[key] = true; out.push(value); } }); return out; }
  function matchAll_(text, regex, group) { var out = [], match; regex.lastIndex = 0; while ((match = regex.exec(text)) !== null) { out.push(match[group || 0]); if (!regex.global) break; } return unique_(out); }
  function labeled_(lines, label) { for (var i = 0; i < lines.length; i++) { var match = lines[i].match(label); if (match && clean_(match[1])) return clean_(match[1]); } return ''; }
  function isContact_(line) { return /@|(?:https?:\/\/|www\.)|\b(?:mob(?:ile)?|phone|tel|email|web(?:site)?|gstin?|cin|linkedin|address|products?|services?)\b/i.test(line) || /\d{6,}/.test(line); }
  function validName_(line) { line = clean_(line); return /^(?:[A-Z][A-Za-z.'-]+\s+){1,3}[A-Z][A-Za-z.'-]+$/.test(line) && !HEADING.test(line) && !COMPANY.test(line) && !DESIGNATIONS.test(line) && !MARKETING.test(line) && !isContact_(line) && !/^(?:RISK|WEALTH|BUSINESS|TRUST|OUR)\b/.test(line); }
  function validCompany_(line) { line = clean_(line); if (!line || HEADING.test(line) || MARKETING.test(line) || DESIGNATIONS.test(line) || isContact_(line)) return false; var words = line.split(/\s+/); return words.length <= 7 && COMPANY.test(line) && !/\b(?:for|providing|protecting|creating|supporting)\b/i.test(line); }
  function likelyName_(lines) { for (var i = 0; i < Math.min(lines.length, 8); i++) { var line = clean_(lines[i]); if (validName_(line)) return line; } return ''; }
  function likelyDesignation_(lines) { for (var i = 0; i < lines.length; i++) if (DESIGNATIONS.test(lines[i])) return clean_(lines[i]); return ''; }
  function likelyCompany_(lines) { for (var i = 0; i < lines.length; i++) if (validCompany_(lines[i])) return clean_(lines[i]); return ''; }
  function likelyAddress_(lines) { var start = -1, parts = []; for (var i = 0; i < lines.length; i++) { if (/^\s*(?:address|add)\s*[:\-]/i.test(lines[i]) || ADDRESS.test(lines[i])) { start = i; break; } } if (start < 0) return ''; for (var j = start; j < Math.min(lines.length, start + 5); j++) { var part = clean_(lines[j].replace(/^\s*(?:address|add)\s*[:\-]\s*/i, '')).replace(/\s*,\s*$/, ''); if (!part) continue; if (j > start && (/@|(?:https?:\/\/|www\.)|^\s*(?:mob(?:ile)?|phone|tel|email|web(?:site)?|gstin?|cin|products?|services?)\s*[:\-]/i.test(part) || /^\+?\d[\d\s.-]{7,}$/.test(part))) break; parts.push(part); } return clean_(parts.join(', '), 1000); }
  function locationFromAddress_(address) { if (!address) return ''; var match = address.match(/(?:,|\s)\s*([A-Za-z][A-Za-z .'-]{1,40})(?:,\s*[A-Za-z][A-Za-z .'-]{1,40})?\s*[-, ]\s*\d{6}\b/); return match ? clean_(match[1]) : ''; }

  function parse(rawText, providerConfidence) {
    var raw = String(rawText || '').replace(/\r/g, ''), lines = raw.split('\n').map(function (line) { return clean_(line); }).filter(Boolean), flat = lines.join('\n'), out = {}, confidence = {};
    var emails = matchAll_(flat, /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi);
    var urlText = flat.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '');
    var urls = matchAll_(urlText, /\b(?:https?:\/\/|www\.)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+(?:\/[A-Z0-9._~:/?#[\]@!$&'()*+,;=%-]*)?/gi);
    var linkedIn = urls.filter(function (url) { return /(?:^|\.)linkedin\.com\//i.test(url.replace(/^https?:\/\//i, '').replace(/^www\./i, '')); });
    var websites = urls.filter(function (url) { return !/(?:^|\.)linkedin\.com\//i.test(url.replace(/^https?:\/\//i, '').replace(/^www\./i, '')); });
    var gstins = matchAll_(flat.toUpperCase(), /\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/g);
    var cins = matchAll_(flat.toUpperCase(), /\b[LU]\d{5}[A-Z]{2}\d{4}(?:PLC|PTC)\d{6}\b/g);
    var phones = unique_(matchAll_(flat, /(?:\+?91[\s.-]?)?(?:\(?0?\d{2,5}\)?[\s.-]?)?\d(?:[\s.-]?\d){7,11}/g).map(function (value) { return value.replace(/[^\d+]/g, ''); }).filter(function (value) { var digits = value.replace(/\D/g, ''); return digits.length >= 10 && digits.length <= 13; }));
    var mobiles = phones.filter(function (value) { var digits = value.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, ''); return /^[6-9]\d{9}$/.test(digits); });
    var address = likelyAddress_(lines), name = likelyName_(lines), designation = likelyDesignation_(lines), company = likelyCompany_(lines);
    function set(field, value, score) { if (value) { out[field] = value; confidence[field] = score; } }
    set('personName', name, 0.72); set('designation', designation, 0.82); set('companyName', company, 0.78);
    set('primaryMobile', mobiles[0], 0.9); set('mobile', mobiles[0], 0.9); set('alternateMobile', mobiles[1], 0.85);
    set('email', emails[0], 0.98); set('website', websites[0], 0.95); set('companyPhone', phones.filter(function (value) { return mobiles.indexOf(value) === -1; })[0], 0.8);
    set('address', address, 0.65); set('location', locationFromAddress_(address), 0.6); set('gstin', gstins[0], 0.99); set('cin', cins[0], 0.99); set('linkedIn', linkedIn[0], 0.95);
    set('tagline', labeled_(lines, /^\s*(?:tagline|motto)\s*[:\-]\s*(.+)$/i), 0.9);
    set('productsServices', labeled_(lines, /^\s*(?:products?(?:\s*\/\s*services?)?|services?)\s*[:\-]\s*(.+)$/i), 0.9);
    out.confidence = confidence; out.providerConfidence = typeof providerConfidence === 'number' ? providerConfidence : null;
    return out;
  }

  function extractText_(image) {
    var response;
    try { response = UrlFetchApp.fetch(ENDPOINT, { method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, payload: JSON.stringify({ requests: [{ image: { content: image.base64 }, features: [{ type: FEATURE, maxResults: 1 }] }] }), muteHttpExceptions: true }); }
    catch (ignored) { throw error_('GARUDA_OCR_UNAVAILABLE', 'Visiting-card OCR is temporarily unavailable. Please try again or enter the details manually.'); }
    var status = response.getResponseCode(), parsed;
    try { parsed = JSON.parse(response.getContentText() || '{}'); } catch (ignoredJson) { parsed = {}; }
    if (status < 200 || status >= 300 || !parsed.responses || !parsed.responses[0] || parsed.responses[0].error) throw error_('GARUDA_OCR_UNAVAILABLE', 'Visiting-card OCR is temporarily unavailable. Please try again or enter the details manually.', status);
    var annotation = parsed.responses[0].fullTextAnnotation, text = annotation && annotation.text || parsed.responses[0].textAnnotations && parsed.responses[0].textAnnotations[0] && parsed.responses[0].textAnnotations[0].description || '';
    if (!clean_(text)) throw error_('GARUDA_OCR_UNREADABLE', 'No reliable text was found. Please retake the photo or enter the details manually.', 422);
    var pages = annotation && annotation.pages || [], scores = []; pages.forEach(function (page) { if (typeof page.confidence === 'number') scores.push(page.confidence); });
    return { text: text, confidence: scores.length ? scores.reduce(function (a, b) { return a + b; }, 0) / scores.length : null };
  }
  function parseResult_(image) { var ocr = extractText_(image); return parse(ocr.text, ocr.confidence); }
  function extract(input) { return { front: parseResult_(input.front), back: input.back ? parseResult_(input.back) : null }; }
  return Object.freeze({ extract: extract, parse: parse, endpoint: ENDPOINT, feature: FEATURE });
})();

function extractGarudaVisitingCardWithConfiguredOcr_(input) { return JSKOS.GarudaCloudVisionOcr.extract(input || {}); }
