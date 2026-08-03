/** JSK OS Build 1008 - Document Vault foundation smoke test. */

function testDocumentFoundation() {
  var migration = ensureBuild1008Documents();
  var repository = new DocumentRepository();
  var search = repository.search({});
  var filters = getDocumentFilters();
  var result = {
    success: migration.success === true && Array.isArray(search.items) && filters.statuses.indexOf('Verified') !== -1,
    build: 1008,
    schemaVersion: JSK_DOCUMENT_SCHEMA.VERSION,
    sheetName: JSK_DOCUMENT_SCHEMA.SHEET_NAME,
    documentCount: search.total,
    filters: filters
  };
  console.info(JSON.stringify(result));
  if (!result.success) throw new Error('Build 1008 Document Vault foundation test failed.');
  return result;
}

function testDocumentApiSerialization() {
  var source = {
    createdAt: new Date('2026-08-03T12:00:00.000Z'),
    nested: [{ expiryDate: new Date('2027-08-03T12:00:00.000Z') }]
  };
  var serialized = documentApiSerialize_(source);
  var success =
    serialized.createdAt === '2026-08-03T12:00:00.000Z' &&
    serialized.nested[0].expiryDate === '2027-08-03T12:00:00.000Z';
  if (!success) throw new Error('Document API date serialization test failed.');
  return { success: true, serialized: serialized };
}
