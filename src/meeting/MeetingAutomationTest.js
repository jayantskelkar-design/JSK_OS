/** JSK OS Build 1005 - Meeting automation tests. */

function testMeetingAutomationPlan() {
  var now = new Date(2026, 7, 2, 9, 0, 0);
  var plan = JSKOS.MeetingAutomation.buildPlan([
    { meetingId:'M1', title:'Today meeting', status:'Scheduled', startAt:'2026-08-02T10:00', owner:'JSK' },
    { meetingId:'M2', title:'Past meeting', status:'Scheduled', startAt:'2026-08-01T10:00', endAt:'2026-08-01T11:00', owner:'JSK' },
    { meetingId:'M3', title:'Synced future', status:'Scheduled', startAt:'2026-08-10T10:00', calendarEventId:'event-1' }
  ], [], now, { JSK:'owner@example.com' }, 'admin@example.com');
  assertMeetingAutomation_(plan.calendar.length === 2, 'Calendar plan failed.');
  assertMeetingAutomation_(plan.reminders.length === 1, 'Reminder plan failed.');
  assertMeetingAutomation_(plan.followUps.length === 1, 'Follow-up plan failed.');
  assertMeetingAutomation_(plan.agenda.length === 1, 'Agenda plan failed.');
  console.info(JSON.stringify({ success:true, message:'Meeting automation plan passed.' }));
  return { success:true, calendar:plan.calendar.length, reminders:plan.reminders.length, followUps:plan.followUps.length, agenda:plan.agenda.length };
}
function assertMeetingAutomation_(condition, message) { if (!condition) throw new Error('Meeting Automation Test Failed: ' + message); }
