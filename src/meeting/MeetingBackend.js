/** JSK OS Build 1005 - Meeting service and API. */

function meetingApiExecute_(operation, callback) {
  try {
    return { success: true, data: callback(), error: null, meta: { operation: operation, timestamp: new Date().toISOString() } };
  } catch (error) {
    console.error('Meeting API ' + operation + ' failed: ' + (error.stack || error));
    return { success: false, data: null, error: { name: error.name || 'Error', message: error.message || String(error), code: error.code || '', details: error.currentVersion ? { currentVersion: error.currentVersion } : {} } };
  }
}

function meetingRequest_(payload) { return payload && typeof payload === 'object' ? payload : {}; }
function meetingRepository_() { ensureBuild1005Meetings(); return new MeetingRepository(); }

function apiMeetingCreate(payload) {
  return meetingApiExecute_('create', function () { var request = meetingRequest_(payload); return meetingRepository_().create(request.data || {}, request.actor); });
}
function apiMeetingGet(payload) {
  return meetingApiExecute_('get', function () { var request = meetingRequest_(payload); var meeting = meetingRepository_().findById(request.meetingId, false); if (!meeting) throw new Error('Meeting not found.'); return meeting; });
}
function apiMeetingUpdate(payload) {
  return meetingApiExecute_('update', function () { var request = meetingRequest_(payload); return meetingRepository_().update(request.meetingId, request.data || {}, request.actor, request.expectedVersion); });
}
function apiMeetingSearch(payload) {
  return meetingApiExecute_('search', function () { return meetingRepository_().search(meetingRequest_(payload)); });
}
function apiMeetingComplete(payload) {
  var request = meetingRequest_(payload);
  request.data = Object.assign({}, request.data || {}, { status: 'Completed' });
  return apiMeetingUpdate(request);
}

function getMeetingFilters() {
  return { types: JSK_MEETING_SCHEMA.TYPE_VALUES.slice(), statuses: JSK_MEETING_SCHEMA.STATUS_VALUES.slice() };
}
