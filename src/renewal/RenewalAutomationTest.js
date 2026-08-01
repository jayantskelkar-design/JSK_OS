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

function testRenewalFollowUpPlan() {
  var today = new Date(2026, 7, 1);
  var plan = JSKOS.RenewalAutomation.buildFollowUpPlan([
    {
      policyId: 'NEW', policyNumber: 'NEW', policyStatus: 'Active',
      renewalStage: 'Call Pending', renewalDate: new Date(2026, 7, 5),
      nextActionDate: '', followUpNotes: '', recordVersion: 1
    },
    {
      policyId: 'CLOSE', policyNumber: 'CLOSE', policyStatus: 'Active',
      renewalStage: 'Won', renewalDate: new Date(2026, 7, 5),
      nextActionDate: new Date(2026, 7, 2), recordVersion: 2
    },
    {
      policyId: 'KEEP', policyNumber: 'KEEP', policyStatus: 'Active',
      renewalStage: 'Negotiation', renewalDate: new Date(2026, 7, 20),
      nextActionDate: new Date(2026, 7, 2), recordVersion: 3
    }
  ], today);

  if (plan.length !== 2) throw new Error('Expected two follow-up actions.');
  if (plan[0].type !== 'CREATE' || plan[0].data.nextActionDate !== '2026-08-01') {
    throw new Error('GARUDA follow-up creation plan is invalid.');
  }
  if (plan[1].type !== 'CLOSE' || plan[1].data.nextActionDate !== '') {
    throw new Error('Terminal action closure plan is invalid.');
  }
  return { success: true, actions: plan.length };
}
