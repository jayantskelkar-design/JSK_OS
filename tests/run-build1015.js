'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),root=path.resolve(__dirname,'..');
global.JSKOS={};global.console=console;
function load(file){vm.runInThisContext(fs.readFileSync(path.join(root,file),'utf8'),{filename:file});}
load('src/core/ClientContext.js');load('src/core/ClientContextTest.js');
const tests=[testBuild1015ClientContextNormalization,testBuild1015PolicyIdBounds,testBuild1015ContextMatching];
const results=tests.map(function(test){try{test();return{name:test.name,success:true};}catch(error){return{name:test.name,success:false,error:error.message};}});
const failed=results.filter(function(x){return!x.success;});const report={build:1015,passed:results.length-failed.length,failed:failed.length,results:results};
console.log(JSON.stringify(report,null,2));if(failed.length)process.exit(1);
