/**
 * Executes the JSK OS EventBus tests.
 *
 * Run this function manually from the Apps Script editor.
 *
 * @return {void}
 */
function testEventBus() {
  testEventBusSubscribeAndPublish_();
  testEventBusDuplicateSubscription_();
  testEventBusUnsubscribe_();
  testEventBusOnce_();
  testEventBusListenerIsolation_();
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

/** @private @return {void} */
function testEventBusSubscribeAndPublish_() {
  const bus = new JSKEventBus();
  const received = [];

  bus.subscribe('company.created', function (event) {
    received.push(event);
  });

  const summary = bus.publish(
    'company.created',
    { companyId: 'COM-001' },
    { source: 'CompanyService', actor: 'system-test' }
  );

  assertEventBusTest_(received.length === 1, 'Listener must run once.');
  assertEventBusTest_(
    received[0].payload.companyId === 'COM-001',
    'Payload must be preserved.'
  );
  assertEventBusTest_(
    received[0].metadata.source === 'CompanyService',
    'Metadata must be preserved.'
  );
  assertEventBusTest_(
    summary.deliveredCount === 1 && summary.failedCount === 0,
    'Publication summary must report successful delivery.'
  );
}

/** @private @return {void} */
function testEventBusDuplicateSubscription_() {
  const bus = new JSKEventBus();
  const handler = function () {};
  const firstToken = bus.subscribe('people.updated', handler);
  const secondToken = bus.subscribe('people.updated', handler);

  assertEventBusTest_(
    firstToken.id === secondToken.id,
    'Duplicate handler subscription must reuse its token.'
  );
  assertEventBusTest_(
    bus.listenerCount('people.updated') === 1,
    'Duplicate handler subscription must not add a listener.'
  );
}

/** @private @return {void} */
function testEventBusUnsubscribe_() {
  const bus = new JSKEventBus();
  let calls = 0;
  const handler = function () {
    calls += 1;
  };

  const token = bus.subscribe('task.completed', handler);

  assertEventBusTest_(
    bus.unsubscribe('task.completed', token) === true,
    'Token unsubscribe must remove the listener.'
  );

  bus.publish('task.completed');

  assertEventBusTest_(calls === 0, 'Removed listener must not execute.');
  assertEventBusTest_(
    bus.unsubscribe('task.completed', token) === false,
    'Removing an unknown subscription must be safe.'
  );
}

/** @private @return {void} */
function testEventBusOnce_() {
  const bus = new JSKEventBus();
  let calls = 0;

  bus.once('notification.read', function () {
    calls += 1;
  });

  bus.publish('notification.read');
  bus.publish('notification.read');

  assertEventBusTest_(calls === 1, 'Once listener must run exactly once.');
}

/** @private @return {void} */
function testEventBusListenerIsolation_() {
  const logger = new JSKEventBusTestLogger_();
  const bus = new JSKEventBus({ logger: logger });
  let successfulCalls = 0;

  bus.subscribe('renewal.due', function () {
    throw new Error('Expected test failure');
  });

  bus.subscribe('renewal.due', function () {
    successfulCalls += 1;
  });

  const summary = bus.publish('renewal.due');

  assertEventBusTest_(
    successfulCalls === 1,
    'One listener failure must not stop remaining listeners.'
  );
  assertEventBusTest_(
    summary.failedCount === 1 && summary.deliveredCount === 1,
    'Publication summary must report listener failures.'
  );
  assertEventBusTest_(
    logger.exceptions.length === 1,
    'Listener failure must be logged.'
  );
}

/** @private @return {void} */
function testEventBusClear_() {
  const bus = new JSKEventBus();

  bus.subscribe('company.created', function () {});
  bus.subscribe('company.created', function () {});
  bus.subscribe('people.created', function () {});

  assertEventBusTest_(
    bus.clear('company.created') === 2,
    'clear() must return the number of removed listeners.'
  );
  assertEventBusTest_(
    bus.listenerCount('people.created') === 1,
    'clear() must not remove other events.'
  );
  assertEventBusTest_(
    bus.clearAll() === 1 && bus.eventNames().length === 0,
    'clearAll() must remove every remaining listener.'
  );
}

/** @private @return {void} */
function testEventBusValidation_() {
  const bus = new JSKEventBus();
  let invalidNameRejected = false;
  let invalidHandlerRejected = false;

  try {
    bus.publish('invalid event name');
  } catch (error) {
    invalidNameRejected = error instanceof TypeError;
  }

  try {
    bus.subscribe('company.created', null);
  } catch (error) {
    invalidHandlerRejected = error instanceof TypeError;
  }

  assertEventBusTest_(
    invalidNameRejected,
    'Invalid event names must be rejected.'
  );
  assertEventBusTest_(
    invalidHandlerRejected,
    'Non-function handlers must be rejected.'
  );
}

/**
 * Test logger for listener failure assertions.
 *
 * @constructor
 */
function JSKEventBusTestLogger_() {
  /** @type {Object[]} */
  this.exceptions = [];
}

/**
 * Captures a logged exception.
 *
 * @param {*} error Error value.
 * @param {Object} context Error context.
 * @return {void}
 */
JSKEventBusTestLogger_.prototype.exception = function (error, context) {
  this.exceptions.push({ error: error, context: context });
};

/**
 * Throws when an EventBus test condition fails.
 *
 * @private
 * @param {boolean} condition Test result.
 * @param {string} message Failure message.
 * @return {void}
 */
function assertEventBusTest_(condition, message) {
  if (!condition) {
    throw new Error('EventBus Test Failed: ' + message);
  }
}
