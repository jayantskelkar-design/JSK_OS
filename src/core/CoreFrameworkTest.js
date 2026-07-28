/**
 * Executes all Logger.js and Response.js tests.
 *
 * Run this function manually from the Apps Script editor.
 *
 * @return {void}
 */
function testCoreFramework() {
  testLoggerFramework_();
  testResponseFramework_();
  testEventBusFramework_();

  console.info(
    JSON.stringify({
      success: true,
      message: 'JSK OS Core Framework tests passed.',
      timestamp: new Date().toISOString()
    })
  );
}

/**
 * Tests structured logging behavior.
 *
 * @private
 * @return {void}
 */
function testLoggerFramework_() {
  const repository = new JSKInMemoryLogRepositoryForTest_();

  const logger = new JSKLogger({
    serviceName: 'CoreFrameworkTest',
    repository: repository,
    minimumLevel: JSK_LOG_LEVEL.DEBUG,
    requestId: 'REQ-TEST-001',
    user: 'system-test',
    defaultContext: {
      environment: 'test'
    }
  });

  logger.debug('Debug message', {
    module: 'Logger'
  });

  logger.info('Customer record processed.', {
    customerId: 'CUST-001',
    apiKey: 'secret-api-key'
  });

  logger.warn('Processing took longer than expected.', {
    durationMs: 2500
  });

  logger.exception(new Error('Test exception'), {
    operation: 'testLoggerFramework'
  });

  assertCoreTest_(
    repository.entries.length === 4,
    'Logger must persist four log entries.'
  );

  assertCoreTest_(
    repository.entries[0].level === 'DEBUG',
    'First log entry must have DEBUG level.'
  );

  assertCoreTest_(
    repository.entries[1].context.apiKey === '[REDACTED]',
    'Sensitive values must be redacted.'
  );

  assertCoreTest_(
    repository.entries[1].requestId === 'REQ-TEST-001',
    'Request ID must be included in log entries.'
  );

  assertCoreTest_(
    repository.entries[3].error.message === 'Test exception',
    'Exception details must be captured.'
  );

  const infoLogger = new JSKLogger({
    serviceName: 'LevelFilterTest',
    repository: repository,
    minimumLevel: JSK_LOG_LEVEL.INFO
  });

  const filteredEntry = infoLogger.debug(
    'This message must be filtered.'
  );

  assertCoreTest_(
    filteredEntry === null,
    'Messages below the minimum level must be filtered.'
  );
}

/**
 * Tests standard response behavior.
 *
 * @private
 * @return {void}
 */
function testResponseFramework_() {
  const successResponse = JSKResponse.success(
    {
      companyId: 'COM-001',
      companyName: 'JSK Investment'
    },
    {
      requestId: 'REQ-TEST-002',
      message: 'Company retrieved successfully.'
    }
  );

  assertCoreTest_(
    successResponse.success === true,
    'Success response must have success=true.'
  );

  assertCoreTest_(
    successResponse.code === 'SUCCESS',
    'Success response must have SUCCESS code.'
  );

  assertCoreTest_(
    successResponse.data.companyId === 'COM-001',
    'Success response must preserve data.'
  );

  assertCoreTest_(
    successResponse.meta.requestId === 'REQ-TEST-002',
    'Success response must preserve request ID.'
  );

  const validationResponse = JSKResponse.validationError(
    {
      companyName: 'Company name is required.'
    },
    {
      requestId: 'REQ-TEST-003'
    }
  );

  assertCoreTest_(
    validationResponse.success === false,
    'Validation response must have success=false.'
  );

  assertCoreTest_(
    validationResponse.code === 'VALIDATION_ERROR',
    'Validation response must have VALIDATION_ERROR code.'
  );

  assertCoreTest_(
    validationResponse.error.fieldErrors.companyName ===
      'Company name is required.',
    'Validation response must preserve field errors.'
  );

  const exceptionResponse = JSKResponse.fromException(
    new Error('Internal database information'),
    {
      requestId: 'REQ-TEST-004'
    }
  );

  assertCoreTest_(
    exceptionResponse.message !== 'Internal database information',
    'Internal exception messages must not be exposed by default.'
  );

  const jsonOutput = JSKResponse.json(successResponse);

  assertCoreTest_(
    jsonOutput.getMimeType() === ContentService.MimeType.JSON,
    'JSON output must use application/json MIME type.'
  );

  const parsedOutput = JSON.parse(jsonOutput.getContent());

  assertCoreTest_(
    parsedOutput.data.companyName === 'JSK Investment',
    'JSON output must contain the response payload.'
  );
}


/**
 * Tests EventBus behavior.
 *
 * @private
 * @return {void}
 */
function testEventBusFramework_() {
  var eventBus = new JSKEventBus();
  var calls = [];

  function firstListener(payload) {
    calls.push('first:' + payload.companyId);
  }

  function secondListener(payload) {
    calls.push('second:' + payload.companyId);
  }

  eventBus.subscribe('company.created', firstListener);
  eventBus.subscribe('company.created', secondListener);
  eventBus.subscribe('company.created', firstListener);

  assertCoreTest_(
    eventBus.listenerCount('company.created') === 2,
    'Duplicate EventBus subscriptions must be ignored.'
  );

  var firstPublish = eventBus.publish('company.created', {
    companyId: 'COM-001'
  });

  assertCoreTest_(
    firstPublish.delivered === 2 && firstPublish.failed === 0,
    'EventBus must deliver an event to every registered listener.'
  );

  assertCoreTest_(
    calls.join('|') === 'first:COM-001|second:COM-001',
    'EventBus must preserve listener execution order.'
  );

  eventBus.unsubscribe('company.created', firstListener);
  eventBus.publish('company.created', {
    companyId: 'COM-002'
  });

  assertCoreTest_(
    calls[calls.length - 1] === 'second:COM-002',
    'EventBus unsubscribe must remove only the selected listener.'
  );

  var onceCount = 0;
  eventBus.once('people.updated', function () {
    onceCount += 1;
  });

  eventBus.publish('people.updated');
  eventBus.publish('people.updated');

  assertCoreTest_(
    onceCount === 1,
    'EventBus once listener must execute exactly once.'
  );

  var wildcardCalls = [];
  eventBus.subscribe('company.*', function (payload, event) {
    wildcardCalls.push('namespace:' + event.name);
  });
  eventBus.subscribe('*', function (payload, event) {
    wildcardCalls.push('global:' + event.name);
  });

  eventBus.publish('company.updated', {
    companyId: 'COM-003'
  });

  assertCoreTest_(
    wildcardCalls.join('|') ===
      'namespace:company.updated|global:company.updated',
    'EventBus wildcard listeners must execute in namespace then global order.'
  );

  var isolationCount = 0;
  var quietLogger = {
    exception: function () {}
  };
  var isolatedEventBus = new JSKEventBus({
    logger: quietLogger
  });

  isolatedEventBus.subscribe('test.isolation', function () {
    throw new Error('Expected listener failure for isolation test.');
  });
  isolatedEventBus.subscribe('test.isolation', function () {
    isolationCount += 1;
  });

  var isolationResult = isolatedEventBus.publish('test.isolation');

  assertCoreTest_(
    isolationResult.failed === 1 && isolationCount === 1,
    'A failing EventBus listener must not stop remaining listeners.'
  );

  assertCoreTest_(
    eventBus.clear('company.created') === 1,
    'EventBus clear must report the number of removed listeners.'
  );

  eventBus.clearAll();

  assertCoreTest_(
    eventBus.listenerCount('company.*') === 0 &&
      eventBus.listenerCount('*') === 0,
    'EventBus clearAll must remove every listener.'
  );
}

/**
 * In-memory repository used only for automated tests.
 *
 * @private
 * @extends JSKLogRepository
 */
/**
 * In-memory log repository used by Core Framework tests.
 *
 * @constructor
 */
function JSKInMemoryLogRepositoryForTest_() {
  /** @type {Object[]} */
  this.entries = [];
}

/**
 * Stores a structured log entry in memory.
 *
 * @param {Object} logEntry Structured log entry.
 * @return {void}
 */
JSKInMemoryLogRepositoryForTest_.prototype.write = function (logEntry) {
  this.entries.push(logEntry);
};

/**
 * Throws an error when a test condition fails.
 *
 * @private
 * @param {boolean} condition Test result.
 * @param {string} message Failure message.
 * @return {void}
 */
function assertCoreTest_(condition, message) {
  if (!condition) {
    throw new Error('Core Framework Test Failed: ' + message);
  }
}