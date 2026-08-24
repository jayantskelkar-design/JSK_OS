'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
function source(file){return fs.readFileSync(path.join(root,file),'utf8');}
function load(context,file){vm.runInContext(source(file),context,{filename:file});}
function assert(value,message){if(!value)throw new Error(message);}
function code(call){try{call();return'SUCCESS';}catch(error){return error&&error.code||error&&error.name||'ERROR';}}

function peopleCreateLockProbe(){
  const text=source('src/people/PeopleRepository.js'),start=text.indexOf('  create(person, actor) {'),end=text.indexOf('  update(personId, changes, actor, expectedVersion) {'),body=text.slice(start,end);
  assert(start!==-1&&end>start&&/LockService\.getScriptLock\(\)/.test(body),'People create does not use script lock');
  assert(!/LockService\.getDocumentLock\(\)/.test(body),'People create requests document lock');
  return{success:true,scriptLock:true,documentLock:false};
}

function communicationVersionProbe(){
  const context={console:console,Date:Date,Math:Math,JSON:JSON,Object:Object,String:String,Number:Number,Boolean:Boolean,Error:Error,isFinite:isFinite,state:null};context.SpreadsheetApp={flush(){context.state.flush++;}};
  vm.createContext(context);load(context,'src/communication/CommunicationRepository.js');
  function harness(storedVersion){
    const state={record:{'Communication ID':'COM-1','Channel':'WhatsApp','Recipient':'919999999999','Message':'Test','Status':'Queued','Record Version':storedVersion},row:0,audit:0,flush:0,script:0,document:0};context.state=state;context.LockService={getScriptLock(){state.script++;return{waitLock(){},releaseLock(){}};},getDocumentLock(){state.document++;throw new Error('Communication update requested document lock');}};
    const repo=vm.runInContext('Object.create(CommunicationRepository.prototype)',context);repo.headers=Object.keys(state.record);repo.map={};repo.headers.forEach((h,i)=>repo.map[h]=i);repo._find=function(){return{row:2,record:Object.assign({},state.record)};};repo._normalize=function(changes){const out={};if(changes.status!==undefined)out.Status=changes.status;return out;};repo._validate=function(){};repo._actor=String;repo._toRow=function(record){return repo.headers.map(h=>record[h]);};repo._format=function(record){return{communicationId:record['Communication ID'],status:record.Status,recordVersion:record['Record Version']};};repo._writeAuditLog=function(){state.audit++;};repo.sheet={getRange(){return{setValues(values){state.row++;repo.headers.forEach((h,i)=>state.record[h]=values[0][i]);}};}};return{repo,state};
  }
  const live=harness(4),first=live.repo.update('COM-1',{status:'Sending'},'actor',4);assert(first.recordVersion===5&&live.state.row===1&&live.state.audit===1&&live.state.flush===1,'Communication valid update failed');const before=JSON.stringify(live.state);let conflict=null;try{live.repo.update('COM-1',{status:'Sent'},'actor',4);}catch(error){conflict=error;}assert(conflict&&conflict.code==='VERSION_CONFLICT'&&conflict.currentVersion===5,'Communication stale update escaped');assert(JSON.stringify(live.state.record)===JSON.stringify(JSON.parse(before).record)&&live.state.row===1&&live.state.audit===1&&live.state.flush===1,'Communication stale update mutated state');
  [undefined,0,1.5,'4','junk'].forEach(value=>{const item=harness(4);assert(code(()=>item.repo.update('COM-1',{status:'Sent'},'actor',value))==='VALIDATION_ERROR','Invalid communication expectedVersion accepted');assert(item.state.row===0&&item.state.audit===0&&item.state.flush===0);});['',0,'4','corrupt',null].forEach(value=>{const item=harness(value);assert(code(()=>item.repo.update('COM-1',{status:'Sent'},'actor',4))==='INVALID_RECORD_VERSION','Invalid communication stored version accepted');assert(item.state.row===0&&item.state.audit===0&&item.state.flush===0);});assert(live.state.document===0,'Communication update requested document lock');return{success:true,staleCode:conflict.code,currentVersion:conflict.currentVersion,mutations:live.state.row,scriptLocks:live.state.script,documentLocks:live.state.document};
}

function metaWebhookProbe(){
  const updates=[],properties={JSK_OS_META_WA_VERIFY_TOKEN:'secret'},context={console:{error(){},info(){}},Date:Date,Math:Math,JSON:JSON,Object:Object,String:String,Number:Number,Boolean:Boolean,Error:Error,isFinite:isFinite,PropertiesService:{getScriptProperties(){return{getProperty(key){return properties[key]||'';},getProperties(){return Object.assign({},properties);}};}},ContentService:{MimeType:{JSON:'JSON',TEXT:'TEXT'},createTextOutput(value){return{value:String(value),setMimeType(){return this;}};}},JSKOS:{LegacyMutationAuthority:{},ConfigService:{}},requireBuild1006Communications_:function(){},CommunicationRepository:function(){this.findByProviderMessageId=function(){return{communicationId:'COM-1',status:context.currentStatus,recordVersion:context.currentVersion};};this.update=function(id,changes,actor,version){updates.push({id,changes,actor,version});context.currentStatus=changes.status;context.currentVersion++;};}};
  vm.createContext(context);load(context,'src/communication/MetaWhatsAppProvider.js');context.applyMetaWhatsAppStatuses_=function(){context.applied=(context.applied||0)+1;};let response=context.handleMetaWhatsAppWebhook({parameter:{},postData:{contents:'{}'}});assert(JSON.parse(response.value).error==='UNAUTHORIZED'&&!context.applied,'Unsigned webhook was accepted');response=context.handleMetaWhatsAppWebhook({parameter:{webhook_token:'wrong'},postData:{contents:'{}'}});assert(JSON.parse(response.value).error==='UNAUTHORIZED'&&!context.applied,'Wrong webhook token was accepted');response=context.handleMetaWhatsAppWebhook({parameter:{webhook_token:'secret'},postData:{contents:'{}'}});assert(JSON.parse(response.value).success===true&&context.applied===1,'Authorized webhook was rejected');
  load(context,'src/communication/MetaWhatsAppProvider.js');context.currentStatus='Sent';context.currentVersion=2;context.applyMetaWhatsAppStatuses_([{id:'wamid.1',status:'sent',at:new Date(),error:''},{id:'wamid.1',status:'delivered',at:new Date(),error:''},{id:'wamid.1',status:'sent',at:new Date(),error:''},{id:'wamid.1',status:'read',at:new Date(),error:''},{id:'wamid.1',status:'read',at:new Date(),error:''}]);assert(updates.length===2&&updates[0].changes.status==='Delivered'&&updates[1].changes.status==='Read','Webhook replay/order protection failed');return{success:true,unauthorizedRejected:true,authorizedAccepted:true,statusWrites:updates.map(x=>x.changes.status)};
}

function releaseScopeProbe(){
  const changed=require('child_process').execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).split(/\r?\n/).filter(line=>line.trim()).map(line=>line.slice(3));
  const allowed=new Set(['src/core/AccessControl.js','src/core/Config.js','src/core/Router.js','src/people/PeopleRepository.js','src/communication/CommunicationRepository.js','src/communication/MetaWhatsAppProvider.js','src/garuda/','src/garuda/GarudaBackend.js','src/garuda/GarudaLeadIntelligence.js','src/garuda/GarudaVisitingCard.js','src/Ui/Garuda/','src/Ui/Garuda/GarudaUi.js','src/Ui/Garuda/Garuda.html','src/Ui/Garuda/GarudaStyles.html','src/Ui/Garuda/GarudaScripts.html','tests/run-build1025.js','tests/run-build1026.js','tests/run-build1027.js','tests/run-garuda-card.js']);
  ['src/appsscript.json','src/garuda/GarudaCloudVisionOcr.js','src/garuda/GarudaCrmResolver.js','src/Ui/Garuda/GarudaCrmResolutionScripts.html','tests/run-garuda-cloud-vision.js','tests/run-garuda-crm-resolution.js'].forEach(file=>allowed.add(file));
  assert(changed.every(file=>allowed.has(file)),'Build 1026 changed path outside scope: '+changed.filter(file=>!allowed.has(file)).join(','));
  assert(!fs.existsSync(path.join(root,'src/core/Build1025PeopleMigration.js'))&&!fs.existsSync(path.join(root,'src/core/Build1025PeoplePreflight.js')),'Temporary Build 1025 helper entered release tree');
  assert(/VERSION:\s*'1\.5\.(?:15|16)'/.test(source('src/core/Config.js')),'Build 1026 runtime version mismatch');
  const router=source('src/core/Router.js'),start=router.indexOf('renderError: function'),errorBody=router.slice(start,router.indexOf('\n  },',start));
  assert(!/escapeRouterHtml_\(diagnostic\)/.test(errorBody)&&/Please contact an Administrator/.test(errorBody),'Router exposes diagnostics to clients');
  return{success:true,changed};
}

const tests=[['PEOPLE_CREATE_LOCK',peopleCreateLockProbe],['COMMUNICATION_VERSION_INTEGRITY',communicationVersionProbe],['META_WEBHOOK_AUTH_REPLAY',metaWebhookProbe],['RELEASE_SCOPE',releaseScopeProbe]],results=tests.map(([name,run])=>{try{return{name,success:true,result:run()};}catch(error){return{name,success:false,error:error.stack||String(error)};}}),failed=results.filter(x=>!x.success);process.stdout.write(JSON.stringify({build:1026,passed:results.length-failed.length,failed:failed.length,assertions:32,results},null,2)+'\n');if(failed.length)process.exitCode=1;
