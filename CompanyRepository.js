function myFunction() {
  /**
 * JSK OS v0.7.3
 * CompanyRepository.js
 *
 * Repository layer for Company CRM.
 * Storage: Google Sheets
 * Runtime: Google Apps Script V8
 */

var JSK_COMPANY_CONFIG = Object.freeze({
  SHEET_NAME: 'Companies',
  AUDIT_SHEET_NAME: 'Audit_Log',
  HEADER_SCAN_LIMIT: 10,
  ID_PREFIX: 'COM',
  LOCK_TIMEOUT_MS: 30000,

  REQUIRED_HEADERS: Object.freeze([
    'Company ID',
    'Company Name',
    'Industry',
    'GSTIN',
    'Website',
    'Address',
    'Area',
    'Zone',
    'Owner Person ID',
    'Primary Contact ID',
    'Employees',
    'Turnover Range',
    'Current Covers',
    'Risk Category',
    'Corporate Potential',
    'Last Review',
    'Next Review',
    'Status',
    'Google Maps Link',
    'Remarks',
    'Created At',
    'Created By',
    'Updated At',
    'Updated By',
    'Record Version',
    'Is Deleted'
  ]),

  SEARCHABLE_HEADERS: Object.freeze([
    'Company ID',
    'Company Name',
    'Industry',
    'GSTIN',
    'Website',
    'Address',
    'Area',
    'Zone',
    'Owner Person ID',
    'Primary Contact ID',
    'Turnover Range',
    'Current Covers',
    'Risk Category',
    'Corporate Potential',
    'Status',
    'Remarks'
  ])
});


class CompanyRepository {
  constructor(spreadsheet) {
    this.spreadsheet = spreadsheet || SpreadsheetApp.getActiveSpreadsheet();

    if (!this.spreadsheet) {
      throw new Error('Active spreadsheet is not available.');
    }

    this.sheet = this.spreadsheet.getSheetByName(
      JSK_COMPANY_CONFIG.SHEET_NAME
    );

    if (!this.sheet) {
      throw new Error(
        'Companies sheet not found. Run migrateCompanyDatabase() first.'
      );
    }

    this.headerRow = this._findHeaderRow();
    this.headers = this._readHeaders();
    this.headerMap = this._createHeaderMap(this.headers);

    this._validateSchema();
  }

  /**
   * Creates a company record.
   *
   * @param {Object} company
   * @param {string} actor
   * @return {Object}
   */
  create(company, actor) {
    var repository = this;
    var lock = LockService.getDocumentLock();

    lock.waitLock(JSK_COMPANY_CONFIG.LOCK_TIMEOUT_MS);

    try {
      repository._refreshSchema();

      var now = new Date();
      var normalizedCompany = repository._normalizeCompany(company);
      var validationErrors = repository._validateForCreate(normalizedCompany);

      if (validationErrors.length > 0) {
        throw new CompanyValidationError(validationErrors);
      }

      repository._assertNoDuplicate(normalizedCompany, null);

      var record = repository._createEmptyRecord();

      repository._applyCompanyFields(record, normalizedCompany);

      record['Company ID'] = repository._generateCompanyId();
      record['Created At'] = now;
      record['Created By'] = repository._normalizeActor(actor);
      record['Updated At'] = now;
      record['Updated By'] = repository._normalizeActor(actor);
      record['Record Version'] = 1;
      record['Is Deleted'] = false;

      if (!record.Status) {
        record.Status = 'Active';
      }

      var rowValues = repository._recordToRow(record);
      var targetRow = repository.sheet.getLastRow() + 1;

      repository.sheet
        .getRange(targetRow, 1, 1, repository.headers.length)
        .setValues([rowValues]);

      SpreadsheetApp.flush();

      repository._writeAuditLog({
        action: 'CREATE',
        entityId: record['Company ID'],
        actor: repository._normalizeActor(actor),
        beforeData: null,
        afterData: repository._serializeRecord(record)
      });

      return repository.findById(record['Company ID'], {
        includeDeleted: true
      });
    } finally {
      lock.releaseLock();
    }
  }

  /**
   * Returns one company by ID.
   *
   * @param {string} companyId
   * @param {Object=} options
   * @return {Object|null}
   */
  findById(companyId, options) {
    options = options || {};

    var normalizedId = this._normalizeText(companyId).toUpperCase();

    if (!normalizedId) {
      throw new Error('Company ID is required.');
    }

    var rowNumber = this._findRowNumberById(normalizedId);

    if (!rowNumber) {
      return null;
    }

    var record = this._readRecordAtRow(rowNumber);

    if (
      !options.includeDeleted &&
      this._toBoolean(record['Is Deleted'])
    ) {
      return null;
    }

    return this._formatRecord(record, rowNumber);
  }

  /**
   * Updates an existing company.
   *
   * Supports optimistic locking through expectedVersion.
   *
   * @param {string} companyId
   * @param {Object} changes
   * @param {string} actor
   * @param {number=} expectedVersion
   * @return {Object}
   */
  update(companyId, changes, actor, expectedVersion) {
    var repository = this;
    var lock = LockService.getDocumentLock();

    lock.waitLock(JSK_COMPANY_CONFIG.LOCK_TIMEOUT_MS);

    try {
      repository._refreshSchema();

      var normalizedId = repository
        ._normalizeText(companyId)
        .toUpperCase();

      if (!normalizedId) {
        throw new Error('Company ID is required.');
      }

      var rowNumber = repository._findRowNumberById(normalizedId);

      if (!rowNumber) {
        throw new CompanyNotFoundError(normalizedId);
      }

      var existingRecord = repository._readRecordAtRow(rowNumber);

      if (repository._toBoolean(existingRecord['Is Deleted'])) {
        throw new Error(
          'Archived company cannot be updated. Restore it first.'
        );
      }

      var currentVersion =
        Number(existingRecord['Record Version']) || 1;

      if (
        expectedVersion !== undefined &&
        expectedVersion !== null &&
        Number(expectedVersion) !== currentVersion
      ) {
        throw new CompanyConflictError(
          'Company was modified by another user.',
          currentVersion
        );
      }

      var normalizedChanges = repository._normalizeCompany(changes);
      var updatedRecord = Object.assign({}, existingRecord);

      repository._applyCompanyFields(updatedRecord, normalizedChanges);

      var validationErrors =
        repository._validateForUpdate(updatedRecord);

      if (validationErrors.length > 0) {
        throw new CompanyValidationError(validationErrors);
      }

      repository._assertNoDuplicate(updatedRecord, normalizedId);

      updatedRecord['Company ID'] = normalizedId;
      updatedRecord['Created At'] = existingRecord['Created At'];
      updatedRecord['Created By'] = existingRecord['Created By'];
      updatedRecord['Updated At'] = new Date();
      updatedRecord['Updated By'] =
        repository._normalizeActor(actor);
      updatedRecord['Record Version'] = currentVersion + 1;
      updatedRecord['Is Deleted'] = false;

      repository.sheet
        .getRange(rowNumber, 1, 1, repository.headers.length)
        .setValues([repository._recordToRow(updatedRecord)]);

      SpreadsheetApp.flush();

      repository._writeAuditLog({
        action: 'UPDATE',
        entityId: normalizedId,
        actor: repository._normalizeActor(actor),
        beforeData: repository._serializeRecord(existingRecord),
        afterData: repository._serializeRecord(updatedRecord)
      });

      return repository.findById(normalizedId, {
        includeDeleted: true
      });
    } finally {
      lock.releaseLock();
    }
  }

  /**
   * Soft deletes a company.
   *
   * @param {string} companyId
   * @param {string} actor
   * @param {number=} expectedVersion
   * @return {Object}
   */
  archive(companyId, actor, expectedVersion) {
    var repository = this;
    var lock = LockService.getDocumentLock();

    lock.waitLock(JSK_COMPANY_CONFIG.LOCK_TIMEOUT_MS);

    try {
      repository._refreshSchema();

      var normalizedId = repository
        ._normalizeText(companyId)
        .toUpperCase();

      var rowNumber = repository._findRowNumberById(normalizedId);

      if (!rowNumber) {
        throw new CompanyNotFoundError(normalizedId);
      }

      var existingRecord = repository._readRecordAtRow(rowNumber);
      var currentVersion =
        Number(existingRecord['Record Version']) || 1;

      if (
        expectedVersion !== undefined &&
        expectedVersion !== null &&
        Number(expectedVersion) !== currentVersion
      ) {
        throw new CompanyConflictError(
          'Company was modified by another user.',
          currentVersion
        );
      }

      if (repository._toBoolean(existingRecord['Is Deleted'])) {
        return repository._formatRecord(existingRecord, rowNumber);
      }

      var archivedRecord = Object.assign({}, existingRecord);

      archivedRecord.Status = 'Archived';
      archivedRecord['Is Deleted'] = true;
      archivedRecord['Updated At'] = new Date();
      archivedRecord['Updated By'] =
        repository._normalizeActor(actor);
      archivedRecord['Record Version'] = currentVersion + 1;

      repository.sheet
        .getRange(rowNumber, 1, 1, repository.headers.length)
        .setValues([repository._recordToRow(archivedRecord)]);

      SpreadsheetApp.flush();

      repository._writeAuditLog({
        action: 'ARCHIVE',
        entityId: normalizedId,
        actor: repository._normalizeActor(actor),
        beforeData: repository._serializeRecord(existingRecord),
        afterData: repository._serializeRecord(archivedRecord)
      });

      return repository.findById(normalizedId, {
        includeDeleted: true
      });
    } finally {
      lock.releaseLock();
    }
  }

  /**
   * Restores an archived company.
   *
   * @param {string} companyId
   * @param {string} actor
   * @return {Object}
   */
  restore(companyId, actor) {
    var repository = this;
    var lock = LockService.getDocumentLock();

    lock.waitLock(JSK_COMPANY_CONFIG.LOCK_TIMEOUT_MS);

    try {
      repository._refreshSchema();

      var normalizedId = repository
        ._normalizeText(companyId)
        .toUpperCase();

      var rowNumber = repository._findRowNumberById(normalizedId);

      if (!rowNumber) {
        throw new CompanyNotFoundError(normalizedId);
      }

      var existingRecord = repository._readRecordAtRow(rowNumber);

      if (!repository._toBoolean(existingRecord['Is Deleted'])) {
        return repository._formatRecord(existingRecord, rowNumber);
      }

      repository._assertNoDuplicate(existingRecord, normalizedId);

      var restoredRecord = Object.assign({}, existingRecord);

      restoredRecord.Status = 'Active';
      restoredRecord['Is Deleted'] = false;
      restoredRecord['Updated At'] = new Date();
      restoredRecord['Updated By'] =
        repository._normalizeActor(actor);
      restoredRecord['Record Version'] =
        (Number(existingRecord['Record Version']) || 1) + 1;

      repository.sheet
        .getRange(rowNumber, 1, 1, repository.headers.length)
        .setValues([repository._recordToRow(restoredRecord)]);

      SpreadsheetApp.flush();

      repository._writeAuditLog({
        action: 'RESTORE',
        entityId: normalizedId,
        actor: repository._normalizeActor(actor),
        beforeData: repository._serializeRecord(existingRecord),
        afterData: repository._serializeRecord(restoredRecord)
      });

      return repository.findById(normalizedId, {
        includeDeleted: true
      });
    } finally {
      lock.releaseLock();
    }
  }

  /**
   * Searches company records.
   *
   * @param {Object=} criteria
   * @return {Object}
   */
  search(criteria) {
    criteria = criteria || {};

    var page = Math.max(1, Number(criteria.page) || 1);
    var pageSize = Math.min(
      100,
      Math.max(1, Number(criteria.pageSize) || 25)
    );

    var includeDeleted = this._toBoolean(
      criteria.includeDeleted
    );

    var query = this._normalizeText(criteria.query).toLowerCase();
    var status = this._normalizeText(criteria.status).toLowerCase();
    var industry = this._normalizeText(criteria.industry).toLowerCase();
    var area = this._normalizeText(criteria.area).toLowerCase();
    var zone = this._normalizeText(criteria.zone).toLowerCase();
    var riskCategory = this
      ._normalizeText(criteria.riskCategory)
      .toLowerCase();

    var lastRow = this.sheet.getLastRow();

    if (lastRow <= this.headerRow) {
      return {
        items: [],
        pagination: {
          page: page,
          pageSize: pageSize,
          totalItems: 0,
          totalPages: 0,
          hasNext: false,
          hasPrevious: false
        }
      };
    }

    var rowCount = lastRow - this.headerRow;
    var values = this.sheet
      .getRange(
        this.headerRow + 1,
        1,
        rowCount,
        this.headers.length
      )
      .getValues();

    var repository = this;

    var matched = values
      .map(function (row, index) {
        var record = repository._rowToRecord(row);

        return {
          record: record,
          rowNumber: repository.headerRow + index + 1
        };
      })
      .filter(function (entry) {
        var record = entry.record;

        if (!record['Company ID']) {
          return false;
        }

        if (
          !includeDeleted &&
          repository._toBoolean(record['Is Deleted'])
        ) {
          return false;
        }

        if (
          status &&
          repository
            ._normalizeText(record.Status)
            .toLowerCase() !== status
        ) {
          return false;
        }

        if (
          industry &&
          repository
            ._normalizeText(record.Industry)
            .toLowerCase() !== industry
        ) {
          return false;
        }

        if (
          area &&
          repository
            ._normalizeText(record.Area)
            .toLowerCase() !== area
        ) {
          return false;
        }

        if (
          zone &&
          repository
            ._normalizeText(record.Zone)
            .toLowerCase() !== zone
        ) {
          return false;
        }

        if (
          riskCategory &&
          repository
            ._normalizeText(record['Risk Category'])
            .toLowerCase() !== riskCategory
        ) {
          return false;
        }

        if (!query) {
          return true;
        }

        return JSK_COMPANY_CONFIG.SEARCHABLE_HEADERS.some(
          function (header) {
            return repository
              ._normalizeText(record[header])
              .toLowerCase()
              .includes(query);
          }
        );
      });

    matched.sort(function (left, right) {
      var leftDate =
        repository._toDate(left.record['Updated At']) ||
        new Date(0);

      var rightDate =
        repository._toDate(right.record['Updated At']) ||
        new Date(0);

      return rightDate.getTime() - leftDate.getTime();
    });

    var totalItems = matched.length;
    var totalPages =
      totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);

    if (totalPages > 0 && page > totalPages) {
      page = totalPages;
    }

    var offset = (page - 1) * pageSize;

    var items = matched
      .slice(offset, offset + pageSize)
      .map(function (entry) {
        return repository._formatRecord(
          entry.record,
          entry.rowNumber
        );
      });

    return {
      items: items,
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

  _refreshSchema() {
    this.headerRow = this._findHeaderRow();
    this.headers = this._readHeaders();
    this.headerMap = this._createHeaderMap(this.headers);
    this._validateSchema();
  }

  _findHeaderRow() {
    var maxRows = Math.min(
      Math.max(this.sheet.getLastRow(), 1),
      JSK_COMPANY_CONFIG.HEADER_SCAN_LIMIT
    );

    var maxColumns = Math.max(
      this.sheet.getLastColumn(),
      JSK_COMPANY_CONFIG.REQUIRED_HEADERS.length
    );

    var values = this.sheet
      .getRange(1, 1, maxRows, maxColumns)
      .getDisplayValues();

    for (var rowIndex = 0; rowIndex < values.length; rowIndex++) {
      var normalized = values[rowIndex].map(function (value) {
        return String(value || '').trim().toLowerCase();
      });

      if (
        normalized.indexOf('company id') !== -1 &&
        normalized.indexOf('company name') !== -1
      ) {
        return rowIndex + 1;
      }
    }

    throw new Error(
      'Companies header row not found. Run migrateCompanyDatabase().'
    );
  }

  _readHeaders() {
    var lastColumn = this.sheet.getLastColumn();

    if (lastColumn < 1) {
      return [];
    }

    return this.sheet
      .getRange(this.headerRow, 1, 1, lastColumn)
      .getDisplayValues()[0]
      .map(function (header) {
        return String(header || '').trim();
      });
  }

  _createHeaderMap(headers) {
    return headers.reduce(function (map, header, index) {
      if (header) {
        map[header] = index;
      }

      return map;
    }, {});
  }

  _validateSchema() {
    var missing = JSK_COMPANY_CONFIG.REQUIRED_HEADERS.filter(
      function (header) {
        return this.headerMap[header] === undefined;
      },
      this
    );

    if (missing.length > 0) {
      throw new Error(
        'Companies schema is outdated. Missing columns: ' +
          missing.join(', ') +
          '. Run migrateCompanyDatabase().'
      );
    }
  }

  _findRowNumberById(companyId) {
    var lastRow = this.sheet.getLastRow();

    if (lastRow <= this.headerRow) {
      return null;
    }

    var companyIdColumn =
      this.headerMap['Company ID'] + 1;

    var idValues = this.sheet
      .getRange(
        this.headerRow + 1,
        companyIdColumn,
        lastRow - this.headerRow,
        1
      )
      .getDisplayValues();

    for (var index = 0; index < idValues.length; index++) {
      if (
        this._normalizeText(idValues[index][0]).toUpperCase() ===
        companyId
      ) {
        return this.headerRow + index + 1;
      }
    }

    return null;
  }

  _readRecordAtRow(rowNumber) {
    var row = this.sheet
      .getRange(rowNumber, 1, 1, this.headers.length)
      .getValues()[0];

    return this._rowToRecord(row);
  }

  _rowToRecord(row) {
    var record = {};

    this.headers.forEach(function (header, index) {
      if (header) {
        record[header] = row[index];
      }
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
      if (header) {
        record[header] = '';
      }

      return record;
    }, {});
  }

  _applyCompanyFields(target, source) {
    var protectedHeaders = {
      'Company ID': true,
      'Created At': true,
      'Created By': true,
      'Updated At': true,
      'Updated By': true,
      'Record Version': true,
      'Is Deleted': true
    };

    Object.keys(source || {}).forEach(
      function (header) {
        if (
          this.headerMap[header] !== undefined &&
          !protectedHeaders[header]
        ) {
          target[header] = source[header];
        }
      }.bind(this)
    );
  }

  _normalizeCompany(company) {
    if (!company || typeof company !== 'object') {
      throw new Error('Company payload must be an object.');
    }

    var aliases = {
      companyId: 'Company ID',
      companyName: 'Company Name',
      industry: 'Industry',
      gstin: 'GSTIN',
      website: 'Website',
      address: 'Address',
      area: 'Area',
      zone: 'Zone',
      ownerPersonId: 'Owner Person ID',
      primaryContactId: 'Primary Contact ID',
      employees: 'Employees',
      turnoverRange: 'Turnover Range',
      currentCovers: 'Current Covers',
      riskCategory: 'Risk Category',
      corporatePotential: 'Corporate Potential',
      lastReview: 'Last Review',
      nextReview: 'Next Review',
      status: 'Status',
      googleMapsLink: 'Google Maps Link',
      remarks: 'Remarks'
    };

    var normalized = {};
    var repository = this;

    Object.keys(company).forEach(function (key) {
      var header = aliases[key] || key;

      if (repository.headerMap[header] === undefined) {
        return;
      }

      var value = company[key];

      if (
        header === 'Last Review' ||
        header === 'Next Review'
      ) {
        normalized[header] =
          value === '' || value === null || value === undefined
            ? ''
            : repository._normalizeDate(value, header);
        return;
      }

      if (header === 'Employees') {
        normalized[header] =
          value === '' || value === null || value === undefined
            ? ''
            : repository._normalizeEmployeeCount(value);
        return;
      }

      normalized[header] = repository._normalizeText(value);
    });

    if (normalized.GSTIN) {
      normalized.GSTIN = normalized.GSTIN
        .replace(/\s+/g, '')
        .toUpperCase();
    }

    if (normalized.Website) {
      normalized.Website = repository._normalizeUrl(
        normalized.Website
      );
    }

    if (normalized['Google Maps Link']) {
      normalized['Google Maps Link'] =
        repository._normalizeUrl(
          normalized['Google Maps Link']
        );
    }

    return normalized;
  }

  _validateForCreate(company) {
    var errors = [];

    if (!company['Company Name']) {
      errors.push({
        field: 'companyName',
        message: 'Company Name is required.'
      });
    }

    return errors.concat(this._validateBusinessFields(company));
  }

  _validateForUpdate(company) {
    var errors = [];

    if (!this._normalizeText(company['Company Name'])) {
      errors.push({
        field: 'companyName',
        message: 'Company Name is required.'
      });
    }

    return errors.concat(this._validateBusinessFields(company));
  }

  _validateBusinessFields(company) {
    var errors = [];
    var gstin = this._normalizeText(company.GSTIN);

    if (
      gstin &&
      !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(
        gstin
      )
    ) {
      errors.push({
        field: 'gstin',
        message: 'GSTIN format is invalid.'
      });
    }

    if (
      company.Employees !== '' &&
      company.Employees !== null &&
      company.Employees !== undefined &&
      (!Number.isInteger(Number(company.Employees)) ||
        Number(company.Employees) < 0)
    ) {
      errors.push({
        field: 'employees',
        message:
          'Employees must be a non-negative whole number.'
      });
    }

    if (
      company.Website &&
      !this._isValidUrl(company.Website)
    ) {
      errors.push({
        field: 'website',
        message: 'Website URL is invalid.'
      });
    }

    if (
      company['Google Maps Link'] &&
      !this._isValidUrl(company['Google Maps Link'])
    ) {
      errors.push({
        field: 'googleMapsLink',
        message: 'Google Maps Link is invalid.'
      });
    }

    return errors;
  }

  _assertNoDuplicate(company, excludedCompanyId) {
    var lastRow = this.sheet.getLastRow();

    if (lastRow <= this.headerRow) {
      return;
    }

    var companyName = this
      ._normalizeText(company['Company Name'])
      .toLowerCase();

    var gstin = this
      ._normalizeText(company.GSTIN)
      .toUpperCase();

    var values = this.sheet
      .getRange(
        this.headerRow + 1,
        1,
        lastRow - this.headerRow,
        this.headers.length
      )
      .getValues();

    var repository = this;

    values.forEach(function (row) {
      var record = repository._rowToRecord(row);
      var recordId = repository
        ._normalizeText(record['Company ID'])
        .toUpperCase();

      if (!recordId || recordId === excludedCompanyId) {
        return;
      }

      if (repository._toBoolean(record['Is Deleted'])) {
        return;
      }

      var existingName = repository
        ._normalizeText(record['Company Name'])
        .toLowerCase();

      var existingGstin = repository
        ._normalizeText(record.GSTIN)
        .toUpperCase();

      if (gstin && existingGstin && gstin === existingGstin) {
        throw new CompanyDuplicateError(
          'A company with GSTIN ' + gstin + ' already exists.',
          recordId
        );
      }

      if (
        companyName &&
        existingName &&
        companyName === existingName
      ) {
        throw new CompanyDuplicateError(
          'A company named "' +
            company['Company Name'] +
            '" already exists.',
          recordId
        );
      }
    });
  }

  _generateCompanyId() {
    var timestamp = Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone() || 'Asia/Kolkata',
      'yyyyMMddHHmmss'
    );

    var randomPart = Utilities.getUuid()
      .replace(/-/g, '')
      .substring(0, 6)
      .toUpperCase();

    var companyId =
      JSK_COMPANY_CONFIG.ID_PREFIX +
      '-' +
      timestamp +
      '-' +
      randomPart;

    if (this._findRowNumberById(companyId)) {
      return this._generateCompanyId();
    }

    return companyId;
  }

  _formatRecord(record, rowNumber) {
    var formatted = {};

    this.headers.forEach(
      function (header) {
        if (!header) {
          return;
        }

        var key = this._headerToCamelCase(header);
        var value = record[header];

        if (
          header === 'Created At' ||
          header === 'Updated At' ||
          header === 'Last Review' ||
          header === 'Next Review'
        ) {
          formatted[key] = this._formatDateForApi(value);
        } else if (header === 'Is Deleted') {
          formatted[key] = this._toBoolean(value);
        } else if (
          header === 'Employees' ||
          header === 'Record Version'
        ) {
          formatted[key] =
            value === '' || value === null
              ? null
              : Number(value);
        } else {
          formatted[key] =
            value === null || value === undefined
              ? ''
              : String(value);
        }
      }.bind(this)
    );

    formatted._rowNumber = rowNumber;

    return formatted;
  }

  _headerToCamelCase(header) {
    var specialNames = {
      GSTIN: 'gstin',
      Website: 'website',
      Address: 'address',
      Area: 'area',
      Zone: 'zone',
      Employees: 'employees',
      Status: 'status',
      Remarks: 'remarks',
      Industry: 'industry'
    };

    if (specialNames[header]) {
      return specialNames[header];
    }

    return header
      .replace(/[^A-Za-z0-9]+(.)/g, function (_, character) {
        return character.toUpperCase();
      })
      .replace(/^[A-Z]/, function (character) {
        return character.toLowerCase();
      });
  }

  _serializeRecord(record) {
    var repository = this;
    var serializable = {};

    Object.keys(record).forEach(function (key) {
      var value = record[key];

      if (value instanceof Date) {
        serializable[key] =
          repository._formatDateForApi(value);
      } else {
        serializable[key] = value;
      }
    });

    return JSON.stringify(serializable);
  }

  _writeAuditLog(entry) {
    var auditSheet = this.spreadsheet.getSheetByName(
      JSK_COMPANY_CONFIG.AUDIT_SHEET_NAME
    );

    if (!auditSheet) {
      auditSheet = this.spreadsheet.insertSheet(
        JSK_COMPANY_CONFIG.AUDIT_SHEET_NAME
      );

      auditSheet
        .getRange(1, 1, 1, 8)
        .setValues([
          [
            'Audit ID',
            'Timestamp',
            'Entity Type',
            'Entity ID',
            'Action',
            'Actor',
            'Before Data',
            'After Data'
          ]
        ]);

      auditSheet.setFrozenRows(1);
    }

    auditSheet.appendRow([
      'AUD-' + Utilities.getUuid().toUpperCase(),
      new Date(),
      'Company',
      entry.entityId,
      entry.action,
      entry.actor,
      entry.beforeData || '',
      entry.afterData || ''
    ]);
  }

  _normalizeActor(actor) {
    var explicitActor = this._normalizeText(actor);

    if (explicitActor) {
      return explicitActor;
    }

    var activeEmail = '';

    try {
      activeEmail = Session.getActiveUser().getEmail();
    } catch (error) {
      activeEmail = '';
    }

    return activeEmail || 'SYSTEM';
  }

  _normalizeText(value) {
    if (value === null || value === undefined) {
      return '';
    }

    return String(value).trim();
  }

  _normalizeEmployeeCount(value) {
    var employeeCount = Number(value);

    if (
      !Number.isFinite(employeeCount) ||
      !Number.isInteger(employeeCount) ||
      employeeCount < 0
    ) {
      return value;
    }

    return employeeCount;
  }

  _normalizeUrl(value) {
    var url = this._normalizeText(value);

    if (!url) {
      return '';
    }

    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }

    return url;
  }

  _isValidUrl(value) {
    return /^https?:\/\/[^\s]+$/i.test(
      this._normalizeText(value)
    );
  }

  _normalizeDate(value, fieldName) {
    var date = this._toDate(value);

    if (!date) {
      throw new CompanyValidationError([
        {
          field: this._headerToCamelCase(fieldName),
          message: fieldName + ' is not a valid date.'
        }
      ]);
    }

    return date;
  }

  _toDate(value) {
    if (!value) {
      return null;
    }

    if (value instanceof Date && !isNaN(value.getTime())) {
      return value;
    }

    var parsedDate = new Date(value);

    return isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  _formatDateForApi(value) {
    var date = this._toDate(value);

    return date ? date.toISOString() : null;
  }

  _toBoolean(value) {
    if (value === true || value === false) {
      return value;
    }

    var normalized = this
      ._normalizeText(value)
      .toLowerCase();

    return (
      normalized === 'true' ||
      normalized === 'yes' ||
      normalized === '1'
    );
  }
}


class CompanyValidationError extends Error {
  constructor(errors) {
    super('Company validation failed.');
    this.name = 'CompanyValidationError';
    this.code = 'VALIDATION_ERROR';
    this.status = 400;
    this.errors = errors || [];
  }
}


class CompanyNotFoundError extends Error {
  constructor(companyId) {
    super('Company not found: ' + companyId);
    this.name = 'CompanyNotFoundError';
    this.code = 'COMPANY_NOT_FOUND';
    this.status = 404;
    this.companyId = companyId;
  }
}


class CompanyDuplicateError extends Error {
  constructor(message, duplicateCompanyId) {
    super(message);
    this.name = 'CompanyDuplicateError';
    this.code = 'DUPLICATE_COMPANY';
    this.status = 409;
    this.duplicateCompanyId = duplicateCompanyId;
  }
}


class CompanyConflictError extends Error {
  constructor(message, currentVersion) {
    super(message);
    this.name = 'CompanyConflictError';
    this.code = 'VERSION_CONFLICT';
    this.status = 409;
    this.currentVersion = currentVersion;
  }
}
}
