'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const properties = {};

function output(content) {
  return {
    content: content,
    getContent: function () { return this.content; },
    setContent: function (value) { this.content = value; return this; },
    setTitle: function () { return this; },
    setXFrameOptionsMode: function () { return this; },
    addMetaTag: function () { return this; }
  };
}
function include(relativePath) {
  return fs.readFileSync(path.join(root, 'src', relativePath + (path.extname(relativePath) ? '' : '.html')), 'utf8');
}
function render(relativePath) {
  var content = include(relativePath);
  content = content.replace(/<\?!=\s*JSKOS\.TemplateService\.include\(['"]([^'"]+)['"]\);?\s*\?>/g, function (_, name) { return include(name); });
  return content;
}

global.console = console;
global.PropertiesService = { getScriptProperties: function () { return {
  getProperty: function (key) { return properties[key] || null; },
  setProperty: function (key, value) { properties[key] = String(value); return this; }
}; } };
global.ScriptApp = { getService: function () { return { getUrl: function () { return ''; } }; } };
global.HtmlService = {
  XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' },
  createHtmlOutput: output,
  createHtmlOutputFromFile: function (name) { return output(include(name)); },
  createTemplateFromFile: function (name) { var template={};template.evaluate=function(){return output(render(name));};return template; }
};
global.JSKOS = {
  Config: { APP: { NAME: 'JSK OS', VERSION: '1.5.4' } },
  ConfigService: {
    getCurrentUser: function () { return 'owner@example.com'; },
    getSpreadsheet: function () { return { getSheetByName: function () { return { appendRow: function () {} }; } }; },
    getOrCreateSheet: function () { return { getLastRow:function(){return 1;},appendRow:function(){},setFrozenRows:function(){} }; }
  },
  TemplateService: {
    include: include,
    createModel: function () { return { applicationName:'JSK OS',applicationVersion:'1.5.4',currentUser:'owner@example.com',routeUrls:{} }; }
  }
};
global.bootstrapBuild1002Automation_ = function () {};
global.renderEnterpriseDashboardUi = function () { return output('Dashboard'); };
global.handleMetaWhatsAppWebhookVerification = function () { return output('ok'); };
global.handleMetaWhatsAppWebhook = function () { return output('ok'); };
['claimApiExecute_','companyApiExecute_','peopleApiExecute_','policyApiExecute_','documentApiExecute_','endorsementApi_','quoteApi_','revenueApi_','taskApiExecute_','meetingApiExecute_','communicationApiExecute_','reportApi_'].forEach(function(name){global[name]=function(){};});

function load(relativePath) { vm.runInThisContext(fs.readFileSync(path.join(root, relativePath), 'utf8'), { filename: relativePath }); }
load('src/core/Response.js');
load('src/core/AccessControl.js');
load('src/Ui/Access/AccessUi.js');
load('src/core/Router.js');
load('src/core/AccessControlTest.js');
load('src/core/BuildReleaseSuites.js');

var report=testBuild1013ReleaseCandidate();
if(!report.success){console.error(JSON.stringify(report,null,2));process.exit(1);}
console.log(JSON.stringify(report,null,2));
