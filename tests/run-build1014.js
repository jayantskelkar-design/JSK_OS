'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
global.JSKOS = {
  AccessControl: {
    hasPermission: function () { return true; },
    requireModuleOperation: function () {},
    getOperationPermission: function (moduleName, operation) { return moduleName + '.' + operation; }
  },
  Config: { APP: { VERSION: '1.5.2' } },
  Router: { resolve: function (event) { return event.parameter.page; } }
};
global.JSK_ACCESS = { ROUTE_PERMISSIONS: { client360: 'client360.view' } };
global.console = console;
['CompanyRepository','PeopleRepository','PolicyRepository','ClaimRepository','TaskRepository','MeetingRepository','CommunicationRepository','DocumentRepository','QuoteRepository','EndorsementRepository','RevenueRepository'].forEach(function (name) {
  global[name] = function () {};
});
global.CommunicationRepository.prototype.search = function (criteria) {
  criteria = criteria || {};
  var items = this._entries().filter(function (entry) {
    var record = entry.record;
    return !this._bool(record['Is Deleted']) &&
      (!criteria.companyId || record['Company ID'] === criteria.companyId) &&
      (!criteria.personId || record['Person ID'] === criteria.personId);
  }, this).map(function (entry) { return this._format(entry.record); }, this);
  return { items: items, total: items.length };
};
global.RevenueRepository.prototype.search = function (criteria) {
  criteria = criteria || {};
  var rows = this.sheet.getLastRow() < 2 ? [] : this.sheet.getRange().getValues();
  var items = rows.map(this.obj_.bind(this)).filter(function (item) {
    return (!criteria.companyId || item.companyId === criteria.companyId) &&
      (!criteria.policyId || item.policyId === criteria.policyId);
  });
  return { items: items, total: items.length };
};
global.apiCompanyGet = function () {};
global.apiPeopleGet = function () {};
global.renderClient360Ui = function () {
  var content = fs.readFileSync(path.join(root, 'src/Ui/Client360/Client360.html'), 'utf8') +
    fs.readFileSync(path.join(root, 'src/Ui/Client360/Client360Scripts.html'), 'utf8');
  return { getContent: function () { return content; } };
};

global.runJSKOSReleaseSuite_ = function (build, tests) {
  var results = tests.map(function (test) {
    try { test.run(); return { name: test.name, success: true }; }
    catch (error) { return { name: test.name, success: false, error: error.message }; }
  });
  var failures = results.filter(function (result) { return !result.success; });
  return { build: build, passed: results.length - failures.length, failed: failures.length, results: results };
};

function load(relativePath) {
  vm.runInThisContext(fs.readFileSync(path.join(root, relativePath), 'utf8'), { filename: relativePath });
}

load('src/client360/Client360Service.js');
load('src/client360/Client360ServiceTest.js');

var reports = {
  client360V01: testClient360V01ReleaseCandidate(),
  build1014: testBuild1014Client360IntelligenceReleaseCandidate()
};
if (reports.client360V01.failed || reports.build1014.failed) {
  console.error(JSON.stringify(reports, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(reports, null, 2));
