/** JSK OS Build 1027 - GARUDA Lead IQ deterministic risk intelligence. */
var JSKOS = JSKOS || {};

JSKOS.GarudaLeadIntelligence = (function () {
  'use strict';

  var UNKNOWN = 'UNKNOWN';
  var MAX_TEXT = 20000;
  var RISK_RULES = Object.freeze([
    { domain: 'People', terms: ['employee', 'worker', 'staff', 'labour', 'factory'], risks: ['Employee health and accidental injury', 'Employer liability', 'Key-person dependency'], opportunities: ['Employee-risk review', 'Group health / accident review', 'Workers compensation review'] },
    { domain: 'Property', terms: ['manufactur', 'factory', 'plant', 'machinery', 'warehouse', 'stock', 'retail', 'trader'], risks: ['Fire and property damage', 'Plant, machinery or stock loss', 'Business interruption'], opportunities: ['Property and fire review', 'Machinery breakdown review', 'Business interruption review'] },
    { domain: 'Transit', terms: ['import', 'export', 'cargo', 'logistic', 'transport', 'shipping', 'trading'], risks: ['Goods in transit', 'Import/export cargo exposure'], opportunities: ['Marine cargo / inland transit review'] },
    { domain: 'Liability', terms: ['product', 'consult', 'professional', 'service', 'director', 'contract'], risks: ['Public or product liability', 'Professional or contractual liability', 'Management liability'], opportunities: ['Liability protection review', 'Professional indemnity / D&O review where applicable'] },
    { domain: 'Cyber and Crime', terms: ['software', 'technology', 'digital', 'data', 'online', 'finance', 'payment'], risks: ['Cyber and data exposure', 'Fraud, fidelity or crime exposure'], opportunities: ['Cyber and crime-risk review'] },
    { domain: 'Projects and Contractors', terms: ['contractor', 'construction', 'project', 'engineering', 'erection', 'site'], risks: ['Contract works damage', 'Worker and third-party injury', 'Project delay or equipment exposure'], opportunities: ['Contract works / erection review', 'Workers compensation and third-party liability review'] }
  ]);

  function analyze(input, options) {
    var normalized = normalizeInput_(input);
    var facts = confirmedFacts_(normalized);
    var evidence = searchableEvidence_(normalized, facts);
    var riskMap = riskMap_(evidence);
    var coverage = protection_(normalized, riskMap);
    var opportunities = opportunities_(riskMap, normalized);
    var unknowns = unknowns_(normalized);
    var assumptions = assumptions_(normalized, riskMap);
    var questions = questions_(unknowns, riskMap);
    var documents = documents_(normalized, riskMap);
    var priority = priority_(normalized, facts, riskMap, coverage);
    var result = {
      analysisVersion: 'GARUDA-LEAD-IQ-1',
      generatedAt: (options && options.now ? new Date(options.now) : new Date()).toISOString(),
      inputClassification: inputClassification_(normalized),
      leadSnapshot: leadSnapshot_(normalized),
      personIntelligence: personIntelligence_(normalized),
      companyIntelligence: companyIntelligence_(normalized),
      confirmedFacts: facts,
      assumptions: assumptions,
      unknowns: unknowns,
      riskMap: riskMap,
      protection: coverage,
      opportunities: opportunities,
      personalOpportunities: personalOpportunities_(normalized),
      priority: priority,
      discoveryQuestions: questions,
      documentsToRequest: documents,
      meetingStrategy: meetingStrategy_(riskMap, unknowns),
      solutionDirection: solutionDirection_(riskMap, coverage),
      nextBestAction: nextAction_(priority, normalized),
      sources: sources_(normalized),
      disclaimer: 'GARUDA provides preliminary risk intelligence based only on available information. Findings are not underwriting, legal, medical, financial or coverage advice and require advisor and client verification.'
    };
    result.internalReport = internalReport_(result);
    result.clientReport = clientReport_(result);
    return result;
  }

  function normalizeInput_(input) {
    input = input && typeof input === 'object' ? input : {};
    var output = {
      personId: text_(input.personId, 80), companyId: text_(input.companyId, 80),
      personName: text_(input.personName, 160), designation: text_(input.designation, 160),
      phone: text_(input.phone, 40), email: text_(input.email, 200), relationship: text_(input.relationship, 200),
      companyName: text_(input.companyName, 240), businessType: text_(input.businessType, 160),
      industry: text_(input.industry, 160), productsServices: text_(input.productsServices, 2000),
      location: text_(input.location, 300), website: safeUrl_(input.website),
      employeeInformation: text_(input.employeeInformation, 500), operatingFootprint: text_(input.operatingFootprint, 1000),
      businessActivities: text_(input.businessActivities, 3000), knownAssetsExposures: text_(input.knownAssetsExposures, 3000),
      existingCoverage: text_(input.existingCoverage, 4000), extractedText: text_(input.extractedText, MAX_TEXT),
      sourceType: enum_(input.sourceType, ['manual', 'business_card', 'brochure', 'pdf_text', 'website_information', 'jsk_os_record'], 'manual'),
      sourceReference: safeUrl_(input.sourceReference), personalReviewRequested: input.personalReviewRequested === true,
      decisionMakerAccess: bounded_(input.decisionMakerAccess), timingSignal: bounded_(input.timingSignal),
      relationshipStrength: bounded_(input.relationshipStrength), nextActionReadiness: bounded_(input.nextActionReadiness)
    };
    if (!output.companyName && !output.personName && !output.extractedText) {
      throw validation_('Company name, person name or extracted text is required.');
    }
    if (output.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(output.email)) throw validation_('Email address is invalid.');
    return output;
  }

  function confirmedFacts_(input) {
    var facts = [];
    function add(label, value, source) { if (value) facts.push({ label: label, value: value, source: source }); }
    var source = input.sourceType === 'jsk_os_record' ? 'JSK OS record' : 'User-provided data';
    add('Person name', input.personName, source); add('Designation', input.designation, source);
    add('Company name', input.companyName, source); add('Industry', input.industry, source);
    add('Business type', input.businessType, source); add('Products / services', input.productsServices, source);
    add('Location', input.location, source); add('Website', input.website, source);
    add('Business activities', input.businessActivities, source); add('Known assets / exposures', input.knownAssetsExposures, source);
    add('Existing coverage information', input.existingCoverage, source);
    return facts;
  }

  function riskMap_(evidence) {
    var found = [];
    RISK_RULES.forEach(function (rule) {
      var matches = rule.terms.filter(function (term) { return evidence.indexOf(term) !== -1; });
      if (matches.length) found.push({ domain: rule.domain, classification: 'POTENTIAL_EXPOSURE', evidence: matches, risks: rule.risks.slice(), requiresVerification: true });
    });
    if (!found.length) found.push({ domain: 'General Business', classification: 'INFORMATION_REQUIRED', evidence: [], risks: ['Business risk profile cannot be established from available information'], requiresVerification: true });
    return found;
  }

  function protection_(input, risks) {
    if (!input.existingCoverage) return risks.map(function (risk) { return { domain: risk.domain, state: 'INFORMATION_REQUIRED', statement: 'Existing coverage not available for verification.' }; });
    return risks.map(function (risk) { return { domain: risk.domain, state: 'POSSIBLE_GAP', statement: 'Coverage information was supplied but adequacy, limits and exclusions require document review.' }; });
  }

  function opportunities_(risks, input) {
    var seen = {}, items = [];
    risks.forEach(function (risk) {
      var rule = RISK_RULES.filter(function (candidate) { return candidate.domain === risk.domain; })[0];
      (rule ? rule.opportunities : ['Corporate insurance and risk review']).forEach(function (name) {
        if (!seen[name]) { seen[name] = true; items.push({ opportunity: name, basis: risk.domain + ' evidence requires verification', category: 'BUSINESS' }); }
      });
    });
    if (input.existingCoverage) items.unshift({ opportunity: 'Existing programme adequacy review', basis: 'Coverage information is available for structured verification', category: 'BUSINESS' });
    return items;
  }

  function priority_(input, facts, risks, coverage) {
    var dimensions = {
      decisionMakerAccess: input.decisionMakerAccess,
      businessRelevance: Math.min(5, Math.max(1, risks.length)),
      identifiableExposure: Math.min(5, risks.length + (input.knownAssetsExposures ? 1 : 0)),
      protectionReviewNeed: coverage.some(function (item) { return item.state === 'INFORMATION_REQUIRED'; }) ? 4 : 3,
      timingSignal: input.timingSignal,
      dataCompleteness: Math.min(5, Math.max(1, Math.round(facts.length / 2))),
      relationshipStrength: input.relationshipStrength,
      nextActionReadiness: input.nextActionReadiness
    };
    var total = Object.keys(dimensions).reduce(function (sum, key) { return sum + dimensions[key]; }, 0);
    var score = Math.round(total / 40 * 100);
    return { score: score, label: score >= 75 ? 'High' : score >= 45 ? 'Medium' : 'Early-stage', dimensions: dimensions, explanation: 'Transparent score based on access, relevance, exposure evidence, review need, timing, completeness, relationship and action readiness.' };
  }

  function clientReport_(result) {
    return {
      title: 'JSK BUSINESS RISK REVIEW', subtitle: 'Powered by GARUDA Intelligence',
      businessSnapshot: result.companyIntelligence,
      keyRiskAreas: result.riskMap.map(function (item) { return { domain: item.domain, risks: item.risks, status: item.classification }; }),
      informationReviewed: result.confirmedFacts.map(function (fact) { return { label: fact.label, value: fact.value, source: fact.source }; }),
      areasRequiringVerification: result.unknowns.slice(), potentialProtectionGaps: result.protection.slice(),
      recommendedRiskReview: result.solutionDirection, suggestedDocuments: result.documentsToRequest.slice(),
      practicalNextSteps: [result.nextBestAction, 'Validate all findings with the business before making protection decisions.'],
      disclaimer: result.disclaimer
    };
  }

  function internalReport_(result) {
    return {
      title: 'GARUDA LEAD IQ - JSK INTERNAL INTELLIGENCE REPORT', leadSnapshot: result.leadSnapshot,
      personIntelligence: result.personIntelligence, companyIntelligence: result.companyIntelligence,
      confirmedFacts: result.confirmedFacts, assumptions: result.assumptions, unknowns: result.unknowns,
      businessRiskMap: result.riskMap, protectionInformation: result.protection, businessOpportunities: result.opportunities,
      personalFamilyOpportunities: result.personalOpportunities, priority: result.priority,
      discoveryQuestions: result.discoveryQuestions, documentsToRequest: result.documentsToRequest,
      meetingStrategy: result.meetingStrategy, solutionDirection: result.solutionDirection,
      nextBestAction: result.nextBestAction, followUpPriority: result.priority.label,
      sources: result.sources, disclaimer: result.disclaimer
    };
  }

  function unknowns_(i) { var fields = [['Employee count', i.employeeInformation], ['Operating footprint', i.operatingFootprint], ['Asset values', i.knownAssetsExposures], ['Existing policy limits and exclusions', i.existingCoverage], ['Turnover and financial position', ''], ['Claims history', ''], ['Renewal dates', '']]; return fields.filter(function (x) { return !x[1]; }).map(function (x) { return x[0] + ': ' + UNKNOWN; }); }
  function assumptions_(i, risks) { return risks.filter(function (r) { return r.classification === 'POTENTIAL_EXPOSURE'; }).map(function (r) { return { statement: r.domain + ' exposure may exist based on supplied business descriptors.', basis: r.evidence.join(', '), status: 'INFERENCE_REQUIRES_VERIFICATION' }; }); }
  function questions_(unknowns, risks) { var q = unknowns.map(function (x) { return 'Please confirm ' + x.split(':')[0].toLowerCase() + '.'; }); risks.forEach(function (r) { q.push('How does the business currently manage ' + r.domain.toLowerCase() + ' risks?'); }); return unique_(q).slice(0, 15); }
  function documents_(i, risks) { var items = ['Current insurance schedule and policy copies', 'Recent claims summary', 'Asset and stock declaration', 'Employee census where relevant']; if (risks.some(function (r) { return r.domain === 'Transit'; })) items.push('Import/export and transit details'); if (i.sourceType !== 'brochure' && i.sourceType !== 'pdf_text') items.push('Company profile or brochure'); return unique_(items); }
  function personalOpportunities_(i) { return i.personalReviewRequested ? [{ opportunity: 'Separate personal/family protection discovery', basis: 'Explicitly requested; personal facts remain unknown until provided.' }] : []; }
  function meetingStrategy_(risks, unknowns) { return 'Lead with business understanding. Validate ' + risks.map(function (r) { return r.domain; }).join(', ') + ' exposures, then close the information gaps before discussing products. ' + unknowns.length + ' material information areas remain unknown.'; }
  function solutionDirection_(risks, coverage) { return 'Conduct a structured business risk and existing-coverage review focused on ' + risks.map(function (r) { return r.domain; }).join(', ') + '. Requires verification: treat all protection findings as provisional until policy documents and business facts are verified. Current gap state: ' + unique_(coverage.map(function (x) { return x.state; })).join(', ') + '.'; }
  function nextAction_(priority, input) { if (!input.companyName && !input.personName) return 'Validate the extracted identity and business details before saving or contacting the prospect.'; return priority.label === 'High' ? 'Schedule a discovery meeting and request the listed verification documents.' : 'Complete missing business facts and confirm decision-maker access before proposing a review.'; }
  function leadSnapshot_(i) { return { personName: i.personName || UNKNOWN, companyName: i.companyName || UNKNOWN, designation: i.designation || UNKNOWN, industry: i.industry || UNKNOWN, sourceType: i.sourceType }; }
  function personIntelligence_(i) { return { name: i.personName || UNKNOWN, designation: i.designation || UNKNOWN, contact: { phone: i.phone || UNKNOWN, email: i.email || UNKNOWN }, relationshipToCompany: i.relationship || UNKNOWN, decisionMakerRelevance: i.designation ? 'Requires verification from stated designation.' : UNKNOWN }; }
  function companyIntelligence_(i) { return { name: i.companyName || UNKNOWN, businessType: i.businessType || UNKNOWN, industry: i.industry || UNKNOWN, productsServices: i.productsServices || UNKNOWN, location: i.location || UNKNOWN, website: i.website || UNKNOWN, employeeInformation: i.employeeInformation || UNKNOWN, operatingFootprint: i.operatingFootprint || UNKNOWN, businessActivities: i.businessActivities || UNKNOWN }; }
  function sources_(i) { var result = [{ type: i.sourceType, classification: i.sourceType === 'jsk_os_record' ? 'JSK_OS_DATA' : 'USER_PROVIDED_DATA', reference: i.sourceReference || 'No external reference supplied' }]; if (i.extractedText) result.push({ type: 'extracted_text', classification: 'USER_PROVIDED_DATA', reference: 'Supplied text; original document should be retained separately' }); return result; }
  function inputClassification_(i) { return { userProvided: i.sourceType !== 'jsk_os_record', jskOsData: i.sourceType === 'jsk_os_record', publicResearch: false, aiInference: true, externalResearchPerformed: false }; }
  function searchableEvidence_(i, facts) { return (facts.map(function (f) { return f.value; }).join(' ') + ' ' + i.extractedText + ' ' + i.operatingFootprint).toLowerCase(); }
  function unique_(items) { var seen = {}; return items.filter(function (item) { var key = JSON.stringify(item); if (seen[key]) return false; seen[key] = true; return true; }); }
  function bounded_(value) { var n = Number(value); return isFinite(n) ? Math.max(0, Math.min(5, Math.round(n))) : 0; }
  function enum_(value, allowed, fallback) { value = String(value || '').trim().toLowerCase(); return allowed.indexOf(value) === -1 ? fallback : value; }
  function safeUrl_(value) { var text = text_(value, 1000); if (!text) return ''; if (!/^https?:\/\//i.test(text)) throw validation_('Website/source URLs must use http or https.'); return text; }
  function text_(value, limit) { var text = String(value === null || value === undefined ? '' : value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim(); if (text.length > limit) throw validation_('Input exceeds the permitted length.'); return text; }
  function validation_(message) { var error = new Error(message); error.code = 'GARUDA_VALIDATION_ERROR'; error.status = 400; return error; }

  return Object.freeze({ analyze: analyze, normalizeInput: normalizeInput_ });
})();
