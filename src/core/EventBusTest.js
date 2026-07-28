/**
 * Runs JSK OS EventBus automated tests.
 *
 * Run manually from the Apps Script editor.
 *
 * @return {void}
 */
function testEventBus() {
  var bus = new JSKEventBus();
  var received = [];

  var firstHandler = function (event) {
    received.push('first:' + event.payload.companyId);
  };

  var secondHandler = function () {
    received.push('second');
  };

  var unsubscribeFirst = bus.subscribe(
    'company.created',
    firstHandler
  );

  bus.subscribe('company.created', secondHandler);
  bus.subscribe('company.created', secondHandler);

  assertEventBusTest_(
    bus.listenerCount('company.created') === 2,
    'Duplicate subscriptions must be prevented.'
  );

  var firstSummary = bus.publish('company.created', {
    companyId: 'COM-001'
  });

  assertEventBusTest_(
    firstSummary.delivered === 2 && firstSummary.failed === 0,
    'Exact listeners must receive the event.'
  );

  assertEventBusTest_(
    received[0] === 'first:COM-001' && received[1] === 'second',
    'Listener order must be preserved.'
  );

  assertEventBusTest_(
    unsubscribeFirst() === true && unsubscribeFirst() === false,
    'Unsubscribe function must be idempotent.'
  );

  bus.publish('company.created', {
    companyId: 'COM-002'
  });

  assertEventBusTest_(
    received.indexOf('first:COM-002') === -1,
    'Unsubscribed listeners must not execute.'
  );

  var onceCount = 0;
  bus.once('people.updated', function () {
    onceCount += 1;
  });

  bus.publish('people.updated');
  bus.publish('people.updated');

  assertEventBusTest_(
    onceCount === 1,
    'Once listener must execute exactly once.'
  );

  var wildcardEvents = [];

  bus.subscribe('company.*', function (event) {
    wildcardEvents.push('namespace:' + event.name);
  });

  bus.subscribe('*', function (event) {
    wildcardEvents.push('global:' + event.name);
  });

  bus.publish('company.updated');

  assertEventBusTest_(
    wildcardEvents.length === 2,
    'Namespace and global wildcard listeners must execute.'
  );

  var resilientCount = 0;

  bus.subscribe('system.test', function () {
    throw new Error('Expected listener failure.');
  });

  bus.subscribe('system.test', function () {
    resilientCount += 1;
  });

  var failureSummary = bus.publish('system.test');

  assertEventBusTest_(
    failureSummary.failed === 1 &&
      failureSummary.delivered >= 1 &&
      resilientCount === 1,
    'Listener failure must not stop remaining listeners.'
  );

  assertEventBusTest_(
    bus.publish('unknown.event').matched === 1,
    'Unknown exact events must remain safe and reach global listeners.'
  );

  var removedCompanyListeners = bus.clear('company.created');

  assertEventBusTest_(
    removedCompanyListeners === 1 &&
      bus.listenerCount('company.created') === 0,
    'clear() must remove only the selected event listeners.'
  );

  var listenersBeforeClearAll = bus.listenerCount();
  var removedAll = bus.clearAll();

  assertEventBusTest_(
    removedAll === listenersBeforeClearAll &&
      bus.listenerCount() === 0,
    'clearAll() must remove every listener.'
  );

  assertEventBusThrows_(function () {
    bus.publish('company.*');
  }, 'Wildcard events must not be publishable.');

  assertEventBusThrows_(function () {
    bus.subscribe('', function () {});
  }, 'Blank event names must be rejected.');

  assertEventBusThrows_(function () {
    bus.subscribe('company.created', 'not-a-function');
  }, 'Non-function handlers must be rejected.');

  console.info(
    JSON.stringify({
      success: true,
      message: 'JSK OS EventBus tests passed.',
      timestamp: new Date().toISOString()
    })
  );
}

/** @private */
function assertEventBusTest_(condition, message) {
  if (!condition) {
    throw new Error('EventBus Test Failed: ' + message);
  }
}

/** @private */
function assertEventBusThrows_(callback, message) {
  var didThrow = false;

  try {
    callback();
  } catch (error) {
    didThrow = true;
  }

  assertEventBusTest_(didThrow, message);
}
