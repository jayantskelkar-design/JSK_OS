/**
 * Runs JSK OS EventBus tests.
 *
 * Run manually from the Apps Script editor.
 *
 * @return {void}
 */
function testEventBus() {
  testEventBusExactSubscription_();
  testEventBusDuplicatePrevention_();
  testEventBusOnce_();
  testEventBusUnsubscribe_();
  testEventBusWildcardOrder_();
  testEventBusFailureIsolation_();
  testEventBusClear_();
  testEventBusValidation_();

  console.info(
    JSON.stringify({
      success: true,
      message: 'JSK OS EventBus tests passed.',
      timestamp: new Date().toISOString()
    })
  );
}

function testEventBusExactSubscription_() {
  var bus = new JSKEventBus();
  var received = null;

  bus.subscribe('company.created', function (event) {
    received = event;
  });

  var result = bus.publish('company.created', { companyId: 'COM-001' });

  assertEventBusTest_(received !== null, 'Exact listener must receive event.');
  assertEventBusTest_(
    received.payload.companyId === 'COM-001',
    'Payload must be preserved.'
  );
  assertEventBusTest_(result.delivered === 1, 'One listener must be delivered.');
}

function testEventBusDuplicatePrevention_() {
  var bus = new JSKEventBus();
  var handler = function () {};

  bus.subscribe('people.updated', handler);
  var duplicateToken = bus.subscribe('people.updated', handler);

  assertEventBusTest_(
    duplicateToken.duplicate === true,
    'Duplicate subscription must be reported.'
  );
  assertEventBusTest_(
    bus.listenerCount('people.updated') === 1,
    'Duplicate handler must not be added twice.'
  );
}

function testEventBusOnce_() {
  var bus = new JSKEventBus();
  var calls = 0;

  bus.once('task.completed', function () {
    calls += 1;
  });

  bus.publish('task.completed');
  bus.publish('task.completed');

  assertEventBusTest_(calls === 1, 'Once listener must execute only once.');
}

function testEventBusUnsubscribe_() {
  var bus = new JSKEventBus();
  var calls = 0;
  var handler = function () {
    calls += 1;
  };

  var token = bus.subscribe('notification.read', handler);
  var removed = bus.unsubscribe('notification.read', token);
  bus.publish('notification.read');

  assertEventBusTest_(removed === true, 'Token unsubscribe must return true.');
  assertEventBusTest_(calls === 0, 'Unsubscribed listener must not execute.');
}

function testEventBusWildcardOrder_() {
  var bus = new JSKEventBus();
  var order = [];

  bus.subscribe('company.created', function () {
    order.push('exact');
  });
  bus.subscribe('company.*', function () {
    order.push('namespace');
  });
  bus.subscribe('*', function () {
    order.push('global');
  });

  bus.publish('company.created');

  assertEventBusTest_(
    order.join(',') === 'exact,namespace,global',
    'Listeners must run in exact, namespace, global order.'
  );
}

function testEventBusFailureIsolation_() {
  var bus = new JSKEventBus();
  var successfulCalls = 0;

  bus.subscribe('garuda.analysis.completed', function () {
    throw new Error('Expected listener failure for isolation test.');
  });
  bus.subscribe('garuda.analysis.completed', function () {
    successfulCalls += 1;
  });

  var result = bus.publish('garuda.analysis.completed');

  assertEventBusTest_(result.failed === 1, 'One listener failure is expected.');
  assertEventBusTest_(result.delivered === 1, 'Remaining listener must execute.');
  assertEventBusTest_(successfulCalls === 1, 'Failure must be isolated.');
}

function testEventBusClear_() {
  var bus = new JSKEventBus();

  bus.subscribe('renewal.due', function () {});
  bus.subscribe('renewal.due', function () {});
  bus.subscribe('meeting.reminder', function () {});

  assertEventBusTest_(bus.clear('renewal.due') === 2, 'clear() count mismatch.');
  assertEventBusTest_(
    bus.listenerCount('renewal.due') === 0,
    'clear() must remove event listeners.'
  );
  assertEventBusTest_(bus.clearAll() === 1, 'clearAll() count mismatch.');
}

function testEventBusValidation_() {
  var bus = new JSKEventBus();
  var invalidNameRejected = false;
  var invalidHandlerRejected = false;

  try {
    bus.subscribe('Invalid Event Name', function () {});
  } catch (error) {
    invalidNameRejected = error instanceof TypeError;
  }

  try {
    bus.subscribe('company.created', null);
  } catch (error) {
    invalidHandlerRejected = error instanceof TypeError;
  }

  assertEventBusTest_(invalidNameRejected, 'Invalid event name must be rejected.');
  assertEventBusTest_(invalidHandlerRejected, 'Invalid handler must be rejected.');
}

function assertEventBusTest_(condition, message) {
  if (!condition) {
    throw new Error('EventBus Test Failed: ' + message);
  }
}
