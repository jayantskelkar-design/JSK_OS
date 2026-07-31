/**
 * JSK OS - Standard API Response Framework
 *
 * Provides:
 * - Standard success and error envelopes
 * - Validation error responses
 * - Exception conversion
 * - JSON ContentService output
 * - Request and response metadata
 *
 * Google Apps Script V8 compatible.
 */

/**
 * Standard application response utility.
 */
class JSKResponse {
  /**
   * Creates a successful response.
   *
   * @param {*=} data Response payload.
   * @param {{
   *   message: (string|undefined),
   *   code: (string|undefined),
   *   requestId: (string|undefined),
   *   metadata: (Object|undefined)
   * }=} options Response options.
   * @return {Object} Standard response envelope.
   */
  static success(data, options) {
    const normalizedOptions = options || {};

    return JSKResponse.createEnvelope_({
      success: true,
      code: normalizedOptions.code || 'SUCCESS',
      message: normalizedOptions.message || 'Request completed successfully.',
      data: data === undefined ? null : data,
      error: null,
      requestId: normalizedOptions.requestId || '',
      metadata: normalizedOptions.metadata || {}
    });
  }

  /**
   * Creates a resource-created response.
   *
   * @param {*} data Created resource.
   * @param {{
   *   message: (string|undefined),
   *   code: (string|undefined),
   *   requestId: (string|undefined),
   *   metadata: (Object|undefined)
   * }=} options Response options.
   * @return {Object} Standard response envelope.
   */
  static created(data, options) {
    const normalizedOptions = options || {};

    return JSKResponse.success(
      data,
      Object.assign({}, normalizedOptions, {
        code: normalizedOptions.code || 'RESOURCE_CREATED',
        message:
          normalizedOptions.message || 'Resource created successfully.'
      })
    );
  }

  /**
   * Creates an error response.
   *
   * @param {{
   *   code: string,
   *   message: string,
   *   details: (*|undefined),
   *   fieldErrors: (Object|Array|undefined),
   *   requestId: (string|undefined),
   *   metadata: (Object|undefined)
   * }} options Error response options.
   * @return {Object} Standard response envelope.
   */
  static error(options) {
    const normalizedOptions = options || {};

    if (
      !normalizedOptions.code ||
      typeof normalizedOptions.code !== 'string'
    ) {
      throw new TypeError('Error response requires a string code.');
    }

    if (
      !normalizedOptions.message ||
      typeof normalizedOptions.message !== 'string'
    ) {
      throw new TypeError('Error response requires a string message.');
    }

    return JSKResponse.createEnvelope_({
      success: false,
      code: normalizedOptions.code,
      message: normalizedOptions.message,
      data: null,
      error: {
        details:
          normalizedOptions.details === undefined
            ? null
            : normalizedOptions.details,
        fieldErrors:
          normalizedOptions.fieldErrors === undefined
            ? null
            : normalizedOptions.fieldErrors
      },
      requestId: normalizedOptions.requestId || '',
      metadata: normalizedOptions.metadata || {}
    });
  }

  /**
   * Creates a validation-error response.
   *
   * @param {Object|Array} fieldErrors Field validation errors.
   * @param {{
   *   message: (string|undefined),
   *   requestId: (string|undefined),
   *   metadata: (Object|undefined)
   * }=} options Response options.
   * @return {Object} Standard response envelope.
   */
  static validationError(fieldErrors, options) {
    const normalizedOptions = options || {};

    if (
      fieldErrors === null ||
      fieldErrors === undefined ||
      typeof fieldErrors !== 'object'
    ) {
      throw new TypeError(
        'validationError() requires an object or array of field errors.'
      );
    }

    return JSKResponse.error({
      code: 'VALIDATION_ERROR',
      message:
        normalizedOptions.message ||
        'One or more fields contain invalid values.',
      fieldErrors: fieldErrors,
      requestId: normalizedOptions.requestId || '',
      metadata: normalizedOptions.metadata || {}
    });
  }

  /**
   * Creates a not-found response.
   *
   * @param {string} resourceName Name of the missing resource.
   * @param {{
   *   message: (string|undefined),
   *   requestId: (string|undefined),
   *   metadata: (Object|undefined)
   * }=} options Response options.
   * @return {Object} Standard response envelope.
   */
  static notFound(resourceName, options) {
    const normalizedOptions = options || {};
    const normalizedResourceName =
      String(resourceName || 'Resource').trim() || 'Resource';

    return JSKResponse.error({
      code: 'RESOURCE_NOT_FOUND',
      message:
        normalizedOptions.message ||
        normalizedResourceName + ' was not found.',
      requestId: normalizedOptions.requestId || '',
      metadata: normalizedOptions.metadata || {}
    });
  }

  /**
   * Creates an unauthorized response.
   *
   * @param {{
   *   message: (string|undefined),
   *   requestId: (string|undefined),
   *   metadata: (Object|undefined)
   * }=} options Response options.
   * @return {Object} Standard response envelope.
   */
  static unauthorized(options) {
    const normalizedOptions = options || {};

    return JSKResponse.error({
      code: 'UNAUTHORIZED',
      message:
        normalizedOptions.message ||
        'Authentication is required to access this resource.',
      requestId: normalizedOptions.requestId || '',
      metadata: normalizedOptions.metadata || {}
    });
  }

  /**
   * Creates a forbidden response.
   *
   * @param {{
   *   message: (string|undefined),
   *   requestId: (string|undefined),
   *   metadata: (Object|undefined)
   * }=} options Response options.
   * @return {Object} Standard response envelope.
   */
  static forbidden(options) {
    const normalizedOptions = options || {};

    return JSKResponse.error({
      code: 'FORBIDDEN',
      message:
        normalizedOptions.message ||
        'You do not have permission to perform this action.',
      requestId: normalizedOptions.requestId || '',
      metadata: normalizedOptions.metadata || {}
    });
  }

  /**
   * Converts an exception into a safe response.
   *
   * Stack traces are excluded from the client response.
   *
   * @param {Error|*} error Error or thrown value.
   * @param {{
   *   code: (string|undefined),
   *   message: (string|undefined),
   *   requestId: (string|undefined),
   *   metadata: (Object|undefined),
   *   exposeErrorMessage: (boolean|undefined)
   * }=} options Response options.
   * @return {Object} Standard response envelope.
   */
  static fromException(error, options) {
    const normalizedOptions = options || {};
    const normalizedError = JSKResponse.normalizeError_(error);

    const publicMessage = normalizedOptions.exposeErrorMessage === true
      ? normalizedError.message
      : normalizedOptions.message ||
        'An unexpected error occurred while processing the request.';

    return JSKResponse.error({
      code: normalizedOptions.code || 'INTERNAL_ERROR',
      message: publicMessage,
      details: {
        type: normalizedError.name || 'Error'
      },
      requestId: normalizedOptions.requestId || '',
      metadata: normalizedOptions.metadata || {}
    });
  }

  /**
   * Converts a standard response envelope to Apps Script JSON output.
   *
   * @param {Object} response Standard response envelope.
   * @return {GoogleAppsScript.Content.TextOutput} JSON response.
   */
  static json(response) {
    JSKResponse.assertValidEnvelope_(response);

    return ContentService
      .createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
  }

  /**
   * Converts a success payload directly to JSON output.
   *
   * @param {*=} data Response payload.
   * @param {Object=} options Success response options.
   * @return {GoogleAppsScript.Content.TextOutput} JSON response.
   */
  static jsonSuccess(data, options) {
    return JSKResponse.json(JSKResponse.success(data, options));
  }

  /**
   * Converts an error response directly to JSON output.
   *
   * @param {Object} options Error response options.
   * @return {GoogleAppsScript.Content.TextOutput} JSON response.
   */
  static jsonError(options) {
    return JSKResponse.json(JSKResponse.error(options));
  }

  /**
   * Builds the common response envelope.
   *
   * @private
   * @param {Object} values Envelope values.
   * @return {Object} Frozen response envelope.
   */
  static createEnvelope_(values) {
    const response = {
      success: values.success === true,
      code: String(values.code),
      message: String(values.message),
      data: JSKResponse.toSerializable_(values.data),
      error: JSKResponse.toSerializable_(values.error),
      meta: {
        timestamp: new Date().toISOString(),
        requestId: values.requestId
          ? String(values.requestId)
          : '',
        metadata: JSKResponse.toSerializable_(values.metadata || {})
      }
    };

    return JSKResponse.deepFreeze_(response);
  }

  /**
   * Validates a response envelope before serialization.
   *
   * @private
   * @param {Object} response Response envelope.
   * @return {void}
   */
  static assertValidEnvelope_(response) {
    if (!response || typeof response !== 'object') {
      throw new TypeError('Response must be an object.');
    }

    if (typeof response.success !== 'boolean') {
      throw new TypeError('Response.success must be a boolean.');
    }

    if (!response.code || typeof response.code !== 'string') {
      throw new TypeError('Response.code must be a non-empty string.');
    }

    if (!response.message || typeof response.message !== 'string') {
      throw new TypeError('Response.message must be a non-empty string.');
    }

    if (!response.meta || typeof response.meta !== 'object') {
      throw new TypeError('Response.meta must be an object.');
    }

    if (
      !response.meta.timestamp ||
      typeof response.meta.timestamp !== 'string'
    ) {
      throw new TypeError(
        'Response.meta.timestamp must be a non-empty string.'
      );
    }
  }

  /**
   * Converts any thrown value to an Error object.
   *
   * @private
   * @param {*} error Thrown value.
   * @return {Error} Normalized error.
   */
  static normalizeError_(error) {
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
   * Converts values into JSON-safe data.
   *
   * @private
   * @param {*} value Value to convert.
   * @param {WeakSet=} visited Circular-reference tracker.
   * @return {*} JSON-safe value.
   */
  static toSerializable_(value, visited) {
    const seen = visited || new WeakSet();

    if (value === undefined) {
      return null;
    }

    if (value === null) {
      return null;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (value instanceof Error) {
      return {
        name: value.name || 'Error',
        message: value.message || ''
      };
    }

    if (typeof value === 'function') {
      return null;
    }

    if (typeof value !== 'object') {
      return value;
    }

    if (seen.has(value)) {
      return '[Circular]';
    }

    seen.add(value);

    if (Array.isArray(value)) {
      return value.map(function (item) {
        return JSKResponse.toSerializable_(item, seen);
      });
    }

    const result = {};

    Object.keys(value).forEach(function (key) {
      result[key] = JSKResponse.toSerializable_(value[key], seen);
    });

    return result;
  }

  /**
   * Deep-freezes an object to prevent accidental response mutation.
   *
   * @private
   * @param {*} value Value to freeze.
   * @param {WeakSet=} visited Circular-reference tracker.
   * @return {*} Frozen value.
   */
  static deepFreeze_(value, visited) {
    const seen = visited || new WeakSet();

    if (
      value === null ||
      typeof value !== 'object' ||
      Object.isFrozen(value)
    ) {
      return value;
    }

    if (seen.has(value)) {
      return value;
    }

    seen.add(value);

    Object.keys(value).forEach(function (key) {
      JSKResponse.deepFreeze_(value[key], seen);
    });

    return Object.freeze(value);
  }
}