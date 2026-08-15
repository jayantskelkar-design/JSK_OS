/** JSK OS Build 1007 - Claim service and public API. */

function claimApiExecute_(operation, callback) {
  try { var context = JSKOS.AccessControl.requireModuleOperation('claims', operation); return { success: true, data: callback(context), error: null, meta: { operation: operation, timestamp: new Date().toISOString() } }; }
  catch (error) { console.error('Claim API ' + operation + ' failed: ' + (error.stack || error)); return { success: false, data: null, error: { name: error.name || 'Error', message: error.message || String(error), code: error.code || '', details: error.currentVersion ? { currentVersion: error.currentVersion } : {} } }; }
}
function claimRequest_(payload) { return payload && typeof payload === 'object' ? payload : {}; }
function claimRepository_() { ensureBuild1007Claims(); return new ClaimRepository(); }
function claimServerActor_(context) { var actor = String(context && context.email || '').trim().toLowerCase(); if (!/^[a-z0-9._%+\-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(actor)) throw new Error('Authenticated Claim actor is unavailable.'); return actor; }
function apiClaimCreate(payload) { return claimApiExecute_('create', function (context) { var r = claimRequest_(payload); return claimRepository_().create(r.data || {}, claimServerActor_(context)); }); }
function apiClaimGet(payload) { return claimApiExecute_('get', function () { var r = claimRequest_(payload), item = claimRepository_().findById(r.claimId, false); if (!item) throw new Error('Claim not found.'); return item; }); }
function apiClaimUpdate(payload) { return claimApiExecute_('update', function (context) { var r = claimRequest_(payload); return claimRepository_().update(r.claimId, r.data || {}, claimServerActor_(context), r.expectedVersion); }); }
function apiClaimDelete(payload) { return claimApiExecute_('delete', function (context) { var r = claimRequest_(payload); return claimRepository_().remove(r.claimId, claimServerActor_(context), r.expectedVersion); }); }
function apiClaimRestore(payload) { return claimApiExecute_('restore', function (context) { var r = claimRequest_(payload); return claimRepository_().restore(r.claimId, claimServerActor_(context), r.expectedVersion); }); }
function apiClaimSearch(payload) { return claimApiExecute_('search', function () { return claimRepository_().search(claimRequest_(payload)); }); }
function getClaimFilters() { JSKOS.AccessControl.requireModuleOperation('claims', 'filters'); return { types: JSK_CLAIM_SCHEMA.TYPE_VALUES.slice(), statuses: JSK_CLAIM_SCHEMA.STATUS_VALUES.slice(), priorities: JSK_CLAIM_SCHEMA.PRIORITY_VALUES.slice() }; }
