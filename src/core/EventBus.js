/**
 * JSK OS
 * Module: Core Event Bus
 * Version: 1.0.0
 *
 * Provides synchronous, in-process event publishing for loosely coupled
 * JSK OS modules. Google Apps Script V8 compatible.
 */

var JSKOS = JSKOS || {};

/**
 * Creates an isolated event bus instance.
 *
 * @constructor
 */
function JSKEventBus() {
  /** @private @type {Object<string, Array<Object>>} */
  this.listeners_ = Object.create(null);

  /** @private @type {number} */
  this.nextSubscriptionId_ = 1;
}

/**
 * Subscribes a handler to an event.
 *
 * Supported event names:
 * - Exact: company.created
 * - Namespace wildcard: company.*
 * - Global wildcard: *
 *
 * Duplicate registrations of the same handler for the same event are ignored.
 *
 * @param {string} eventName Event name.
 * @param {Function} handler Listener function.
 * @param {Object=} options Subscription options.
 * @return {Object} Immutable subscription token.
 */
JSKEventBus.prototype.subscribe = function (eventName, handler, options) {
  var normalizedEventName = this.normalizeEventName_(eventName);

  if (typeof handler !== 'function') {
    throw new TypeError('Event handler must be a function.');
  }

  var listeners = this.listeners_[normalizedEventName] || [];
  var existing = listeners.some(function (listener) {
    return listener.handler === handler;
  });

  if (existing) {
    return Object.freeze({
      eventName: normalizedEventName,
      id: null,
      duplicate: true
    });
  }

  var subscription = {
    id: this.nextSubscriptionId_++,
    eventName: normalizedEventName,
    handler: handler,
    once: Boolean(options && options.once)
  };

  listeners.push(subscription);
  this.listeners_[normalizedEventName] = listeners;

  return Object.freeze({
    eventName: normalizedEventName,
    id: subscription.id,
    duplicate: false
  });
};

/**
 * Subscribes a handler that is removed after its first invocation.
 *
 * @param {string} eventName Event name.
 * @param {Function} handler Listener function.
 * @return {Object} Immutable subscription token.
 */
JSKEventBus.prototype.once = function (eventName, handler) {
  return this.subscribe(eventName, handler, { once: true });
};

/**
 * Removes a subscription.
 *
 * The second argument may be a handler function or a subscription token.
 *
 * @param {string} eventName Event name.
 * @param {Function|Object} handlerOrToken Handler or token.
 * @return {boolean} True when at least one listener was removed.
 */
JSKEventBus.prototype.unsubscribe = function (eventName, handlerOrToken) {
  var normalizedEventName = this.normalizeEventName_(eventName);
  var listeners = this.listeners_[normalizedEventName];

  if (!listeners || listeners.length === 0) {
    return false;
  }

  var originalLength = listeners.length;
  var tokenId =
    handlerOrToken && typeof handlerOrToken === 'object'
      ? handlerOrToken.id
      : null;

  this.listeners_[normalizedEventName] = listeners.filter(function (listener) {
    if (typeof handlerOrToken === 'function') {
      return listener.handler !== handlerOrToken;
    }

    if (tokenId !== null && tokenId !== undefined) {
      return listener.id !== tokenId;
    }

    return true;
  });

  if (this.listeners_[normalizedEventName].length === 0) {
    delete this.listeners_[normalizedEventName];
  }

  return originalLength !== (this.listeners_[normalizedEventName] || []).length;
};

/**
 * Publishes an event synchronously.
 *
 * Listener failures are isolated. Remaining listeners continue to run.
 *
 * @param {string} eventName Event name.
 * @param {*=} payload Event payload.
 * @param {Object=} metadata Optional event metadata.
 * @return {Object} Immutable publish summary.
 */
JSKEventBus.prototype.publish = function (eventName, payload, metadata) {
  var normalizedEventName = this.normalizeEventName_(eventName);
  var envelope = Object.freeze({
    name: normalizedEventName,
    payload: payload === undefined ? null : payload,
    metadata: Object.freeze(this.copyObject_(metadata)),
    timestamp: new Date().toISOString()
  });

  var subscriptions = this.collectSubscriptions_(normalizedEventName);
  var delivered = 0;
  var failed = 0;
  var eventBus = this;

  subscriptions.forEach(function (subscription) {
    try {
      subscription.handler(envelope);
      delivered += 1;
    } catch (error) {
      failed += 1;
      eventBus.logListenerError_(normalizedEventName, subscription, error);
    } finally {
      if (subscription.once) {
        eventBus.unsubscribe(subscription.eventName, {
          id: subscription.id
        });
      }
    }
  });

  return Object.freeze({
    eventName: normalizedEventName,
    matched: subscriptions.length,
    delivered: delivered,
    failed: failed
  });
};

/**
 * Removes listeners for one event.
 *
 * @param {string} eventName Event name.
 * @return {number} Number of listeners removed.
 */
JSKEventBus.prototype.clear = function (eventName) {
  var normalizedEventName = this.normalizeEventName_(eventName);
  var count = this.listenerCount(normalizedEventName);

  delete this.listeners_[normalizedEventName];

  return count;
};

/**
 * Removes all listeners.
 *
 * @return {number} Number of listeners removed.
 */
JSKEventBus.prototype.clearAll = function () {
  var eventBus = this;
  var count = Object.keys(this.listeners_).reduce(function (total, eventName) {
    return total + eventBus.listeners_[eventName].length;
  }, 0);

  this.listeners_ = Object.create(null);

  return count;
};

/**
 * Returns the number of listeners registered for one event.
 *
 * @param {string} eventName Event name.
 * @return {number} Listener count.
 */
JSKEventBus.prototype.listenerCount = function (eventName) {
  var normalizedEventName = this.normalizeEventName_(eventName);
  var listeners = this.listeners_[normalizedEventName];

  return listeners ? listeners.length : 0;
};

/**
 * Returns all matching subscriptions in deterministic order.
 * Exact listeners run first, namespace wildcard listeners second,
 * and global wildcard listeners last.
 *
 * @private
 * @param {string} eventName Event name.
 * @return {Array<Object>} Matching subscriptions.
 */
JSKEventBus.prototype.collectSubscriptions_ = function (eventName) {
  var matches = [];
  var exact = this.listeners_[eventName] || [];
  var namespace = this.getNamespacePattern_(eventName);
  var namespaceListeners = namespace
    ? this.listeners_[namespace] || []
    : [];
  var globalListeners = this.listeners_['*'] || [];

  return matches.concat(exact, namespaceListeners, globalListeners).slice();
};

/**
 * Returns the namespace wildcard pattern for an event.
 *
 * @private
 * @param {string} eventName Event name.
 * @return {string|null} Namespace wildcard pattern.
 */
JSKEventBus.prototype.getNamespacePattern_ = function (eventName) {
  var separatorIndex = eventName.indexOf('.');

  if (separatorIndex <= 0) {
    return null;
  }

  return eventName.substring(0, separatorIndex) + '.*';
};

/**
 * Validates and normalizes an event name.
 *
 * @private
 * @param {*} eventName Event name.
 * @return {string} Normalized event name.
 */
JSKEventBus.prototype.normalizeEventName_ = function (eventName) {
  var normalized = String(eventName || '').trim().toLowerCase();

  if (!normalized) {
    throw new TypeError('Event name is required.');
  }

  if (normalized === '*') {
    return normalized;
  }

  if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)*(?:\.\*)?$/.test(normalized)) {
    throw new TypeError('Invalid event name: ' + normalized);
  }

  return normalized;
};

/**
 * Creates a shallow copy suitable for event metadata.
 *
 * @private
 * @param {Object=} value Source object.
 * @return {Object} Copied object.
 */
JSKEventBus.prototype.copyObject_ = function (value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.assign({}, value);
};

/**
 * Logs a listener failure without interrupting event delivery.
 *
 * @private
 * @param {string} eventName Event name.
 * @param {Object} subscription Subscription record.
 * @param {*} error Listener error.
 * @return {void}
 */
JSKEventBus.prototype.logListenerError_ = function (
  eventName,
  subscription,
  error
) {
  var normalizedError =
    error instanceof Error ? error : new Error(String(error));

  try {
    if (typeof JSKLogger === 'function') {
      new JSKLogger({ serviceName: 'EventBus' }).exception(normalizedError, {
        eventName: eventName,
        subscriptionId: subscription.id,
        subscriptionEventName: subscription.eventName
      });
      return;
    }
  } catch (loggingError) {
    // Fall through to console logging.
  }

  if (typeof console !== 'undefined' && console.error) {
    console.error(
      JSON.stringify({
        service: 'EventBus',
        message: 'Event listener failed.',
        eventName: eventName,
        subscriptionId: subscription.id,
        error: {
          name: normalizedError.name,
          message: normalizedError.message,
          stack: normalizedError.stack || ''
        }
      })
    );
  }
};

/**
 * Shared JSK OS event bus singleton.
 */
JSKOS.EventBus = JSKOS.EventBus || new JSKEventBus();
