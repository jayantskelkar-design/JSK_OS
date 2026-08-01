/**
 * JSK OS
 * Module: Policy Repository
 * Version: 1.0.0
 *
 * Repository layer for Policy Management.
 * Storage: Google Sheets
 * Runtime: Google Apps Script V8
 */

var JSK_POLICY_REPOSITORY_CONFIG = Object.freeze({
  SHEET_NAME: 'Policies',
  AUDIT_SHEET_NAME: 'Audit_Log',
  HEADER_SCAN_LIMIT: 10,
  ID_PREFIX: 'POL',
  LOCK_TIMEOUT_MS: 30000,
  DEFAULT_PAGE_SIZE: 25,
  MAX_PAGE_SIZE: 100,

  REQUIRED_HEADERS: Object.freeze([
    'Policy ID', 'Policy Number', 'Proposal Number', 'Policy Type',
    'Product Name', 'Insurer Name', 'Company ID', 'Person ID',
    'Family ID', 'Insured Name', 'Risk Category', 'Sum Insured',
    'Net Premium', 'GST Amount', 'Total Premium', 'Start Date',
    'End Date', 'Renewal Date', 'Policy Status', 'Renewal Stage',
    'Payment Frequency',
    'Agent / Broker', 'Branch', 'Nominee', 'Policy Document URL',
    'Previous Policy Number', 'Claims Count', 'Last Claim Date',
    'Remarks', 'Created At', 'Created By', 'Updated At', 'Updated By',
    'Record Version', 'Is Deleted'
  ]),

  SEARCHABLE_HEADERS: Object.freeze([
    'Policy ID', 'Policy Number', 'Proposal Number', 'Policy Type',
    'Product Name', 'Insurer Name', 'Company ID', 'Person ID',
    'Family ID', 'Insured Name', 'Risk Category', 'Policy Status',
    'Renewal Stage',
    'Agent / Broker', 'Branch', 'Nominee', 'Previous Policy Number',
    'Remarks'
  ]),

  DATE_HEADERS: Object.freeze([
    'Start Date', 'End Date', 'Renewal Date', 'Last Claim Date',
    'Created At', 'Updated At'
  ]),

  MONEY_HEADERS: Object.freeze([
    'Sum Insured', 'Net Premium', 'GST Amount', 'Total Premium'
  ])
});

class PolicyRepository {
  constructor(spreadsheet) {
    this.spreadsheet = spreadsheet || this._resolveSpreadsheet();

    if (!this.spreadsheet) {
      throw new Error('JSK OS spreadsheet is not available.');
    }

    this.sheet = this.spreadsheet.getSheetByName(
      JSK_POLICY_REPOSITORY_CONFIG.SHEET_NAME
    );

    if (!this.sheet) {
      throw new Error(
        'Policies sheet not found. Run migratePolicyDatabase() first.'
      );
    }

    this._refreshSchema();
  }

  create(policy, actor) {
    var repository = this;
    var lock = repository._getWriteLock();
    lock.waitLock(JSK_POLICY_REPOSITORY_CONFIG.LOCK_TIMEOUT_MS);

    try {
      repository._refreshSchema();
      var normalizedActor = repository._normalizeActor(actor);
      var normalizedPolicy = repository._normalizePolicy(policy);
      var errors = repository._validateForCreate(normalizedPolicy);

      if (errors.length) {
        throw new PolicyValidationError(errors);
      }

      repository._assertNoDuplicate(normalizedPolicy, null);

      var now = new Date();
      var record = repository._createEmptyRecord();
      repository._applyPolicyFields(record, normalizedPolicy);

      record['Policy ID'] = repository._generatePolicyId();
      record['Created At'] = now;
      record['Created By'] = normalizedActor;
      record['Updated At'] = now;
      record['Updated By'] = normalizedActor;
      record['Record Version'] = 1;
      record['Is Deleted'] = false;

      if (!record['Policy Status']) {
        record['Policy Status'] = 'Active';
      }

      var targetRow = repository.sheet.getLastRow() + 1;
      repository.sheet
        .getRange(targetRow, 1, 1, repository.headers.length)
        .setValues([repository._recordToRow(record)]);

      SpreadsheetApp.flush();

      repository._writeAuditLogSafely({
        action: 'CREATE',
        entityId: record['Policy ID'],
        actor: normalizedActor,
        beforeData: null,
        afterData: repository._serializeRecord(record)
      });

      return repository.findById(record['Policy ID'], {
        includeDeleted: true
      });
    } finally {
      lock.releaseLock();
    }
  }

  findById(policyId, options) {
    options = options || {};
    var normalizedId = this._normalizeRequiredId(policyId);
    var rowNumber = this._findRowNumberById(normalizedId);

    if (!rowNumber) {
      return null;
    }

    var record = this._readRecordAtRow(rowNumber);

    if (!options.includeDeleted && this._toBoolean(record['Is Deleted'])) {
      return null;
    }

    return this._formatRecord(record, rowNumber);
  }

  findByPolicyNumber(policyNumber, options) {
    options = options || {};
    var normalizedNumber = this._normalizeText(policyNumber).toUpperCase();

    if (!normalizedNumber) {
      throw new PolicyValidationError([
        { field: 'policyNumber', message: 'Policy Number is required.' }
      ]);
    }

    var lastRow = this.sheet.getLastRow();
    if (lastRow <= this.headerRow) {
      return null;
    }

    var column = this.headerMap['Policy Number'] + 1;
    var values = this.sheet
      .getRange(this.headerRow + 1, column, lastRow - this.headerRow, 1)
      .getDisplayValues();

    for (var index = 0; index < values.length; index++) {
      if (this._normalizeText(values[index][0]).toUpperCase() === normalizedNumber) {
        var rowNumber = this.headerRow + index + 1;
        var record = this._readRecordAtRow(rowNumber);
        if (!options.includeDeleted && this._toBoolean(record['Is Deleted'])) {
          return null;
        }
        return this._formatRecord(record, rowNumber);
      }
    }

    return null;
  }

  update(policyId, changes, actor, expectedVersion) {
    var repository = this;
    var lock = repository._getWriteLock();
    lock.waitLock(JSK_POLICY_REPOSITORY_CONFIG.LOCK_TIMEOUT_MS);

    try {
      repository._refreshSchema();
      var normalizedId = repository._normalizeRequiredId(policyId);
      var rowNumber = repository._findRowNumberById(normalizedId);

      if (!rowNumber) {
        throw new PolicyNotFoundError(normalizedId);
      }

      var existing = repository._readRecordAtRow(rowNumber);
      if (repository._toBoolean(existing['Is Deleted'])) {
        throw new PolicyConflictError(
          'Archived policy cannot be updated. Restore it first.',
          Number(existing['Record Version']) || 1
        );
      }

      var currentVersion = Number(existing['Record Version']) || 1;
      repository._assertExpectedVersion(expectedVersion, currentVersion);

      var normalizedChanges = repository._normalizePolicy(changes);
      if (!Object.keys(normalizedChanges).length) {
        throw new PolicyValidationError([
          { field: 'data', message: 'No valid policy fields were provided.' }
        ]);
      }

      var updated = Object.assign({}, existing);
      repository._applyPolicyFields(updated, normalizedChanges);

      var errors = repository._validateForUpdate(updated);
      if (errors.length) {
        throw new PolicyValidationError(errors);
      }

      repository._assertNoDuplicate(updated, normalizedId);
      var normalizedActor = repository._normalizeActor(actor);

      updated['Policy ID'] = normalizedId;
      updated['Created At'] = existing['Created At'];
      updated['Created By'] = existing['Created By'];
      updated['Updated At'] = new Date();
      updated['Updated By'] = normalizedActor;
      updated['Record Version'] = currentVersion + 1;
      updated['Is Deleted'] = false;

      repository.sheet
        .getRange(rowNumber, 1, 1, repository.headers.length)
        .setValues([repository._recordToRow(updated)]);
      SpreadsheetApp.flush();

      repository._writeAuditLogSafely({
        action: 'UPDATE',
        entityId: normalizedId,
        actor: normalizedActor,
        beforeData: repository._serializeRecord(existing),
        afterData: repository._serializeRecord(updated)
      });

      return repository.findById(normalizedId, { includeDeleted: true });
    } finally {
      lock.releaseLock();
    }
  }

  archive(policyId, actor, expectedVersion) {
    return this._setArchivedState(
      policyId,
      true,
      actor,
      expectedVersion,
      'ARCHIVE'
    );
  }

  restore(policyId, actor, expectedVersion) {
    return this._setArchivedState(
      policyId,
      false,
      actor,
      expectedVersion,
      'RESTORE'
    );
  }

  search(criteria) {
    criteria = criteria || {};
    var page = Math.max(1, Number(criteria.page) || 1);
    var pageSize = Math.min(
      JSK_POLICY_REPOSITORY_CONFIG.MAX_PAGE_SIZE,
      Math.max(
        1,
        Number(criteria.pageSize) ||
          JSK_POLICY_REPOSITORY_CONFIG.DEFAULT_PAGE_SIZE
      )
    );

    var includeDeleted = this._toBoolean(criteria.includeDeleted);
    var query = this._normalizeText(criteria.query).toLowerCase();
    var filters = {
      policyType: this._normalizeText(criteria.policyType).toLowerCase(),
      insurerName: this._normalizeText(criteria.insurerName).toLowerCase(),
      companyId: this._normalizeText(criteria.companyId).toUpperCase(),
      personId: this._normalizeText(criteria.personId).toUpperCase(),
      familyId: this._normalizeText(criteria.familyId).toUpperCase(),
      policyStatus: this._normalizeText(criteria.policyStatus).toLowerCase(),
      renewalStage: this._normalizeText(criteria.renewalStage).toLowerCase(),
      riskCategory: this._normalizeText(criteria.riskCategory).toLowerCase()
    };

    var startFrom = criteria.renewalFrom
      ? this._toDate(criteria.renewalFrom)
      : null;
    var endAt = criteria.renewalTo
      ? this._toDate(criteria.renewalTo)
      : null;

    if (criteria.renewalFrom && !startFrom) {
      throw this._dateValidationError('renewalFrom', 'Renewal From');
    }
    if (criteria.renewalTo && !endAt) {
      throw this._dateValidationError('renewalTo', 'Renewal To');
    }

    var entries = this._readAllEntries().filter(function (entry) {
      var record = entry.record;
      if (!record['Policy ID']) return false;
      if (!includeDeleted && this._toBoolean(record['Is Deleted'])) return false;
      if (!this._matchesExact(record['Policy Type'], filters.policyType)) return false;
      if (!this._matchesExact(record['Insurer Name'], filters.insurerName)) return false;
      if (!this._matchesExactUpper(record['Company ID'], filters.companyId)) return false;
      if (!this._matchesExactUpper(record['Person ID'], filters.personId)) return false;
      if (!this._matchesExactUpper(record['Family ID'], filters.familyId)) return false;
      if (!this._matchesExact(record['Policy Status'], filters.policyStatus)) return false;
      if (!this._matchesExact(record['Renewal Stage'], filters.renewalStage)) return false;
      if (!this._matchesExact(record['Risk Category'], filters.riskCategory)) return false;

      var renewalDate = this._toDate(record['Renewal Date']);
      if (startFrom && (!renewalDate || renewalDate.getTime() < startFrom.getTime())) return false;
      if (endAt && (!renewalDate || renewalDate.getTime() > endAt.getTime())) return false;

      if (!query) return true;
      return JSK_POLICY_REPOSITORY_CONFIG.SEARCHABLE_HEADERS.some(
        function (header) {
          return this._normalizeText(record[header])
            .toLowerCase()
            .includes(query);
        }.bind(this)
      );
    }, this);

    var repository = this;
    entries.sort(function (left, right) {
      var leftDate = repository._toDate(left.record['Updated At']) || new Date(0);
      var rightDate = repository._toDate(right.record['Updated At']) || new Date(0);
      return rightDate.getTime() - leftDate.getTime();
    });

    var totalItems = entries.length;
    var totalPages = totalItems ? Math.ceil(totalItems / pageSize) : 0;
    if (totalPages && page > totalPages) page = totalPages;
    var offset = (page - 1) * pageSize;

    return {
      items: entries.slice(offset, offset + pageSize).map(function (entry) {
        return repository._formatRecord(entry.record, entry.rowNumber);
      }),
      pagination: {
        page: page,
        pageSize: pageSize,
        totalItems: totalItems,
        totalPages: totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1
      }
    };
  }

  count(options) {
    options = options || {};
    return this.search({
      page: 1,
      pageSize: 1,
      includeDeleted: options.includeDeleted
    }).pagination.totalItems;
  }

  findByCompanyId(companyId, options) {
    options = options || {};
    return this._collectAllSearchResults({
      companyId: companyId,
      includeDeleted: options.includeDeleted
    });
  }

  findByPersonId(personId, options) {
    options = options || {};
    return this._collectAllSearchResults({
      personId: personId,
      includeDeleted: options.includeDeleted
    });
  }

  findRenewalsDue(dueDate, options) {
    options = options || {};
    var endDate = dueDate ? this._toDate(dueDate) : new Date();
    if (!endDate) {
      throw this._dateValidationError('dueDate', 'Due Date');
    }

    var startDate = options.fromDate
      ? this._toDate(options.fromDate)
      : new Date(0);
    if (options.fromDate && !startDate) {
      throw this._dateValidationError('fromDate', 'From Date');
    }

    var results = this._collectAllSearchResults({
      renewalFrom: startDate,
      renewalTo: endDate,
      includeDeleted: options.includeDeleted,
      policyStatus: options.policyStatus || ''
    });

    return results.sort(function (left, right) {
      var leftDate = new Date(left.renewalDate || 0);
      var rightDate = new Date(right.renewalDate || 0);
      return leftDate.getTime() - rightDate.getTime();
    });
  }

  _setArchivedState(policyId, isDeleted, actor, expectedVersion, action) {
    var repository = this;
    var lock = repository._getWriteLock();
    lock.waitLock(JSK_POLICY_REPOSITORY_CONFIG.LOCK_TIMEOUT_MS);

    try {
      repository._refreshSchema();
      var normalizedId = repository._normalizeRequiredId(policyId);
      var rowNumber = repository._findRowNumberById(normalizedId);
      if (!rowNumber) throw new PolicyNotFoundError(normalizedId);

      var existing = repository._readRecordAtRow(rowNumber);
      var currentDeleted = repository._toBoolean(existing['Is Deleted']);
      var currentVersion = Number(existing['Record Version']) || 1;
      repository._assertExpectedVersion(expectedVersion, currentVersion);

      if (currentDeleted === isDeleted) {
        return repository._formatRecord(existing, rowNumber);
      }

      var updated = Object.assign({}, existing);
      var normalizedActor = repository._normalizeActor(actor);
      updated['Is Deleted'] = isDeleted;
      updated['Updated At'] = new Date();
      updated['Updated By'] = normalizedActor;
      updated['Record Version'] = currentVersion + 1;

      if (!isDeleted) {
        repository._assertNoDuplicate(updated, normalizedId);
      }

      repository.sheet
        .getRange(rowNumber, 1, 1, repository.headers.length)
        .setValues([repository._recordToRow(updated)]);
      SpreadsheetApp.flush();

      repository._writeAuditLogSafely({
        action: action,
        entityId: normalizedId,
        actor: normalizedActor,
        beforeData: repository._serializeRecord(existing),
        afterData: repository._serializeRecord(updated)
      });

      return repository.findById(normalizedId, { includeDeleted: true });
    } finally {
      lock.releaseLock();
    }
  }

  _collectAllSearchResults(criteria) {
    criteria = Object.assign({}, criteria || {});
    var page = 1;
    var items = [];
    var result;

    do {
      result = this.search(Object.assign({}, criteria, {
        page: page,
        pageSize: JSK_POLICY_REPOSITORY_CONFIG.MAX_PAGE_SIZE
      }));
      items = items.concat(result.items);
      page += 1;
    } while (result.pagination.hasNext);

    return items;
  }

  _refreshSchema() {
    this.headerRow = this._findHeaderRow();
    this.headers = this._readHeaders();
    this.headerMap = this._createHeaderMap(this.headers);
    this._validateSchema();
  }

  _findHeaderRow() {
    var maxRows = Math.min(
      Math.max(this.sheet.getLastRow(), 1),
      JSK_POLICY_REPOSITORY_CONFIG.HEADER_SCAN_LIMIT
    );
    var maxColumns = Math.max(
      this.sheet.getLastColumn(),
      JSK_POLICY_REPOSITORY_CONFIG.REQUIRED_HEADERS.length
    );
    var values = this.sheet
      .getRange(1, 1, maxRows, maxColumns)
      .getDisplayValues();

    for (var rowIndex = 0; rowIndex < values.length; rowIndex++) {
      var normalized = values[rowIndex].map(function (value) {
        return String(value || '').trim().toLowerCase();
      });
      if (
        normalized.indexOf('policy id') !== -1 &&
        normalized.indexOf('policy number') !== -1
      ) {
        return rowIndex + 1;
      }
    }

    throw new Error(
      'Policies header row not found. Run migratePolicyDatabase().'
    );
  }

  _readHeaders() {
    var lastColumn = this.sheet.getLastColumn();
    if (lastColumn < 1) return [];
    return this.sheet
      .getRange(this.headerRow, 1, 1, lastColumn)
      .getDisplayValues()[0]
      .map(function (header) { return String(header || '').trim(); });
  }

  _createHeaderMap(headers) {
    var map = {};
    var normalizedMap = {};
    headers.forEach(function (header, index) {
      if (!header) return;
      var key = header.toLowerCase();
      if (normalizedMap[key] !== undefined) {
        throw new Error('Duplicate Policies header: ' + header);
      }
      normalizedMap[key] = index;
      map[header] = index;
    });
    return map;
  }

  _validateSchema() {
    var missing = JSK_POLICY_REPOSITORY_CONFIG.REQUIRED_HEADERS.filter(
      function (header) { return this.headerMap[header] === undefined; },
      this
    );
    if (missing.length) {
      throw new Error(
        'Policies schema is outdated. Missing columns: ' +
          missing.join(', ') + '. Run migratePolicyDatabase().'
      );
    }
  }

  _findRowNumberById(policyId) {
    var lastRow = this.sheet.getLastRow();
    if (lastRow <= this.headerRow) return null;
    var column = this.headerMap['Policy ID'] + 1;
    var values = this.sheet
      .getRange(this.headerRow + 1, column, lastRow - this.headerRow, 1)
      .getDisplayValues();
    for (var index = 0; index < values.length; index++) {
      if (this._normalizeText(values[index][0]).toUpperCase() === policyId) {
        return this.headerRow + index + 1;
      }
    }
    return null;
  }

  _readRecordAtRow(rowNumber) {
    return this._rowToRecord(
      this.sheet
        .getRange(rowNumber, 1, 1, this.headers.length)
        .getValues()[0]
    );
  }

  _readAllEntries() {
    var lastRow = this.sheet.getLastRow();
    if (lastRow <= this.headerRow) return [];
    var repository = this;
    return this.sheet
      .getRange(
        this.headerRow + 1,
        1,
        lastRow - this.headerRow,
        this.headers.length
      )
      .getValues()
      .map(function (row, index) {
        return {
          record: repository._rowToRecord(row),
          rowNumber: repository.headerRow + index + 1
        };
      });
  }

  _rowToRecord(row) {
    var record = {};
    this.headers.forEach(function (header, index) {
      if (header) record[header] = row[index];
    });
    return record;
  }

  _recordToRow(record) {
    return this.headers.map(function (header) {
      return header ? record[header] : '';
    });
  }

  _createEmptyRecord() {
    return this.headers.reduce(function (record, header) {
      if (header) record[header] = '';
      return record;
    }, {});
  }

  _applyPolicyFields(target, source) {
    var protectedHeaders = {
      'Policy ID': true,
      'Created At': true,
      'Created By': true,
      'Updated At': true,
      'Updated By': true,
      'Record Version': true,
      'Is Deleted': true
    };

    Object.keys(source || {}).forEach(function (header) {
      if (this.headerMap[header] !== undefined && !protectedHeaders[header]) {
        target[header] = source[header];
      }
    }, this);
  }

  _normalizePolicy(policy) {
    if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
      throw new PolicyValidationError([
        { field: 'data', message: 'Policy payload must be an object.' }
      ]);
    }

    var aliases = {
      policyId: 'Policy ID', policyNumber: 'Policy Number',
      proposalNumber: 'Proposal Number', policyType: 'Policy Type',
      productName: 'Product Name', insurerName: 'Insurer Name',
      companyId: 'Company ID', personId: 'Person ID', familyId: 'Family ID',
      insuredName: 'Insured Name', riskCategory: 'Risk Category',
      sumInsured: 'Sum Insured', netPremium: 'Net Premium',
      gstAmount: 'GST Amount', totalPremium: 'Total Premium',
      startDate: 'Start Date', endDate: 'End Date', renewalDate: 'Renewal Date',
      policyStatus: 'Policy Status', renewalStage: 'Renewal Stage',
      paymentFrequency: 'Payment Frequency',
      agentBroker: 'Agent / Broker', branch: 'Branch', nominee: 'Nominee',
      policyDocumentUrl: 'Policy Document URL',
      previousPolicyNumber: 'Previous Policy Number',
      claimsCount: 'Claims Count', lastClaimDate: 'Last Claim Date',
      remarks: 'Remarks'
    };

    var normalized = {};
    var repository = this;
    Object.keys(policy).forEach(function (key) {
      var header = aliases[key] || key;
      if (repository.headerMap[header] === undefined) return;
      var value = policy[key];

      if (JSK_POLICY_REPOSITORY_CONFIG.DATE_HEADERS.indexOf(header) !== -1) {
        normalized[header] = repository._isBlank(value)
          ? ''
          : repository._normalizeDate(value, header);
      } else if (JSK_POLICY_REPOSITORY_CONFIG.MONEY_HEADERS.indexOf(header) !== -1) {
        normalized[header] = repository._isBlank(value)
          ? ''
          : repository._normalizeNonNegativeNumber(value);
      } else if (header === 'Claims Count') {
        normalized[header] = repository._isBlank(value)
          ? 0
          : repository._normalizeNonNegativeInteger(value);
      } else {
        normalized[header] = repository._normalizeText(value);
      }
    });

    ['Policy Number', 'Proposal Number', 'Company ID', 'Person ID', 'Family ID']
      .forEach(function (header) {
        if (normalized[header]) normalized[header] = normalized[header].toUpperCase();
      });

    if (normalized['Policy Document URL']) {
      normalized['Policy Document URL'] = repository._normalizeUrl(
        normalized['Policy Document URL']
      );
    }

    return normalized;
  }

  _validateForCreate(policy) {
    var errors = [];
    if (!policy['Policy Number']) {
      errors.push({ field: 'policyNumber', message: 'Policy Number is required.' });
    }
    if (!policy['Policy Type']) {
      errors.push({ field: 'policyType', message: 'Policy Type is required.' });
    }
    if (!policy['Insured Name']) {
      errors.push({ field: 'insuredName', message: 'Insured Name is required.' });
    }
    return errors.concat(this._validateBusinessFields(policy));
  }

  _validateForUpdate(policy) {
    return this._validateForCreate(policy);
  }

  _validateBusinessFields(policy) {
    var errors = [];
    var startDate = this._toDate(policy['Start Date']);
    var endDate = this._toDate(policy['End Date']);
    var renewalDate = this._toDate(policy['Renewal Date']);

    if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
      errors.push({ field: 'endDate', message: 'End Date cannot be before Start Date.' });
    }
    if (startDate && renewalDate && renewalDate.getTime() < startDate.getTime()) {
      errors.push({ field: 'renewalDate', message: 'Renewal Date cannot be before Start Date.' });
    }

    JSK_POLICY_REPOSITORY_CONFIG.MONEY_HEADERS.forEach(function (header) {
      var value = policy[header];
      if (!this._isBlank(value) && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
        errors.push({
          field: this._headerToCamelCase(header),
          message: header + ' must be a non-negative number.'
        });
      }
    }, this);

    if (
      !this._isBlank(policy['Claims Count']) &&
      (!Number.isInteger(Number(policy['Claims Count'])) || Number(policy['Claims Count']) < 0)
    ) {
      errors.push({
        field: 'claimsCount',
        message: 'Claims Count must be a non-negative whole number.'
      });
    }

    if (
      policy['Policy Document URL'] &&
      !this._isValidUrl(policy['Policy Document URL'])
    ) {
      errors.push({
        field: 'policyDocumentUrl',
        message: 'Policy Document URL is invalid.'
      });
    }

    return errors;
  }

  _assertNoDuplicate(policy, excludedPolicyId) {
    var policyNumber = this._normalizeText(policy['Policy Number']).toUpperCase();
    if (!policyNumber) return;

    this._readAllEntries().forEach(function (entry) {
      var record = entry.record;
      var recordId = this._normalizeText(record['Policy ID']).toUpperCase();
      if (!recordId || recordId === excludedPolicyId) return;
      if (this._toBoolean(record['Is Deleted'])) return;

      var existingNumber = this._normalizeText(record['Policy Number']).toUpperCase();
      if (existingNumber && existingNumber === policyNumber) {
        throw new PolicyDuplicateError(
          'A policy with Policy Number ' + policyNumber + ' already exists.',
          recordId
        );
      }
    }, this);
  }

  _generatePolicyId() {
    var timestamp = Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone() || 'Asia/Kolkata',
      'yyyyMMddHHmmss'
    );
    var randomPart = Utilities.getUuid()
      .replace(/-/g, '')
      .substring(0, 6)
      .toUpperCase();
    var policyId =
      JSK_POLICY_REPOSITORY_CONFIG.ID_PREFIX + '-' + timestamp + '-' + randomPart;
    return this._findRowNumberById(policyId)
      ? this._generatePolicyId()
      : policyId;
  }

  _formatRecord(record, rowNumber) {
    var formatted = {};
    this.headers.forEach(function (header) {
      if (!header) return;
      var key = this._headerToCamelCase(header);
      var value = record[header];

      if (JSK_POLICY_REPOSITORY_CONFIG.DATE_HEADERS.indexOf(header) !== -1) {
        formatted[key] = this._formatDateForApi(value);
      } else if (header === 'Is Deleted') {
        formatted[key] = this._toBoolean(value);
      } else if (
        JSK_POLICY_REPOSITORY_CONFIG.MONEY_HEADERS.indexOf(header) !== -1 ||
        header === 'Claims Count' ||
        header === 'Record Version'
      ) {
        formatted[key] = this._isBlank(value) ? null : Number(value);
      } else {
        formatted[key] = this._isBlank(value) ? '' : String(value);
      }
    }, this);
    formatted._rowNumber = rowNumber;
    return formatted;
  }

  _headerToCamelCase(header) {
    var specialNames = {
      'Policy ID': 'policyId', 'Company ID': 'companyId',
      'Person ID': 'personId', 'Family ID': 'familyId',
      'GST Amount': 'gstAmount', 'Policy Document URL': 'policyDocumentUrl',
      'Is Deleted': 'isDeleted'
    };
    if (specialNames[header]) return specialNames[header];
    return header
      .replace(/[^a-zA-Z0-9]+(.)/g, function (match, character) {
        return character.toUpperCase();
      })
      .replace(/^[A-Z]/, function (character) {
        return character.toLowerCase();
      });
  }

  _serializeRecord(record) {
    var serializable = {};
    Object.keys(record).forEach(function (key) {
      serializable[key] = record[key] instanceof Date
        ? this._formatDateForApi(record[key])
        : record[key];
    }, this);
    return JSON.stringify(serializable);
  }

  _writeAuditLogSafely(entry) {
    try {
      this._writeAuditLog(entry);
    } catch (error) {
      console.error(
        'Policy audit log failed: ' +
          (error && error.stack ? error.stack : error)
      );
    }
  }

  _writeAuditLog(entry) {
    var auditSheet = this.spreadsheet.getSheetByName(
      JSK_POLICY_REPOSITORY_CONFIG.AUDIT_SHEET_NAME
    );
    if (!auditSheet) {
      auditSheet = this.spreadsheet.insertSheet(
        JSK_POLICY_REPOSITORY_CONFIG.AUDIT_SHEET_NAME
      );
      auditSheet.getRange(1, 1, 1, 8).setValues([[
        'Audit ID', 'Timestamp', 'Entity Type', 'Entity ID',
        'Action', 'Actor', 'Before Data', 'After Data'
      ]]);
      auditSheet.setFrozenRows(1);
    }
    auditSheet.appendRow([
      'AUD-' + Utilities.getUuid().toUpperCase(),
      new Date(),
      'Policy',
      entry.entityId,
      entry.action,
      entry.actor,
      entry.beforeData || '',
      entry.afterData || ''
    ]);
  }

  _resolveSpreadsheet() {
    if (
      typeof JSKOS !== 'undefined' &&
      JSKOS.ConfigService &&
      typeof JSKOS.ConfigService.getSpreadsheet === 'function'
    ) {
      return JSKOS.ConfigService.getSpreadsheet();
    }
    return SpreadsheetApp.getActiveSpreadsheet();
  }

  _getWriteLock() {
    return LockService.getDocumentLock() || LockService.getScriptLock();
  }

  _normalizeActor(actor) {
    var explicit = this._normalizeText(actor);
    if (explicit) return explicit;
    var email = '';
    try { email = Session.getActiveUser().getEmail(); } catch (error) { email = ''; }
    return email || 'SYSTEM';
  }

  _normalizeRequiredId(policyId) {
    var normalized = this._normalizeText(policyId).toUpperCase();
    if (!normalized) {
      throw new PolicyValidationError([
        { field: 'policyId', message: 'Policy ID is required.' }
      ]);
    }
    return normalized;
  }

  _assertExpectedVersion(expectedVersion, currentVersion) {
    if (
      expectedVersion !== undefined &&
      expectedVersion !== null &&
      Number(expectedVersion) !== Number(currentVersion)
    ) {
      throw new PolicyConflictError(
        'Policy was modified by another user.',
        currentVersion
      );
    }
  }

  _matchesExact(value, filter) {
    return !filter || this._normalizeText(value).toLowerCase() === filter;
  }

  _matchesExactUpper(value, filter) {
    return !filter || this._normalizeText(value).toUpperCase() === filter;
  }

  _normalizeText(value) {
    return value === null || value === undefined ? '' : String(value).trim();
  }

  _isBlank(value) {
    return value === '' || value === null || value === undefined;
  }

  _normalizeNonNegativeNumber(value) {
    var number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : value;
  }

  _normalizeNonNegativeInteger(value) {
    var number = Number(value);
    return Number.isFinite(number) && Number.isInteger(number) && number >= 0
      ? number
      : value;
  }

  _normalizeUrl(value) {
    var url = this._normalizeText(value);
    if (!url) return '';
    return /^https?:\/\//i.test(url) ? url : 'https://' + url;
  }

  _isValidUrl(value) {
    return /^https?:\/\/[^\s]+$/i.test(this._normalizeText(value));
  }

  _normalizeDate(value, fieldName) {
    var date = this._toDate(value);
    if (!date) throw this._dateValidationError(this._headerToCamelCase(fieldName), fieldName);
    return date;
  }

  _dateValidationError(field, label) {
    return new PolicyValidationError([
      { field: field, message: label + ' is not a valid date.' }
    ]);
  }

  _toDate(value) {
    if (!value) return null;
    if (value instanceof Date && !isNaN(value.getTime())) return value;
    var parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  _formatDateForApi(value) {
    var date = this._toDate(value);
    return date ? date.toISOString() : null;
  }

  _toBoolean(value) {
    if (value === true || value === false) return value;
    var normalized = this._normalizeText(value).toLowerCase();
    return normalized === 'true' || normalized === 'yes' || normalized === '1';
  }
}

class PolicyValidationError extends Error {
  constructor(errors) {
    super('Policy validation failed.');
    this.name = 'PolicyValidationError';
    this.code = 'VALIDATION_ERROR';
    this.status = 400;
    this.errors = errors || [];
  }
}

class PolicyNotFoundError extends Error {
  constructor(policyId) {
    super('Policy not found: ' + policyId);
    this.name = 'PolicyNotFoundError';
    this.code = 'POLICY_NOT_FOUND';
    this.status = 404;
    this.policyId = policyId;
  }
}

class PolicyDuplicateError extends Error {
  constructor(message, duplicatePolicyId) {
    super(message);
    this.name = 'PolicyDuplicateError';
    this.code = 'DUPLICATE_POLICY';
    this.status = 409;
    this.duplicatePolicyId = duplicatePolicyId;
  }
}

class PolicyConflictError extends Error {
  constructor(message, currentVersion) {
    super(message);
    this.name = 'PolicyConflictError';
    this.code = 'VERSION_CONFLICT';
    this.status = 409;
    this.currentVersion = currentVersion;
  }
}
