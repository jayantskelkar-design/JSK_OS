/**
 * Executes JSK OS EventBus tests.
 *
 * Run manually from the Apps Script editor.
 *
 * @return {void}
 */
function testEventBus() {
  testEventBusSubscribeAndPublish_();
  testEventBusDuplicateProtection_();
  testEventBusOnce_();
  testEventBusUnsubscribe_();
  testEventBusWildcards_();
  testEventBusErrorIsolation_();
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

/** @private */
function testEventBusSubscribeAndPublish_() {
  var bus = new JSKEventBus();
  var received = null;

  bus.subscribe('company.created', function (payload, envelope) {
    received = {
      payload: payload,
      envelope: envelope
    };
  });

  var result = bus.publish(
    'company.created',
    { companyId: 'COM-001' },
    { actor: 'test' }
  );

  assertEventBusTest_(
    received.payload.companyId === 'COM-001',
    'Subscriber must receive the event payload.'
  );
  assertEventBusTest_(
    received.envelope.name === 'company.created',
    'Envelope must preserve the normalized event name.'
  );
  assertEventBusTest_(
    received.envelope.metadata.actor === 'test',
    'Envelope must preserve metadata.'
  );
  assertEventBusTest_(
    result.executed === 1 && result.failed === 0,
    'Publish result must report successful execution.'
  );
}

/** @private */
function testEventBusDuplicateProtection_() {
  var bus = new JSKEventBus();
  var count = 0;

  function handler() {
    count += 1;
  }

  var firstToken = bus.subscribe('people.updated', handler);
  var duplicateToken = bus.subscribe('people.updated', handler);

  bus.publish('people.updated');

  assertEventBusTest_(
    firstToken.id === duplicateToken.id,
    'Duplicate subscriptions must reuse the existing token.'
  );
  assertEventBusTest_(
    count === 1,
    'Duplicate subscriptions must not execute twice.'
  );
}

/** @private */
function testEventBusOnce_() {
  var bus = new JSKEventBus();
  var count = 0;

  bus.once('task.completed', function () {
    count += 1;
  });

  bus.publish('task.completed');
  bus.publish('task.completed');

  assertEventBusTest_(
    count === 1,
    'A once subscription must execute exactly once.'
  );
  assertEventBusTest_(
    bus.listenerCount('task.completed') === 0,
    'A once subscription must remove itself.'
  );
}

/** @private */
function testEventBusUnsubscribe_() {
  var bus = new JSKEventBus();
  var count = 0;

  function handler() {
    count += 1;
  }

  var token = bus.subscribe('notification.read', handler);

  assertEventBusTest_(
    bus.unsubscribe(token) === true,
    'Unsubscribe by token must remove a subscription.'
  );

  bus.publish('notification.read');

  assertEventBusTest_(
    count === 0,
    'An unsubscribed handler must not execute.'
  );
  assertEventBusTest_(
    bus.unsubscribe(token) === false,
    'Unsubscribing an unknown token must be safe.'
  );
}

/** @private */
function testEventBusWildcards_() {
  var bus = new JSKEventBus();
  var order = [];

  bus.subscribe('company.*', function () {
    order.push('namespace');
  });
  bus.subscribe('*', function () {
    order.push('global');
  });
  bus.subscribe('company.updated', function () {
    order.push('exact');
  });

  var result = bus.publish('company.updated');

  assertEventBusTest_(
    order.join(',') === 'namespace,global,exact',
    'Matching listeners must execute in subscription order.'
  );
  assertEventBusTest_(
    result.matched === 3,
    'Exact and wildcard listeners must all match.'
  );
}

/** @private */
function testEventBusErrorIsolation_() {
  var logger = new JSKEventBusTestLogger_();
  var bus = new JSKEventBus({ logger: logger });
  var successfulListenerExecuted = false;

  bus.subscribe('system.test', function () {
    throw new Error('Expected test failure.');
  });
  bus.subscribe('system.test', function () {
    successfulListenerExecuted = true;
  });

  var result = bus.publish('system.test');

  assertEventBusTest_(
    successfulListenerExecuted === true,
    'One listener failure must not stop remaining listeners.'
  );
  assertEventBusTest_(
    result.failed === 1 && result.executed === 1,
    'Publish result must report listener failures.'
  );
  assertEventBusTest_(
    logger.errors.length === 1,
    'Listener failures must be logged when a logger is supplied.'
  );
}

/** @private */
function testEventBusClear_() {
  var bus = new JSKEventBus();

  bus.subscribe('company.created', function () {});
  bus.subscribe('company.created', function () {});
  bus.subscribe('people.created', function () {});

  assertEventBusTest_(
    bus.clear('company.created') === 2,
    'Clear must return the number of removed listeners.'
  );
  assertEventBusTest_(
    bus.listenerCount() === 1,
    'Clear must only remove listeners for the requested event.'
  );
  assertEventBusTest_(
    bus.clearAll() === 1 && bus.listenerCount() === 0,
    'ClearAll must remove every remaining listener.'
  );
}

/** @private */
function testEventBusValidation_() {
  var bus = new JSKEventBus();
  var invalidEventRejected = false;
  var wildcardPublishRejected = false;

  try {
    bus.subscribe('Invalid Event', function () {});
  } catch (error) {
    invalidEventRejected = true;
  }

  try {
    bus.publish('company.*');
  } catch (error) {
    wildcardPublishRejected = true;
  }

  assertEventBusTest_(
    invalidEventRejected,
    'Invalid event names must be rejected.'
  );
  assertEventBusTest_(
    wildcardPublishRejected,
    'Wildcard event names must not be publishable.'
  );
}

/**
 * Test logger that captures EventBus listener errors.
 *
 * @constructor
 * @private
 */
function JSKEventBusTestLogger_() {
  this.errors = [];
}

/** @private */
JSKEventBusTestLogger_.prototype.exception = function (error, context) {
  this.errors.push({
    error: error,
    context: context
  });
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
