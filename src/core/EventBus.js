/**
 * JSK OS
 * Module: Core Event Bus
 * Version: 1.0.0
 *
 * Synchronous, in-process event dispatcher for loosely coupled modules.
 * Compatible with Google Apps Script V8.
 *
 * Event naming convention:
 *   <domain>.<action>
 * Examples:
 *   company.created
 *   people.updated
 *   notification.read
 */

var JSKOS = JSKOS || {};

/**
 * Creates an isolated Event Bus instance.
 *
 * @constructor
 * @param {Object=} options Optional configuration.
 * @param {Object=} options.logger Logger with warn()/error() methods.
 * @param {boolean=} options.rethrowListenerErrors Rethrow listener errors.
 */
function JSKEventBus(options) {
  var config = options || {};

  /** @private @type {Object<string, Array<Object>>} */
  this.listeners_ = Object.create(null);

  /** @private @type {number} */
  this.nextSubscriptionId_ = 1;

  /** @private @type {?Object} */
  this.logger_ = config.logger || null;

  /** @private @type {boolean} */
  this.rethrowListenerErrors_ =
    config.rethrowListenerErrors === true;
}

/**
 * Subscribes a handler to an event.
 *
 * Duplicate event/handler pairs are not registered twice. The existing
 * subscription token is returned when the same handler is subscribed again.
 *
 * Supported patterns:
 *   company.created  Exact event
 *   company.*        Namespace wildcard
 *   *                Every event
 *
 * @param {string} eventName Event name or wildcard pattern.
 * @param {Function} handler Event handler.
 * @param {Object=} options Subscription options.
 * @param {boolean=} options.once Execute at most once.
 * @param {*=} options.context Value used as `this` inside the handler.
 * @return {Object} Immutable subscription token.
 */
JSKEventBus.prototype.subscribe = function (eventName, handler, options) {
  var normalizedEventName = this.normalizeEventName_(eventName);

  if (typeof handler !== 'function') {
    throw new TypeError('Event handler must be a function.');
  }

  var config = options || {};
  var listeners = this.listeners_[normalizedEventName] || [];
  var context = Object.prototype.hasOwnProperty.call(config, 'context')
    ? config.context
    : null;

  for (var index = 0; index < listeners.length; index += 1) {
    if (
      listeners[index].handler === handler &&
      listeners[index].context === context
    ) {
      return listeners[index].token;
    }
  }

  var token = Object.freeze({
    id: this.nextSubscriptionId_,
    eventName: normalizedEventName
  });

  this.nextSubscriptionId_ += 1;

  listeners.push({
    token: token,
    handler: handler,
    context: context,
    once: config.once === true
  });

  this.listeners_[normalizedEventName] = listeners;

  return token;
};

/**
 * Subscribes a handler that is automatically removed after its first call.
 *
 * @param {string} eventName Event name or wildcard pattern.
 * @param {Function} handler Event handler.
 * @param {Object=} options Subscription options.
 * @return {Object} Immutable subscription token.
 */
JSKEventBus.prototype.once = function (eventName, handler, options) {
  var config = options || {};
  var onceOptions = {
    once: true,
    context: Object.prototype.hasOwnProperty.call(config, 'context')
      ? config.context
      : null
  };

  return this.subscribe(eventName, handler, onceOptions);
};

/**
 * Removes a subscription.
 *
 * Supported forms:
 *   unsubscribe(subscriptionToken)
 *   unsubscribe(eventName, handler)
 *   unsubscribe(eventName) // removes all listeners for that event
 *
 * @param {(Object|string)} tokenOrEventName Token or event name.
 * @param {Function=} handler Optional handler.
 * @return {boolean} True when at least one subscription was removed.
 */
JSKEventBus.prototype.unsubscribe = function (tokenOrEventName, handler) {
  if (
    tokenOrEventName &&
    typeof tokenOrEventName === 'object' &&
    typeof tokenOrEventName.id === 'number'
  ) {
    return this.unsubscribeByToken_(tokenOrEventName);
  }

  var eventName = this.normalizeEventName_(tokenOrEventName);
  var listeners = this.listeners_[eventName];

  if (!listeners || listeners.length === 0) {
    return false;
  }

  if (handler === undefined) {
    delete this.listeners_[eventName];
    return true;
  }

  if (typeof handler !== 'function') {
    throw new TypeError('Event handler must be a function.');
  }

  var originalLength = listeners.length;

  this.listeners_[eventName] = listeners.filter(function (listener) {
    return listener.handler !== handler;
  });

  if (this.listeners_[eventName].length === 0) {
    delete this.listeners_[eventName];
  }

  return this.listeners_[eventName]
    ? this.listeners_[eventName].length !== originalLength
    : originalLength > 0;
};

/**
 * Publishes an event synchronously.
 *
 * Listener failures are isolated so one failing handler does not prevent
 * remaining handlers from executing. Set rethrowListenerErrors=true when
 * constructing an isolated bus if tests or callers require fail-fast behavior.
 *
 * @param {string} eventName Event name.
 * @param {*=} payload Event payload.
 * @param {Object=} metadata Optional event metadata.
 * @return {Object} Immutable publication result.
 */
JSKEventBus.prototype.publish = function (eventName, payload, metadata) {
  var normalizedEventName = this.normalizePublishedEventName_(eventName);
  var envelope = Object.freeze({
    name: normalizedEventName,
    payload: payload === undefined ? null : payload,
    metadata: Object.freeze(this.copyObject_(metadata)),
    publishedAt: new Date().toISOString()
  });

  var matchingListeners = this.collectMatchingListeners_(
    normalizedEventName
  );
  var errors = [];
  var executed = 0;

  for (var index = 0; index < matchingListeners.length; index += 1) {
    var entry = matchingListeners[index];

    if (!this.hasSubscription_(entry.listener.token)) {
      continue;
    }

    if (entry.listener.once) {
      this.unsubscribe(entry.listener.token);
    }

    try {
      entry.listener.handler.call(
        entry.listener.context,
        envelope.payload,
        envelope
      );
      executed += 1;
    } catch (error) {
      errors.push(error);
      this.logListenerError_(error, envelope, entry.pattern);

      if (this.rethrowListenerErrors_) {
        throw error;
      }
    }
  }

  return Object.freeze({
    event: envelope,
    matched: matchingListeners.length,
    executed: executed,
    failed: errors.length,
    errors: Object.freeze(errors.slice())
  });
};

/**
 * Removes all listeners for one event or wildcard pattern.
 *
 * @param {string} eventName Event name or wildcard pattern.
 * @return {number} Number of removed subscriptions.
 */
JSKEventBus.prototype.clear = function (eventName) {
  var normalizedEventName = this.normalizeEventName_(eventName);
  var listeners = this.listeners_[normalizedEventName] || [];
  var count = listeners.length;

  delete this.listeners_[normalizedEventName];

  return count;
};

/**
 * Removes every subscription.
 *
 * @return {number} Number of removed subscriptions.
 */
JSKEventBus.prototype.clearAll = function () {
  var eventNames = Object.keys(this.listeners_);
  var count = 0;

  for (var index = 0; index < eventNames.length; index += 1) {
    count += this.listeners_[eventNames[index]].length;
  }

  this.listeners_ = Object.create(null);

  return count;
};

/**
 * Returns the current number of subscriptions.
 *
 * @param {string=} eventName Optional event or wildcard pattern.
 * @return {number} Subscription count.
 */
JSKEventBus.prototype.listenerCount = function (eventName) {
  if (eventName !== undefined) {
    var normalizedEventName = this.normalizeEventName_(eventName);
    return (this.listeners_[normalizedEventName] || []).length;
  }

  var eventNames = Object.keys(this.listeners_);
  var count = 0;

  for (var index = 0; index < eventNames.length; index += 1) {
    count += this.listeners_[eventNames[index]].length;
  }

  return count;
};

/** @private */
JSKEventBus.prototype.unsubscribeByToken_ = function (token) {
  var eventName = String(token.eventName || '').trim();
  var listeners = this.listeners_[eventName];

  if (!listeners || listeners.length === 0) {
    return false;
  }

  var originalLength = listeners.length;

  this.listeners_[eventName] = listeners.filter(function (listener) {
    return listener.token.id !== token.id;
  });

  if (this.listeners_[eventName].length === 0) {
    delete this.listeners_[eventName];
  }

  return originalLength !==
    (this.listeners_[eventName]
      ? this.listeners_[eventName].length
      : 0);
};

/** @private */
JSKEventBus.prototype.collectMatchingListeners_ = function (eventName) {
  var matches = [];
  var patterns = Object.keys(this.listeners_);

  for (var patternIndex = 0; patternIndex < patterns.length; patternIndex += 1) {
    var pattern = patterns[patternIndex];

    if (!this.eventMatchesPattern_(eventName, pattern)) {
      continue;
    }

    var listeners = this.listeners_[pattern].slice();

    for (var listenerIndex = 0; listenerIndex < listeners.length; listenerIndex += 1) {
      matches.push({
        pattern: pattern,
        listener: listeners[listenerIndex]
      });
    }
  }

  matches.sort(function (left, right) {
    return left.listener.token.id - right.listener.token.id;
  });

  return matches;
};

/** @private */
JSKEventBus.prototype.eventMatchesPattern_ = function (eventName, pattern) {
  if (pattern === '*' || pattern === eventName) {
    return true;
  }

  if (pattern.slice(-2) !== '.*') {
    return false;
  }

  var namespace = pattern.slice(0, -2);

  return eventName.indexOf(namespace + '.') === 0;
};

/** @private */
JSKEventBus.prototype.hasSubscription_ = function (token) {
  var listeners = this.listeners_[token.eventName] || [];

  return listeners.some(function (listener) {
    return listener.token.id === token.id;
  });
};

/** @private */
JSKEventBus.prototype.normalizeEventName_ = function (eventName) {
  var normalized = String(eventName || '').trim().toLowerCase();

  if (!normalized) {
    throw new Error('Event name is required.');
  }

  if (normalized === '*') {
    return normalized;
  }

  if (!/^[a-z0-9][a-z0-9_-]*(\.[a-z0-9][a-z0-9_-]*)*(\.\*)?$/.test(normalized)) {
    throw new Error(
      'Invalid event name. Use lowercase namespace.action format.'
    );
  }

  return normalized;
};

/** @private */
JSKEventBus.prototype.normalizePublishedEventName_ = function (eventName) {
  var normalized = this.normalizeEventName_(eventName);

  if (normalized === '*' || normalized.slice(-2) === '.*') {
    throw new Error('Wildcard event names cannot be published.');
  }

  return normalized;
};

/** @private */
JSKEventBus.prototype.copyObject_ = function (value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  var copy = {};
  var keys = Object.keys(value);

  for (var index = 0; index < keys.length; index += 1) {
    copy[keys[index]] = value[keys[index]];
  }

  return copy;
};

/** @private */
JSKEventBus.prototype.logListenerError_ = function (
  error,
  envelope,
  pattern
) {
  var context = {
    eventName: envelope.name,
    subscriptionPattern: pattern
  };

  if (this.logger_) {
    if (typeof this.logger_.exception === 'function') {
      this.logger_.exception(error, context);
      return;
    }

    if (typeof this.logger_.error === 'function') {
      this.logger_.error('Event listener failed.', {
        error: error,
        context: context
      });
      return;
    }
  }

  if (typeof console !== 'undefined' && console.error) {
    console.error(
      JSON.stringify({
        message: 'JSK OS EventBus listener failed.',
        eventName: envelope.name,
        subscriptionPattern: pattern,
        error: error && error.message ? error.message : String(error)
      })
    );
  }
};

/**
 * Shared application Event Bus singleton.
 *
 * Modules should normally use JSKOS.EventBus. Tests may create isolated
 * JSKEventBus instances to avoid shared state.
 */
JSKOS.EventBus = JSKOS.EventBus || new JSKEventBus();
