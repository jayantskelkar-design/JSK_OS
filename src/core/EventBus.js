/**
 * JSK OS - Core Event Bus
 *
 * Provides synchronous, in-process event communication for loosely coupled
 * modules. Supports exact event names, namespace wildcards (for example
 * "company.*"), and the global wildcard "*".
 *
 * Google Apps Script V8 compatible.
 */

var JSKOS = JSKOS || {};

/**
 * Core event bus implementation.
 */
class JSKEventBus {
  /**
   * Creates an EventBus instance.
   *
   * @param {{logger: (Object|undefined)}=} options EventBus options.
   */
  constructor(options) {
    var normalizedOptions = options || {};

    /** @private @type {Object<string, Array<Object>>} */
    this.listeners_ = Object.create(null);

    /** @private @type {Object|null} */
    this.logger_ = normalizedOptions.logger || this.createDefaultLogger_();

    /** @private @type {number} */
    this.nextSubscriptionId_ = 1;
  }

  /**
   * Subscribes a handler to an event.
   *
   * @param {string} eventName Exact event, namespace wildcard, or "*".
   * @param {Function} handler Event handler.
   * @return {Function} Unsubscribe function.
   */
  subscribe(eventName, handler) {
    var normalizedEventName = this.normalizeEventName_(eventName);
    this.assertHandler_(handler);

    var listeners = this.listeners_[normalizedEventName] || [];
    var existing = listeners.some(function (listener) {
      return listener.handler === handler && listener.once !== true;
    });

    if (!existing) {
      listeners.push({
        id: this.nextSubscriptionId_++,
        handler: handler,
        once: false
      });
      this.listeners_[normalizedEventName] = listeners;
    }

    return function () {
      return this.unsubscribe(normalizedEventName, handler);
    }.bind(this);
  }

  /**
   * Subscribes a handler that is removed after its first execution.
   *
   * @param {string} eventName Exact event, namespace wildcard, or "*".
   * @param {Function} handler Event handler.
   * @return {Function} Unsubscribe function.
   */
  once(eventName, handler) {
    var normalizedEventName = this.normalizeEventName_(eventName);
    this.assertHandler_(handler);

    var listeners = this.listeners_[normalizedEventName] || [];
    listeners.push({
      id: this.nextSubscriptionId_++,
      handler: handler,
      once: true
    });
    this.listeners_[normalizedEventName] = listeners;

    return function () {
      return this.unsubscribe(normalizedEventName, handler);
    }.bind(this);
  }

  /**
   * Removes a handler from an event.
   *
   * @param {string} eventName Event name.
   * @param {Function} handler Previously subscribed handler.
   * @return {boolean} True when at least one subscription was removed.
   */
  unsubscribe(eventName, handler) {
    var normalizedEventName = this.normalizeEventName_(eventName);
    this.assertHandler_(handler);

    var listeners = this.listeners_[normalizedEventName];

    if (!listeners || listeners.length === 0) {
      return false;
    }

    var remaining = listeners.filter(function (listener) {
      return listener.handler !== handler;
    });
    var removed = remaining.length !== listeners.length;

    if (remaining.length > 0) {
      this.listeners_[normalizedEventName] = remaining;
    } else {
      delete this.listeners_[normalizedEventName];
    }

    return removed;
  }

  /**
   * Publishes an event synchronously.
   *
   * Listener failures are isolated so that remaining listeners still run.
   *
   * @param {string} eventName Exact event name to publish.
   * @param {*=} payload Event payload.
   * @param {Object=} metadata Optional event metadata.
   * @return {{eventName:string, delivered:number, failed:number}}
   *   Delivery summary.
   */
  publish(eventName, payload, metadata) {
    var normalizedEventName = this.normalizePublishedEventName_(eventName);
    var envelope = Object.freeze({
      eventName: normalizedEventName,
      payload: payload === undefined ? null : payload,
      metadata: metadata || {},
      publishedAt: new Date().toISOString()
    });

    var matchingSubscriptions = this.collectMatchingSubscriptions_(
      normalizedEventName
    );
    var delivered = 0;
    var failed = 0;

    matchingSubscriptions.forEach(
      function (subscription) {
        try {
          subscription.listener.handler(envelope);
          delivered += 1;
        } catch (error) {
          failed += 1;
          this.logListenerFailure_(normalizedEventName, error);
        } finally {
          if (subscription.listener.once === true) {
            this.removeSubscriptionById_(
              subscription.subscriptionEventName,
              subscription.listener.id
            );
          }
        }
      }.bind(this)
    );

    return {
      eventName: normalizedEventName,
      delivered: delivered,
      failed: failed
    };
  }

  /**
   * Removes all listeners for one event pattern.
   *
   * @param {string} eventName Event name or wildcard pattern.
   * @return {number} Number of removed listeners.
   */
  clear(eventName) {
    var normalizedEventName = this.normalizeEventName_(eventName);
    var listeners = this.listeners_[normalizedEventName] || [];
    var removedCount = listeners.length;

    delete this.listeners_[normalizedEventName];

    return removedCount;
  }

  /**
   * Removes every listener from this EventBus instance.
   *
   * @return {number} Number of removed listeners.
   */
  clearAll() {
    var removedCount = Object.keys(this.listeners_).reduce(
      function (count, eventName) {
        return count + this.listeners_[eventName].length;
      }.bind(this),
      0
    );

    this.listeners_ = Object.create(null);

    return removedCount;
  }

  /**
   * Returns the listener count for one event pattern, or for all patterns.
   *
   * @param {string=} eventName Optional event name.
   * @return {number} Listener count.
   */
  listenerCount(eventName) {
    if (eventName === undefined || eventName === null) {
      return Object.keys(this.listeners_).reduce(
        function (count, key) {
          return count + this.listeners_[key].length;
        }.bind(this),
        0
      );
    }

    var normalizedEventName = this.normalizeEventName_(eventName);
    return (this.listeners_[normalizedEventName] || []).length;
  }

  /**
   * Collects exact, namespace wildcard, and global wildcard subscriptions.
   * Registration order is preserved across all matching listener groups.
   *
   * @private
   * @param {string} eventName Published event name.
   * @return {Array<Object>} Matching subscriptions.
   */
  collectMatchingSubscriptions_(eventName) {
    var matchingPatterns = [eventName, '*'];
    var separatorIndex = eventName.lastIndexOf('.');

    while (separatorIndex > 0) {
      matchingPatterns.push(eventName.substring(0, separatorIndex) + '.*');
      separatorIndex = eventName.lastIndexOf('.', separatorIndex - 1);
    }

    var seenPatterns = Object.create(null);
    var subscriptions = [];

    matchingPatterns.forEach(
      function (pattern) {
        if (seenPatterns[pattern]) {
          return;
        }

        seenPatterns[pattern] = true;

        (this.listeners_[pattern] || []).forEach(function (listener) {
          subscriptions.push({
            subscriptionEventName: pattern,
            listener: listener
          });
        });
      }.bind(this)
    );

    subscriptions.sort(function (left, right) {
      return left.listener.id - right.listener.id;
    });

    return subscriptions;
  }

  /**
   * Removes a single subscription by its internal ID.
   *
   * @private
   * @param {string} eventName Subscription event pattern.
   * @param {number} subscriptionId Subscription ID.
   * @return {void}
   */
  removeSubscriptionById_(eventName, subscriptionId) {
    var listeners = this.listeners_[eventName] || [];
    var remaining = listeners.filter(function (listener) {
      return listener.id !== subscriptionId;
    });

    if (remaining.length > 0) {
      this.listeners_[eventName] = remaining;
    } else {
      delete this.listeners_[eventName];
    }
  }

  /**
   * Validates and normalizes a subscription event name.
   *
   * @private
   * @param {*} eventName Event name.
   * @return {string} Normalized event name.
   */
  normalizeEventName_(eventName) {
    if (typeof eventName !== 'string' || eventName.trim() === '') {
      throw new TypeError('Event name must be a non-empty string.');
    }

    var normalized = eventName.trim().toLowerCase();

    if (normalized === '*') {
      return normalized;
    }

    if (!/^[a-z0-9_-]+(?:\.[a-z0-9_-]+)*(?:\.\*)?$/.test(normalized)) {
      throw new RangeError(
        'Invalid event name. Use names such as "company.created", "company.*", or "*".'
      );
    }

    return normalized;
  }

  /**
   * Validates a published event name. Wildcards cannot be published.
   *
   * @private
   * @param {*} eventName Event name.
   * @return {string} Normalized event name.
   */
  normalizePublishedEventName_(eventName) {
    var normalized = this.normalizeEventName_(eventName);

    if (normalized === '*' || normalized.slice(-2) === '.*') {
      throw new RangeError('Wildcard event names cannot be published.');
    }

    return normalized;
  }

  /**
   * Validates an event handler.
   *
   * @private
   * @param {*} handler Handler value.
   * @return {void}
   */
  assertHandler_(handler) {
    if (typeof handler !== 'function') {
      throw new TypeError('Event handler must be a function.');
    }
  }

  /**
   * Logs a listener failure without allowing logging to break publication.
   *
   * @private
   * @param {string} eventName Published event name.
   * @param {*} error Listener error.
   * @return {void}
   */
  logListenerFailure_(eventName, error) {
    try {
      if (this.logger_ && typeof this.logger_.exception === 'function') {
        this.logger_.exception(
          error,
          { eventName: eventName },
          'EventBus listener failed.'
        );
        return;
      }

      console.error(
        JSON.stringify({
          level: 'ERROR',
          service: 'EventBus',
          message: 'EventBus listener failed.',
          eventName: eventName,
          error: error && error.message ? error.message : String(error)
        })
      );
    } catch (loggingError) {
      // Event publishing must never fail because error logging failed.
    }
  }

  /**
   * Creates a logger consistent with the existing JSK OS logging framework.
   *
   * @private
   * @return {Object|null} Logger instance when available.
   */
  createDefaultLogger_() {
    try {
      if (
        typeof JSKLoggerFactory !== 'undefined' &&
        typeof JSKLoggerFactory.createConsoleLogger === 'function'
      ) {
        return JSKLoggerFactory.createConsoleLogger('EventBus', {
          minimumLevel:
            typeof JSK_LOG_LEVEL !== 'undefined'
              ? JSK_LOG_LEVEL.INFO
              : 'INFO'
        });
      }
    } catch (error) {
      return null;
    }

    return null;
  }
}

/**
 * Shared application EventBus singleton.
 */
JSKOS.EventBus = new JSKEventBus();
