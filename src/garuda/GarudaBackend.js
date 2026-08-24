/** JSK OS Build 1027 - authorized, read-only GARUDA API boundary. */
function apiGarudaAnalyze(payload) {
  return garudaApiExecute_('analyze', function (context) {
    var request = payload && typeof payload === 'object' ? payload : {};
    var input = request.input && typeof request.input === 'object' ? Object.assign({}, request.input) : {};
    enrichGarudaInputFromJskOs_(input, request, context);
    return JSKOS.GarudaLeadIntelligence.analyze(input);
  });
}

function apiGarudaExtractVisitingCard(payload) {
  return garudaApiExecute_('extract-card', function () {
    var request = payload && typeof payload === 'object' ? payload : {};
    var front = JSKOS.GarudaVisitingCard.validateImage(request.front, true);
    var back = JSKOS.GarudaVisitingCard.validateImage(request.back, false);
    if (typeof extractGarudaVisitingCardWithConfiguredOcr_ !== 'function') {
      var unavailable = new Error('Visiting-card OCR is not configured. Contact an Administrator to enable the approved OCR provider.');
      unavailable.code = 'GARUDA_OCR_UNAVAILABLE'; unavailable.status = 503; throw unavailable;
    }
    var extracted = extractGarudaVisitingCardWithConfiguredOcr_({ front: front, back: back });
    return JSKOS.GarudaVisitingCard.merge(extracted && extracted.front, extracted && extracted.back);
  });
}

function apiGarudaResolveExistingEntities(payload) {
  return garudaApiExecute_('resolve-existing-entities', function () {
    JSKOS.AccessControl.requirePermission('companies.view');
    JSKOS.AccessControl.requirePermission('people.view');
    requireCompanySchema_(); requirePeopleSchema_();
    return JSKOS.GarudaCrmResolver.resolve(payload || {}, garudaReadAll_(new PeopleRepository()), garudaReadAll_(new CompanyRepository()));
  });
}

function garudaReadAll_(repository) {
  var items = [], page = 1, result;
  do { if (page > 100) { var error = new Error('CRM match resolution is unavailable because the complete record set could not be inspected safely.'); error.code = 'GARUDA_RESOLUTION_LIMIT'; error.status = 503; throw error; } result = repository.search({ page: page, pageSize: 100 }); items = items.concat(result && result.items || []); page += 1; } while (result && result.pagination && result.pagination.hasNext);
  return items;
}

function garudaApiExecute_(operation, callback) {
  try {
    // GARUDA analysis is read-only; use the same explicit permission as the UI route.
    var context = JSKOS.AccessControl.requirePermission('garuda.view');
    return { success: true, data: callback(context), error: null, meta: { operation: operation, readOnly: true, build: 1027 } };
  } catch (error) {
    console.error('GARUDA ' + operation + ' failed: ' + garudaSafeError_(error));
    return { success: false, data: null, error: { code: error.code || 'GARUDA_ERROR', message: error.message || 'GARUDA analysis could not be completed.' }, meta: { operation: operation, readOnly: true, build: 1027 } };
  }
}

function enrichGarudaInputFromJskOs_(input, request) {
  var companyId = String(request.companyId || input.companyId || '').trim();
  var personId = String(request.personId || input.personId || '').trim();
  if (companyId) {
    JSKOS.AccessControl.requirePermission('companies.view');
    requireCompanySchema_();
    var company = new CompanyRepository().findById(companyId, { includeDeleted: false });
    if (!company) throw garudaNotFound_('Company', companyId);
    input.companyId = companyId; input.companyName = input.companyName || company.companyName;
    input.industry = input.industry || company.industry; input.businessType = input.businessType || company.companyType;
    input.location = input.location || [company.city, company.state, company.country].filter(Boolean).join(', ');
    input.website = input.website || company.website; input.sourceType = 'jsk_os_record';
  }
  if (personId) {
    JSKOS.AccessControl.requirePermission('people.view');
    requirePeopleSchema_();
    var person = new PeopleRepository().findById(personId);
    if (!person) throw garudaNotFound_('Person', personId);
    input.personId = personId; input.personName = input.personName || person.fullName;
    input.designation = input.designation || person.designation; input.phone = input.phone || person.mobile;
    input.email = input.email || person.email; input.companyId = input.companyId || person.companyId;
    input.sourceType = 'jsk_os_record';
  }
}

function garudaNotFound_(entity, id) { var error = new Error(entity + ' not found: ' + id); error.code = 'GARUDA_SOURCE_NOT_FOUND'; error.status = 404; return error; }
function garudaSafeError_(error) { return String(error && error.message ? error.message : error || 'Unknown error').replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]').substring(0, 300); }
