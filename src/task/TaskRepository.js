/** JSK OS Build 1004 - Task repository. */

class TaskRepository {
  constructor(spreadsheet) {
    this.spreadsheet = spreadsheet || JSKOS.ConfigService.getSpreadsheet();
    this.sheet = this.spreadsheet.getSheetByName(JSK_TASK_SCHEMA.SHEET_NAME);
    if (!this.sheet) throw new Error('Tasks sheet not found. Run ensureBuild1004Tasks().');
    this.headers = this.sheet.getRange(1, 1, 1, this.sheet.getLastColumn())
      .getDisplayValues()[0].map(function (value) { return String(value || '').trim(); });
    this.map = {};
    this.headers.forEach(function (header, index) { if (header) this.map[header] = index; }, this);
  }

  create(data, actor) {
    var task = this._normalize(data);
    this._validate(task);
    var now = new Date();
    var record = this._empty();
    Object.assign(record, task, {
      'Task ID': 'TSK-' + Utilities.formatDate(now, 'Asia/Kolkata', 'yyyyMMddHHmmss') + '-' +
        Utilities.getUuid().replace(/-/g, '').substring(0, 6).toUpperCase(),
      'Status': task['Status'] || 'Open',
      'Priority': task['Priority'] || 'Medium',
      'Created At': now, 'Created By': this._actor(actor),
      'Updated At': now, 'Updated By': this._actor(actor),
      'Record Version': 1, 'Is Deleted': false
    });
    this.sheet.appendRow(this._toRow(record));
    return this.findById(record['Task ID'], true);
  }

  findById(taskId, includeDeleted) {
    var entry = this._find(String(taskId || '').trim().toUpperCase());
    if (!entry || (!includeDeleted && this._bool(entry.record['Is Deleted']))) return null;
    return this._format(entry.record);
  }

  update(taskId, changes, actor, expectedVersion) {
    var lock = LockService.getDocumentLock() || LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      var entry = this._find(String(taskId || '').trim().toUpperCase());
      if (!entry) throw new Error('Task not found.');
      var currentVersion = Number(entry.record['Record Version']) || 1;
      if (expectedVersion !== undefined && Number(expectedVersion) !== currentVersion) {
        var conflict = new Error('Task was modified by another user.');
        conflict.code = 'VERSION_CONFLICT';
        conflict.currentVersion = currentVersion;
        throw conflict;
      }
      var updated = Object.assign({}, entry.record, this._normalize(changes));
      this._validate(updated);
      if (updated['Status'] === 'Completed' && !updated['Completed At']) updated['Completed At'] = new Date();
      if (updated['Status'] !== 'Completed') updated['Completed At'] = '';
      updated['Updated At'] = new Date();
      updated['Updated By'] = this._actor(actor);
      updated['Record Version'] = currentVersion + 1;
      this.sheet.getRange(entry.row, 1, 1, this.headers.length).setValues([this._toRow(updated)]);
      SpreadsheetApp.flush();
      return this._format(updated);
    } finally {
      lock.releaseLock();
    }
  }

  search(criteria) {
    criteria = criteria || {};
    var query = String(criteria.query || '').trim().toLowerCase();
    var status = String(criteria.status || '').trim().toLowerCase();
    var priority = String(criteria.priority || '').trim().toLowerCase();
    var owner = String(criteria.owner || '').trim().toLowerCase();
    var linkField = criteria.companyId ? 'Company ID' : criteria.personId ? 'Person ID' : criteria.policyId ? 'Policy ID' : '';
    var linkValue = criteria.companyId || criteria.personId || criteria.policyId || '';
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var dateView = String(criteria.dateView || '').toLowerCase();
    var items = this._entries().filter(function (entry) {
      var record = entry.record;
      if (!record['Task ID'] || this._bool(record['Is Deleted'])) return false;
      if (status && String(record['Status']).toLowerCase() !== status) return false;
      if (priority && String(record['Priority']).toLowerCase() !== priority) return false;
      if (owner && String(record['Owner']).trim().toLowerCase() !== owner) return false;
      if (linkField && String(record[linkField]).trim().toUpperCase() !== String(linkValue).trim().toUpperCase()) return false;
      var due = record['Due Date'] instanceof Date ? new Date(record['Due Date']) : new Date(record['Due Date']);
      if (!isNaN(due.getTime())) due.setHours(0, 0, 0, 0);
      if (dateView === 'today' && (isNaN(due.getTime()) || due.getTime() !== today.getTime())) return false;
      if (dateView === 'overdue' && (isNaN(due.getTime()) || due.getTime() >= today.getTime() || record['Status'] === 'Completed')) return false;
      if (query && ['Title', 'Description', 'Owner', 'Company ID', 'Person ID', 'Policy ID']
        .every(function (header) { return String(record[header] || '').toLowerCase().indexOf(query) === -1; })) return false;
      return true;
    }, this).map(function (entry) { return this._format(entry.record); }, this);
    items.sort(function (a, b) { return String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999')); });
    return { items: items, totalItems: items.length };
  }

  _entries() {
    var count = this.sheet.getLastRow() - 1;
    if (count < 1) return [];
    return this.sheet.getRange(2, 1, count, this.headers.length).getValues().map(function (row, index) {
      return { row: index + 2, record: this._fromRow(row) };
    }, this);
  }
  _find(id) { return this._entries().filter(function (entry) { return String(entry.record['Task ID']).toUpperCase() === id; })[0] || null; }
  _fromRow(row) { var record = {}; this.headers.forEach(function (h, i) { if (h) record[h] = row[i]; }); return record; }
  _toRow(record) {
    return this.headers.map(function (h) {
      if (!h) return '';
      return record[h] === null || record[h] === undefined ? '' : record[h];
    });
  }
  _empty() { var record = {}; this.headers.forEach(function (h) { if (h) record[h] = ''; }); return record; }
  _actor(actor) { return String(actor || '').trim() || Session.getActiveUser().getEmail() || 'SYSTEM'; }
  _bool(value) { return value === true || String(value).toLowerCase() === 'true'; }
  _normalize(data) {
    data = data || {};
    var aliases = { title:'Title', description:'Description', taskType:'Task Type', status:'Status', priority:'Priority', owner:'Owner', dueDate:'Due Date', companyId:'Company ID', personId:'Person ID', policyId:'Policy ID' };
    var result = {};
    Object.keys(data).forEach(function (key) {
      var header = aliases[key] || key;
      if (this.map[header] === undefined) return;
      var value = data[key];
      result[header] = header === 'Due Date' && value ? new Date(value) : String(value || '').trim();
    }, this);
    return result;
  }
  _validate(task) {
    if (!String(task['Title'] || '').trim()) throw new Error('Task Title is required.');
    if (task['Status'] && JSK_TASK_SCHEMA.STATUS_VALUES.indexOf(task['Status']) === -1) throw new Error('Select a valid Task Status.');
    if (task['Priority'] && JSK_TASK_SCHEMA.PRIORITY_VALUES.indexOf(task['Priority']) === -1) throw new Error('Select a valid Task Priority.');
    if (task['Task Type'] && JSK_TASK_SCHEMA.TYPE_VALUES.indexOf(task['Task Type']) === -1) throw new Error('Select a valid Task Type.');
    if (task['Due Date'] && isNaN(new Date(task['Due Date']).getTime())) throw new Error('Due Date is invalid.');
  }
  _format(record) {
    var result = {};
    this.headers.forEach(function (header) {
      if (!header) return;
      var key = header.replace(/[^a-zA-Z0-9]+(.)/g, function (_, c) { return c.toUpperCase(); }).replace(/^[A-Z]/, function (c) { return c.toLowerCase(); });
      var value = record[header];
      result[key] = value instanceof Date
        ? Utilities.formatDate(value, 'Asia/Kolkata', header.indexOf(' At') !== -1 ? 'yyyy-MM-dd HH:mm:ss' : 'yyyy-MM-dd')
        : value;
    });
    result.recordVersion = Number(record['Record Version']) || 1;
    result.isDeleted = this._bool(record['Is Deleted']);
    return result;
  }
}
