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
    minimumLevel: JSK_LOG_LEVEL.TRACE,
    requestId: 'REQ-TEST-001',
    user: 'system-test',
    defaultContext: {
      environment: 'test'
    }
  });

  logger.trace('Trace message', {
    module: 'Logger'
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
    repository.entries.length === 5,
    'Logger must persist five log entries.'
  );

  assertCoreTest_(
    repository.entries[0].level === 'TRACE',
    'First log entry must have TRACE level.'
  );

  assertCoreTest_(
    repository.entries[2].context.apiKey === '[REDACTED]',
    'Sensitive values must be redacted.'
  );

  assertCoreTest_(
    repository.entries[2].requestId === 'REQ-TEST-001',
    'Request ID must be included in log entries.'
  );

  assertCoreTest_(
    repository.entries[4].error.message === 'Test exception',
    'Exception details must be captured.'
  );


  const circularContext = {
    name: 'Circular Context'
  };
  circularContext.self = circularContext;

  const circularEntry = logger.info(
    'Circular context test.',
    circularContext
  );

  assertCoreTest_(
    circularEntry.context.self === '[Circular]',
    'Circular context values must be handled safely.'
  );

  const failingRepository = {
    write: function () {
      throw new Error('Expected repository failure.');
    }
  };

  const resilientLogger = new JSKLogger({
    serviceName: 'RepositoryFailureTest',
    repository: failingRepository,
    minimumLevel: JSK_LOG_LEVEL.TRACE
  });

  const resilientEntry = resilientLogger.info(
    'Application execution must continue.'
  );

  assertCoreTest_(
    resilientEntry && resilientEntry.level === 'INFO',
    'Repository failures must not interrupt logger execution.'
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