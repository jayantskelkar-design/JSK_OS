/** JSK OS Build 1005 - Calendar sync, reminders and follow-up automation. */

var JSKOS = JSKOS || {};

JSKOS.MeetingAutomation = (function () {
  'use strict';
  var TIMEZONE = 'Asia/Kolkata';
  var RECIPIENTS_KEY = 'JSK_OS_MEETING_DASHBOARD_RECIPIENTS';
  var FALLBACK_KEY = 'JSK_OS_RENEWAL_DASHBOARD_RECIPIENTS';
  var OWNER_EMAILS_KEY = 'JSK_OS_TASK_OWNER_EMAILS';
  var LOG_SHEET = 'Meeting_Automation_Log';

  function runDaily(referenceDate) {
    ensureBuild1005Meetings();
    ensureBuild1004Tasks();
    var meetingRepository = new MeetingRepository();
    var taskRepository = new TaskRepository();
    var meetings = meetingRepository.search({}).items || [];
    var tasks = taskRepository.search({}).items || [];
    var now = referenceDate instanceof Date ? new Date(referenceDate.getTime()) : new Date(referenceDate || new Date());
    var plan = buildPlan_(meetings, tasks, now);
    var result = { calendarCreated: 0, remindersSent: 0, followUpsCreated: 0, agendaSent: false };

    plan.calendar.forEach(function (item) {
      try {
        var meeting = meetingRepository.findById(item.meetingId, false);
        if (!meeting) return;
        var calendar = CalendarApp.getDefaultCalendar();
        var start = new Date(meeting.startAt);
        var end = meeting.endAt ? new Date(meeting.endAt) : new Date(start.getTime() + 3600000);
        var event = meeting.calendarEventId ? calendar.getEventById(meeting.calendarEventId) : findTaggedEvent_(calendar, meeting.meetingId, start);
        if (item.action === 'CANCEL') {
          if (event) event.deleteEvent();
          if (meeting.calendarEventId) meetingRepository.update(meeting.meetingId, { calendarEventId: '' }, 'Meeting Automation', meeting.recordVersion);
          return;
        }
        if (!event) {
          event = calendar.createEvent(meeting.title, start, end, {
            description: [meeting.agenda || '', meeting.meetingLink || ''].filter(Boolean).join('\n'), location: meeting.location || ''
          });
          event.setTag('JSK_OS_MEETING_ID', meeting.meetingId);
          var reminder = Number(meeting.reminderMinutes);
          if (reminder >= 5 && reminder <= 40320) event.addPopupReminder(reminder);
          result.calendarCreated += 1;
        } else {
          event.setTitle(meeting.title).setTime(start, end).setDescription([meeting.agenda || '', meeting.meetingLink || ''].filter(Boolean).join('\n')).setLocation(meeting.location || '');
        }
        if (meeting.calendarEventId !== event.getId()) meetingRepository.update(meeting.meetingId, { calendarEventId: event.getId() }, 'Meeting Automation', meeting.recordVersion);
      } catch (error) { console.error('Meeting calendar sync failed: ' + (error.stack || error)); }
    });

    plan.reminders.forEach(function (item) {
      if (wasProcessed_(item.key)) return;
      MailApp.sendEmail({ to: item.to, subject: item.subject, body: item.body });
      logProcessed_(item.key, item.meetingId, item.to, 'REMINDER');
      result.remindersSent += 1;
    });

    plan.followUps.forEach(function (item) {
      try {
        var task = taskRepository.create(item.data, 'Meeting Automation');
        var meeting = meetingRepository.findById(item.meetingId, false);
        if (meeting && !meeting.followUpTaskId) meetingRepository.update(meeting.meetingId, { followUpTaskId: task.taskId }, 'Meeting Automation', meeting.recordVersion);
        result.followUpsCreated += 1;
      } catch (error) { console.error('Meeting follow-up creation failed: ' + (error.stack || error)); }
    });

    result.agendaSent = sendAgenda_(plan.agenda, now);
    return result;
  }

  function buildPlan_(meetings, tasks, referenceDate, ownerEmails, fallbackRecipient) {
    var now = referenceDate instanceof Date ? new Date(referenceDate.getTime()) : new Date(referenceDate);
    var today = formatDate_(now);
    var tomorrow = new Date(now.getTime() + 86400000);
    var markerMap = {};
    (tasks || []).forEach(function (task) {
      var match = String(task.description || '').match(/\[AUTO-MEETING:([^\]]+)\]/);
      if (match) markerMap[match[1]] = true;
    });
    var settings = ownerEmails ? { owners: ownerEmails, fallback: fallbackRecipient || '' } : getRecipients_();
    var plan = { calendar: [], reminders: [], followUps: [], agenda: [] };

    (meetings || []).forEach(function (meeting) {
      var start = new Date(meeting.startAt);
      if (isNaN(start.getTime())) return;
      if (meeting.status === 'Scheduled' && start >= now) plan.calendar.push({ meetingId: meeting.meetingId, action: meeting.calendarEventId ? 'UPDATE' : 'CREATE' });
      if (meeting.status === 'Cancelled' && meeting.calendarEventId) plan.calendar.push({ meetingId: meeting.meetingId, action: 'CANCEL' });
      if (meeting.status === 'Scheduled' && formatDate_(start) === today) plan.agenda.push(meeting);
      if (meeting.status === 'Scheduled' && start >= now && start <= tomorrow) {
        var recipient = resolveOwner_(meeting.owner, settings.owners, settings.fallback);
        if (recipient) plan.reminders.push({
          key: [today, 'REMINDER', meeting.meetingId].join('|'), meetingId: meeting.meetingId, to: recipient,
          subject: 'Meeting Reminder: ' + meeting.title,
          body: 'JSK OS Meeting Reminder\n\n' + meeting.title + '\nStart: ' + meeting.startAt + '\nOwner: ' + (meeting.owner || 'Unassigned') + (meeting.meetingLink ? '\nJoin: ' + meeting.meetingLink : '')
        });
      }
      var meetingEnd = meeting.endAt ? new Date(meeting.endAt) : new Date(start.getTime() + 3600000);
      if ((meeting.status === 'Scheduled' || meeting.status === 'No Show') && meetingEnd < now && !meeting.followUpTaskId && !markerMap[meeting.meetingId]) {
        plan.followUps.push({ meetingId: meeting.meetingId, data: {
          title: 'Follow up: ' + meeting.title,
          description: '[AUTO-MEETING:' + meeting.meetingId + '] Meeting outcome and next action required.',
          taskType: 'Follow-up', status: 'Open', priority: meeting.status === 'No Show' ? 'High' : 'Medium',
          owner: meeting.owner || '', dueDate: today, companyId: meeting.companyId || '', personId: meeting.personId || '', policyId: meeting.policyId || ''
        }});
      }
    });
    return plan;
  }

  function sendAgenda_(meetings, referenceDate) {
    var settings = getRecipients_();
    if (!meetings.length || !settings.fallback) return false;
    var key = [formatDate_(referenceDate), 'DAILY_AGENDA'].join('|');
    if (wasProcessed_(key)) return false;
    var lines = ['JSK OS Daily Meeting Agenda - ' + formatDate_(referenceDate), ''];
    meetings.forEach(function (meeting) { lines.push('- ' + meeting.startAt + ' | ' + meeting.title + ' | ' + (meeting.owner || 'Unassigned')); });
    MailApp.sendEmail(settings.fallback, 'JSK OS Daily Meeting Agenda', lines.join('\n'));
    logProcessed_(key, '', settings.fallback, 'AGENDA');
    return true;
  }

  function getRecipients_() {
    var properties = PropertiesService.getScriptProperties(), owners = {};
    try { owners = JSON.parse(properties.getProperty(OWNER_EMAILS_KEY) || '{}'); } catch (error) { owners = {}; }
    return { owners: owners, fallback: String(properties.getProperty(RECIPIENTS_KEY) || properties.getProperty(FALLBACK_KEY) || '').trim() };
  }
  function findTaggedEvent_(calendar, meetingId, start) {
    var from = new Date(start.getTime() - 86400000), to = new Date(start.getTime() + 86400000);
    var events = calendar.getEvents(from, to);
    for (var index = 0; index < events.length; index += 1) {
      if (events[index].getTag('JSK_OS_MEETING_ID') === meetingId) return events[index];
    }
    return null;
  }
  function resolveOwner_(owner, map, fallback) { var value = String(owner || '').trim(); if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return value; return String(map[value] || map[value.toLowerCase()] || fallback || '').trim(); }
  function getLog_() { var spreadsheet = JSKOS.ConfigService.getSpreadsheet(); var sheet = spreadsheet.getSheetByName(LOG_SHEET) || spreadsheet.insertSheet(LOG_SHEET); if (!sheet.getLastRow()) sheet.appendRow(['Processed At','Key','Meeting ID','Recipient','Type']); return sheet; }
  function wasProcessed_(key) { var sheet = getLog_(); return sheet.getLastRow() > 1 && sheet.getRange(2,2,sheet.getLastRow()-1,1).getDisplayValues().some(function (row) { return row[0] === key; }); }
  function logProcessed_(key, meetingId, recipient, type) { getLog_().appendRow([new Date(),key,meetingId,recipient,type]); }
  function formatDate_(value) { return Utilities.formatDate(value instanceof Date ? value : new Date(value), TIMEZONE, 'yyyy-MM-dd'); }
  return { runDaily: runDaily, buildPlan: buildPlan_ };
})();

function runDailyMeetingAutomation() { return JSKOS.MeetingAutomation.runDaily(new Date()); }
