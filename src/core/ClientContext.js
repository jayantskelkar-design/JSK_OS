/** JSK OS Build 1015 - shared, read-only Company/Person context. */
var JSKOS = JSKOS || {};

JSKOS.ClientContext = Object.freeze((function () {
  'use strict';
  var DEFAULT_POLICY_LIMIT = 50;
  var MAX_POLICY_LIMIT = 100;
  var ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;

  function cleanId_(value) {
    var id = String(value || '').trim().toUpperCase();
    return ID_PATTERN.test(id) ? id : '';
  }

  function normalizePolicyIds_(value, limit) {
    var values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
    var seen = {}, valid = [], invalid = 0;
    values.forEach(function (entry) {
      var id = cleanId_(entry);
      if (!id) { if (String(entry || '').trim()) invalid += 1; return; }
      if (!seen[id]) { seen[id] = true; valid.push(id); }
    });
    return { values: valid.slice(0, limit), available: valid.length, invalid: invalid, truncated: valid.length > limit };
  }

  function normalize(input, options) {
    input = input && typeof input === 'object' ? input : {};
    options = options || {};
    var requestedLimit = Number(options.policyLimit || input.policyLimit || DEFAULT_POLICY_LIMIT);
    var policyLimit = Math.max(1, Math.min(isFinite(requestedLimit) ? requestedLimit : DEFAULT_POLICY_LIMIT, MAX_POLICY_LIMIT));
    var companyId = cleanId_(input.companyId), personId = cleanId_(input.personId);
    var policies = normalizePolicyIds_(input.policyIds, policyLimit);
    var malformed = Boolean((input.companyId && !companyId) || (input.personId && !personId) || policies.invalid);
    if (options.strict && malformed) throw new Error('Client context contains an invalid identifier.');
    return Object.freeze({
      companyId: companyId,
      personId: personId,
      policyIds: Object.freeze(policies.values),
      active: Boolean(companyId || personId || policies.values.length),
      malformed: malformed,
      meta: Object.freeze({ limit: policyLimit, returned: policies.values.length, available: policies.available, truncated: policies.truncated, invalidIgnored: policies.invalid })
    });
  }

  function matches(record, context) {
    context = normalize(context);
    record = record || {};
    if (context.companyId && cleanId_(record.companyId) !== context.companyId) return false;
    if (context.personId && cleanId_(record.personId) !== context.personId) return false;
    if (context.policyIds.length && context.policyIds.indexOf(cleanId_(record.policyId)) === -1) return false;
    return true;
  }

  function filter(items, context, options) {
    options = options || {};
    context = normalize(context, options);
    var limit = Math.max(1, Math.min(Number(options.limit) || 250, 500));
    var matchesAll = (items || []).filter(function (item) { return matches(item, context); });
    return { items: matchesAll.slice(0, limit), context: context, meta: { returned: Math.min(matchesAll.length, limit), available: matchesAll.length, truncated: matchesAll.length > limit, limit: limit, queryCount: Number(options.queryCount) || 1 } };
  }

  function query(context) {
    context = normalize(context);
    var values=[];
    if(context.companyId)values.push('companyId='+encodeURIComponent(context.companyId));
    if(context.personId)values.push('personId='+encodeURIComponent(context.personId));
    if(context.policyIds.length)values.push('policyIds='+encodeURIComponent(context.policyIds.join(',')));
    return values.join('&');
  }

  return { normalize:normalize, matches:matches, filter:filter, query:query, DEFAULT_POLICY_LIMIT:DEFAULT_POLICY_LIMIT, MAX_POLICY_LIMIT:MAX_POLICY_LIMIT };
})());
