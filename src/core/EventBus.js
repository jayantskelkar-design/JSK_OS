/**
 * JSK OS
 * Module: Core Event Bus
 * Version: 1.0.0
 *
 * In-process publish/subscribe infrastructure for loosely coupled modules.
 * Google Apps Script V8 compatible.
 *
 * Notes:
 * - Listeners exist only for the current Apps Script execution.
 * - Event names use lower-case dot notation, for example: company.created.
 * - Wildcards are supported as "company.*" and "*".
 */

var JSKOS = JSKOS || {};

/**
 * Error raised when EventBus input is invalid.
 */
class JSKEventBusError extends Error {
  /**
   * @param {string} message Error message.
   * @param {string=} code Stable error code.
   */
  constructor(message, code) {
    super(message);
    this.name = 'JSKEventBusError';
    this.code = code || 'EVENT_BUS_ERROR';
  }
}

/**
 * Synchronous, execution-scoped event bus.
 */
class JSKEventBus {
  /**
   * @param {Object=} options EventBus options.
   * @param {Object=} options.logger Logger exposing warn/error methods.
   */
  constructor(options) {
    var normalizedOptions = options || {};

    this.listeners_ = new Map();
    this.nextSubscriptionId_ = 1;
    this.logger_ = normalizedOptions.logger || null;
  }

  /**
   * Subscribes a handler to an event.
   *
   * Duplicate subscriptions using the same event and handler are ignored and
   * return the existing unsubscribe function.
   *
   * @param {string} eventName Exact event, namespace wildcard, or "*".
   * @param {Function} handler Listener function.
   * @return {Function} Unsubscribe function.
   */
  subscribe(eventName, handler) {
    var normalizedName = this.normalizeEventName_(eventName);
    this.assertHandler_(handler);

    var subscriptions = this.listeners_.get(normalizedName) || [];
    var existing = subscriptions.find(function (subscription) {
      return subscription.handler === handler;
    });

    if (existing) {
      return existing.unsubscribe;
    }

    var subscription = this.createSubscription_(
      normalizedName,
      handler,
      false
    );

    subscriptions.push(subscription);
    this.listeners_.set(normalizedName, subscriptions);

    return subscription.unsubscribe;
  }

  /**
   * Subscribes a handler that is removed before its first execution.
   *
   * @param {string} eventName Event name.
   * @param {Function} handler Listener function.
   * @return {Function} Unsubscribe function.
   */
  once(eventName, handler) {
    var normalizedName = this.normalizeEventName_(eventName);
    this.assertHandler_(handler);

    var subscriptions = this.listeners_.get(normalizedName) || [];
    var subscription = this.createSubscription_(
      normalizedName,
      handler,
      true
    );

    subscriptions.push(subscription);
    this.listeners_.set(normalizedName, subscriptions);

    return subscription.unsubscribe;
  }

  /**
   * Removes matching subscriptions.
   *
   * @param {string} eventName Event name.
   * @param {Function=} handler Specific handler. Omit to clear the event.
   * @return {number} Number of subscriptions removed.
   */
  unsubscribe(eventName, handler) {
    var normalizedName = this.normalizeEventName_(eventName);

    if (handler === undefined) {
      return this.clear(normalizedName);
    }

    this.assertHandler_(handler);

    var subscriptions = this.listeners_.get(normalizedName) || [];
    var remaining = subscriptions.filter(function (subscription) {
      return subscription.handler !== handler;
    });
    var removedCount = subscriptions.length - remaining.length;

    if (remaining.length > 0) {
      this.listeners_.set(normalizedName, remaining);
    } else {
      this.listeners_.delete(normalizedName);
    }

    return removedCount;
  }

  /**
   * Publishes an event synchronously.
   *
   * Listener failures are isolated. Remaining listeners continue to execute.
   *
   * @param {string} eventName Exact event name. Wildcards cannot be published.
   * @param {*=} payload Event payload.
   * @param {Object=} metadata Optional event metadata.
   * @return {Object} Immutable delivery summary.
   */
  publish(eventName, payload, metadata) {
    var normalizedName = this.normalizePublishedEventName_(eventName);
    var event = Object.freeze({
      name: normalizedName,
      payload: payload === undefined ? null : payload,
      metadata: Object.freeze(
        Object.assign({}, metadata || {})
      ),
      publishedAt: new Date().toISOString()
    });

    var subscriptions = this.collectSubscriptions_(normalizedName);
    var delivered = 0;
    var failed = 0;

    subscriptions.forEach(
      function (subscription) {
        if (!this.isSubscriptionActive_(subscription)) {
          return;
        }

        if (subscription.once) {
          subscription.unsubscribe();
        }

        try {
          subscription.handler(event);
          delivered += 1;
        } catch (error) {
          failed += 1;
          this.logListenerFailure_(normalizedName, subscription, error);
        }
      }.bind(this)
    );

    return Object.freeze({
      eventName: normalizedName,
      matched: subscriptions.length,
      delivered: delivered,
      failed: failed
    });
  }

  /**
   * Removes every listener for one event or wildcard.
   *
   * @param {string} eventName Event name.
   * @return {number} Number of listeners removed.
   */
  clear(eventName) {
    var normalizedName = this.normalizeEventName_(eventName);
    var subscriptions = this.listeners_.get(normalizedName) || [];

    this.listeners_.delete(normalizedName);
    return subscriptions.length;
  }

  /**
   * Removes every subscription from the bus.
   *
   * @return {number} Number of listeners removed.
   */
  clearAll() {
    var removedCount = 0;

    this.listeners_.forEach(function (subscriptions) {
      removedCount += subscriptions.length;
    });

    this.listeners_.clear();
    return removedCount;
  }

  /**
   * Returns listener count for one event, or all events when omitted.
   *
   * @param {string=} eventName Optional event name.
   * @return {number} Listener count.
   */
  listenerCount(eventName) {
    if (eventName === undefined) {
      var total = 0;

      this.listeners_.forEach(function (subscriptions) {
        total += subscriptions.length;
      });

      return total;
    }

    var normalizedName = this.normalizeEventName_(eventName);
    return (this.listeners_.get(normalizedName) || []).length;
  }

  /**
   * Creates an internal subscription.
   *
   * @private
   */
  createSubscription_(eventName, handler, once) {
    var bus = this;
    var subscription = {
      id: this.nextSubscriptionId_++,
      eventName: eventName,
      handler: handler,
      once: once,
      active: true,
      unsubscribe: null
    };

    subscription.unsubscribe = function () {
      if (!subscription.active) {
        return false;
      }

      subscription.active = false;
      bus.removeSubscriptionById_(eventName, subscription.id);
      return true;
    };

    return subscription;
  }

  /** @private */
  removeSubscriptionById_(eventName, subscriptionId) {
    var subscriptions = this.listeners_.get(eventName) || [];
    var remaining = subscriptions.filter(function (subscription) {
      return subscription.id !== subscriptionId;
    });

    if (remaining.length > 0) {
      this.listeners_.set(eventName, remaining);
    } else {
      this.listeners_.delete(eventName);
    }
  }

  /** @private */
  collectSubscriptions_(eventName) {
    var namespace = eventName.split('.')[0];
    var keys = [eventName, namespace + '.*', '*'];
    var collected = [];
    var seenIds = new Set();

    keys.forEach(
      function (key) {
        (this.listeners_.get(key) || []).forEach(function (subscription) {
          if (!seenIds.has(subscription.id)) {
            seenIds.add(subscription.id);
            collected.push(subscription);
          }
        });
      }.bind(this)
    );

    return collected;
  }

  /** @private */
  isSubscriptionActive_(subscription) {
    return Boolean(subscription && subscription.active);
  }

  /** @private */
  normalizeEventName_(eventName) {
    var normalizedName = String(eventName || '').trim().toLowerCase();

    if (!normalizedName) {
      throw new JSKEventBusError(
        'Event name is required.',
        'EVENT_NAME_REQUIRED'
      );
    }

    if (normalizedName === '*') {
      return normalizedName;
    }

    if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)*(?:\.\*)?$/.test(normalizedName)) {
      throw new JSKEventBusError(
        'Invalid event name: ' + normalizedName,
        'INVALID_EVENT_NAME'
      );
    }

    return normalizedName;
  }

  /** @private */
  normalizePublishedEventName_(eventName) {
    var normalizedName = this.normalizeEventName_(eventName);

    if (normalizedName === '*' || /\.\*$/.test(normalizedName)) {
      throw new JSKEventBusError(
        'Wildcard event names cannot be published.',
        'WILDCARD_PUBLISH_NOT_ALLOWED'
      );
    }

    return normalizedName;
  }

  /** @private */
  assertHandler_(handler) {
    if (typeof handler !== 'function') {
      throw new JSKEventBusError(
        'Event handler must be a function.',
        'INVALID_EVENT_HANDLER'
      );
    }
  }

  /** @private */
  logListenerFailure_(eventName, subscription, error) {
    var context = {
      eventName: eventName,
      subscriptionId: subscription.id,
      errorName: error && error.name ? error.name : 'Error',
      errorMessage:
        error && error.message
          ? error.message
          : String(error || 'Unknown listener error')
    };

    if (this.logger_ && typeof this.logger_.exception === 'function') {
      this.logger_.exception(error, context);
      return;
    }

    if (this.logger_ && typeof this.logger_.error === 'function') {
      this.logger_.error('Event listener failed.', context);
      return;
    }

    console.error(
      JSON.stringify({
        level: 'ERROR',
        service: 'EventBus',
        message: 'Event listener failed.',
        context: context,
        timestamp: new Date().toISOString()
      })
    );
  }
}

/**
 * Shared EventBus singleton for the current Apps Script execution.
 */
JSKOS.EventBus = JSKOS.EventBus || new JSKEventBus({
  logger:
    typeof JSKLoggerFactory !== 'undefined'
      ? JSKLoggerFactory.createConsoleLogger('EventBus')
      : null
});
