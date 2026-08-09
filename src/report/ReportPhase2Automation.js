/** JSK OS Build 1012 Phase 2 - Executive report export and delivery. */

function apiReportExport() {
  return reportApi_(function () {
    var response = apiReportExecutiveSummary();
    var summary = reportData_(response, 'Executive summary');
    var rows = [
      ['Section', 'Metric', 'Value'],
      ['Clients', 'Companies', summary.clients.companies],
      ['Clients', 'People', summary.clients.people],
      ['Business', 'Policies', summary.business.policies],
      ['Business', 'Claims', summary.business.claims],
      ['Business', 'Quotes', summary.business.quotes],
      ['Business', 'Open Endorsements', summary.business.endorsementsOpen],
      ['Servicing', 'Documents', summary.servicing.documents],
      ['Servicing', 'Expired Documents', summary.servicing.documentsExpired],
      ['Servicing', 'Endorsements Overdue', summary.servicing.endorsementsOverdue],
      ['Servicing', 'Quotes Expiring in 7 Days', summary.servicing.quotesExpiring7Days],
      ['Finance', 'Expected', summary.finance.expected],
      ['Finance', 'Received', summary.finance.received],
      ['Finance', 'Outstanding', summary.finance.outstanding],
      ['Finance', 'Overdue Records', summary.finance.overdue]
    ];
    var csv = rows.map(function (row) {
      return row.map(function (value) {
        return '"' + String(value == null ? '' : value)
          .replace(/"/g, '""') + '"';
      }).join(',');
    }).join('\r\n');
    return {
      fileName: 'JSK_OS_Executive_Report_' +
        Utilities.formatDate(new Date(), JSKOS.Config.APP.TIMEZONE, 'yyyy-MM-dd') +
        '.csv',
      csv: csv,
      rowCount: rows.length - 1
    };
  });
}

function sendExecutiveReportEmail() {
  var recipients = String(
    PropertiesService.getScriptProperties()
      .getProperty('JSK_OS_REPORT_RECIPIENTS') || ''
  ).trim();
  if (!recipients) {
    throw new Error(
      'Set JSK_OS_REPORT_RECIPIENTS in Script Properties before sending reports.'
    );
  }
  var exportResponse = apiReportExport();
  var report = reportData_(exportResponse, 'Report export');
  var summary = reportData_(
    apiReportExecutiveSummary(),
    'Executive summary'
  );
  var finance = summary.finance;
  var body = [
    'JSK OS Executive Report',
    '',
    'Companies: ' + summary.clients.companies,
    'People: ' + summary.clients.people,
    'Policies: ' + summary.business.policies,
    'Claims: ' + summary.business.claims,
    'Open endorsements: ' + summary.business.endorsementsOpen,
    'Expired documents: ' + summary.servicing.documentsExpired,
    'Expected commission: INR ' + finance.expected,
    'Received commission: INR ' + finance.received,
    'Outstanding commission: INR ' + finance.outstanding
  ].join('\n');
  MailApp.sendEmail({
    to: recipients,
    subject: 'JSK OS Executive Report - ' +
      Utilities.formatDate(new Date(), JSKOS.Config.APP.TIMEZONE, 'dd MMM yyyy'),
    body: body,
    attachments: [
      Utilities.newBlob(report.csv, 'text/csv', report.fileName)
    ]
  });
  return { success: true, recipients: recipients, fileName: report.fileName };
}

function installExecutiveReportTrigger() {
  var handler = 'sendExecutiveReportEmail';
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === handler) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  var trigger = ScriptApp.newTrigger(handler)
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();
  return { success: true, triggerId: trigger.getUniqueId(), hour: 8 };
}

function testReportAutomationPlan() {
  var response = apiReportExport();
  if (
    !response.success ||
    response.data.rowCount !== 14 ||
    response.data.csv.indexOf('"Section","Metric","Value"') !== 0
  ) {
    throw new Error('Build 1012 report export plan failed.');
  }
  var result = {
    success: true,
    build: 1012,
    rowCount: response.data.rowCount,
    fileName: response.data.fileName
  };
  console.info(JSON.stringify(result));
  return result;
}
