/** JSK OS Build 1027 - authorized, read-only GARUDA API boundary. */
function apiGarudaAnalyze(payload) {
  return garudaApiExecute_('analyze', function (context) {
    var request = payload && typeof payload === 'object' ? payload : {};
    var input = request.input && typeof request.input === 'object' ? Object.assign({}, request.input) : {};
    enrichGarudaInputFromJskOs_(input, request, context);
    return JSKOS.GarudaLeadIntelligence.analyze(input);
  });
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
