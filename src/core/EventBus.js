/**
 * JSK OS
 * Module: Core Event Bus
 * Version: 1.0.0
 *
 * Provides synchronous, in-process event publishing for loosely coupled
 * JSK OS modules. The implementation is Google Apps Script V8 compatible.
 */

var JSKOS = JSKOS || {};

/**
 * Central event dispatcher for JSK OS.
 *
 * Listener failures are isolated so one faulty subscriber cannot stop the
 * remaining listeners. Events are delivered synchronously in subscription
 * order.
 */
class JSKEventBus {
  /**
   * Creates an event bus.
   *
   * @param {{logger: Object}=} options Optional dependencies.
   */
  constructor(options) {
    const normalizedOptions = options || {};

    /** @private @type {Object<string, Array<Object>>} */
    this.listeners_ = Object.create(null);

    /** @private @type {number} */
    this.nextSubscriptionId_ = 1;

    /** @private @type {?Object} */
    this.logger_ = normalizedOptions.logger || null;
  }

  /**
   * Subscribes a handler to an event.
   *
   * Duplicate subscriptions of the same handler to the same event are
   * ignored and return the existing subscription token.
   *
   * @param {string} eventName Event name such as "company.created".
   * @param {Function} handler Event handler.
   * @param {{once: boolean}=} options Subscription options.
   * @return {Object} Immutable subscription token.
   */
  subscribe(eventName, handler, options) {
    const normalizedEventName = this.normalizeEventName_(eventName);

    if (typeof handler !== 'function') {
      throw new TypeError('EventBus handler must be a function.');
    }

    const listeners = this.listeners_[normalizedEventName] || [];
    const existing = listeners.find(function (listener) {
      return listener.handler === handler;
    });

    if (existing) {
      return existing.token;
    }

    const subscriptionId = this.nextSubscriptionId_++;
    const token = Object.freeze({
      id: subscriptionId,
      eventName: normalizedEventName
    });

    listeners.push({
      id: subscriptionId,
      handler: handler,
      once: Boolean(options && options.once),
      token: token
    });

    this.listeners_[normalizedEventName] = listeners;

    return token;
  }

  /**
   * Subscribes a handler that is removed after its first invocation.
   *
   * @param {string} eventName Event name.
   * @param {Function} handler Event handler.
   * @return {Object} Immutable subscription token.
   */
  once(eventName, handler) {
    return this.subscribe(eventName, handler, { once: true });
  }

  /**
   * Removes a subscription.
   *
   * The second argument may be either the original handler or the token
   * returned by subscribe()/once(). Unknown subscriptions are safe.
   *
   * @param {string} eventName Event name.
   * @param {Function|Object} handlerOrToken Handler or subscription token.
   * @return {boolean} True when at least one listener was removed.
   */
  unsubscribe(eventName, handlerOrToken) {
    const normalizedEventName = this.normalizeEventName_(eventName);
    const listeners = this.listeners_[normalizedEventName];

    if (!listeners || listeners.length === 0) {
      return false;
    }

    const tokenId =
      handlerOrToken && typeof handlerOrToken === 'object'
        ? Number(handlerOrToken.id)
        : null;

    const remaining = listeners.filter(function (listener) {
      if (typeof handlerOrToken === 'function') {
        return listener.handler !== handlerOrToken;
      }

      return !tokenId || listener.id !== tokenId;
    });

    const removed = remaining.length !== listeners.length;

    if (remaining.length === 0) {
      delete this.listeners_[normalizedEventName];
    } else {
      this.listeners_[normalizedEventName] = remaining;
    }

    return removed;
  }

  /**
   * Publishes an event synchronously.
   *
   * @param {string} eventName Event name.
   * @param {*=} payload Event payload.
   * @param {{source: string, actor: string, requestId: string}=} metadata
   *     Optional event metadata.
   * @return {Object} Immutable publication summary.
   */
  publish(eventName, payload, metadata) {
    const normalizedEventName = this.normalizeEventName_(eventName);
    const listeners = (this.listeners_[normalizedEventName] || []).slice();
    const normalizedMetadata = this.createMetadata_(metadata);
    const event = Object.freeze({
      name: normalizedEventName,
      payload: payload === undefined ? null : payload,
      metadata: normalizedMetadata,
      publishedAt: new Date().toISOString()
    });

    let deliveredCount = 0;
    const errors = [];

    listeners.forEach(
      function (listener) {
        try {
          listener.handler(event);
          deliveredCount += 1;
        } catch (error) {
          const normalizedError = this.normalizeError_(error);
          errors.push(normalizedError);
          this.logListenerFailure_(normalizedEventName, listener.id, error);
        } finally {
          if (listener.once) {
            this.unsubscribe(normalizedEventName, listener.token);
          }
        }
      }.bind(this)
    );

    return Object.freeze({
      eventName: normalizedEventName,
      listenerCount: listeners.length,
      deliveredCount: deliveredCount,
      failedCount: errors.length,
      errors: Object.freeze(errors)
    });
  }

  /**
   * Removes every listener for one event.
   *
   * @param {string} eventName Event name.
   * @return {number} Number of listeners removed.
   */
  clear(eventName) {
    const normalizedEventName = this.normalizeEventName_(eventName);
    const listeners = this.listeners_[normalizedEventName] || [];
    const removedCount = listeners.length;

    delete this.listeners_[normalizedEventName];

    return removedCount;
  }

  /**
   * Removes all listeners from the event bus.
   *
   * @return {number} Total number of listeners removed.
   */
  clearAll() {
    const eventNames = Object.keys(this.listeners_);
    const removedCount = eventNames.reduce(
      function (total, eventName) {
        return total + this.listeners_[eventName].length;
      }.bind(this),
      0
    );

    this.listeners_ = Object.create(null);

    return removedCount;
  }

  /**
   * Returns the listener count for an event.
   *
   * @param {string} eventName Event name.
   * @return {number} Listener count.
   */
  listenerCount(eventName) {
    const normalizedEventName = this.normalizeEventName_(eventName);
    return (this.listeners_[normalizedEventName] || []).length;
  }

  /**
   * Returns all event names that currently have subscribers.
   *
   * @return {string[]} Sorted event names.
   */
  eventNames() {
    return Object.keys(this.listeners_).sort();
  }

  /**
   * Validates and normalizes an event name.
   *
   * @private
   * @param {*} eventName Event name.
   * @return {string} Normalized event name.
   */
  normalizeEventName_(eventName) {
    if (typeof eventName !== 'string') {
      throw new TypeError('EventBus event name must be a string.');
    }

    const normalized = eventName.trim().toLowerCase();

    if (!normalized) {
      throw new TypeError('EventBus event name cannot be empty.');
    }

    if (!/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/.test(normalized)) {
      throw new TypeError(
        'EventBus event name contains unsupported characters: ' +
          normalized
      );
    }

    return normalized;
  }

  /**
   * Creates immutable event metadata.
   *
   * @private
   * @param {Object=} metadata Raw metadata.
   * @return {Object} Immutable metadata.
   */
  createMetadata_(metadata) {
    const source = metadata || {};

    return Object.freeze({
      source: String(source.source || '').trim(),
      actor: String(source.actor || '').trim(),
      requestId: String(source.requestId || '').trim()
    });
  }

  /**
   * Converts an exception into a safe serializable object.
   *
   * @private
   * @param {*} error Error value.
   * @return {Object} Normalized error.
   */
  normalizeError_(error) {
    return Object.freeze({
      name:
        error && error.name
          ? String(error.name)
          : 'Error',
      message:
        error && error.message
          ? String(error.message)
          : String(error || 'Unknown listener error')
    });
  }

  /**
   * Logs listener errors without allowing logger failures to break publish().
   *
   * @private
   * @param {string} eventName Event name.
   * @param {number} listenerId Listener identifier.
   * @param {*} error Listener error.
   * @return {void}
   */
  logListenerFailure_(eventName, listenerId, error) {
    const context = {
      eventName: eventName,
      listenerId: listenerId
    };

    try {
      if (
        this.logger_ &&
        typeof this.logger_.exception === 'function'
      ) {
        this.logger_.exception(error, context);
        return;
      }

      console.error(
        JSON.stringify({
          level: 'ERROR',
          service: 'EventBus',
          message: 'Event listener failed.',
          context: context,
          error: this.normalizeError_(error),
          timestamp: new Date().toISOString()
        })
      );
    } catch (loggingError) {
      // Logging must never interrupt event delivery.
    }
  }
}

/**
 * Shared singleton used by JSK OS modules.
 *
 * Tests and isolated services may instantiate JSKEventBus directly.
 */
JSKOS.EventBus = JSKOS.EventBus || new JSKEventBus();
