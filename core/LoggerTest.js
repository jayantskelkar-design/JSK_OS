/**
 * JSK OS
 * Module: Logger Enhancement Tests
 * Issue: CORE-002
 *
 * Run testLoggerEnhancement manually from the Apps Script editor.
 */
function testLoggerEnhancement() {
  testLoggerTraceLevel_();
  testLoggerSensitiveData_();
  testLoggerCircularContext_();
  testLoggerRepositoryFailureIsolation_();
  testLoggerChildContext_();

  console.info(
    JSON.stringify({
      success: true,
      message: 'JSK OS Logger enhancement tests passed.',
      timestamp: new Date().toISOString()
    })
  );
}

function testLoggerTraceLevel_() {
  var repository = new JSKLoggerTestRepository_();
  var logger = new JSKLogger({
    serviceName: 'LoggerTraceTest',
    repository: repository,
    minimumLevel: JSK_LOG_LEVEL.TRACE
  });

  logger.trace('Trace entry.', { operation: 'trace-test' });

  assertLoggerTest_(
    repository.entries.length === 1 &&
      repository.entries[0].level === 'TRACE',
    'TRACE entries must be supported.'
  );
}

function testLoggerSensitiveData_() {
  var repository = new JSKLoggerTestRepository_();
  var logger = new JSKLogger({
    serviceName: 'LoggerSensitiveDataTest',
    repository: repository,
    minimumLevel: JSK_LOG_LEVEL.DEBUG
  });

  logger.info('Request accepted.', {
    apiKey: 'secret-value',
    nested: { password: 'do-not-log' },
    authorization: 'Bearer abc.def.ghi'
  });

  var context = repository.entries[0].context;

  assertLoggerTest_(
    context.apiKey === '[REDACTED]' &&
      context.nested.password === '[REDACTED]' &&
      context.authorization.indexOf('[REDACTED]') !== -1,
    'Sensitive values must be redacted.'
  );
}

function testLoggerCircularContext_() {
  var repository = new JSKLoggerTestRepository_();
  var logger = new JSKLogger({
    serviceName: 'LoggerCircularTest',
    repository: repository
  });
  var circular = { name: 'root' };
  circular.self = circular;

  logger.info('Circular context.', circular);

  assertLoggerTest_(
    repository.entries[0].context.self &&
      repository.entries[0].context.self.self === '[Circular]',
    'Circular references must be handled safely.'
  );
}

function testLoggerRepositoryFailureIsolation_() {
  var logger = new JSKLogger({
    serviceName: 'LoggerFailureIsolationTest',
    repository: new JSKFailingLoggerTestRepository_()
  });
  var completed = false;

  logger.info('This write is expected to fail safely.');
  completed = true;

  assertLoggerTest_(
    completed === true,
    'Repository failures must not interrupt application execution.'
  );
}

function testLoggerChildContext_() {
  var repository = new JSKLoggerTestRepository_();
  var logger = new JSKLogger({
    serviceName: 'LoggerChildTest',
    repository: repository,
    defaultContext: { module: 'core' }
  });
  var child = logger.child({ requestType: 'test' });

  child.info('Child logger entry.', { operation: 'child' });

  assertLoggerTest_(
    repository.entries[0].context.module === 'core' &&
      repository.entries[0].context.requestType === 'test' &&
      repository.entries[0].context.operation === 'child',
    'Child loggers must preserve and extend default context.'
  );
}

function JSKLoggerTestRepository_() {
  this.entries = [];
}

JSKLoggerTestRepository_.prototype.write = function (entry) {
  this.entries.push(entry);
};

function JSKFailingLoggerTestRepository_() {}

JSKFailingLoggerTestRepository_.prototype.write = function () {
  throw new Error('Expected logger repository failure.');
};

function assertLoggerTest_(condition, message) {
  if (!condition) {
    throw new Error('Logger test failed: ' + message);
  }
}
