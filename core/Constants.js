/**
 * JSK OS
 * Module: Shared Constants
 * Version: 1.0.0
 */

var JSKOS = JSKOS || {};

JSKOS.Constants = Object.freeze({
  MODULES: Object.freeze({
    CORE: 'CORE',
    DATABASE: 'DATABASE',
    COMPANY: 'COMPANY',
    PEOPLE: 'PEOPLE',
    DASHBOARD: 'DASHBOARD',
    TASKS: 'TASKS',
    MEETINGS: 'MEETINGS',
    POLICIES: 'POLICIES',
    RENEWALS: 'RENEWALS',
    CLAIMS: 'CLAIMS',
    GARUDA: 'GARUDA'
  }),

  STATUS: Object.freeze({
    ACTIVE: 'Active',
    INACTIVE: 'Inactive',
    PROSPECT: 'Prospect',
    CUSTOMER: 'Customer',
    DORMANT: 'Dormant',
    ARCHIVED: 'Archived'
  }),

  LOG_LEVELS: Object.freeze({
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR',
    FATAL: 'FATAL'
  }),

  ERROR_CODES: Object.freeze({
    VALIDATION_ERROR:
      'VALIDATION_ERROR',

    CONFIGURATION_ERROR:
      'CONFIGURATION_ERROR',

    RECORD_NOT_FOUND:
      'RECORD_NOT_FOUND',

    DUPLICATE_RECORD:
      'DUPLICATE_RECORD',

    VERSION_CONFLICT:
      'VERSION_CONFLICT',

    DATABASE_ERROR:
      'DATABASE_ERROR',

    LOCK_TIMEOUT:
      'LOCK_TIMEOUT',

    INTERNAL_ERROR:
      'INTERNAL_ERROR'
  }),

  HTTP_STATUS: Object.freeze({
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    INTERNAL_SERVER_ERROR: 500
  }),

  SORT_DIRECTION: Object.freeze({
    ASCENDING: 'ASC',
    DESCENDING: 'DESC'
  }),

  BOOLEAN_TEXT: Object.freeze({
    TRUE: 'TRUE',
    FALSE: 'FALSE'
  })
});