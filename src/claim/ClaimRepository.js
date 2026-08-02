/** JSK OS Build 1007 - Claim repository. */

class ClaimRepository {
  constructor(spreadsheet) {
    this.spreadsheet = spreadsheet || JSKOS.ConfigService.getSpreadsheet();
    this.sheet = this.spreadsheet.getSheetByName(JSK_CLAIM_SCHEMA.SHEET_NAME);
    if (!this.sheet) throw new Error('Claims sheet not found. Run ensureBuild1007Claims().');
    this.headers = this.sheet.getRange(1, 1, 1, this.sheet.getLastColumn()).getDisplayValues()[0].map(function (v) { return String(v || '').trim(); });
    this.map = {}; this.headers.forEach(function (h, i) { if (h) this.map[h] = i; }, this);
  }

  create(data, actor) {
    var claim = this._normalize(data); this._validate(claim);
    var now = new Date(), record = this._empty();
    Object.assign(record, claim, {
      'Claim ID': 'CLM-' + Utilities.formatDate(now, 'Asia/Kolkata', 'yyyyMMddHHmmss') + '-' + Utilities.getUuid().replace(/-/g, '').substring(0, 6).toUpperCase(),
      'Status': claim['Status'] || 'Draft', 'Priority': claim['Priority'] || 'Medium',
      'Created At': now, 'Created By': this._actor(actor), 'Updated At': now,
      'Updated By': this._actor(actor), 'Record Version': 1, 'Is Deleted': false
    });
    this.sheet.appendRow(this._toRow(record));
    return this.findById(record['Claim ID'], true);
  }

  findById(id, includeDeleted) {
    var entry = this._find(String(id || '').trim().toUpperCase());
    if (!entry || (!includeDeleted && this._bool(entry.record['Is Deleted']))) return null;
    return this._format(entry.record);
  }

  update(id, changes, actor, expectedVersion) {
    var lock = LockService.getScriptLock(); lock.waitLock(30000);
    try {
      var entry = this._find(String(id || '').trim().toUpperCase());
      if (!entry) throw new Error('Claim not found.');
      var version = Number(entry.record['Record Version']) || 1;
      if (expectedVersion !== undefined && Number(expectedVersion) !== version) {
        var conflict = new Error('Claim was modified by another user.'); conflict.code = 'VERSION_CONFLICT'; conflict.currentVersion = version; throw conflict;
      }
      var updated = Object.assign({}, entry.record, this._normalize(changes)); this._validate(updated);
      updated['Updated At'] = new Date(); updated['Updated By'] = this._actor(actor); updated['Record Version'] = version + 1;
      this.sheet.getRange(entry.row, 1, 1, this.headers.length).setValues([this._toRow(updated)]); SpreadsheetApp.flush();
      return this._format(updated);
    } finally { lock.releaseLock(); }
  }

  remove(id, actor, expectedVersion) { return this.update(id, { 'Is Deleted': true }, actor, expectedVersion); }

  search(criteria) {
    criteria = criteria || {};
    var query = String(criteria.query || '').trim().toLowerCase(), status = String(criteria.status || '').trim().toLowerCase();
    var type = String(criteria.claimType || '').trim().toLowerCase(), owner = String(criteria.owner || '').trim().toLowerCase();
    var linkField = criteria.policyId ? 'Policy ID' : criteria.companyId ? 'Company ID' : criteria.personId ? 'Person ID' : '';
    var linkValue = criteria.policyId || criteria.companyId || criteria.personId || '';
    var items = this._entries().filter(function (entry) {
      var r = entry.record;
      if (!r['Claim ID'] || this._bool(r['Is Deleted'])) return false;
      if (status && String(r['Status']).toLowerCase() !== status) return false;
      if (type && String(r['Claim Type']).toLowerCase() !== type) return false;
      if (owner && String(r['Assigned Owner']).toLowerCase() !== owner) return false;
      if (linkField && String(r[linkField]).toUpperCase() !== String(linkValue).trim().toUpperCase()) return false;
      if (query && ['Claim Number', 'Insurer Reference', 'TPA Name', 'Description', 'Notes'].every(function (h) { return String(r[h] || '').toLowerCase().indexOf(query) === -1; })) return false;
      return true;
    }, this).map(function (entry) { return this._format(entry.record); }, this);
    items.sort(function (a, b) { return String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')); });
    return { items: items, totalItems: items.length };
  }

  _entries() { var count = this.sheet.getLastRow() - 1; if (count < 1) return []; return this.sheet.getRange(2, 1, count, this.headers.length).getValues().map(function (row, i) { return { row: i + 2, record: this._fromRow(row) }; }, this); }
  _find(id) { return this._entries().filter(function (e) { return String(e.record['Claim ID']).toUpperCase() === id; })[0] || null; }
  _fromRow(row) { var r = {}; this.headers.forEach(function (h, i) { if (h) r[h] = row[i]; }); return r; }
  _toRow(record) { return this.headers.map(function (h) { return record[h] === null || record[h] === undefined ? '' : record[h]; }); }
  _empty() { var r = {}; this.headers.forEach(function (h) { if (h) r[h] = ''; }); return r; }
  _actor(actor) { return String(actor || '').trim() || Session.getActiveUser().getEmail() || 'SYSTEM'; }
  _bool(v) { return v === true || String(v).toLowerCase() === 'true'; }
  _date(v) { if (!v) return null; var d = v instanceof Date ? new Date(v.getTime()) : new Date(v); return isNaN(d.getTime()) ? null : d; }
  _normalize(data) {
    data = data || {};
    var aliases = { claimNumber:'Claim Number', claimType:'Claim Type', status:'Status', priority:'Priority', intimationDate:'Intimation Date', incidentDate:'Incident Date', admissionDate:'Admission Date', dischargeDate:'Discharge Date', claimAmount:'Claim Amount', approvedAmount:'Approved Amount', settledAmount:'Settled Amount', insurerReference:'Insurer Reference', tpaName:'TPA Name', surveyorName:'Surveyor Name', assignedOwner:'Assigned Owner', nextActionDate:'Next Action Date', slaDueDate:'SLA Due Date', closedAt:'Closed At', description:'Description', notes:'Notes', rejectionReason:'Rejection Reason', documentUrl:'Document URL', companyId:'Company ID', personId:'Person ID', policyId:'Policy ID', taskId:'Task ID', meetingId:'Meeting ID', isDeleted:'Is Deleted' };
    var dates = ['Intimation Date','Incident Date','Admission Date','Discharge Date','Next Action Date','SLA Due Date','Closed At'];
    var amounts = ['Claim Amount','Approved Amount','Settled Amount'];
    var result = {};
    Object.keys(data).forEach(function (key) { var h = aliases[key] || key; if (this.map[h] === undefined) return; var v = data[key]; if (dates.indexOf(h) !== -1 && v) result[h] = new Date(v); else if (amounts.indexOf(h) !== -1) result[h] = v === '' ? '' : Number(v); else if (h === 'Is Deleted') result[h] = this._bool(v); else result[h] = String(v || '').trim(); }, this);
    return result;
  }
  _validate(c) {
    if (!String(c['Policy ID'] || '').trim()) throw new Error('Policy ID is required.');
    if (!String(c['Claim Type'] || '').trim()) throw new Error('Claim Type is required.');
    if (JSK_CLAIM_SCHEMA.TYPE_VALUES.indexOf(c['Claim Type']) === -1) throw new Error('Select a valid Claim Type.');
    if (c['Status'] && JSK_CLAIM_SCHEMA.STATUS_VALUES.indexOf(c['Status']) === -1) throw new Error('Select a valid Claim Status.');
    if (c['Priority'] && JSK_CLAIM_SCHEMA.PRIORITY_VALUES.indexOf(c['Priority']) === -1) throw new Error('Select a valid Claim Priority.');
    ['Claim Amount','Approved Amount','Settled Amount'].forEach(function (h) { if (c[h] !== '' && (isNaN(Number(c[h])) || Number(c[h]) < 0)) throw new Error(h + ' is invalid.'); });
    if (c['Document URL'] && !/^https?:\/\//i.test(String(c['Document URL']))) throw new Error('Document URL must use http:// or https://.');
  }
  _format(record) {
    var special = {'Claim ID':'claimId','Company ID':'companyId','Person ID':'personId','Policy ID':'policyId','Task ID':'taskId','Meeting ID':'meetingId','TPA Name':'tpaName','SLA Due Date':'slaDueDate'};
    var result = {};
    this.headers.forEach(function (h) { if (!h) return; var key = special[h] || h.replace(/[^a-zA-Z0-9]+(.)/g, function (_, c) { return c.toUpperCase(); }).replace(/^[A-Z]/, function (c) { return c.toLowerCase(); }); var v = record[h]; result[key] = v instanceof Date ? Utilities.formatDate(v, 'Asia/Kolkata', 'yyyy-MM-dd HH:mm:ss') : v; });
    result.recordVersion = Number(record['Record Version']) || 1; result.isDeleted = this._bool(record['Is Deleted']); return result;
  }
}
