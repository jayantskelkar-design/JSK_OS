/** JSK OS Build 1003 Renewal Work Queue tests. */

function testRenewalWorkQueue() {
  var result = JSKOS.RenewalWorkQueue.build([
    { policyId: 'OVERDUE', policyStatus: 'Active', nextActionDate: new Date(2026, 6, 31), assignedOwner: 'A' },
    { policyId: 'TODAY', policyStatus: 'Renewal Due', nextActionDate: new Date(2026, 7, 1), assignedOwner: 'B' },
    { policyId: 'UPCOMING', policyStatus: 'Issued', nextActionDate: new Date(2026, 7, 8), assignedOwner: '' },
    { policyId: 'LATER', policyStatus: 'Active', nextActionDate: new Date(2026, 7, 20), assignedOwner: '' },
    { policyId: 'WON', policyStatus: 'Active', renewalStage: 'Won', nextActionDate: new Date(2026, 7, 1) }
  ], new Date(2026, 7, 1), 8);

  if (result.summary.overdue !== 1) throw new Error('Overdue queue count failed.');
  if (result.summary.dueToday !== 1) throw new Error('Today queue count failed.');
  if (result.summary.next7Days !== 1) throw new Error('Upcoming queue count failed.');
  if (result.summary.unassigned !== 2) throw new Error('Unassigned queue count failed.');
  if (result.items.length !== 3 || result.items[0].policyId !== 'OVERDUE') {
    throw new Error('Work queue ordering failed.');
  }
  if (result.items[1].nextActionDate !== '2026-08-01') {
    throw new Error('Work queue local date formatting failed.');
  }
  return { success: true, summary: result.summary };
}
