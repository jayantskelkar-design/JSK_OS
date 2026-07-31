/**
 * JSK OS - Structured Logging Framework
 *
 * Provides:
 * - Structured JSON logs
 * - Log-level filtering
 * - Sensitive-data masking
 * - Console repository
 * - Google Sheets repository
 * - Script locking for concurrent writes
 *
 * Google Apps Script V8 compatible.
 */

/**
 * Supported logging levels.
 *
 * @readonly
 * @enum {number}
 */
const JSK_LOG_LEVEL = Object.freeze({
  TRACE: 5,
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
  FATAL: 50
});

/**
 * Log level names.
 *
 * @readonly
 * @enum {string}
 */
const JSK_LOG_LEVEL_NAME = Object.freeze({
  5: 'TRACE',
  10: 'DEBUG',
  20: 'INFO',
  30: 'WARN',
  40: 'ERROR',
  50: 'FATAL'
});

/**
 * Default sensitive keys that must not appear in logs.
 *
 * @readonly
 * @type {string[]}
 */
const JSK_SENSITIVE_LOG_KEYS = Object.freeze([
  'password',
  'passcode',
  'pin',
  'otp',
  'token',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'authorization',
  'apiKey',
  'api_key',
  'secret',
  'clientSecret',
  'client_secret',
  'privateKey',
  'private_key',
  'cookie'
]);

/**
 * Base repository contract for log persistence.
 *
 * Concrete repositories must implement write().
 *
 * @abstract
 */
class JSKLogRepository {
  /**
   * Persists a structured log entry.
   *
   * @param {Object} logEntry Structured log entry.
   * @return {void}
   */
  write(logEntry) {
    throw new Error('JSKLogRepository.write() must be implemented.');
  }
}

/**
 * Writes structured logs to the Apps Script execution console.
 *
 * @extends JSKLogRepository
 */
class JSKConsoleLogRepository extends JSKLogRepository {
  /**
   * Writes a structured log entry to the execution console.
   *
   * @param {Object} logEntry Structured log entry.
   * @return {void}
   */
  write(logEntry) {
    let serializedEntry;

    try {
      serializedEntry = JSON.stringify(logEntry);
    } catch (error) {
      serializedEntry = JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        service: 'JSKConsoleLogRepository',
        message: 'Log entry could not be serialized.',
        error: {
          name: error && error.name ? error.name : 'Error',
          message: error && error.message
            ? error.message
            : String(error)
        }
      });
    }

    switch (logEntry.level) {
      case 'ERROR':
      case 'FATAL':
        console.error(serializedEntry);
        break;

      case 'WARN':
        console.warn(serializedEntry);
        break;

      case 'TRACE':
      case 'DEBUG':
        console.log(serializedEntry);
        break;

      case 'INFO':
      default:
        console.info(serializedEntry);
        break;
    }
  }
}

/**
 * Persists structured logs in a Google Sheets worksheet.
 *
 * The worksheet is created automatically if it does not exist.
 *
 * @extends JSKLogRepository
 */
class JSKSpreadsheetLogRepository extends JSKLogRepository {
  /**
   * Creates a spreadsheet log repository.
   *
   * @param {string} spreadsheetId Target spreadsheet ID.
   * @param {string=} sheetName Target sheet name.
   */
  constructor(spreadsheetId, sheetName) {
    super();

    if (!spreadsheetId || typeof spreadsheetId !== 'string') {
      throw new TypeError(
        'JSKSpreadsheetLogRepository requires a valid spreadsheet ID.'
      );
    }

    this.spreadsheetId_ = spreadsheetId.trim();
    this.sheetName_ = String(sheetName || 'System Logs').trim();
    this.headers_ = Object.freeze([
      'Timestamp',
      'Level',
      'Service',
      'Message',
      'Request ID',
      'User',
      'Context',
      'Error Name',
      'Error Message',
      'Stack Trace'
    ]);
  }

  /**
   * Writes a structured log entry to Google Sheets.
   *
   * @param {Object} logEntry Structured log entry.
   * @return {void}
   */
  write(logEntry) {
    const lock = LockService.getScriptLock();

    try {
      lock.waitLock(30000);

      const spreadsheet = SpreadsheetApp.openById(this.spreadsheetId_);
      const sheet = this.getOrCreateSheet_(spreadsheet);

      sheet.appendRow([
        logEntry.timestamp || '',
        logEntry.level || '',
        logEntry.service || '',
        logEntry.message || '',
        logEntry.requestId || '',
        logEntry.user || '',
        this.stringifySafely_(logEntry.context),
        logEntry.error ? logEntry.error.name || '' : '',
        logEntry.error ? logEntry.error.message || '' : '',
        logEntry.error ? logEntry.error.stack || '' : ''
      ]);
    } finally {
      if (lock.hasLock()) {
        lock.releaseLock();
      }
    }
  }

  /**
   * Returns the logging sheet, creating it when necessary.
   *
   * @private
   * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} spreadsheet Spreadsheet.
   * @return {GoogleAppsScript.Spreadsheet.Sheet} Logging sheet.
   */
  getOrCreateSheet_(spreadsheet) {
    let sheet = spreadsheet.getSheetByName(this.sheetName_);

    if (!sheet) {
      sheet = spreadsheet.insertSheet(this.sheetName_);
    }

    if (sheet.getLastRow() === 0) {
      sheet
        .getRange(1, 1, 1, this.headers_.length)
        .setValues([this.headers_])
        .setFontWeight('bold');

      sheet.setFrozenRows(1);
      sheet.autoResizeColumns(1, this.headers_.length);
    }

    return sheet;
  }

  /**
   * Converts a value to JSON without breaking log execution.
   *
   * @private
   * @param {*} value Value to serialize.
   * @return {string} Serialized value.
   */
  stringifySafely_(value) {
    if (value === null || value === undefined) {
      return '';
    }

    try {
      return JSON.stringify(value);
    } catch (error) {
      return String(value);
    }
  }
}

/**
 * Structured application logger.
 *
 * Repository pattern is used so that persistence can be changed without
 * changing business logic.
 */
class JSKLogger {
  /**
   * Creates a structured logger.
   *
   * @param {{
   *   serviceName: string,
   *   repository: JSKLogRepository,
   *   minimumLevel: (number|string|undefined),
   *   requestId: (string|undefined),
   *   user: (string|undefined),
   *   defaultContext: (Object|undefined),
   *   sensitiveKeys: (string[]|undefined)
   * }} options Logger options.
   */
  constructor(options) {
    const normalizedOptions = options || {};

    if (
      !normalizedOptions.serviceName ||
      typeof normalizedOptions.serviceName !== 'string'
    ) {
      throw new TypeError('JSKLogger requires a serviceName.');
    }

    if (
      !normalizedOptions.repository ||
      typeof normalizedOptions.repository.write !== 'function'
    ) {
      throw new TypeError(
        'JSKLogger requires a repository implementing write().'
      );
    }

    this.serviceName_ = normalizedOptions.serviceName.trim();
    this.repository_ = normalizedOptions.repository;
    this.minimumLevel_ = this.normalizeLevel_(
      normalizedOptions.minimumLevel === undefined
        ? JSK_LOG_LEVEL.INFO
        : normalizedOptions.minimumLevel
    );

    this.requestId_ = normalizedOptions.requestId
      ? String(normalizedOptions.requestId)
      : '';

    this.user_ = normalizedOptions.user
      ? String(normalizedOptions.user)
      : '';

    this.defaultContext_ = this.cloneValue_(
      normalizedOptions.defaultContext || {}
    );

    this.sensitiveKeys_ = new Set(
      (normalizedOptions.sensitiveKeys || JSK_SENSITIVE_LOG_KEYS)
        .map(function (key) {
          return String(key).toLowerCase();
        })
    );
  }

  /**
   * Logs a TRACE message.
   *
   * @param {string} message Log message.
   * @param {Object=} context Additional context.
   * @return {Object|null} Created log entry or null when filtered.
   */
  trace(message, context) {
    return this.log(JSK_LOG_LEVEL.TRACE, message, context);
  }

  /**
   * Logs a DEBUG message.
   *
   * @param {string} message Log message.
   * @param {Object=} context Additional context.
   * @return {Object|null} Created log entry or null when filtered.
   */
  debug(message, context) {
    return this.log(JSK_LOG_LEVEL.DEBUG, message, context);
  }

  /**
   * Logs an INFO message.
   *
   * @param {string} message Log message.
   * @param {Object=} context Additional context.
   * @return {Object|null} Created log entry or null when filtered.
   */
  info(message, context) {
    return this.log(JSK_LOG_LEVEL.INFO, message, context);
  }

  /**
   * Logs a WARN message.
   *
   * @param {string} message Log message.
   * @param {Object=} context Additional context.
   * @return {Object|null} Created log entry or null when filtered.
   */
  warn(message, context) {
    return this.log(JSK_LOG_LEVEL.WARN, message, context);
  }

  /**
   * Logs an ERROR message.
   *
   * @param {string} message Log message.
   * @param {Object=} context Additional context.
   * @param {Error=} error Error object.
   * @return {Object|null} Created log entry or null when filtered.
   */
  error(message, context, error) {
    return this.log(JSK_LOG_LEVEL.ERROR, message, context, error);
  }

  /**
   * Logs a FATAL message.
   *
   * @param {string} message Log message.
   * @param {Object=} context Additional context.
   * @param {Error=} error Error object.
   * @return {Object|null} Created log entry or null when filtered.
   */
  fatal(message, context, error) {
    return this.log(JSK_LOG_LEVEL.FATAL, message, context, error);
  }

  /**
   * Logs an exception using a standardized error structure.
   *
   * @param {Error|*} error Error or thrown value.
   * @param {Object=} context Additional context.
   * @param {string=} message Custom log message.
   * @return {Object|null} Created log entry or null when filtered.
   */
  exception(error, context, message) {
    const normalizedError = this.normalizeError_(error);

    return this.log(
      JSK_LOG_LEVEL.ERROR,
      message || normalizedError.message || 'Unhandled exception',
      context,
      normalizedError
    );
  }

  /**
   * Writes a structured log entry.
   *
   * @param {number|string} level Log level.
   * @param {string} message Log message.
   * @param {Object=} context Additional context.
   * @param {Error=} error Error object.
   * @return {Object|null} Created log entry or null when filtered.
   */
  log(level, message, context, error) {
    const numericLevel = this.normalizeLevel_(level);

    if (numericLevel < this.minimumLevel_) {
      return null;
    }

    if (!message || typeof message !== 'string') {
      throw new TypeError('Log message must be a non-empty string.');
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      level: JSK_LOG_LEVEL_NAME[numericLevel],
      levelValue: numericLevel,
      service: this.serviceName_,
      message: message.trim(),
      requestId: this.requestId_,
      user: this.user_,
      context: this.sanitize_(
        Object.assign(
          {},
          this.cloneValue_(this.defaultContext_),
          this.cloneValue_(context || {})
        )
      )
    };

    if (error !== undefined && error !== null) {
      logEntry.error = this.sanitizeError_(this.normalizeError_(error));
    }

    this.writeSafely_(logEntry);

    return logEntry;
  }

  /**
   * Writes a log entry without allowing repository failures to interrupt
   * application execution.
   *
   * @private
   * @param {Object} logEntry Structured log entry.
   * @return {void}
   */
  writeSafely_(logEntry) {
    try {
      this.repository_.write(logEntry);
    } catch (repositoryError) {
      try {
        const fallbackEntry = {
          timestamp: new Date().toISOString(),
          level: 'ERROR',
          service: 'JSKLogger',
          message: 'Log repository write failed.',
          context: {
            originalService: this.serviceName_,
            originalLevel: logEntry.level,
            originalMessage: logEntry.message
          },
          error: this.sanitizeError_(
            this.normalizeError_(repositoryError)
          )
        };

        new JSKConsoleLogRepository().write(fallbackEntry);
      } catch (fallbackError) {
        // Logging must never interrupt application execution.
      }
    }
  }

  /**
   * Creates a child logger with additional default context.
   *
   * @param {Object} context Context inherited by the child logger.
   * @return {JSKLogger} Child logger.
   */
  child(context) {
    return new JSKLogger({
      serviceName: this.serviceName_,
      repository: this.repository_,
      minimumLevel: this.minimumLevel_,
      requestId: this.requestId_,
      user: this.user_,
      defaultContext: Object.assign(
        {},
        this.cloneValue_(this.defaultContext_),
        this.cloneValue_(context || {})
      ),
      sensitiveKeys: Array.from(this.sensitiveKeys_)
    });
  }

  /**
   * Normalizes a log level.
   *
   * @private
   * @param {number|string} level Log level.
   * @return {number} Numeric log level.
   */
  normalizeLevel_(level) {
    if (typeof level === 'number' && JSK_LOG_LEVEL_NAME[level]) {
      return level;
    }

    if (typeof level === 'string') {
      const normalizedName = level.trim().toUpperCase();

      if (JSK_LOG_LEVEL[normalizedName] !== undefined) {
        return JSK_LOG_LEVEL[normalizedName];
      }
    }

    throw new RangeError('Unsupported log level: ' + String(level));
  }

  /**
   * Converts any thrown value into an Error object.
   *
   * @private
   * @param {*} error Thrown value.
   * @return {Error} Normalized Error.
   */
  normalizeError_(error) {
    if (error instanceof Error) {
      return error;
    }

    if (typeof error === 'string') {
      return new Error(error);
    }

    try {
      return new Error(JSON.stringify(error));
    } catch (serializationError) {
      return new Error(String(error));
    }
  }

  /**
   * Creates a safe error representation.
   *
   * @private
   * @param {Error} error Error object.
   * @return {Object} Sanitized error details.
   */
  sanitizeError_(error) {
    return {
      name: error.name || 'Error',
      message: this.maskString_(error.message || ''),
      stack: this.maskString_(error.stack || '')
    };
  }

  /**
   * Recursively masks sensitive values.
   *
   * @private
   * @param {*} value Value to sanitize.
   * @param {WeakSet=} visited Circular-reference tracker.
   * @return {*} Sanitized value.
   */
  sanitize_(value, visited) {
    const seen = visited || new WeakSet();

    if (value === null || value === undefined) {
      return value;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (value instanceof Error) {
      return this.sanitizeError_(value);
    }

    if (typeof value === 'string') {
      return this.maskString_(value);
    }

    if (typeof value !== 'object') {
      return value;
    }

    if (seen.has(value)) {
      return '[Circular]';
    }

    seen.add(value);

    if (Array.isArray(value)) {
      return value.map(
        function (item) {
          return this.sanitize_(item, seen);
        }.bind(this)
      );
    }

    const sanitizedObject = {};

    Object.keys(value).forEach(
      function (key) {
        if (this.sensitiveKeys_.has(String(key).toLowerCase())) {
          sanitizedObject[key] = '[REDACTED]';
          return;
        }

        sanitizedObject[key] = this.sanitize_(value[key], seen);
      }.bind(this)
    );

    return sanitizedObject;
  }

  /**
   * Masks common authorization and credential values inside strings.
   *
   * @private
   * @param {string} value String value.
   * @return {string} Masked string.
   */
  maskString_(value) {
    return String(value)
      .replace(
        /\b(Bearer|Basic)\s+[A-Za-z0-9\-._~+/]+=*/gi,
        '$1 [REDACTED]'
      )
      .replace(
        /(["']?(?:password|token|api[_-]?key|secret)["']?\s*[:=]\s*)["']?[^,\s}"']+/gi,
        '$1[REDACTED]'
      );
  }

  /**
   * Deep-clones serializable data while preserving safe fallback behavior.
   *
   * @private
   * @param {*} value Value to clone.
   * @return {*} Cloned value.
   */
  cloneValue_(value, visited) {
  const seen = visited || new WeakSet();

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== 'object') {
    return value;
  }

  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  if (value instanceof Error) {
    return value;
  }

  if (seen.has(value)) {
    return '[Circular]';
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map(item => this.cloneValue_(item, seen));
  }

  const clone = {};

  Object.keys(value).forEach(key => {
    clone[key] = this.cloneValue_(value[key], seen);
  });

  return clone;
  }
}

/**
 * Logger factory for consistent application-wide logger creation.
 */
class JSKLoggerFactory {
  /**
   * Creates a console-backed logger.
   *
   * @param {string} serviceName Service or module name.
   * @param {Object=} options Additional logger options.
   * @return {JSKLogger} Configured logger.
   */
  static createConsoleLogger(serviceName, options) {
    return new JSKLogger(
      Object.assign({}, options || {}, {
        serviceName: serviceName,
        repository: new JSKConsoleLogRepository()
      })
    );
  }

  /**
   * Creates a Google Sheets-backed logger.
   *
   * @param {string} serviceName Service or module name.
   * @param {string} spreadsheetId Log spreadsheet ID.
   * @param {string=} sheetName Log sheet name.
   * @param {Object=} options Additional logger options.
   * @return {JSKLogger} Configured logger.
   */
  static createSpreadsheetLogger(
    serviceName,
    spreadsheetId,
    sheetName,
    options
  ) {
    return new JSKLogger(
      Object.assign({}, options || {}, {
        serviceName: serviceName,
        repository: new JSKSpreadsheetLogRepository(
          spreadsheetId,
          sheetName
        )
      })
    );
  }
}