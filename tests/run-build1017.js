'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),root=path.resolve(__dirname,'..');global.JSKOS={};global.console=console;
function load(file){vm.runInThisContext(fs.readFileSync(path.join(root,file),'utf8'),{filename:file});}
load('src/core/ClientContext.js');load('src/core/ClientAction.js');load('src/core/WorkflowIntent.js');load('src/core/WorkflowIntentTest.js');
const tests=[testBuild1017IntentNormalization,testBuild1017UnsupportedAndMalformed,testBuild1017PermissionIsolation,testBuild1017IncompleteIntent,testBuild1017AllowlistedDraft,testBuild1017BoundsAndRelationship,testBuild1017HandoffRevalidation,testBuild1017ReadOnly];
const results=tests.map(function(test){try{test();return{name:test.name,success:true};}catch(error){return{name:test.name,success:false,error:error.message};}}),failed=results.filter(function(x){return!x.success;}),report={build:1017,passed:results.length-failed.length,failed:failed.length,results:results};console.log(JSON.stringify(report,null,2));if(failed.length)process.exit(1);
