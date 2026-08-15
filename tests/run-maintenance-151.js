'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
let passed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
  passed += 1;
}

function load(relativePath) {
  vm.runInThisContext(
    fs.readFileSync(path.join(root, relativePath), 'utf8'),
    { filename: relativePath }
  );
}

function fakeSheet(headers) {
  const rows = [headers.slice()];
  return {
    rows: rows,
    getLastColumn: function () { return headers.length; },
    getLastRow: function () { return rows.length; },
    appendRow: function (row) { rows.push(row.slice()); },
    getRange: function (row, column, rowCount, columnCount) {
      rowCount = rowCount || 1;
      columnCount = columnCount || 1;
      return {
        getDisplayValues: function () {
          return rows.slice(row - 1, row - 1 + rowCount).map(function (item) {
            return item.slice(column - 1, column - 1 + columnCount);
          });
        },
        getValues: function () {
          return rows.slice(row - 1, row - 1 + rowCount).map(function (item) {
            return item.slice(column - 1, column - 1 + columnCount);
          });
        },
        setValues: function (values) {
          values.forEach(function (value, index) {
            rows[row - 1 + index] = value.slice();
          });
          return this;
        },
        createTextFinder: function (value) {
          return {
            matchEntireCell: function () { return this; },
            matchCase: function () { return this; },
            findNext: function () {
              for (let index = 1; index < rows.length; index++) {
                if (String(rows[index][column - 1]) === String(value)) {
                  return { getRow: function () { return index + 1; } };
                }
              }
              return null;
            }
          };
        }
      };
    }
  };
}

function spreadsheetFor(name, sheet) {
  return { getSheetByName: function (requested) { return requested === name ? sheet : null; } };
}

global.JSKOS = { ConfigService: {}, AccessControl: {} };
let uuidCounter = 0;
global.Utilities = {
  formatDate: function () { return '20260815120000'; },
  getUuid: function () {
    uuidCounter += 1;
    return String(uuidCounter).padStart(6, '0') + '12-3456-7890-abcd-ef1234567890';
  }
};
global.LockService = {
  getScriptLock: function () {
    return { waitLock: function () {}, releaseLock: function () {} };
  }
};
global.SpreadsheetApp = { flush: function () {} };
global.Session = { getActiveUser: function () { return { getEmail: function () { return ''; } }; } };

const companyUi = fs.readFileSync(path.join(root, 'src/Ui/Company/CompanyScripts.html'), 'utf8');
const companySuccess = companyUi.slice(
  companyUi.indexOf("callServer(methodName, payload)"),
  companyUi.indexOf('.catch(function (error)', companyUi.indexOf("callServer(methodName, payload)"))
);
assert(
  companySuccess.indexOf('setSaveButtonLoading(false);') !== -1 &&
    companySuccess.indexOf('setSaveButtonLoading(false);') < companySuccess.indexOf('closeCompanyModal();'),
  'Company success path must re-enable controls before closing the modal.'
);
assert(
  companyUi.indexOf('setSaveButtonLoading(true);') < companyUi.indexOf("callServer(methodName, payload)"),
  'Company save must disable controls before submission.'
);
const companyFailure = companyUi.slice(
  companyUi.indexOf('.catch(function (error)', companyUi.indexOf("callServer(methodName, payload)")),
  companyUi.indexOf('.finally(function ()', companyUi.indexOf("callServer(methodName, payload)"))
);
assert(
  companyFailure.indexOf('displayFormError(error);') !== -1 && companyFailure.indexOf('closeCompanyModal') === -1,
  'Company failure path must keep the modal open and display the error.'
);

global.JSK_CLAIM_SCHEMA = {
  SHEET_NAME: 'Claims',
  TYPE_VALUES: ['Health'],
  STATUS_VALUES: ['Draft', 'Documents Pending', 'Settled'],
  PRIORITY_VALUES: ['Low', 'Medium']
};
global.ensureBuild1007Claims = function () {};
const claimHeaders = [
  'Claim ID', 'Policy ID', 'Company ID', 'Person ID', 'Claim Number', 'Claim Type',
  'Status', 'Priority', 'Claim Amount', 'Approved Amount', 'Settled Amount',
  'Description', 'Created At', 'Created By', 'Updated At', 'Updated By',
  'Record Version', 'Is Deleted'
];
const claimSheet = fakeSheet(claimHeaders);
const claimSpreadsheet = spreadsheetFor('Claims', claimSheet);
global.JSKOS.ConfigService.getSpreadsheet = function () { return claimSpreadsheet; };
load('src/claim/ClaimRepository.js');
load('src/claim/ClaimBackend.js');

const claims = new ClaimRepository(claimSpreadsheet);
const claimCreated = claims.create({
  policyId: 'POL-1', companyId: 'COM-1', personId: 'PER-1', claimNumber: 'CL-1',
  claimType: 'Health', status: 'Draft', priority: 'Medium', claimAmount: 5000,
  approvedAmount: 1000, settledAmount: 0, description: 'Original'
}, 'creator@example.com');
assert(claimCreated.claimId.indexOf('CLM-') === 0 && claimCreated.policyId === 'POL-1', 'Claim Create failed.');
const claimUpdated = claims.update(claimCreated.claimId, { description: 'Edited' }, 'editor@example.com', claimCreated.recordVersion);
assert(claimUpdated.description === 'Edited' && claimUpdated.claimId === claimCreated.claimId, 'Claim Edit changed identity or failed.');
const claimArchived = claims.remove(claimUpdated.claimId, 'archiver@example.com', claimUpdated.recordVersion);
assert(claimArchived.isDeleted && claimArchived.policyId === 'POL-1' && claimArchived.companyId === 'COM-1' && claimArchived.personId === 'PER-1', 'Claim Archive changed relationships.');
assert(claimSheet.rows.length === 2 && claims.search({}).totalItems === 0, 'Claim Archive duplicated a row or leaked into active search.');
assert(claims.search({ includeArchived: true }).items[0].claimId === claimCreated.claimId, 'Include Archived did not return the same Claim.');
const claimRestored = claims.restore(claimArchived.claimId, 'restorer@example.com', claimArchived.recordVersion);
assert(!claimRestored.isDeleted && claimRestored.claimId === claimCreated.claimId && claimRestored.policyId === 'POL-1', 'Claim Restore changed identity or relationship.');
assert(claimSheet.rows.length === 2 && claims.search({}).totalItems === 1, 'Claim Restore duplicated a row or failed active search.');

global.JSKOS.AccessControl.requireModuleOperation = function () { return { email: 'server@example.com' }; };
const claimApiCreated = apiClaimCreate({
  actor: 'spoofed@example.com',
  data: { policyId: 'POL-2', claimNumber: 'CL-2', claimType: 'Health', status: 'Draft', priority: 'Medium', claimAmount: '', approvedAmount: '', settledAmount: '' }
});
assert(claimApiCreated.success && claimApiCreated.data.createdBy === 'server@example.com', 'Claim API trusted browser actor identity: ' + JSON.stringify(claimApiCreated));
const claimCountBeforeInvalidActor = claimSheet.rows.length;
global.JSKOS.AccessControl.requireModuleOperation = function () { return { email: 'SYSTEM' }; };
const invalidClaimActor = apiClaimCreate({ data: { policyId: 'POL-3', claimType: 'Health', claimAmount: '', approvedAmount: '', settledAmount: '' } });
assert(!invalidClaimActor.success && claimSheet.rows.length === claimCountBeforeInvalidActor, 'Invalid Claim actor wrote a destination.');

const claimHtml = fs.readFileSync(path.join(root, 'src/Ui/Claim/Claim.html'), 'utf8');
const claimUi = fs.readFileSync(path.join(root, 'src/Ui/Claim/ClaimScripts.html'), 'utf8');
assert(claimHtml.indexOf('includeArchivedCheckbox') !== -1, 'Claim Include Archived control is missing.');
['apiClaimDelete', 'apiClaimRestore', 'data-action="archive"', 'data-action="restore"', "if(!archived){total++"].forEach(function (marker) {
  assert(claimUi.indexOf(marker) !== -1, 'Claim UI marker missing: ' + marker);
});
assert(claimUi.indexOf("actor:'JSK OS Claim UI'") === -1, 'Claim UI still supplies authoritative actor identity.');

global.JSK_ENDORSEMENT_SCHEMA = {
  SHEET_NAME: 'Endorsements',
  TYPE_VALUES: ['Correction'],
  STATUS_VALUES: ['Draft', 'Documents Pending', 'Ready to Submit', 'Submitted', 'Insurer Query', 'Approved', 'Rejected', 'Completed', 'Cancelled'],
  PRIORITY_VALUES: ['Low', 'Medium']
};
global.JSKOS.ClientContext = {
  normalize: function () { return { active: false }; },
  matches: function () { return true; }
};
global.ensureBuild1009Endorsements = function () {};
const endorsementHeaders = [
  'Endorsement ID', 'Request Number', 'Endorsement Type', 'Status', 'Priority',
  'Policy ID', 'Company ID', 'Person ID', 'Premium Impact', 'Refund Impact',
  'Description', 'Created At', 'Created By', 'Updated At', 'Updated By',
  'Record Version', 'Is Deleted'
];
const endorsementSheet = fakeSheet(endorsementHeaders);
const endorsementSpreadsheet = spreadsheetFor('Endorsements', endorsementSheet);
global.JSKOS.ConfigService.getSpreadsheet = function () { return endorsementSpreadsheet; };
load('src/endorsement/EndorsementRepository.js');
load('src/endorsement/EndorsementBackend.js');

const endorsements = new EndorsementRepository();
const endorsementCreated = endorsements.create({
  policyId: 'POL-9', companyId: 'COM-9', personId: 'PER-9', requestNumber: 'REQ-9',
  endorsementType: 'Correction', status: 'Draft', priority: 'Medium',
  premiumImpact: 125, refundImpact: 25, description: 'Original'
}, 'creator@example.com');
assert(endorsementCreated.endorsementId.indexOf('END-') === 0 && endorsementCreated.requestNumber === 'REQ-9', 'Endorsement Create failed.');
const endorsementUpdated = endorsements.update(endorsementCreated.endorsementId, { description: 'Edited', status: 'Documents Pending' }, 'editor@example.com', endorsementCreated.recordVersion);
assert(endorsementUpdated.description === 'Edited' && endorsementUpdated.status === 'Documents Pending' && endorsementUpdated.endorsementId === endorsementCreated.endorsementId, 'Endorsement Edit changed identity or failed.');
const endorsementArchived = endorsements.remove(endorsementUpdated.endorsementId, 'archiver@example.com', endorsementUpdated.recordVersion);
assert(endorsementArchived.isDeleted && endorsementArchived.policyId === 'POL-9' && endorsementArchived.requestNumber === 'REQ-9', 'Endorsement Archive changed identity or relationships.');
assert(endorsementArchived.premiumImpact === 125 && endorsementArchived.refundImpact === 25, 'Endorsement Archive changed financial fields.');
assert(endorsementArchived.status === 'Documents Pending', 'Endorsement Archive changed workflow status.');
assert(endorsementSheet.rows.length === 2 && endorsements.search({}).total === 0, 'Endorsement Archive duplicated a row or leaked into active search.');
assert(endorsements.search({ includeDeleted: true }).items[0].endorsementId === endorsementCreated.endorsementId, 'Endorsement Include Archived failed.');
const endorsementRestored = endorsements.restore(endorsementArchived.endorsementId, 'restorer@example.com', endorsementArchived.recordVersion);
assert(!endorsementRestored.isDeleted && endorsementRestored.endorsementId === endorsementCreated.endorsementId && endorsementRestored.requestNumber === 'REQ-9', 'Endorsement Restore changed identity.');
assert(endorsementRestored.policyId === 'POL-9' && endorsementRestored.premiumImpact === 125 && endorsementRestored.refundImpact === 25, 'Endorsement Restore changed relationships or financial fields.');
assert(endorsementRestored.status === 'Documents Pending', 'Endorsement Restore changed workflow status.');
assert(endorsementSheet.rows.length === 2 && endorsements.search({}).total === 1, 'Endorsement Restore duplicated a row or failed active search.');

global.JSKOS.AccessControl.requireModuleOperation = function () { return { email: 'server@example.com' }; };
const endorsementApiCreated = apiEndorsementCreate({
  actor: 'spoofed@example.com',
  data: { policyId: 'POL-10', requestNumber: 'REQ-10', endorsementType: 'Correction', status: 'Draft', priority: 'Medium' }
});
assert(endorsementApiCreated.success && endorsementApiCreated.data.createdBy === 'server@example.com', 'Endorsement API trusted browser actor identity.');
const endorsementCountBeforeInvalidActor = endorsementSheet.rows.length;
global.JSKOS.AccessControl.requireModuleOperation = function () { return { email: '' }; };
const invalidEndorsementActor = apiEndorsementCreate({ data: { policyId: 'POL-11', endorsementType: 'Correction' } });
assert(!invalidEndorsementActor.success && endorsementSheet.rows.length === endorsementCountBeforeInvalidActor, 'Invalid Endorsement actor wrote a destination.');

const endorsementHtml = fs.readFileSync(path.join(root, 'src/Ui/Endorsement/Endorsement.html'), 'utf8');
const endorsementUi = fs.readFileSync(path.join(root, 'src/Ui/Endorsement/EndorsementScripts.html'), 'utf8');
assert(endorsementHtml.indexOf('includeArchivedCheckbox') !== -1, 'Endorsement Include Archived control is missing.');
['apiEndorsementRestore', 'data-action="restore"', "if(x.isDeleted)return", "if(!archived){total++"].forEach(function (marker) {
  assert(endorsementUi.indexOf(marker) !== -1, 'Endorsement UI marker missing: ' + marker);
});
assert(endorsementUi.indexOf("actor:'JSK OS Endorsement UI'") === -1, 'Endorsement UI still supplies authoritative actor identity.');

[companyUi, claimUi, endorsementUi].forEach(function (source) {
  new Function(source.replace(/^\s*<script>\s*/, '').replace(/\s*<\/script>\s*$/, ''));
  passed += 1;
});

async function verifyEndorsementLoadFailure(initialItems) {
  const loadStart = endorsementUi.indexOf('function load()');
  const loadEnd = endorsementUi.indexOf('function contextSummary()', loadStart);
  const context = {
    state: { items: initialItems.slice(), loadToken: 0 },
    context: { get: function () { return ''; } },
    elements: {
      searchInput: { value: '' }, statusFilter: { value: '' }, typeFilter: { value: '' },
      policyHistoryFilter: { value: '' }, includeArchivedCheckbox: { checked: true }
    },
    call: function (name) {
      return name === 'apiEndorsementSearch'
        ? Promise.reject(new Error('simulated load failure'))
        : Promise.resolve({ success: true, data: {} });
    },
    data: function (value) { return value; },
    renderCount: 0,
    summaryReset: false,
    failureMessage: '',
    render: function () { context.renderCount += 1; },
    renderSummary: function (summary) { context.summaryReset = Object.keys(summary).length === 0; },
    fail: function (error) { context.failureMessage = error.message; },
    contextSummary: function () { return {}; },
    $: function (id) { return context.elements[id]; },
    Promise: Promise
  };
  vm.runInNewContext(endorsementUi.slice(loadStart, loadEnd) + ';this.load=load;', context);
  await context.load();
  assert(context.state.items.length === 0, 'Failed Endorsement load left stale rows visible.');
  assert(context.renderCount === 1 && context.summaryReset, 'Failed Endorsement load did not settle table/statistics state.');
  assert(context.failureMessage === 'simulated load failure', 'Failed Endorsement load did not expose the error.');
}

async function verifyEndorsementLatestLoadWins() {
  const loadStart = endorsementUi.indexOf('function load()');
  const loadEnd = endorsementUi.indexOf('function contextSummary()', loadStart);
  const searches = [];
  function deferred() {
    const item = {};
    item.promise = new Promise(function (resolve, reject) { item.resolve = resolve; item.reject = reject; });
    return item;
  }
  const context = {
    state: { items: [{ endorsementId: 'INITIAL' }], loadToken: 0 },
    context: { get: function () { return ''; } },
    elements: {
      searchInput: { value: '' }, statusFilter: { value: '' }, typeFilter: { value: '' },
      policyHistoryFilter: { value: '' }, includeArchivedCheckbox: { checked: true }
    },
    call: function (name) {
      if (name === 'apiEndorsementSearch') {
        const search = deferred(); searches.push(search); return search.promise;
      }
      return Promise.resolve({ success: true, data: {} });
    },
    data: function (value) {
      if (!value || !value.success) throw new Error('Endorsement API error.');
      return value.data;
    },
    renderCount: 0,
    failureCount: 0,
    render: function () { context.renderCount += 1; },
    renderSummary: function () {},
    fail: function () { context.failureCount += 1; },
    contextSummary: function () { return {}; },
    $: function (id) { return context.elements[id]; },
    Promise: Promise
  };
  vm.runInNewContext(endorsementUi.slice(loadStart, loadEnd) + ';this.load=load;', context);
  const older = context.load();
  const newer = context.load();
  searches[1].resolve({ success: true, data: { items: [{ endorsementId: 'NEWER' }] } });
  await newer;
  searches[0].reject(new Error('obsolete failure'));
  await older;
  assert(context.state.items.length === 1 && context.state.items[0].endorsementId === 'NEWER', 'Older Endorsement failure erased newer results.');
  assert(context.renderCount === 1 && context.failureCount === 0, 'Obsolete Endorsement request mutated current UI state.');
}

(async function () {
  await verifyEndorsementLoadFailure([]);
  await verifyEndorsementLoadFailure([{ endorsementId: 'STALE' }]);
  await verifyEndorsementLatestLoadWins();
  console.log(JSON.stringify({ suite: 'maintenance-1.5.11', passed: passed, failed: 0 }, null, 2));
})().catch(function (error) {
  console.error(error.stack || error);
  process.exitCode = 1;
});
