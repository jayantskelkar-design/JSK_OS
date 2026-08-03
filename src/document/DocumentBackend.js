/** JSK OS Build 1008 - Document Vault service and public API. */

function documentApiExecute_(operation, callback) {
  try {
    return { success: true, data: documentApiSerialize_(callback()), error: null, meta: { operation: operation, timestamp: new Date().toISOString() } };
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

/** Converts Apps Script Date values into browser-safe ISO strings. */
function documentApiSerialize_(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(documentApiSerialize_);
  if (value && typeof value === 'object') {
    var result = {};
    Object.keys(value).forEach(function (key) {
      result[key] = documentApiSerialize_(value[key]);
    });
    return result;
  }
  return value;
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

function apiDocumentRestore(payload) {
  return documentApiExecute_('restore', function () {
    var request = documentRequest_(payload);
    return documentRepository_().restore(request.documentId, request.actor, request.expectedVersion);
  });
}

function apiDocumentUpload(payload) {
  return documentApiExecute_('upload', function () {
    var request = documentRequest_(payload);
    var name = String(request.fileName || '').trim();
    var mimeType = String(request.mimeType || 'application/octet-stream').trim();
    var encoded = String(request.base64 || '').replace(/^data:[^;]+;base64,/, '');
    if (!name || !encoded) throw new Error('Select a file to upload.');
    var bytes = Utilities.base64Decode(encoded);
    if (bytes.length > 8 * 1024 * 1024) throw new Error('File size must be 8 MB or less.');
    var folder = getDocumentVaultFolder_();
    var file = folder.createFile(Utilities.newBlob(bytes, mimeType, name));
    return { fileUrl: file.getUrl(), driveFileId: file.getId(), mimeType: file.getMimeType(), fileSize: file.getSize(), fileName: file.getName() };
  });
}

function getDocumentVaultFolder_() {
  var properties = PropertiesService.getScriptProperties();
  var folderId = String(properties.getProperty('JSK_OS_DOCUMENT_FOLDER_ID') || '').trim();
  if (folderId) {
    try { return DriveApp.getFolderById(folderId); } catch (error) { console.warn('Configured Document Vault folder is unavailable.'); }
  }
  var folders = DriveApp.getFoldersByName('JSK OS Document Vault');
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder('JSK OS Document Vault');
  properties.setProperty('JSK_OS_DOCUMENT_FOLDER_ID', folder.getId());
  return folder;
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
