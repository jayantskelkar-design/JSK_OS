/** JSK OS Build 1007 - Claim foundation smoke test. */

function testClaimFoundation() {
  var migration = ensureBuild1007Claims();
  var search = new ClaimRepository().search({});
  var filters = getClaimFilters();
  if (!migration.success || !Array.isArray(search.items) || filters.statuses.indexOf('Settled') === -1) throw new Error('Claim foundation test failed.');
  var result = { success: true, schemaVersion: migration.schemaVersion, claimCount: search.totalItems, statusCount: filters.statuses.length };
  console.info(JSON.stringify(result)); return result;
}
