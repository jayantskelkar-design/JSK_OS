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
global.apiCompanyGet = function () {};
global.apiPeopleGet = function () {};

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

var report = testBuild1014Client360IntelligenceReleaseCandidate();
if (report.failed) {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(report, null, 2));
