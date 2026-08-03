/** JSK OS Build 1008 - Document Vault service and public API. */

function documentApiExecute_(operation, callback) {
  try {
    return { success: true, data: callback(), error: null, meta: { operation: operation, timestamp: new Date().toISOString() } };
  } catch (error) {
    console.error('Document API ' + operation + ' failed: ' + (error.stack || error));
    return {
      success: false,
      data: null,
      error: {
        name: error.name || 'Error',
        message: error.message || String(error),
        code: error.code || '',
        details: error.currentVersion ? { currentVersion: error.currentVersion } : {}
      },
      meta: { operation: operation, timestamp: new Date().toISOString() }
    };
  }
}

function documentRequest_(payload) { return payload && typeof payload === 'object' ? payload : {}; }
function documentRepository_() { ensureBuild1008Documents(); return new DocumentRepository(); }

function apiDocumentCreate(payload) {
  return documentApiExecute_('create', function () {
    var request = documentRequest_(payload);
    return documentRepository_().create(request.data || request, request.actor);
  });
}

function apiDocumentGet(payload) {
  return documentApiExecute_('get', function () {
    var request = documentRequest_(payload);
    var item = documentRepository_().findById(request.documentId, false);
    if (!item) throw new Error('Document not found.');
    return item;
  });
}

function apiDocumentUpdate(payload) {
  return documentApiExecute_('update', function () {
    var request = documentRequest_(payload);
    return documentRepository_().update(request.documentId, request.data || {}, request.actor, request.expectedVersion);
  });
}

function apiDocumentDelete(payload) {
  return documentApiExecute_('delete', function () {
    var request = documentRequest_(payload);
    return documentRepository_().remove(request.documentId, request.actor, request.expectedVersion);
  });
}

function apiDocumentSearch(payload) {
  return documentApiExecute_('search', function () { return documentRepository_().search(documentRequest_(payload)); });
}

function getDocumentFilters() {
  return {
    documentTypes: JSK_DOCUMENT_SCHEMA.TYPE_VALUES.slice(),
    categories: JSK_DOCUMENT_SCHEMA.CATEGORY_VALUES.slice(),
    statuses: JSK_DOCUMENT_SCHEMA.STATUS_VALUES.slice()
  };
}
