'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),root=path.resolve(__dirname,'..');
global.JSKOS={};global.console=console;
function load(file){vm.runInThisContext(fs.readFileSync(path.join(root,file),'utf8'),{filename:file});}
load('src/core/ClientContext.js');
load('src/core/ClientAction.js');
load('src/core/WorkflowIntent.js');
load('src/core/WorkflowConfirmation.js');
load('src/core/WorkflowConfirmationApi.js');
load('src/core/WorkflowAuditRepository.js');
load('src/quote/QuoteModule.js');
load('src/quote/QuoteWorkflowExecution.js');
load('src/quote/QuoteWorkflowExecutionTest.js');
const tests=[testBuild1019ValidExecution,testBuild1019PreviewNoMutation,testBuild1019ActorActionDestination,testBuild1019PermissionAndRelationship,testBuild1019ExpiryAndLifecycle,testBuild1019PolicyBounds,testBuild1019MassAssignment,testBuild1019MalformedPayload,testBuild1019IdempotentRetry,testBuild1019ChangedRetryPayload,testBuild1019DuplicateDestination,testBuild1019AuditRecovery,testBuild1019WriteFailureRetry,testBuild1019LockCoverage,testBuild1019Client360Isolation,testBuild1019SchemaContract,testBuild1019AuditLifecycleContract,testBuild1019ReceiptCompletionMetadata];
const results=tests.map(function(test){try{test();return{name:test.name,success:true};}catch(error){return{name:test.name,success:false,error:error.message};}}),failed=results.filter(function(x){return!x.success;}),report={build:1019,passed:results.length-failed.length,failed:failed.length,results:results};
console.log(JSON.stringify(report,null,2));if(failed.length)process.exit(1);
