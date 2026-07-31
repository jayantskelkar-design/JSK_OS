/**
 * JSK OS - Core Event Bus
 *
 * Provides loosely coupled, in-process communication between modules.
 * Supports exact events, namespace wildcards (for example company.*),
 * global wildcard listeners (*), one-time listeners and safe error isolation.
 *
 * Google Apps Script V8 compatible.
 */

var JSKOS = JSKOS || {};

/**
 * In-process event dispatcher.
 */
class JSKEventBus {
  /**
   * Creates an event bus.
   *
   * @param {{
   *   onListenerError: (Function|undefined)
   * }=} options Optional configuration.
   */
  constructor(options) {
    const config = options || {};

    /** @private @type {Object<string, Function[]>} */
    this.listeners_ = Object.create(null);

    /** @private @type {Function} */
    this.onListenerError_ =
      typeof config.onListenerError === 'function'
        ? config.onListenerError
        : this.defaultErrorHandler_.bind(this);
  }

  /**
   * Subscribes a listener to an event.
   *
   * Duplicate subscriptions for the same event and handler are ignored.
   *
   * @param {string} eventName Event name.
   * @param {Function} handler Listener function.
   * @return {Function} Unsubscribe function.
   */
  subscribe(eventName, handler) {
    const normalizedEventName = this.normalizeEventName_(eventName);
    this.assertHandler_(handler);

    const listeners =
      this.listeners_[normalizedEventName] ||
      (this.listeners_[normalizedEventName] = []);

    if (listeners.indexOf(handler) === -1) {
      listeners.push(handler);
    }

    return function () {
      return this.unsubscribe(normalizedEventName, handler);
    }.bind(this);
  }

  /**
   * Subscribes a listener that is removed after its first invocation.
   *
   * @param {string} eventName Event name.
   * @param {Function} handler Listener function.
   * @return {Function} Unsubscribe function.
   */
  once(eventName, handler) {
    const normalizedEventName = this.normalizeEventName_(eventName);
    this.assertHandler_(handler);

    const eventBus = this;

    function onceHandler(payload, event) {
      eventBus.unsubscribe(normalizedEventName, onceHandler);
      return handler(payload, event);
    }

    return this.subscribe(normalizedEventName, onceHandler);
  }

  /**
   * Removes a listener from an event.
   *
   * @param {string} eventName Event name.
   * @param {Function} handler Listener function.
   * @return {boolean} True when a listener was removed.
   */
  unsubscribe(eventName, handler) {
    const normalizedEventName = this.normalizeEventName_(eventName);
    this.assertHandler_(handler);

    const listeners = this.listeners_[normalizedEventName];

    if (!listeners || listeners.length === 0) {
      return false;
    }

    const handlerIndex = listeners.indexOf(handler);

    if (handlerIndex === -1) {
      return false;
    }

    listeners.splice(handlerIndex, 1);

    if (listeners.length === 0) {
      delete this.listeners_[normalizedEventName];
    }

    return true;
  }

  /**
   * Publishes an event.
   *
   * Listener failures are isolated so one failing listener does not prevent
   * remaining listeners from running.
   *
   * @param {string} eventName Event name.
   * @param {*=} payload Event payload.
   * @return {{eventName: string, delivered: number, failed: number}}
   *   Delivery summary.
   */
  publish(eventName, payload) {
    const normalizedEventName = this.normalizeEventName_(eventName);
    const event = Object.freeze({
      name: normalizedEventName,
      timestamp: new Date().toISOString()
    });

    const handlers = this.collectHandlers_(normalizedEventName);
    let delivered = 0;
    let failed = 0;

    handlers.forEach(function (handler) {
      try {
        handler(payload, event);
        delivered += 1;
      } catch (error) {
        failed += 1;
        this.reportListenerError_(error, normalizedEventName, payload);
      }
    }, this);

    return Object.freeze({
      eventName: normalizedEventName,
      delivered: delivered,
      failed: failed
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
    const listeners = this.listeners_[normalizedEventName];
    const removedCount = listeners ? listeners.length : 0;

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
    let removedCount = 0;

    eventNames.forEach(function (eventName) {
      removedCount += this.listeners_[eventName].length;
    }, this);

    this.listeners_ = Object.create(null);

    return removedCount;
  }

  /**
   * Returns the listener count for one event or the complete bus.
   *
   * @param {string=} eventName Optional event name.
   * @return {number} Listener count.
   */
  listenerCount(eventName) {
    if (eventName === undefined || eventName === null) {
      return Object.keys(this.listeners_).reduce(function (total, name) {
        return total + this.listeners_[name].length;
      }.bind(this), 0);
    }

    const normalizedEventName = this.normalizeEventName_(eventName);
    const listeners = this.listeners_[normalizedEventName];

    return listeners ? listeners.length : 0;
  }

  /**
   * Collects exact, namespace wildcard and global wildcard listeners.
   *
   * Listener order is deterministic: exact, namespace wildcard, global.
   *
   * @private
   * @param {string} eventName Event name.
   * @return {Function[]} Listener snapshot.
   */
  collectHandlers_(eventName) {
    const eventNames = [eventName];
    const separatorIndex = eventName.indexOf('.');

    if (separatorIndex > 0) {
      eventNames.push(eventName.substring(0, separatorIndex) + '.*');
    }

    eventNames.push('*');

    return eventNames.reduce(function (handlers, name) {
      const listeners = this.listeners_[name];

      if (listeners && listeners.length > 0) {
        return handlers.concat(listeners.slice());
      }

      return handlers;
    }.bind(this), []);
  }

  /**
   * Normalizes and validates an event name.
   *
   * @private
   * @param {*} eventName Event name.
   * @return {string} Normalized event name.
   */
  normalizeEventName_(eventName) {
    if (typeof eventName !== 'string') {
      throw new TypeError('Event name must be a string.');
    }

    const normalizedEventName = eventName.trim();

    if (!normalizedEventName) {
      throw new TypeError('Event name must not be empty.');
    }

    return normalizedEventName;
  }

  /**
   * Validates a listener function.
   *
   * @private
   * @param {*} handler Listener candidate.
   * @return {void}
   */
  assertHandler_(handler) {
    if (typeof handler !== 'function') {
      throw new TypeError('Event handler must be a function.');
    }
  }

  /**
   * Reports a listener failure without throwing into publish().
   *
   * @private
   * @param {*} error Listener error.
   * @param {string} eventName Event name.
   * @param {*} payload Event payload.
   * @return {void}
   */
  reportListenerError_(error, eventName, payload) {
    try {
      this.onListenerError_(error, {
        eventName: eventName,
        payload: payload
      });
    } catch (ignoredError) {
      // Error reporting must never break event delivery.
    }
  }

  /**
   * Default listener-error reporter.
   *
   * @private
   * @param {*} error Listener error.
   * @param {Object} context Error context.
   * @return {void}
   */
  defaultErrorHandler_(error, context) {
    const errorDetails = {
      success: false,
      service: 'EventBus',
      message: 'Event listener failed.',
      eventName: context.eventName,
      error: {
        name: error && error.name ? error.name : 'Error',
        message:
          error && error.message
            ? error.message
            : String(error)
      },
      timestamp: new Date().toISOString()
    };

    if (typeof console !== 'undefined' && console.error) {
      console.error(JSON.stringify(errorDetails));
    }
  }
}

/**
 * Shared JSK OS event bus singleton.
 *
 * @type {JSKEventBus}
 */
JSKOS.EventBus = JSKOS.EventBus || new JSKEventBus();
