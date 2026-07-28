/**
 * JSK OS
 * Module: Core Event Bus
 * Version: 1.0.0
 *
 * Lightweight in-process event dispatcher for decoupled module communication.
 * Google Apps Script V8 compatible.
 */

var JSKOS = JSKOS || {};

/**
 * Event bus for publishing and subscribing to application events.
 */
class JSKEventBus {
  /**
   * Creates an event bus.
   *
   * @param {{logger: (Object|undefined)}=} options Optional dependencies.
   */
  constructor(options) {
    var normalizedOptions = options || {};

    /** @private @type {Object<string, Array<Object>>} */
    this.listeners_ = Object.create(null);

    /** @private @type {Object|null} */
    this.logger_ = normalizedOptions.logger || null;
  }

  /**
   * Subscribes a handler to an event.
   *
   * Duplicate subscriptions for the same event and handler are ignored.
   *
   * @param {string} eventName Event name.
   * @param {Function} handler Listener function.
   * @return {Function} Unsubscribe function.
   */
  subscribe(eventName, handler) {
    var normalizedEventName = this.normalizeEventName_(eventName);

    if (typeof handler !== 'function') {
      throw new TypeError('Event handler must be a function.');
    }

    var listeners = this.listeners_[normalizedEventName] || [];
    var alreadySubscribed = listeners.some(function (listener) {
      return listener.handler === handler;
    });

    if (!alreadySubscribed) {
      listeners.push({
        handler: handler,
        once: false
      });

      this.listeners_[normalizedEventName] = listeners;
    }

    var eventBus = this;
    var unsubscribed = false;

    return function () {
      if (unsubscribed) {
        return false;
      }

      unsubscribed = true;
      return eventBus.unsubscribe(normalizedEventName, handler);
    };
  }

  /**
   * Subscribes a handler that executes at most once.
   *
   * @param {string} eventName Event name.
   * @param {Function} handler Listener function.
   * @return {Function} Unsubscribe function.
   */
  once(eventName, handler) {
    var normalizedEventName = this.normalizeEventName_(eventName);

    if (typeof handler !== 'function') {
      throw new TypeError('Event handler must be a function.');
    }

    var listeners = this.listeners_[normalizedEventName] || [];
    var alreadySubscribed = listeners.some(function (listener) {
      return listener.handler === handler;
    });

    if (!alreadySubscribed) {
      listeners.push({
        handler: handler,
        once: true
      });

      this.listeners_[normalizedEventName] = listeners;
    }

    var eventBus = this;
    var unsubscribed = false;

    return function () {
      if (unsubscribed) {
        return false;
      }

      unsubscribed = true;
      return eventBus.unsubscribe(normalizedEventName, handler);
    };
  }

  /**
   * Removes a handler from an event.
   *
   * @param {string} eventName Event name.
   * @param {Function} handler Listener function.
   * @return {boolean} True when a listener was removed.
   */
  unsubscribe(eventName, handler) {
    var normalizedEventName = this.normalizeEventName_(eventName);
    var listeners = this.listeners_[normalizedEventName];

    if (!listeners || listeners.length === 0) {
      return false;
    }

    var originalLength = listeners.length;

    this.listeners_[normalizedEventName] = listeners.filter(function (listener) {
      return listener.handler !== handler;
    });

    if (this.listeners_[normalizedEventName].length === 0) {
      delete this.listeners_[normalizedEventName];
    }

    return originalLength !== (this.listeners_[normalizedEventName] || []).length;
  }

  /**
   * Publishes an event synchronously.
   *
   * Listener failures are isolated so one failing listener does not stop the
   * remaining listeners. Exact listeners run first, followed by namespace
   * wildcard listeners (for example company.*), then global wildcard listeners.
   *
   * @param {string} eventName Event name.
   * @param {*=} payload Event payload.
   * @return {{eventName: string, delivered: number, failed: number}} Result.
   */
  publish(eventName, payload) {
    var normalizedEventName = this.normalizeEventName_(eventName);
    var listenerGroups = this.getListenerGroups_(normalizedEventName);
    var delivered = 0;
    var failed = 0;
    var event = Object.freeze({
      name: normalizedEventName,
      payload: payload,
      publishedAt: new Date().toISOString()
    });

    listenerGroups.forEach(
      function (group) {
        group.listeners.slice().forEach(
          function (listener) {
            if (listener.once) {
              this.unsubscribe(group.eventName, listener.handler);
            }

            try {
              listener.handler(payload, event);
              delivered += 1;
            } catch (error) {
              failed += 1;
              this.logListenerError_(normalizedEventName, error);
            }
          }.bind(this)
        );
      }.bind(this)
    );

    return {
      eventName: normalizedEventName,
      delivered: delivered,
      failed: failed
    };
  }

  /**
   * Removes all listeners for one event.
   *
   * @param {string} eventName Event name.
   * @return {number} Number of listeners removed.
   */
  clear(eventName) {
    var normalizedEventName = this.normalizeEventName_(eventName);
    var listenerCount = this.listenerCount(normalizedEventName);

    delete this.listeners_[normalizedEventName];

    return listenerCount;
  }

  /**
   * Removes all listeners from the event bus.
   *
   * @return {number} Total number of listeners removed.
   */
  clearAll() {
    var total = Object.keys(this.listeners_).reduce(
      function (count, eventName) {
        return count + this.listeners_[eventName].length;
      }.bind(this),
      0
    );

    this.listeners_ = Object.create(null);

    return total;
  }

  /**
   * Returns the number of listeners registered for an event.
   *
   * @param {string} eventName Event name.
   * @return {number} Listener count.
   */
  listenerCount(eventName) {
    var normalizedEventName = this.normalizeEventName_(eventName);
    var listeners = this.listeners_[normalizedEventName];

    return listeners ? listeners.length : 0;
  }

  /**
   * Returns listener groups relevant to a published event.
   *
   * @private
   * @param {string} eventName Published event name.
   * @return {Array<{eventName: string, listeners: Array<Object>}>} Groups.
   */
  getListenerGroups_(eventName) {
    var names = [eventName];
    var segments = eventName.split('.');

    while (segments.length > 1) {
      segments.pop();
      names.push(segments.join('.') + '.*');
    }

    names.push('*');

    return names
      .filter(
        function (name, index, allNames) {
          return allNames.indexOf(name) === index;
        }
      )
      .map(
        function (name) {
          return {
            eventName: name,
            listeners: this.listeners_[name] || []
          };
        }.bind(this)
      )
      .filter(function (group) {
        return group.listeners.length > 0;
      });
  }

  /**
   * Validates and normalizes an event name.
   *
   * @private
   * @param {*} eventName Event name.
   * @return {string} Normalized event name.
   */
  normalizeEventName_(eventName) {
    var normalizedEventName = String(eventName || '').trim();

    if (!normalizedEventName) {
      throw new TypeError('Event name is required.');
    }

    if (normalizedEventName !== '*' && !/^[a-z0-9]+(?:[._-][a-z0-9]+)*(?:\.\*)?$/i.test(normalizedEventName)) {
      throw new TypeError('Invalid event name: ' + normalizedEventName);
    }

    return normalizedEventName;
  }

  /**
   * Logs listener failures without allowing logging failures to propagate.
   *
   * @private
   * @param {string} eventName Event name.
   * @param {*} error Listener failure.
   * @return {void}
   */
  logListenerError_(eventName, error) {
    try {
      if (this.logger_ && typeof this.logger_.exception === 'function') {
        this.logger_.exception(error, {
          eventName: eventName
        }, 'Event listener failed.');
        return;
      }

      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'ERROR',
          service: 'EventBus',
          message: 'Event listener failed.',
          context: {
            eventName: eventName
          },
          error: {
            name: error && error.name ? error.name : 'Error',
            message: error && error.message ? error.message : String(error)
          }
        })
      );
    } catch (loggingError) {
      // The event bus must never fail because logging failed.
    }
  }
}

/**
 * Shared application-wide EventBus instance.
 */
JSKOS.EventBus = JSKOS.EventBus || new JSKEventBus({
  logger:
    typeof JSKLoggerFactory !== 'undefined'
      ? JSKLoggerFactory.createConsoleLogger('EventBus')
      : null
});
