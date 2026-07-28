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
 * Tests core EventBus behavior.
 *
 * @private
 * @return {void}
 */
function testEventBusFramework_() {
  const listenerErrors = [];
  const eventBus = new JSKEventBus({
    onListenerError: function (error, context) {
      listenerErrors.push({
        error: error,
        context: context
      });
    }
  });

  const received = [];

  function exactListener(payload, event) {
    received.push('exact:' + payload.companyId + ':' + event.name);
  }

  function namespaceListener(payload) {
    received.push('namespace:' + payload.companyId);
  }

  function globalListener(payload) {
    const recordId = payload
      ? payload.companyId || payload.personId || ''
      : '';

    received.push('global:' + recordId);
  }

  eventBus.subscribe('company.created', exactListener);
  eventBus.subscribe('company.*', namespaceListener);
  eventBus.subscribe('*', globalListener);
  eventBus.subscribe('company.created', exactListener);

  assertCoreTest_(
    eventBus.listenerCount('company.created') === 1,
    'EventBus must prevent duplicate subscriptions.'
  );

  const publishResult = eventBus.publish('company.created', {
    companyId: 'COM-001'
  });

  assertCoreTest_(
    publishResult.delivered === 3 && publishResult.failed === 0,
    'EventBus must deliver exact, namespace and global listeners.'
  );

  assertCoreTest_(
    received.join('|') ===
      'exact:COM-001:company.created|' +
      'namespace:COM-001|global:COM-001',
    'EventBus must preserve deterministic listener order.'
  );

  assertCoreTest_(
    eventBus.unsubscribe('company.created', exactListener) === true,
    'EventBus must unsubscribe an existing listener.'
  );

  assertCoreTest_(
    eventBus.unsubscribe('company.created', exactListener) === false,
    'EventBus must safely ignore an unknown listener.'
  );

  let onceCount = 0;

  eventBus.once('people.updated', function () {
    onceCount += 1;
  });

  eventBus.publish('people.updated', { personId: 'P-001' });
  eventBus.publish('people.updated', { personId: 'P-001' });

  assertCoreTest_(
    onceCount === 1,
    'EventBus once listener must execute exactly once.'
  );

  eventBus.clear('*');

  let isolatedListenerRan = false;

  eventBus.subscribe('system.test', function () {
    throw new Error('Expected EventBus listener failure.');
  });

  eventBus.subscribe('system.test', function () {
    isolatedListenerRan = true;
  });

  const isolationResult = eventBus.publish('system.test');

  assertCoreTest_(
    isolatedListenerRan === true,
    'A failing EventBus listener must not stop remaining listeners.'
  );

  assertCoreTest_(
    isolationResult.delivered === 1 &&
      isolationResult.failed === 1 &&
      listenerErrors.length === 1,
    'EventBus must report isolated listener failures.'
  );

  assertCoreTest_(
    eventBus.clear('system.test') === 2,
    'EventBus clear must remove listeners for one event.'
  );

  const remainingCount = eventBus.listenerCount();

  assertCoreTest_(
    eventBus.clearAll() === remainingCount &&
      eventBus.listenerCount() === 0,
    'EventBus clearAll must remove every listener.'
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