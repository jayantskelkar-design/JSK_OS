/** JSK OS Build 1005 - Meeting repository. */

class MeetingRepository {
  constructor(spreadsheet) {
    this.spreadsheet = spreadsheet || JSKOS.ConfigService.getSpreadsheet();
    this.sheet = this.spreadsheet.getSheetByName(JSK_MEETING_SCHEMA.SHEET_NAME);
    if (!this.sheet) throw new Error('Meetings sheet not found. Run ensureBuild1005Meetings().');
    this.headers = this.sheet.getRange(1, 1, 1, this.sheet.getLastColumn()).getDisplayValues()[0]
      .map(function (value) { return String(value || '').trim(); });
    this.map = {};
    this.headers.forEach(function (header, index) { if (header) this.map[header] = index; }, this);
  }

  create(data, actor) {
    var meeting = this._normalize(data);
    this._validate(meeting);
    var now = new Date();
    var record = this._empty();
    Object.assign(record, meeting, {
      'Meeting ID': 'MTG-' + Utilities.formatDate(now, 'Asia/Kolkata', 'yyyyMMddHHmmss') + '-' + Utilities.getUuid().replace(/-/g, '').substring(0, 6).toUpperCase(),
      'Status': meeting['Status'] || 'Scheduled',
      'Meeting Type': meeting['Meeting Type'] || 'Client Meeting',
      'Reminder Minutes': meeting['Reminder Minutes'] === '' || meeting['Reminder Minutes'] === undefined
        ? 30 : meeting['Reminder Minutes'],
      'Created At': now, 'Created By': this._actor(actor), 'Updated At': now,
      'Updated By': this._actor(actor), 'Record Version': 1, 'Is Deleted': false
    });
    this.sheet.appendRow(this._toRow(record));
    return this.findById(record['Meeting ID'], true);
  }

  findById(meetingId, includeDeleted) {
    var entry = this._find(String(meetingId || '').trim().toUpperCase());
    if (!entry || (!includeDeleted && this._bool(entry.record['Is Deleted']))) return null;
    return this._format(entry.record);
  }

  update(meetingId, changes, actor, expectedVersion) {
    var lock = LockService.getDocumentLock() || LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      var entry = this._find(String(meetingId || '').trim().toUpperCase());
      if (!entry) throw new Error('Meeting not found.');
      var currentVersion = Number(entry.record['Record Version']) || 1;
      if (expectedVersion !== undefined && Number(expectedVersion) !== currentVersion) {
        var conflict = new Error('Meeting was modified by another user.');
        conflict.code = 'VERSION_CONFLICT';
        conflict.currentVersion = currentVersion;
        throw conflict;
      }
      var updated = Object.assign({}, entry.record, this._normalize(changes));
      this._validate(updated);
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
    var meetingType = String(criteria.meetingType || '').trim().toLowerCase();
    var owner = String(criteria.owner || '').trim().toLowerCase();
    var from = this._date(criteria.from), to = this._date(criteria.to);
    var linkField = criteria.companyId ? 'Company ID' : criteria.personId ? 'Person ID' : criteria.policyId ? 'Policy ID' : criteria.taskId ? 'Task ID' : '';
    var linkValue = criteria.companyId || criteria.personId || criteria.policyId || criteria.taskId || '';
    var items = this._entries().filter(function (entry) {
      var record = entry.record;
      if (!record['Meeting ID'] || this._bool(record['Is Deleted'])) return false;
      if (status && String(record['Status']).toLowerCase() !== status) return false;
      if (meetingType && String(record['Meeting Type']).toLowerCase() !== meetingType) return false;
      if (owner && String(record['Owner']).toLowerCase() !== owner) return false;
      if (linkField && String(record[linkField]).toUpperCase() !== String(linkValue).trim().toUpperCase()) return false;
      var start = this._date(record['Start At']);
      if (from && (!start || start < from)) return false;
      if (to && (!start || start > to)) return false;
      if (query && ['Title', 'Agenda', 'Notes', 'Location', 'Owner'].every(function (header) {
        return String(record[header] || '').toLowerCase().indexOf(query) === -1;
      })) return false;
      return true;
    }, this).map(function (entry) { return this._format(entry.record); }, this);
    items.sort(function (a, b) { return String(a.startAt || '9999').localeCompare(String(b.startAt || '9999')); });
    return { items: items, totalItems: items.length };
  }

  _entries() {
    var count = this.sheet.getLastRow() - 1;
    if (count < 1) return [];
    return this.sheet.getRange(2, 1, count, this.headers.length).getValues().map(function (row, index) {
      return { row: index + 2, record: this._fromRow(row) };
    }, this);
  }
  _find(id) { return this._entries().filter(function (entry) { return String(entry.record['Meeting ID']).toUpperCase() === id; })[0] || null; }
  _fromRow(row) { var result = {}; this.headers.forEach(function (header, index) { if (header) result[header] = row[index]; }); return result; }
  _toRow(record) { return this.headers.map(function (header) { return record[header] === null || record[header] === undefined ? '' : record[header]; }); }
  _empty() { var result = {}; this.headers.forEach(function (header) { if (header) result[header] = ''; }); return result; }
  _actor(actor) { return String(actor || '').trim() || Session.getActiveUser().getEmail() || 'SYSTEM'; }
  _bool(value) { return value === true || String(value).toLowerCase() === 'true'; }
  _date(value) { if (!value) return null; var date = value instanceof Date ? new Date(value.getTime()) : new Date(value); return isNaN(date.getTime()) ? null : date; }

  _normalize(data) {
    data = data || {};
    var aliases = { title:'Title', meetingType:'Meeting Type', status:'Status', startAt:'Start At', endAt:'End At', location:'Location', meetingLink:'Meeting Link', agenda:'Agenda', notes:'Notes', owner:'Owner', companyId:'Company ID', personId:'Person ID', policyId:'Policy ID', taskId:'Task ID', reminderMinutes:'Reminder Minutes', calendarEventId:'Calendar Event ID', reminderSentAt:'Reminder Sent At', followUpTaskId:'Follow-up Task ID' };
    var result = {};
    Object.keys(data).forEach(function (key) {
      var header = aliases[key] || key;
      if (this.map[header] === undefined) return;
      var value = data[key];
      if ((header === 'Start At' || header === 'End At') && value) result[header] = new Date(value);
      else if (header === 'Reminder Minutes') result[header] = value === '' ? '' : Number(value);
      else result[header] = String(value || '').trim();
    }, this);
    return result;
  }

  _validate(meeting) {
    if (!String(meeting['Title'] || '').trim()) throw new Error('Meeting Title is required.');
    if (!this._date(meeting['Start At'])) throw new Error('Meeting Start is required.');
    if (meeting['End At'] && !this._date(meeting['End At'])) throw new Error('Meeting End is invalid.');
    if (meeting['End At'] && this._date(meeting['End At']) < this._date(meeting['Start At'])) throw new Error('Meeting End cannot be before Start.');
    if (meeting['Status'] && JSK_MEETING_SCHEMA.STATUS_VALUES.indexOf(meeting['Status']) === -1) throw new Error('Select a valid Meeting Status.');
    if (meeting['Meeting Type'] && JSK_MEETING_SCHEMA.TYPE_VALUES.indexOf(meeting['Meeting Type']) === -1) throw new Error('Select a valid Meeting Type.');
    if (meeting['Reminder Minutes'] !== '' && (isNaN(Number(meeting['Reminder Minutes'])) || Number(meeting['Reminder Minutes']) < 0)) throw new Error('Reminder Minutes is invalid.');
    if (meeting['Meeting Link'] && !/^https?:\/\//i.test(String(meeting['Meeting Link']))) throw new Error('Meeting Link must use http:// or https://.');
  }

  _format(record) {
    var special = { 'Meeting ID':'meetingId', 'Company ID':'companyId', 'Person ID':'personId', 'Policy ID':'policyId', 'Task ID':'taskId', 'Calendar Event ID':'calendarEventId', 'Follow-up Task ID':'followUpTaskId' };
    var result = {};
    this.headers.forEach(function (header) {
      if (!header) return;
      var key = special[header] || header.replace(/[^a-zA-Z0-9]+(.)/g, function (_, c) { return c.toUpperCase(); }).replace(/^[A-Z]/, function (c) { return c.toLowerCase(); });
      var value = record[header];
      result[key] = value instanceof Date ? Utilities.formatDate(value, 'Asia/Kolkata', header === 'Start At' || header === 'End At' ? "yyyy-MM-dd'T'HH:mm" : 'yyyy-MM-dd HH:mm:ss') : value;
    });
    result.recordVersion = Number(record['Record Version']) || 1;
    result.isDeleted = this._bool(record['Is Deleted']);
    return result;
  }
}
