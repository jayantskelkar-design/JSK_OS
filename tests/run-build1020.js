'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),root=path.resolve(__dirname,'..');
global.JSKOS={};global.console=console;global.PropertiesService={getScriptProperties:function(){return{getProperty:function(){return'';},setProperty:function(){}};}};global.Session={getActiveUser:function(){return{getEmail:function(){return'user@example.com';}};}};
function load(file){vm.runInThisContext(fs.readFileSync(path.join(root,file),'utf8'),{filename:file});}
load('src/core/AccessControl.js');
load('src/core/ClientContext.js');
load('src/core/ClientAction.js');
load('src/core/WorkflowIntent.js');
load('src/core/WorkflowConfirmation.js');
load('src/core/WorkflowAuditRepository.js');
load('src/core/WorkflowAuditRepositoryTest.js');
load('src/quote/QuoteModule.js');
load('src/quote/QuoteWorkflowExecution.js');
load('src/quote/QuoteMigrationTest.js');
load('src/quote/QuoteWorkflowReconciliation.js');
load('src/quote/QuoteWorkflowReconciliationTest.js');
const tests=[testBuild1020VerifiedInspection,testBuild1020AuditOnlyReconciliation,testBuild1020ZeroOneMultipleMatches,testBuild1020LookupOutages,testBuild1020TamperingFailsClosed,testBuild1020ReceiptAndIdentityTampering,testBuild1020MutableBusinessFieldsIndependent,testBuild1020RepositoryCrudReconciliationCompatibility,testBuild1020ExpiredAuditOnlyRules,testBuild1020AuditStoragePending,testBuild1020ConcurrentIdempotency,testBuild1020UnauthorizedIsolation,testBuild1020MalformedLifecycleAndMetadata,testBuild1020SafeDiagnostics,testBuild1020StrictApiPayload,testBuild1020ReadOnlyDestinationOwnership,testBuild1020LeastPrivilegeContract,testBuild1020BoundedAuditLookupContract,testBuild1020LargeAuditAndLifecycleBounds,testBuild1020SheetReadFailureClassification,testBuild1020ReadOnlyInspectionConstruction,testBuild1020ReadOnlySheetResolutionFailure,testBuild1020RealReadOnlyRepositoriesNoWrites];
const results=tests.map(function(test){try{test();return{name:test.name,success:true};}catch(error){return{name:test.name,success:false,error:error.message};}}),failed=results.filter(function(x){return!x.success;}),report={build:1020,passed:results.length-failed.length,failed:failed.length,results:results};console.log(JSON.stringify(report,null,2));if(failed.length)process.exit(1);
