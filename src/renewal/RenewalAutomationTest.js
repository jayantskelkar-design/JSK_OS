/** JSK OS Build 1002 Renewal Automation tests. */

function testRenewalAutomationCandidates() {
  var today = new Date(2026, 7, 1);
  var candidates = JSKOS.RenewalAutomation.buildReminderCandidates([
    { policyId: 'P30', policyStatus: 'Active', renewalDate: new Date(2026, 7, 31) },
    { policyId: 'P7', policyStatus: 'Renewal Due', renewalDate: new Date(2026, 7, 8) },
    { policyId: 'P1', policyStatus: 'Issued', renewalDate: new Date(2026, 7, 2) },
    { policyId: 'P0', policyStatus: 'Active', renewalDate: new Date(2026, 7, 1) },
    { policyId: 'PO7', policyStatus: 'Active', renewalDate: new Date(2026, 6, 25) },
    { policyId: 'SKIP', policyStatus: 'Cancelled', renewalDate: new Date(2026, 7, 1) }
  ], today);

  if (candidates.length !== 5) throw new Error('Expected 5 reminder candidates.');
  var keys = candidates.map(function (item) { return item.reminderKey; }).join(',');
  if (keys !== 'DUE_30,DUE_7,DUE_1,DUE_0,OVERDUE_7') {
    throw new Error('Unexpected reminder keys: ' + keys);
  }
  return { success: true, candidates: candidates.length, keys: keys };
}
