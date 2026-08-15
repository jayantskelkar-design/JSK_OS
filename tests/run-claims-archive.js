'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');

global.JSKOS = { ConfigService: {} };
global.JSK_CLAIM_SCHEMA = { TYPE_VALUES: ['Health'], STATUS_VALUES: ['Draft', 'Settled'], PRIORITY_VALUES: ['Medium', 'Low'] };
global.Utilities = { formatDate: function () { return '20260810120000'; }, getUuid: function () { return 'abcdef12-3456-7890-abcd-ef1234567890'; } };
global.LockService = { getScriptLock: function () { return { waitLock: function () {}, releaseLock: function () {} }; } };
global.SpreadsheetApp = { flush: function () {} };

function load(relativePath) {
  vm.runInThisContext(fs.readFileSync(path.join(root, relativePath), 'utf8'), { filename: relativePath });
}

load('src/claim/ClaimRepository.js');

const headers = ['Claim ID', 'Policy ID', 'Claim Number', 'Claim Type', 'Status', 'Priority', 'Is Deleted', 'Record Version', 'Updated At'];
const records = [
  { 'Claim ID': 'CLM-ACTIVE', 'Policy ID': 'POL-1', 'Claim Number': 'ACTIVE-1', 'Claim Type': 'Health', 'Status': 'Draft', 'Priority': 'Medium', 'Is Deleted': false, 'Record Version': 2, 'Updated At': '2026-08-10' },
  { 'Claim ID': 'CLM-ARCHIVED', 'Policy ID': 'POL-1', 'Claim Number': 'ARCHIVED-1', 'Claim Type': 'Health', 'Status': 'Settled', 'Priority': 'Low', 'Is Deleted': true, 'Record Version': 3, 'Updated At': '2026-08-09' }
];
const repository = Object.create(ClaimRepository.prototype);
repository.headers = headers;
repository._entries = function () { return records.map(function (record, index) { return { row: index + 2, record: record }; }); };

const active = repository.search({});
if (active.totalItems !== 1 || active.items[0].claimId !== 'CLM-ACTIVE') throw new Error('Default Claim search must exclude archived records.');

const all = repository.search({ includeArchived: true });
if (all.totalItems !== 2 || !all.items.some(function (item) { return item.claimId === 'CLM-ARCHIVED' && item.isDeleted; })) throw new Error('Include archived must return clearly flagged archived records.');

const linked = repository.search({ includeArchived: true, policyId: 'POL-1' });
if (linked.totalItems !== 2 || linked.items.some(function (item) { return item.policyId !== 'POL-1'; })) throw new Error('Policy relationships changed during archived search.');

let updateCall = null;
repository.update = function (id, changes, actor, expectedVersion) { updateCall = { id: id, changes: changes, actor: actor, expectedVersion: expectedVersion }; return { claimId: id, isDeleted: true }; };
repository.remove('CLM-ACTIVE', 'actor@example.com', 2);
if (!updateCall || updateCall.id !== 'CLM-ACTIVE' || updateCall.changes['Is Deleted'] !== true || updateCall.expectedVersion !== 2) throw new Error('Archive must use the existing versioned soft-delete update path.');

const integrationHeaders = ['Claim ID', 'Policy ID', 'Claim Number', 'Claim Type', 'Status', 'Priority', 'Claim Amount', 'Approved Amount', 'Settled Amount', 'Description', 'Created At', 'Created By', 'Updated At', 'Updated By', 'Record Version', 'Is Deleted'];
const rows = [integrationHeaders.slice()];
const sheet = {
  getLastColumn: function () { return integrationHeaders.length; },
  getLastRow: function () { return rows.length; },
  appendRow: function (row) { rows.push(row.slice()); },
  getRange: function (row, column, rowCount, columnCount) { return {
    getDisplayValues: function () { return rows.slice(row - 1, row - 1 + rowCount).map(function (item) { return item.slice(column - 1, column - 1 + columnCount); }); },
    getValues: function () { return rows.slice(row - 1, row - 1 + rowCount).map(function (item) { return item.slice(column - 1, column - 1 + columnCount); }); },
    setValues: function (values) { values.forEach(function (value, index) { rows[row - 1 + index] = value.slice(); }); return this; }
  }; }
};
const integrated = new ClaimRepository({ getSheetByName: function () { return sheet; } });
const created = integrated.create({ policyId: 'POL-99', claimNumber: 'NEW-1', claimType: 'Health', claimAmount: '', approvedAmount: '', settledAmount: '', description: 'Original' }, 'creator@example.com');
if (created.claimId.indexOf('CLM-') !== 0 || created.policyId !== 'POL-99' || created.isDeleted || rows.length !== 2) throw new Error('Claim Create regression failed.');
const updated = integrated.update(created.claimId, { description: 'Edited' }, 'editor@example.com', created.recordVersion);
if (updated.description !== 'Edited' || updated.claimId !== created.claimId || updated.policyId !== 'POL-99' || rows.length !== 2) throw new Error('Claim Edit regression or relationship preservation failed.');
const archived = integrated.remove(updated.claimId, 'archiver@example.com', updated.recordVersion);
if (!archived.isDeleted || archived.claimId !== created.claimId || rows.length !== 2) throw new Error('Claim archive created a duplicate or changed identity.');
if (integrated.search({}).totalItems !== 0 || integrated.search({ includeArchived: true }).totalItems !== 1) throw new Error('Integrated active/archived visibility contract failed.');

const backend = fs.readFileSync(path.join(root, 'src/claim/ClaimBackend.js'), 'utf8');
if (!/function apiClaimDelete\(payload\)/.test(backend) || !/claimApiExecute_\('delete'/.test(backend) || !/\.remove\(r\.claimId, r\.actor, r\.expectedVersion\)/.test(backend)) throw new Error('Protected Claim soft-archive API contract is incomplete.');
if (!/function apiClaimCreate\(payload\)/.test(backend) || !/function apiClaimUpdate\(payload\)/.test(backend)) throw new Error('Claim Create/Update APIs were not preserved.');

const html = fs.readFileSync(path.join(root, 'src/Ui/Claim/Claim.html'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'src/Ui/Claim/ClaimScripts.html'), 'utf8');
if (html.indexOf('includeArchivedCheckbox') === -1 || html.indexOf('Include archived') === -1) throw new Error('Include archived control is missing.');
['apiClaimDelete', "confirm('Archive claim", 'Claim archived successfully.', "includeArchived:$('includeArchivedCheckbox').checked", "data-action=\"archive\"", "classList.add('is-archived')"].forEach(function (marker) { if (ui.indexOf(marker) === -1) throw new Error('Claim archive UI marker missing: ' + marker); });

new Function(ui.replace(/^<script>\s*/, '').replace(/\s*<\/script>\s*$/, ''));

console.log(JSON.stringify({ suite: 'claims-archive', passed: 12, failed: 0 }, null, 2));
