/** JSK OS Build 1008 - Document Vault repository. */

class DocumentRepository {
  constructor() {
    ensureBuild1008Documents();
    this.sheet = JSKOS.ConfigService.getSpreadsheet().getSheetByName(JSK_DOCUMENT_SCHEMA.SHEET_NAME);
    this.headers = this.sheet.getRange(1, 1, 1, this.sheet.getLastColumn()).getDisplayValues()[0];
  }

  create(data, actor) {
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
    var now = new Date();
    var item = this.normalize_(data || {});
    item.documentId = item.documentId || this.newId_();
    item.status = item.status || 'Draft';
    item.category = item.category || 'Other';
    item.createdAt = now;
    item.createdBy = actor || item.createdBy || Session.getActiveUser().getEmail() || 'System';
    item.updatedAt = now;
    item.updatedBy = item.createdBy;
    item.recordVersion = 1;
    item.isDeleted = false;
    this.validate_(item);
    this.sheet.appendRow(this.toRow_(item));
    SpreadsheetApp.flush();
    return this.findById(item.documentId, true);
    } finally {
      lock.releaseLock();
    }
  }

  findById(documentId, includeDeleted) {
    var index = this.findRow_(documentId);
    if (!index) return null;
    var item = this.fromRow_(this.sheet.getRange(index, 1, 1, this.headers.length).getValues()[0]);
    return !includeDeleted && item.isDeleted ? null : item;
  }

  update(documentId, changes, actor, expectedVersion) {
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
    var index = this.findRow_(documentId);
    if (!index) throw new Error('Document not found.');
    var current = this.fromRow_(this.sheet.getRange(index, 1, 1, this.headers.length).getValues()[0]);
    if (current.isDeleted) throw new Error('Document is archived.');
    if (expectedVersion !== undefined && Number(expectedVersion) !== Number(current.recordVersion)) {
      var conflict = new Error('Document was modified by another user.');
      conflict.name = 'DocumentConflictError';
      conflict.code = 'VERSION_CONFLICT';
      conflict.currentVersion = current.recordVersion;
      throw conflict;
    }
    var patch = this.normalize_(changes || {});
    delete patch.documentId;
    var item = Object.assign({}, current, patch, {
      updatedAt: new Date(),
      updatedBy: actor || Session.getActiveUser().getEmail() || 'System',
      recordVersion: Number(current.recordVersion || 0) + 1
    });
    this.validate_(item);
    this.sheet.getRange(index, 1, 1, this.headers.length).setValues([this.toRow_(item)]);
    SpreadsheetApp.flush();
    return this.findById(documentId, true);
    } finally {
      lock.releaseLock();
    }
  }

  remove(documentId, actor, expectedVersion) {
    return this.update(documentId, { isDeleted: true, status: 'Archived' }, actor, expectedVersion);
  }

  search(criteria) {
    criteria = criteria || {};
    var rows = this.sheet.getLastRow() < 2 ? [] : this.sheet.getRange(2, 1, this.sheet.getLastRow() - 1, this.headers.length).getValues();
    var query = String(criteria.query || '').trim().toLowerCase();
    var items = rows.map(this.fromRow_.bind(this)).filter(function (item) {
      if (!criteria.includeDeleted && criteria.status !== 'Archived' && item.isDeleted) return false;
      if (criteria.documentType && item.documentType !== criteria.documentType) return false;
      if (criteria.category && item.category !== criteria.category) return false;
      if (criteria.status && item.status !== criteria.status) return false;
      var links = ['companyId', 'personId', 'policyId', 'claimId', 'taskId', 'meetingId'];
      for (var i = 0; i < links.length; i += 1) {
        if (criteria[links[i]] && item[links[i]] !== criteria[links[i]]) return false;
      }
      if (!query) return true;
      return [item.documentName, item.documentType, item.category, item.fileUrl,
        item.driveFileId, item.description, item.notes].some(function (value) {
        return String(value || '').toLowerCase().indexOf(query) !== -1;
      });
    });
    items.sort(function (a, b) { return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0); });
    return { items: items, total: items.length };
  }

  validate_(item) {
    if (!String(item.documentName || '').trim()) throw new Error('Document Name is required.');
    if (JSK_DOCUMENT_SCHEMA.TYPE_VALUES.indexOf(item.documentType) === -1) throw new Error('Select a valid Document Type.');
    if (JSK_DOCUMENT_SCHEMA.CATEGORY_VALUES.indexOf(item.category) === -1) throw new Error('Select a valid Document Category.');
    if (JSK_DOCUMENT_SCHEMA.STATUS_VALUES.indexOf(item.status) === -1) throw new Error('Select a valid Document Status.');
    if (!item.fileUrl && !item.driveFileId) throw new Error('File URL or Drive File ID is required.');
    if (item.fileUrl && !/^https?:\/\//i.test(item.fileUrl)) throw new Error('Enter a valid File URL.');
    if (item.fileSize !== '' && item.fileSize !== null && item.fileSize !== undefined && Number(item.fileSize) < 0) throw new Error('File Size cannot be negative.');
    if (item.issueDate && isNaN(new Date(item.issueDate).getTime())) throw new Error('Enter a valid Issue Date.');
    if (item.expiryDate && isNaN(new Date(item.expiryDate).getTime())) throw new Error('Enter a valid Expiry Date.');
    if (item.issueDate && item.expiryDate && new Date(item.expiryDate) < new Date(item.issueDate)) throw new Error('Expiry Date cannot be before Issue Date.');
    var linked = ['companyId', 'personId', 'policyId', 'claimId', 'taskId', 'meetingId'].some(function (key) { return Boolean(item[key]); });
    if (!linked) throw new Error('Link the document to a Company, Person, Policy, Claim, Task or Meeting.');
  }

  normalize_(data) {
    var aliases = {
      'Document ID': 'documentId', 'Document Name': 'documentName', 'Document Type': 'documentType',
      'File URL': 'fileUrl', 'Drive File ID': 'driveFileId', 'Mime Type': 'mimeType', 'File Size': 'fileSize',
      'Issue Date': 'issueDate', 'Expiry Date': 'expiryDate', 'Verified At': 'verifiedAt', 'Verified By': 'verifiedBy',
      'Company ID': 'companyId', 'Person ID': 'personId', 'Policy ID': 'policyId', 'Claim ID': 'claimId',
      'Task ID': 'taskId', 'Meeting ID': 'meetingId', 'Created At': 'createdAt', 'Created By': 'createdBy',
      'Updated At': 'updatedAt', 'Updated By': 'updatedBy', 'Record Version': 'recordVersion', 'Is Deleted': 'isDeleted'
    };
    var result = {};
    Object.keys(data || {}).forEach(function (key) { result[aliases[key] || key] = data[key]; });
    ['documentName', 'documentType', 'category', 'status', 'fileUrl', 'driveFileId', 'mimeType',
      'verifiedBy', 'description', 'notes', 'companyId', 'personId', 'policyId', 'claimId', 'taskId', 'meetingId']
      .forEach(function (key) { if (result[key] !== undefined && result[key] !== null) result[key] = String(result[key]).trim(); });
    if (result.fileSize !== undefined && result.fileSize !== '') result.fileSize = Number(result.fileSize);
    return result;
  }

  findRow_(documentId) {
    if (!String(documentId || '').trim()) throw new Error('Document ID is required. Refresh the Document Vault and try again.');
    if (this.sheet.getLastRow() < 2) return 0;
    var column = this.headers.indexOf('Document ID') + 1;
    var match = this.sheet.getRange(2, column, this.sheet.getLastRow() - 1, 1)
      .createTextFinder(String(documentId)).matchEntireCell(true).findNext();
    return match ? match.getRow() : 0;
  }

  newId_() {
    return 'DOC-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Kolkata', 'yyyyMMddHHmmss') + '-' + Utilities.getUuid().slice(0, 6).toUpperCase();
  }

  toRow_(item) {
    var self = this;
    return this.headers.map(function (header) { return self.valueForHeader_(item, header); });
  }

  fromRow_(row) {
    var item = {}, self = this;
    this.headers.forEach(function (header, index) { item[self.keyForHeader_(header)] = row[index]; });
    item.recordVersion = Number(item.recordVersion || 0);
    item.isDeleted = item.isDeleted === true || String(item.isDeleted).toUpperCase() === 'TRUE';
    return item;
  }

  valueForHeader_(item, header) { return item[this.keyForHeader_(header)] === undefined ? '' : item[this.keyForHeader_(header)]; }

  keyForHeader_(header) {
    var canonicalKeys = {
      'Document ID': 'documentId',
      'File URL': 'fileUrl',
      'Drive File ID': 'driveFileId',
      'Company ID': 'companyId',
      'Person ID': 'personId',
      'Policy ID': 'policyId',
      'Claim ID': 'claimId',
      'Task ID': 'taskId',
      'Meeting ID': 'meetingId'
    };
    if (canonicalKeys[header]) return canonicalKeys[header];
    return header.replace(/[^A-Za-z0-9]+(.)/g, function (_, chr) { return chr.toUpperCase(); }).replace(/^./, function (chr) { return chr.toLowerCase(); });
  }
}
