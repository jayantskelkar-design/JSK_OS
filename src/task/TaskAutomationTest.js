/** JSK OS Build 1004 - Task automation tests. */

function testTaskAutomationPlan() {
  var today = new Date(2026, 7, 2);
  var policies = [
    { policyId: 'POL-1', policyNumber: '101', policyStatus: 'Active', renewalStage: 'Call Pending', renewalDate: new Date(2026, 7, 20), assignedOwner: 'JSK' },
    { policyId: 'POL-2', policyNumber: '102', policyStatus: 'Active', renewalStage: 'Negotiation', renewalDate: new Date(2026, 6, 29) },
    { policyId: 'POL-3', policyStatus: 'Renewed', renewalStage: 'Won', renewalDate: new Date(2026, 7, 10) },
    { policyId: 'POL-4', policyStatus: 'Active', renewalStage: 'Call Pending', renewalDate: new Date(2026, 9, 1) }
  ];
  var tasks = [
    { taskId: 'TSK-2', description: '[AUTO-RENEWAL:POL-2:2026-07-29]', status: 'Open', priority: 'High', recordVersion: 2 },
    { taskId: 'TSK-3', description: '[AUTO-RENEWAL:POL-3:2026-08-10]', status: 'Open', priority: 'High', recordVersion: 1 }
  ];
  var plan = JSKOS.TaskAutomation.buildPlan(policies, tasks, today);
  assertTaskAutomation_(plan.filter(function (item) { return item.type === 'CREATE'; }).length === 1, 'Create plan failed.');
  assertTaskAutomation_(plan.filter(function (item) { return item.type === 'UPDATE' && item.escalated; }).length === 1, 'Escalation plan failed.');
  assertTaskAutomation_(plan.filter(function (item) { return item.type === 'CLOSE'; }).length === 1, 'Close plan failed.');
  console.info(JSON.stringify({ success: true, message: 'Task automation plan passed.', actions: plan.length }));
  return { success: true, actions: plan.length };
}

function assertTaskAutomation_(condition, message) {
  if (!condition) throw new Error('Task Automation Test Failed: ' + message);
}
