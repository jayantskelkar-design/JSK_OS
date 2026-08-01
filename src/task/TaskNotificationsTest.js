/** JSK OS Build 1004 - Task notification tests. */

function testTaskNotificationPlan() {
  var plan = JSKOS.TaskNotifications.buildPlan([
    { taskId: 'T1', title: 'Call client', status: 'Open', priority: 'High', owner: 'JSK', dueDate: '2026-08-02', policyId: 'P1' },
    { taskId: 'T2', title: 'Escalated renewal', status: 'In Progress', priority: 'Critical', owner: '', dueDate: '2026-08-01', policyId: 'P2' },
    { taskId: 'T3', title: 'Future task', status: 'Open', priority: 'High', owner: 'JSK', dueDate: '2026-08-05' },
    { taskId: 'T4', title: 'Done task', status: 'Completed', priority: 'Critical', owner: 'JSK', dueDate: '2026-08-01' }
  ], new Date(2026, 7, 2), { JSK: 'owner@example.com' }, 'admin@example.com');

  assertTaskNotification_(plan.length === 3, 'Expected two owner digests and one escalation.');
  assertTaskNotification_(plan.filter(function (item) { return item.to === 'owner@example.com'; }).length === 1, 'Owner email mapping failed.');
  assertTaskNotification_(plan.filter(function (item) { return item.subject.indexOf('ACTION REQUIRED') === 0; }).length === 1, 'Critical alert failed.');
  console.info(JSON.stringify({ success: true, message: 'Task notification plan passed.', messages: plan.length }));
  return { success: true, messages: plan.length };
}

function assertTaskNotification_(condition, message) {
  if (!condition) throw new Error('Task Notification Test Failed: ' + message);
}
