/**
 * JSK OS
 * Module: People Repository
 * Version: 0.9.0-alpha
 *
 * Repository layer for the existing People sheet.
 * Storage: Google Sheets
 * Runtime: Google Apps Script V8
 *
 * Existing sheet schema:
 * Person_ID, Full_Name, Mobile, WhatsApp, Email, DOB, Occupation,
 * Designation, Company_ID, Family_ID, Area, Zone, Lead_Source,
 * Status, Priority, Last_Contact, Next_Followup, Notes,
 * Created_At, Updated_At
 */

var JSK_PEOPLE_CONFIG = Object.freeze({
  SHEET_NAME: 'People',
  AUDIT_SHEET_NAME: 'Audit_Log',
  HEADER_SCAN_LIMIT: 10,
  ID_PREFIX: 'P',
  LOCK_TIMEOUT_MS: 30000,
  DEFAULT_PAGE_SIZE: 25,
  MAX_PAGE_SIZE: 100,

  REQUIRED_HEADERS: Object.freeze([
    'Person_ID',
    'Full_Name',
    'Mobile',
    'WhatsApp',
    'Email',
    'DOB',
    'Occupation',
    'Designation',
    'Company_ID',
    'Family_ID',
    'Area',
    'Zone',
    'Lead_Source',
    'Status',
    'Priority',
    'Last_Contact',
    'Next_Followup',
    'Notes',
    'Created_At',
    'Updated_At'
  ]),

  SEARCHABLE_HEADERS: Object.freeze([
    'Person_ID',
    'Full_Name',
    'Mobile',
    'WhatsApp',
    'Email',
    'Occupation',
    'Designation',
    'Company_ID',
    'Family_ID',
    'Area',
    'Zone',
    'Lead_Source',
    'Status',
    'Priority',
    'Notes'
  ])
});

/**
 * Repository for People CRM records.
 */
class PeopleRepository {
  /**
   * @param {GoogleAppsScript.Spreadsheet.Spreadsheet=} spreadsheet Spreadsheet.
   */
  constructor(spreadsheet) {
    this.spreadsheet =
      spreadsheet ||
      (
        typeof JSKOS !== 'undefined' &&
        JSKOS.ConfigService &&
        typeof JSKOS.ConfigService.getSpreadsheet === 'function'
          ? JSKOS.ConfigService.getSpreadsheet()
          : SpreadsheetApp.getActiveSpreadsheet()
      );

    if (!this.spreadsheet) {
      throw new Error('JSK OS spreadsheet is not available.');
    }

    this.sheet = this.spreadsheet.getSheetByName(
      JSK_PEOPLE_CONFIG.SHEET_NAME
    );

    if (!this.sheet) {
      throw new Error(
        'People sheet was not found.'
      );
    }

    this.headerRow = this._findHeaderRow();
    this.headers = this._readHeaders();
    this.headerMap = this._createHeaderMap(this.headers);

    this._validateSchema();
  }

  /**
   * Creates a person record.
   *
   * @param {Object} person Person payload.
   * @param {string=} actor Actor name or email.
   * @return {Object} Created person.
   */
  create(person, actor) {
    var repository = this;
    var lock = LockService.getDocumentLock();

    lock.waitLock(JSK_PEOPLE_CONFIG.LOCK_TIMEOUT_MS);

    try {
      repository._refreshSchema();

      var normalized = repository._normalizePerson(person);
      var errors = repository._validate(normalized, false);

      if (errors.length > 0) {
        throw new PeopleValidationError(errors);
      }

      repository._assertNoDuplicate(normalized, null);

      var now = new Date();
      var record = repository._createEmptyRecord();

      repository._applyMutableFields(record, normalized);

      record.Person_ID = repository._generatePersonId();
      record.Created_At = now;
      record.Updated_At = now;

      if (!record.Status) {
        record.Status = 'Prospect';
      }

      var rowNumber = repository.sheet.getLastRow() + 1;

      repository.sheet
        .getRange(
          rowNumber,
          1,
          1,
          repository.headers.length
        )
        .setValues([
          repository._recordToRow(record)
        ]);

      SpreadsheetApp.flush();

      repository._writeAuditLog({
        action: 'CREATE',
        entityId: record.Person_ID,
        actor: repository._normalizeActor(actor),
        beforeData: '',
        afterData: repository._serializeRecord(record)
      });

      return repository.findById(record.Person_ID);
    } finally {
      lock.releaseLock();
    }
  }

  /**
   * Finds a person by Person_ID.
   *
   * @param {string} personId Person ID.
   * @return {Object|null} Person or null.
   */
  findById(personId) {
    var normalizedId = this
      ._normalizeText(personId)
      .toUpperCase();

    if (!normalizedId) {
      throw new Error('Person ID is required.');
    }

    var rowNumber = this._findRowNumberById(normalizedId);

    if (!rowNumber) {
      return null;
    }

    return this._formatRecord(
      this._readRecordAtRow(rowNumber),
      rowNumber
    );
  }

  /**
   * Updates an existing person.
   *
   * @param {string} personId Person ID.
   * @param {Object} changes Updated fields.
   * @param {string=} actor Actor name or email.
   * @return {Object} Updated person.
   */
  update(personId, changes, actor) {
    var repository = this;
    var lock = LockService.getDocumentLock();

    lock.waitLock(JSK_PEOPLE_CONFIG.LOCK_TIMEOUT_MS);

    try {
      repository._refreshSchema();

      var normalizedId = repository
        ._normalizeText(personId)
        .toUpperCase();

      if (!normalizedId) {
        throw new Error('Person ID is required.');
      }

      var rowNumber =
        repository._findRowNumberById(normalizedId);

      if (!rowNumber) {
        throw new PeopleNotFoundError(normalizedId);
      }

      var existing =
        repository._readRecordAtRow(rowNumber);

      var normalizedChanges =
        repository._normalizePerson(changes);

      var updated = Object.assign({}, existing);

      repository._applyMutableFields(
        updated,
        normalizedChanges
      );

      updated.Person_ID = normalizedId;
      updated.Created_At = existing.Created_At;
      updated.Updated_At = new Date();

      var errors = repository._validate(
        updated,
        true
      );

      if (errors.length > 0) {
        throw new PeopleValidationError(errors);
      }

      repository._assertNoDuplicate(
        updated,
        normalizedId
      );

      repository.sheet
        .getRange(
          rowNumber,
          1,
          1,
          repository.headers.length
        )
        .setValues([
          repository._recordToRow(updated)
        ]);

      SpreadsheetApp.flush();

      repository._writeAuditLog({
        action: 'UPDATE',
        entityId: normalizedId,
        actor: repository._normalizeActor(actor),
        beforeData:
          repository._serializeRecord(existing),
        afterData:
          repository._serializeRecord(updated)
      });

      return repository.findById(normalizedId);
    } finally {
      lock.releaseLock();
    }
  }

  /**
   * Archives a person by setting Status to Archived.
   *
   * @param {string} personId Person ID.
   * @param {string=} actor Actor name or email.
   * @return {Object} Archived person.
   */
  archive(personId, actor) {
    return this._setStatus(
      personId,
      'Archived',
      'ARCHIVE',
      actor
    );
  }

  /**
   * Restores an archived person by setting Status to Active.
   *
   * @param {string} personId Person ID.
   * @param {string=} actor Actor name or email.
   * @return {Object} Restored person.
   */
  restore(personId, actor) {
    return this._setStatus(
      personId,
      'Active',
      'RESTORE',
      actor
    );
  }

  /**
   * Searches People records.
   *
   * Supported criteria:
   * query, companyId, familyId, area, zone, leadSource,
   * status, priority, designation, page, pageSize,
   * includeArchived.
   *
   * @param {Object=} criteria Search criteria.
   * @return {Object} Search result with pagination.
   */
  search(criteria) {
    criteria = criteria || {};

    var page = Math.max(
      1,
      Number(criteria.page) || 1
    );

    var pageSize = Math.min(
      JSK_PEOPLE_CONFIG.MAX_PAGE_SIZE,
      Math.max(
        1,
        Number(criteria.pageSize) ||
          JSK_PEOPLE_CONFIG.DEFAULT_PAGE_SIZE
      )
    );

    var query = this
      ._normalizeText(criteria.query)
      .toLowerCase();

    var companyId = this
      ._normalizeText(criteria.companyId)
      .toLowerCase();

    var familyId = this
      ._normalizeText(criteria.familyId)
      .toLowerCase();

    var area = this
      ._normalizeText(criteria.area)
      .toLowerCase();

    var zone = this
      ._normalizeText(criteria.zone)
      .toLowerCase();

    var leadSource = this
      ._normalizeText(criteria.leadSource)
      .toLowerCase();

    var status = this
      ._normalizeText(criteria.status)
      .toLowerCase();

    var priority = this
      ._normalizeText(criteria.priority)
      .toLowerCase();

    var designation = this
      ._normalizeText(criteria.designation)
      .toLowerCase();

    var includeArchived =
      Boolean(criteria.includeArchived);

    var lastRow = this.sheet.getLastRow();

    if (lastRow <= this.headerRow) {
      return this._emptySearchResult(
        page,
        pageSize
      );
    }

    var values = this.sheet
      .getRange(
        this.headerRow + 1,
        1,
        lastRow - this.headerRow,
        this.headers.length
      )
      .getValues();

    var repository = this;

    var matched = values
      .map(function (row, index) {
        return {
          record: repository._rowToRecord(row),
          rowNumber:
            repository.headerRow + index + 1
        };
      })
      .filter(function (entry) {
        var record = entry.record;

        if (!record.Person_ID) {
          return false;
        }

        if (
          !includeArchived &&
          repository
            ._normalizeText(record.Status)
            .toLowerCase() === 'archived'
        ) {
          return false;
        }

        if (
          companyId &&
          repository
            ._normalizeText(record.Company_ID)
            .toLowerCase() !== companyId
        ) {
          return false;
        }

        if (
          familyId &&
          repository
            ._normalizeText(record.Family_ID)
            .toLowerCase() !== familyId
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
          leadSource &&
          repository
            ._normalizeText(record.Lead_Source)
            .toLowerCase() !== leadSource
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
          priority &&
          repository
            ._normalizeText(record.Priority)
            .toLowerCase() !== priority
        ) {
          return false;
        }

        if (
          designation &&
          repository
            ._normalizeText(record.Designation)
            .toLowerCase() !== designation
        ) {
          return false;
        }

        if (!query) {
          return true;
        }

        return JSK_PEOPLE_CONFIG
          .SEARCHABLE_HEADERS
          .some(function (header) {
            return repository
              ._normalizeText(record[header])
              .toLowerCase()
              .includes(query);
          });
      });

    matched.sort(function (left, right) {
      var leftDate =
        repository._toDate(
          left.record.Updated_At
        ) || new Date(0);

      var rightDate =
        repository._toDate(
          right.record.Updated_At
        ) || new Date(0);

      return rightDate.getTime() -
        leftDate.getTime();
    });

    var totalItems = matched.length;
    var totalPages =
      totalItems === 0
        ? 0
        : Math.ceil(totalItems / pageSize);

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

  /**
   * Counts matching People records.
   *
   * @param {Object=} criteria Search criteria.
   * @return {number} Count.
   */
  count(criteria) {
    criteria = criteria || {};

    return this.search(
      Object.assign({}, criteria, {
        page: 1,
        pageSize: 1
      })
    ).pagination.totalItems;
  }

  /**
   * Returns all people for a company.
   *
   * @param {string} companyId Company ID.
   * @param {boolean=} includeArchived Include archived records.
   * @return {Object[]} People.
   */
  findByCompanyId(companyId, includeArchived) {
    return this.search({
      companyId: companyId,
      includeArchived: Boolean(includeArchived),
      page: 1,
      pageSize: JSK_PEOPLE_CONFIG.MAX_PAGE_SIZE
    }).items;
  }

  /**
   * Returns people whose next follow-up is due on or before a date.
   *
   * @param {Date|string=} dueDate Due date, defaults to today.
   * @return {Object[]} Due people.
   */
  findFollowupsDue(dueDate) {
    var targetDate = this._toDate(dueDate) || new Date();

    targetDate.setHours(23, 59, 59, 999);

    var result = this.search({
      includeArchived: false,
      page: 1,
      pageSize: JSK_PEOPLE_CONFIG.MAX_PAGE_SIZE
    });

    return result.items.filter(function (person) {
      if (!person.nextFollowup) {
        return false;
      }

      var followupDate =
        new Date(person.nextFollowup);

      return (
        !isNaN(followupDate.getTime()) &&
        followupDate.getTime() <=
          targetDate.getTime()
      );
    });
  }

  /**
   * Updates status and records an audit entry.
   *
   * @private
   * @param {string} personId Person ID.
   * @param {string} status Status.
   * @param {string} action Audit action.
   * @param {string=} actor Actor.
   * @return {Object} Updated person.
   */
  _setStatus(personId, status, action, actor) {
    var repository = this;
    var lock = LockService.getDocumentLock();

    lock.waitLock(JSK_PEOPLE_CONFIG.LOCK_TIMEOUT_MS);

    try {
      repository._refreshSchema();

      var normalizedId = repository
        ._normalizeText(personId)
        .toUpperCase();

      var rowNumber =
        repository._findRowNumberById(normalizedId);

      if (!rowNumber) {
        throw new PeopleNotFoundError(normalizedId);
      }

      var existing =
        repository._readRecordAtRow(rowNumber);

      var updated = Object.assign({}, existing);

      updated.Status = status;
      updated.Updated_At = new Date();

      repository.sheet
        .getRange(
          rowNumber,
          1,
          1,
          repository.headers.length
        )
        .setValues([
          repository._recordToRow(updated)
        ]);

      SpreadsheetApp.flush();

      repository._writeAuditLog({
        action: action,
        entityId: normalizedId,
        actor: repository._normalizeActor(actor),
        beforeData:
          repository._serializeRecord(existing),
        afterData:
          repository._serializeRecord(updated)
      });

      return repository.findById(normalizedId);
    } finally {
      lock.releaseLock();
    }
  }

  /**
   * Refreshes schema metadata.
   *
   * @private
   * @return {void}
   */
  _refreshSchema() {
    this.headerRow = this._findHeaderRow();
    this.headers = this._readHeaders();
    this.headerMap =
      this._createHeaderMap(this.headers);

    this._validateSchema();
  }

  /**
   * Finds the People header row.
   *
   * @private
   * @return {number}
   */
  _findHeaderRow() {
    var rowCount = Math.min(
      Math.max(this.sheet.getLastRow(), 1),
      JSK_PEOPLE_CONFIG.HEADER_SCAN_LIMIT
    );

    var columnCount = Math.max(
      this.sheet.getLastColumn(),
      JSK_PEOPLE_CONFIG.REQUIRED_HEADERS.length
    );

    var values = this.sheet
      .getRange(
        1,
        1,
        rowCount,
        columnCount
      )
      .getDisplayValues();

    for (
      var rowIndex = 0;
      rowIndex < values.length;
      rowIndex++
    ) {
      var normalized =
        values[rowIndex].map(function (value) {
          return String(value || '')
            .trim()
            .toLowerCase();
        });

      if (
        normalized.indexOf('person_id') !== -1 &&
        normalized.indexOf('full_name') !== -1
      ) {
        return rowIndex + 1;
      }
    }

    throw new Error(
      'People header row was not found.'
    );
  }

  /**
   * Reads headers.
   *
   * @private
   * @return {string[]}
   */
  _readHeaders() {
    var lastColumn = this.sheet.getLastColumn();

    if (lastColumn < 1) {
      return [];
    }

    return this.sheet
      .getRange(
        this.headerRow,
        1,
        1,
        lastColumn
      )
      .getDisplayValues()[0]
      .map(function (header) {
        return String(header || '').trim();
      });
  }

  /**
   * Creates a header-to-column map.
   *
   * @private
   * @param {string[]} headers Headers.
   * @return {Object}
   */
  _createHeaderMap(headers) {
    return headers.reduce(function (
      map,
      header,
      index
    ) {
      if (header) {
        map[header] = index;
      }

      return map;
    }, {});
  }

  /**
   * Validates required headers.
   *
   * @private
   * @return {void}
   */
  _validateSchema() {
    var missing =
      JSK_PEOPLE_CONFIG.REQUIRED_HEADERS.filter(
        function (header) {
          return this.headerMap[header] ===
            undefined;
        },
        this
      );

    if (missing.length > 0) {
      throw new Error(
        'People schema is missing columns: ' +
          missing.join(', ')
      );
    }
  }

  /**
   * Finds row number by Person_ID.
   *
   * @private
   * @param {string} personId Person ID.
   * @return {number|null}
   */
  _findRowNumberById(personId) {
    var lastRow = this.sheet.getLastRow();

    if (lastRow <= this.headerRow) {
      return null;
    }

    var personIdColumn =
      this.headerMap.Person_ID + 1;

    var values = this.sheet
      .getRange(
        this.headerRow + 1,
        personIdColumn,
        lastRow - this.headerRow,
        1
      )
      .getDisplayValues();

    for (
      var index = 0;
      index < values.length;
      index++
    ) {
      if (
        this
          ._normalizeText(values[index][0])
          .toUpperCase() === personId
      ) {
        return this.headerRow + index + 1;
      }
    }

    return null;
  }

  /**
   * Reads a record from a row.
   *
   * @private
   * @param {number} rowNumber Row number.
   * @return {Object}
   */
  _readRecordAtRow(rowNumber) {
    return this._rowToRecord(
      this.sheet
        .getRange(
          rowNumber,
          1,
          1,
          this.headers.length
        )
        .getValues()[0]
    );
  }

  /**
   * Converts row values into a record.
   *
   * @private
   * @param {Array<*>} row Row.
   * @return {Object}
   */
  _rowToRecord(row) {
    var record = {};

    this.headers.forEach(function (
      header,
      index
    ) {
      if (header) {
        record[header] = row[index];
      }
    });

    return record;
  }

  /**
   * Converts a record into row values.
   *
   * @private
   * @param {Object} record Record.
   * @return {Array<*>}
   */
  _recordToRow(record) {
    return this.headers.map(function (header) {
      return header ? record[header] : '';
    });
  }

  /**
   * Creates an empty record.
   *
   * @private
   * @return {Object}
   */
  _createEmptyRecord() {
    return this.headers.reduce(function (
      record,
      header
    ) {
      if (header) {
        record[header] = '';
      }

      return record;
    }, {});
  }

  /**
   * Applies mutable fields.
   *
   * @private
   * @param {Object} target Target record.
   * @param {Object} source Normalized fields.
   * @return {void}
   */
  _applyMutableFields(target, source) {
    var protectedFields = {
      Person_ID: true,
      Created_At: true,
      Updated_At: true
    };

    Object.keys(source || {}).forEach(
      function (header) {
        if (
          this.headerMap[header] !== undefined &&
          !protectedFields[header]
        ) {
          target[header] = source[header];
        }
      }.bind(this)
    );
  }

  /**
   * Normalizes API payload into sheet headers.
   *
   * @private
   * @param {Object} person Person payload.
   * @return {Object}
   */
  _normalizePerson(person) {
    if (!person || typeof person !== 'object') {
      throw new Error(
        'Person payload must be an object.'
      );
    }

    var aliases = {
      personId: 'Person_ID',
      fullName: 'Full_Name',
      mobile: 'Mobile',
      whatsApp: 'WhatsApp',
      whatsapp: 'WhatsApp',
      email: 'Email',
      dob: 'DOB',
      occupation: 'Occupation',
      designation: 'Designation',
      companyId: 'Company_ID',
      familyId: 'Family_ID',
      area: 'Area',
      zone: 'Zone',
      leadSource: 'Lead_Source',
      status: 'Status',
      priority: 'Priority',
      lastContact: 'Last_Contact',
      nextFollowup: 'Next_Followup',
      notes: 'Notes',
      createdAt: 'Created_At',
      updatedAt: 'Updated_At'
    };

    var normalized = {};
    var repository = this;

    Object.keys(person).forEach(function (key) {
      var header = aliases[key] || key;

      if (
        repository.headerMap[header] === undefined
      ) {
        return;
      }

      var value = person[key];

      if (
        header === 'DOB' ||
        header === 'Last_Contact' ||
        header === 'Next_Followup'
      ) {
        normalized[header] =
          value === '' ||
          value === null ||
          value === undefined
            ? ''
            : repository._normalizeDate(
                value,
                header
              );

        return;
      }

      if (
        header === 'Mobile' ||
        header === 'WhatsApp'
      ) {
        normalized[header] =
          repository._normalizePhone(value);

        return;
      }

      if (header === 'Email') {
        normalized[header] =
          repository
            ._normalizeText(value)
            .toLowerCase();

        return;
      }

      normalized[header] =
        repository._normalizeText(value);
    });

    return normalized;
  }

  /**
   * Validates a normalized record.
   *
   * @private
   * @param {Object} person Person record.
   * @param {boolean} isUpdate Whether update.
   * @return {Object[]} Validation errors.
   */
  _validate(person, isUpdate) {
    var errors = [];

    if (!this._normalizeText(person.Full_Name)) {
      errors.push({
        field: 'fullName',
        message: 'Full Name is required.'
      });
    }

    if (!this._normalizeText(person.Mobile)) {
      errors.push({
        field: 'mobile',
        message: 'Mobile is required.'
      });
    } else if (
      !/^[6-9][0-9]{9}$/.test(
        this._normalizeText(person.Mobile)
      )
    ) {
      errors.push({
        field: 'mobile',
        message:
          'Mobile must be a valid 10-digit Indian number.'
      });
    }

    if (
      person.WhatsApp &&
      !/^[6-9][0-9]{9}$/.test(
        this._normalizeText(person.WhatsApp)
      )
    ) {
      errors.push({
        field: 'whatsApp',
        message:
          'WhatsApp must be a valid 10-digit Indian number.'
      });
    }

    if (
      person.Email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        this._normalizeText(person.Email)
      )
    ) {
      errors.push({
        field: 'email',
        message: 'Email address is invalid.'
      });
    }

    if (
      isUpdate &&
      !this._normalizeText(person.Person_ID)
    ) {
      errors.push({
        field: 'personId',
        message: 'Person ID is required.'
      });
    }

    return errors;
  }

  /**
   * Prevents duplicate active records by mobile or email.
   *
   * @private
   * @param {Object} person Person record.
   * @param {string|null} excludedPersonId Excluded ID.
   * @return {void}
   */
  _assertNoDuplicate(
    person,
    excludedPersonId
  ) {
    var lastRow = this.sheet.getLastRow();

    if (lastRow <= this.headerRow) {
      return;
    }

    var mobile = this._normalizeText(
      person.Mobile
    );

    var email = this
      ._normalizeText(person.Email)
      .toLowerCase();

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
      var record =
        repository._rowToRecord(row);

      var recordId = repository
        ._normalizeText(record.Person_ID)
        .toUpperCase();

      if (
        !recordId ||
        recordId === excludedPersonId
      ) {
        return;
      }

      if (
        repository
          ._normalizeText(record.Status)
          .toLowerCase() === 'archived'
      ) {
        return;
      }

      var existingMobile =
        repository._normalizeText(
          record.Mobile
        );

      var existingEmail =
        repository
          ._normalizeText(record.Email)
          .toLowerCase();

      if (
        mobile &&
        existingMobile &&
        mobile === existingMobile
      ) {
        throw new PeopleDuplicateError(
          'A person with mobile ' +
            mobile +
            ' already exists.',
          recordId
        );
      }

      if (
        email &&
        existingEmail &&
        email === existingEmail
      ) {
        throw new PeopleDuplicateError(
          'A person with email ' +
            email +
            ' already exists.',
          recordId
        );
      }
    });
  }

  /**
   * Generates a unique Person_ID.
   *
   * @private
   * @return {string}
   */
  _generatePersonId() {
    var lastRow = this.sheet.getLastRow();
    var maxSequence = 0;

    if (lastRow > this.headerRow) {
      var personIdColumn =
        this.headerMap.Person_ID + 1;

      var values = this.sheet
        .getRange(
          this.headerRow + 1,
          personIdColumn,
          lastRow - this.headerRow,
          1
        )
        .getDisplayValues();

      values.forEach(function (row) {
        var match = String(row[0] || '')
          .trim()
          .toUpperCase()
          .match(/^P(\d+)$/);

        if (match) {
          maxSequence = Math.max(
            maxSequence,
            Number(match[1]) || 0
          );
        }
      });
    }

    var personId =
      JSK_PEOPLE_CONFIG.ID_PREFIX +
      String(maxSequence + 1)
        .padStart(6, '0');

    if (this._findRowNumberById(personId)) {
      return (
        JSK_PEOPLE_CONFIG.ID_PREFIX +
        Utilities
          .getUuid()
          .replace(/-/g, '')
          .substring(0, 10)
          .toUpperCase()
      );
    }

    return personId;
  }

  /**
   * Formats a sheet record for API consumers.
   *
   * @private
   * @param {Object} record Sheet record.
   * @param {number} rowNumber Row number.
   * @return {Object}
   */
  _formatRecord(record, rowNumber) {
    var formatted = {};

    this.headers.forEach(
      function (header) {
        if (!header) {
          return;
        }

        var key =
          this._headerToApiKey(header);

        var value = record[header];

        if (
          header === 'DOB' ||
          header === 'Last_Contact' ||
          header === 'Next_Followup' ||
          header === 'Created_At' ||
          header === 'Updated_At'
        ) {
          formatted[key] =
            this._formatDateForApi(value);
        } else {
          formatted[key] =
            value === null ||
            value === undefined
              ? ''
              : String(value);
        }
      }.bind(this)
    );

    formatted._rowNumber = rowNumber;

    return formatted;
  }

  /**
   * Converts sheet header into stable API key.
   *
   * @private
   * @param {string} header Sheet header.
   * @return {string}
   */
  _headerToApiKey(header) {
    var mappings = {
      Person_ID: 'personId',
      Full_Name: 'fullName',
      Mobile: 'mobile',
      WhatsApp: 'whatsApp',
      Email: 'email',
      DOB: 'dob',
      Occupation: 'occupation',
      Designation: 'designation',
      Company_ID: 'companyId',
      Family_ID: 'familyId',
      Area: 'area',
      Zone: 'zone',
      Lead_Source: 'leadSource',
      Status: 'status',
      Priority: 'priority',
      Last_Contact: 'lastContact',
      Next_Followup: 'nextFollowup',
      Notes: 'notes',
      Created_At: 'createdAt',
      Updated_At: 'updatedAt'
    };

    return mappings[header] || header;
  }

  /**
   * Normalizes phone numbers.
   *
   * @private
   * @param {*} value Phone.
   * @return {string}
   */
  _normalizePhone(value) {
    var digits = this
      ._normalizeText(value)
      .replace(/\D+/g, '');

    if (
      digits.length === 12 &&
      digits.indexOf('91') === 0
    ) {
      digits = digits.substring(2);
    }

    if (
      digits.length === 11 &&
      digits.indexOf('0') === 0
    ) {
      digits = digits.substring(1);
    }

    return digits;
  }

  /**
   * Normalizes a date value.
   *
   * @private
   * @param {*} value Date value.
   * @param {string} fieldName Field name.
   * @return {Date}
   */
  _normalizeDate(value, fieldName) {
    var date = this._toDate(value);

    if (!date) {
      throw new PeopleValidationError([
        {
          field:
            this._headerToApiKey(fieldName),
          message:
            fieldName + ' is not a valid date.'
        }
      ]);
    }

    return date;
  }

  /**
   * Converts value to Date.
   *
   * @private
   * @param {*} value Value.
   * @return {Date|null}
   */
  _toDate(value) {
    if (!value) {
      return null;
    }

    if (
      value instanceof Date &&
      !isNaN(value.getTime())
    ) {
      return value;
    }

    var parsed = new Date(value);

    return isNaN(parsed.getTime())
      ? null
      : parsed;
  }

  /**
   * Formats date for API.
   *
   * @private
   * @param {*} value Value.
   * @return {string|null}
   */
  _formatDateForApi(value) {
    var date = this._toDate(value);

    return date
      ? date.toISOString()
      : null;
  }

  /**
   * Normalizes text.
   *
   * @private
   * @param {*} value Value.
   * @return {string}
   */
  _normalizeText(value) {
    return value === null ||
      value === undefined
      ? ''
      : String(value).trim();
  }

  /**
   * Serializes a record for audit logging.
   *
   * @private
   * @param {Object} record Record.
   * @return {string}
   */
  _serializeRecord(record) {
    var repository = this;
    var serializable = {};

    Object.keys(record).forEach(function (key) {
      var value = record[key];

      serializable[key] =
        value instanceof Date
          ? repository._formatDateForApi(value)
          : value;
    });

    return JSON.stringify(serializable);
  }

  /**
   * Writes an audit record.
   *
   * @private
   * @param {Object} entry Audit entry.
   * @return {void}
   */
  _writeAuditLog(entry) {
    var auditSheet =
      this.spreadsheet.getSheetByName(
        JSK_PEOPLE_CONFIG.AUDIT_SHEET_NAME
      );

    if (!auditSheet) {
      auditSheet =
        this.spreadsheet.insertSheet(
          JSK_PEOPLE_CONFIG.AUDIT_SHEET_NAME
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
      'AUD-' +
        Utilities.getUuid().toUpperCase(),
      new Date(),
      'Person',
      entry.entityId,
      entry.action,
      entry.actor,
      entry.beforeData || '',
      entry.afterData || ''
    ]);
  }

  /**
   * Resolves actor.
   *
   * @private
   * @param {string=} actor Actor.
   * @return {string}
   */
  _normalizeActor(actor) {
    var explicit =
      this._normalizeText(actor);

    if (explicit) {
      return explicit;
    }

    try {
      return (
        Session
          .getActiveUser()
          .getEmail() ||
        'SYSTEM'
      );
    } catch (error) {
      return 'SYSTEM';
    }
  }

  /**
   * Returns empty search result.
   *
   * @private
   * @param {number} page Page.
   * @param {number} pageSize Page size.
   * @return {Object}
   */
  _emptySearchResult(page, pageSize) {
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
}

/**
 * Validation error for People records.
 */
class PeopleValidationError extends Error {
  /**
   * @param {Object[]} errors Field errors.
   */
  constructor(errors) {
    super('People validation failed.');
    this.name = 'PeopleValidationError';
    this.code = 'VALIDATION_ERROR';
    this.status = 400;
    this.errors = errors || [];
  }
}

/**
 * Not-found error for People records.
 */
class PeopleNotFoundError extends Error {
  /**
   * @param {string} personId Person ID.
   */
  constructor(personId) {
    super('Person not found: ' + personId);
    this.name = 'PeopleNotFoundError';
    this.code = 'PERSON_NOT_FOUND';
    this.status = 404;
    this.personId = personId;
  }
}

/**
 * Duplicate error for People records.
 */
class PeopleDuplicateError extends Error {
  /**
   * @param {string} message Error message.
   * @param {string} duplicatePersonId Duplicate ID.
   */
  constructor(message, duplicatePersonId) {
    super(message);
    this.name = 'PeopleDuplicateError';
    this.code = 'DUPLICATE_PERSON';
    this.status = 409;
    this.duplicatePersonId =
      duplicatePersonId;
  }
}

/**
 * Runs core repository tests without modifying existing data.
 *
 * @return {Object} Test result.
 */
function testPeopleRepositoryReadOnly() {
  var repository = new PeopleRepository();

  var searchResult = repository.search({
    page: 1,
    pageSize: 10,
    includeArchived: true
  });

  if (!searchResult.pagination) {
    throw new Error(
      'People Repository Test Failed: pagination missing.'
    );
  }

  if (!Array.isArray(searchResult.items)) {
    throw new Error(
      'People Repository Test Failed: items must be an array.'
    );
  }

  var result = {
    success: true,
    message:
      'People repository read-only test passed.',
    totalItems:
      searchResult.pagination.totalItems,
    returnedItems:
      searchResult.items.length,
    timestamp: new Date().toISOString()
  };

  console.info(JSON.stringify(result));

  return result;
}
