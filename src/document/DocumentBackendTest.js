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

function testDocumentHeaderMapping() {
  var repository = Object.create(DocumentRepository.prototype);
  var expected = {
    'Document ID': 'documentId',
    'File URL': 'fileUrl',
    'Drive File ID': 'driveFileId',
    'Company ID': 'companyId',
    'Policy ID': 'policyId'
  };
  Object.keys(expected).forEach(function (header) {
    if (repository.keyForHeader_(header) !== expected[header]) {
      throw new Error('Incorrect Document header mapping: ' + header);
    }
  });
  return { success: true, mappings: expected };
}

function testArchivedDocumentSearch() {
  var repository = Object.create(DocumentRepository.prototype);
  repository.headers = JSK_DOCUMENT_SCHEMA.HEADERS.slice();
  var archived = {
    documentId: 'DOC-ARCHIVED-TEST', documentName: 'Archived Test',
    documentType: 'Other', category: 'Other', status: 'Archived',
    companyId: 'COMPANY-TEST', recordVersion: 2, isDeleted: true
  };
  var row = repository.toRow_(archived);
  repository.sheet = {
    getLastRow: function () { return 2; },
    getRange: function () { return { getValues: function () { return [row]; } }; }
  };
  var visible = repository.search({ status: 'Archived' });
  var hidden = repository.search({});
  if (visible.total !== 1 || hidden.total !== 0) {
    throw new Error('Archived Document search behavior failed.');
  }
  return { success: true };
}

function testDocumentExpirySummary() {
  var reference = new Date('2026-08-04T00:00:00+05:30');
  var summary = JSKOS.DocumentAutomation.summarize([
    { documentId: '1', documentName: 'Expired', expiryDate: '2026-08-03' },
    { documentId: '2', documentName: '30', expiryDate: '2026-08-20' },
    { documentId: '3', documentName: '60', expiryDate: '2026-09-20' },
    { documentId: '4', documentName: '90', expiryDate: '2026-10-20' },
    { documentId: '5', documentName: 'Missing file' }
  ], reference);
  if (summary.expired !== 1 || summary.due30 !== 1 || summary.due60 !== 1 || summary.due90 !== 1 || summary.missingFile !== 5) {
    throw new Error('Document expiry summary test failed: ' + JSON.stringify(summary));
  }
  return { success: true, summary: summary };
}
