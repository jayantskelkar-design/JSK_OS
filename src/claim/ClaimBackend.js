/** JSK OS Build 1007 - Claim service and public API. */

function claimApiExecute_(operation, callback) {
  try { return { success: true, data: callback(), error: null, meta: { operation: operation, timestamp: new Date().toISOString() } }; }
  catch (error) { console.error('Claim API ' + operation + ' failed: ' + (error.stack || error)); return { success: false, data: null, error: { name: error.name || 'Error', message: error.message || String(error), code: error.code || '', details: error.currentVersion ? { currentVersion: error.currentVersion } : {} } }; }
}
function claimRequest_(payload) { return payload && typeof payload === 'object' ? payload : {}; }
function claimRepository_() { ensureBuild1007Claims(); return new ClaimRepository(); }
function apiClaimCreate(payload) { return claimApiExecute_('create', function () { var r = claimRequest_(payload); return claimRepository_().create(r.data || {}, r.actor); }); }
function apiClaimGet(payload) { return claimApiExecute_('get', function () { var r = claimRequest_(payload), item = claimRepository_().findById(r.claimId, false); if (!item) throw new Error('Claim not found.'); return item; }); }
function apiClaimUpdate(payload) { return claimApiExecute_('update', function () { var r = claimRequest_(payload); return claimRepository_().update(r.claimId, r.data || {}, r.actor, r.expectedVersion); }); }
function apiClaimDelete(payload) { return claimApiExecute_('delete', function () { var r = claimRequest_(payload); return claimRepository_().remove(r.claimId, r.actor, r.expectedVersion); }); }
function apiClaimSearch(payload) { return claimApiExecute_('search', function () { return claimRepository_().search(claimRequest_(payload)); }); }
function getClaimFilters() { return { types: JSK_CLAIM_SCHEMA.TYPE_VALUES.slice(), statuses: JSK_CLAIM_SCHEMA.STATUS_VALUES.slice(), priorities: JSK_CLAIM_SCHEMA.PRIORITY_VALUES.slice() }; }
