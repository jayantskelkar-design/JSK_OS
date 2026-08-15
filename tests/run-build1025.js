'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm'),childProcess=require('child_process'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),baseline='81f0b08962c15e48d9b32f9fef44a8b37c6b3ccb';
function assert(value,message){if(!value)throw new Error(message);}
function source(file){return fs.readFileSync(path.join(root,file),'utf8');}
function load(context,file){vm.runInContext(source(file),context,{filename:file});}
function errorCode(call){try{const value=call();return value&&value.error&&value.error.code||'';}catch(error){return error&&error.code||'';}}

const manifestContext=vm.createContext({Object:Object,String:String});
load(manifestContext,'src/core/Build1025SecurityTest.js');
const assertionIds=Array.from(manifestContext.BUILD1025_ASSERTION_IDS);

function runtime(options){
  options=options||{};
  const effects={auth:0,schema:0,repository:0,row:0,audit:0,flush:0,propertyWrite:0,trigger:0,drive:0,provider:0,logger:0,actors:[]};
  const context={Date:Date,Math:Math,JSON:JSON,Object:Object,Array:Array,String:String,Number:Number,Boolean:Boolean,RegExp:RegExp,Error:Error,isFinite:isFinite,parseInt:parseInt,encodeURIComponent:encodeURIComponent,console:{error(){},warn(){},info(){},log(){}},effects:effects};
  context.JSKOS={ConfigService:{getCurrentUser(){return options.email||'real.user@example.com';},getSpreadsheet(){effects.schema++;return{getSheetByName(){return null;}};}}};
  function denied(){const error=new Error('denied');error.code=options.unauthenticated?'UNAUTHORIZED':'FORBIDDEN';throw error;}
  context.JSKOS.AccessControl={requireModuleOperation(){effects.auth++;if(options.denied)denied();return{email:options.email||'real.user@example.com'};},requirePermission(){effects.auth++;if(options.denied)denied();return{email:options.email||'real.user@example.com'};}};
  context.Utilities={getUuid(){return'11111111-1111-1111-1111-111111111111';},base64Decode(){return[1];},newBlob(){return{};},formatDate(){return'2026-08-16';}};
  context.PropertiesService={getScriptProperties(){return{getProperty(){return'';},getProperties(){return{};},setProperty(){effects.propertyWrite++;}};}};
  context.SpreadsheetApp={flush(){effects.flush++;}};
  context.DriveApp={getFolderById(){effects.drive++;return{};},getFoldersByName(){effects.drive++;return{hasNext(){return false;}};},createFolder(){effects.drive++;return{getId(){return'id';},createFile(){effects.drive++;return{};}};}};
  context.ScriptApp={getProjectTriggers(){effects.trigger++;return[];},newTrigger(){effects.trigger++;return{};}};
  context.UrlFetchApp={fetch(){effects.provider++;return{};}};
  context.LockService={getScriptLock(){return{waitLock(){},releaseLock(){}};},getDocumentLock(){return{waitLock(){},releaseLock(){}};}};
  vm.createContext(context);load(context,'src/core/LegacyMutationAuthority.js');
  context.schema=function(){effects.schema++;if(options.migration){const error=context.JSKOS.LegacyMutationAuthority.migrationRequired(options.moduleName||'Module');throw error;}return{};};
  return context;
}

function repository(context,moduleName){
  const effects=context.effects;
  function sink(actor,result){effects.row++;effects.audit++;effects.flush++;effects.actors.push(actor);return Object.assign({recordVersion:2},result||{});}
  function Repo(){effects.repository++;}
  Repo.prototype.create=function(data,actor){return sink(actor,{id:'ID-1',companyId:'COM-1',personId:'P1',policyId:'POL-1',documentId:'DOC-1',taskId:'TSK-1',meetingId:'MTG-1',communicationId:'COMMS-1'});};
  Repo.prototype.queue=Repo.prototype.create;
  Repo.prototype.update=function(id,data,actor){return sink(actor,{communicationId:id||'COMMS-1',status:'Queued'});};
  Repo.prototype.archive=function(id,actor){return sink(actor);};Repo.prototype.restore=Repo.prototype.archive;Repo.prototype.remove=Repo.prototype.archive;
  Repo.prototype.findById=function(){return{communicationId:'COMMS-1',status:'Failed',recordVersion:1,idempotencyKey:''};};
  Repo.prototype.search=function(){return{items:[],totalItems:0,pagination:{totalPages:1}};};Repo.prototype.count=function(){return 0;};
  context[moduleName]=Repo;return Repo;
}

const moduleSpecs=[
  {name:'Company',backend:'src/company/CompanyBackend.js',repo:'CompanyRepository',schema:'requireCompanySchema_',calls:c=>[()=>c.apiCompanyCreate({data:{},actor:'mallory@spoof.invalid'}),()=>c.apiCompanyUpdate({companyId:'COM-1',data:{},expectedVersion:1,actor:'mallory@spoof.invalid'}),()=>c.apiCompanyArchive({companyId:'COM-1',expectedVersion:1,actor:'mallory@spoof.invalid'}),()=>c.apiCompanyRestore({companyId:'COM-1',expectedVersion:1,actor:'mallory@spoof.invalid'})]},
  {name:'People',backend:'src/people/PeopleBackend.js',repo:'PeopleRepository',schema:'requirePeopleSchema_',calls:c=>[()=>c.apiPeopleCreate({data:{},actor:'mallory@spoof.invalid'}),()=>c.apiPeopleUpdate({personId:'P1',data:{},expectedVersion:1,actor:'mallory@spoof.invalid'}),()=>c.apiPeopleArchive({personId:'P1',expectedVersion:1,actor:'mallory@spoof.invalid'}),()=>c.apiPeopleRestore({personId:'P1',expectedVersion:1,actor:'mallory@spoof.invalid'})]},
  {name:'Policy',backend:'src/policy/PolicyBackend.js',repo:'PolicyRepository',schema:'requirePolicySchema_',calls:c=>[()=>c.apiPolicyCreate({data:{},actor:'mallory@spoof.invalid'}),()=>c.apiPolicyUpdate({policyId:'POL-1',data:{x:1},expectedVersion:1,actor:'mallory@spoof.invalid'}),()=>c.apiPolicyArchive({policyId:'POL-1',expectedVersion:1,actor:'mallory@spoof.invalid'}),()=>c.apiPolicyRestore({policyId:'POL-1',expectedVersion:1,actor:'mallory@spoof.invalid'})]},
  {name:'Document',backend:'src/document/DocumentBackend.js',repo:'DocumentRepository',schema:'requireBuild1008Documents_',calls:c=>[()=>c.apiDocumentCreate({data:{},actor:'mallory@spoof.invalid'}),()=>c.apiDocumentUpdate({documentId:'DOC-1',data:{},expectedVersion:1,actor:'mallory@spoof.invalid'}),()=>c.apiDocumentDelete({documentId:'DOC-1',expectedVersion:1,actor:'mallory@spoof.invalid'}),()=>c.apiDocumentRestore({documentId:'DOC-1',expectedVersion:1,actor:'mallory@spoof.invalid'})]},
  {name:'Task',backend:'src/task/TaskBackend.js',repo:'TaskRepository',schema:'requireBuild1004Tasks_',calls:c=>[()=>c.apiTaskCreate({data:{},actor:'mallory@spoof.invalid'}),()=>c.apiTaskUpdate({taskId:'TSK-1',data:{},expectedVersion:1,actor:'mallory@spoof.invalid'}),()=>c.apiTaskComplete({taskId:'TSK-1',data:{},expectedVersion:1,actor:'mallory@spoof.invalid'})]},
  {name:'Meeting',backend:'src/meeting/MeetingBackend.js',repo:'MeetingRepository',schema:'requireBuild1005Meetings_',calls:c=>[()=>c.apiMeetingCreate({data:{},actor:'mallory@spoof.invalid'}),()=>c.apiMeetingUpdate({meetingId:'MTG-1',data:{},expectedVersion:1,actor:'mallory@spoof.invalid'}),()=>c.apiMeetingComplete({meetingId:'MTG-1',data:{},expectedVersion:1,actor:'mallory@spoof.invalid'})]},
  {name:'Communication',backend:'src/communication/CommunicationBackend.js',repo:'CommunicationRepository',schema:'requireBuild1006Communications_',calls:c=>[()=>c.apiCommunicationQueue({data:{},actor:'mallory@spoof.invalid'}),()=>c.apiCommunicationRetry({communicationId:'COMMS-1',expectedVersion:1,actor:'mallory@spoof.invalid'}),()=>c.apiCommunicationUpdate({communicationId:'COMMS-1',data:{},expectedVersion:1,actor:'mallory@spoof.invalid'})]}
];

function actorAndDenialProbes(){
  const snapshots={};
  moduleSpecs.forEach(spec=>{
    const allowed=runtime({moduleName:spec.name});allowed[spec.schema]=allowed.schema;repository(allowed,spec.repo);load(allowed,spec.backend);
    const calls=spec.calls(allowed);calls.forEach(call=>{const response=call();assert(response&&response.success,spec.name+' allowed mutation failed');});
    assert(allowed.effects.actors.length===calls.length&&allowed.effects.actors.every(actor=>actor==='real.user@example.com'),spec.name+' did not persist only server actor');
    const denied=runtime({moduleName:spec.name,denied:true});denied[spec.schema]=denied.schema;repository(denied,spec.repo);load(denied,spec.backend);
    const before=JSON.stringify(denied.effects);const response=spec.calls(denied)[0]();assert(response&&response.success===false&&response.error.code==='FORBIDDEN',spec.name+' denial envelope failed');
    const after=denied.effects;assert(after.schema===0&&after.repository===0&&after.row===0&&after.audit===0&&after.flush===0&&after.propertyWrite===0&&after.trigger===0&&after.drive===0&&after.provider===0&&after.logger===0,spec.name+' denial caused a protected effect');
    snapshots[spec.name]={before:JSON.parse(before),after:Object.assign({},after),persistedActors:allowed.effects.actors.slice()};
    if(spec.name==='Document'){denied.apiDocumentUpload({fileName:'x',base64:'eA==',actor:'mallory@spoof.invalid'});assert(denied.effects.drive===0,'Denied upload touched Drive');}
  });
  return{success:true,snapshots:snapshots};
}

function authorityProbe(){
  const denied=runtime({denied:true}),before=JSON.stringify(denied.effects);assert(errorCode(()=>denied.JSKOS.LegacyMutationAuthority.requireUser('companies','create'))==='FORBIDDEN','Authority denial code failed');assert(denied.effects.schema===0&&denied.effects.audit===0&&denied.effects.propertyWrite===0,'Authority denial mutated state');
  const allowed=runtime({email:'Server.Actor@Example.com'}),cap=allowed.JSKOS.LegacyMutationAuthority.requireUser('companies','create');assert(allowed.JSKOS.LegacyMutationAuthority.actor(cap)==='server.actor@example.com','Server actor normalization failed');assert(errorCode(()=>allowed.JSKOS.LegacyMutationAuthority.actor({actor:'mallory@spoof.invalid'}))==='FORBIDDEN','Forged capability accepted');
  const system=vm.runInContext("legacyRunTrustedSystem_('TASK_AUTOMATION',function(cap){return JSKOS.LegacyMutationAuthority.actor(cap);})",allowed);assert(system==='Task Automation','Trusted system actor failed');
  allowed.requireBuild1008Documents_=function(){};allowed.MailApp={sendEmail(){}};allowed.PropertiesService={getScriptProperties(){return{getProperty(){return'';}};}};allowed.DocumentRepository=function(){this.search=function(){return{items:[{documentId:'DOC-1',documentName:'Expired',expiryDate:'2026-08-01',status:'Active',recordVersion:1}]};};this.update=function(id,data,actor){allowed.effects.row++;allowed.effects.audit++;allowed.effects.flush++;allowed.effects.actors.push(actor);return{id:id};};};load(allowed,'src/document/DocumentAutomation.js');const worker=vm.runInContext('runDailyDocumentExpiryAutomation_()',allowed);assert(worker.statusesUpdated===1&&allowed.effects.actors[0]==='Document Expiry Automation','Trusted worker audit sink actor failed');
  return{success:true,deniedBefore:JSON.parse(before),deniedAfter:denied.effects,systemActor:system,trustedWorker:{actor:allowed.effects.actors[0],row:allowed.effects.row,audit:allowed.effects.audit,flush:allowed.effects.flush}};
}

function contentionProbe(){
  function run(file,className,method,record,configure){
    const c=runtime({moduleName:className});load(c,file);
    return vm.runInContext(`(function(){var state={record:${JSON.stringify(record)},row:0,audit:0,flush:0};var repository=Object.create(${className}.prototype);repository.headers=['id'];repository._refreshSchema=function(){};repository._normalizeText=function(v){return String(v||'').trim();};repository._findRowNumberById=function(){return 2;};repository._readRecordAtRow=function(){return Object.assign({},state.record);};repository._normalizeActor=function(v){return String(v||'');};repository._serializeRecord=function(v){return JSON.stringify(v);};repository._writeAuditLog=function(){state.audit++;};repository._recordToRow=function(v){return v;};repository.findById=function(){return Object.assign({recordVersion:Number(state.record['Record Version']||state.record.Record_Version)||1},state.record);};repository.sheet={getRange:function(){return{setValues:function(values){state.row++;state.record=Object.assign({},values[0]);}};}};${configure}var outcomes=[];for(var i=0;i<2;i++){try{repository.${method}('ID-1',${method==='update'?'{fullName:"Winner"},':''}'server.actor@example.com',1);outcomes.push('SUCCESS');}catch(error){outcomes.push(error&&error.code||error&&error.name||'ERROR');}}state.flush=effects.flush;return{outcomes:outcomes,finalVersion:Number(state.record['Record Version']||state.record.Record_Version),row:state.row,audit:state.audit,flush:state.flush};})()`,c);
  }
  const people=run('src/people/PeopleRepository.js','PeopleRepository','update',{Person_ID:'ID-1',Full_Name:'Start',Record_Version:1,Created_At:'2026-01-01'},"repository._recordVersionHeader=function(){return 'Record_Version';};repository._updatedByHeader=function(){return '';};repository._normalizePerson=function(v){return v;};repository._applyMutableFields=function(target,changes){target.Full_Name=changes.fullName;};repository._validate=function(){return[];};repository._assertNoDuplicate=function(){};");
  const company=run('src/company/CompanyRepository.js','CompanyRepository','restore',{'Company ID':'ID-1','Company Name':'Example','Record Version':1,'Is Deleted':true},"repository._toBoolean=function(v){return Boolean(v);};repository._assertNoDuplicate=function(){};repository._formatRecord=function(v){return v;};");
  [people,company].forEach((item,index)=>{assert(item.outcomes.filter(x=>x==='SUCCESS').length===1&&(item.outcomes.includes('VERSION_CONFLICT')),(index?'Company':'People')+' contention outcomes failed: '+JSON.stringify(item));assert(item.finalVersion===2&&item.row===1&&item.audit===1&&item.flush===1,(index?'Company':'People')+' contention mutated more than once: '+JSON.stringify(item));});
  return{people:people,company:company};
}

function versionValidation(){
  const invalid=[undefined,null,'',0,-1,1.2,NaN,Infinity,'junk'];
  ['Company','People'].forEach(name=>{const spec=moduleSpecs.find(x=>x.name===name),c=runtime({moduleName:name});c[spec.schema]=c.schema;repository(c,spec.repo);load(c,spec.backend);const fn=name==='Company'?c.companyExpectedVersion_:c.peopleExpectedVersion_;invalid.forEach(value=>assert(errorCode(()=>fn(value))==='VALIDATION_ERROR',name+' accepted invalid expectedVersion'));assert(fn(3)===3,name+' rejected integer expectedVersion');});
  const contention=contentionProbe(),companyUi=source('src/Ui/Company/CompanyScripts.html'),peopleUi=source('src/Ui/People/PeopleScripts.html');assert(/expectedVersion/.test(companyUi)&&/VERSION_CONFLICT/.test(companyUi),'Company UI lacks version conflict recovery');assert(/expectedVersion/.test(peopleUi)&&/VERSION_CONFLICT/.test(peopleUi),'People UI lacks version conflict recovery');assert(!/actor\s*:/.test(companyUi)&&!/actor\s*:/.test(peopleUi),'UI still supplies mutation actor');
  return{success:true,invalidCases:invalid.length,contention:contention,ui:{company:true,people:true}};
}

function readAliasProbes(){
  const inventory={};
  const groups=[
    {spec:'Company',extra:'src/company/CompanySearchApi.js',calls:c=>[()=>c.apiCompanyGet({companyId:'x'}),()=>c.apiCompanySearch({}),()=>c.apiCompanyHealth(),()=>c.searchCompanies({}),()=>c.searchCompanyById('x'),()=>c.searchCompanyByGstin('x'),()=>c.searchCompanySuggestions({query:'xx'}),()=>c.getCompanySearchFilters()]},
    {spec:'People',extra:'src/people/PeopleSearchApi.js',calls:c=>[()=>c.apiPeopleGet({personId:'x'}),()=>c.apiPeopleSearch({}),()=>c.apiPeopleByCompany({companyId:'x'}),()=>c.apiPeopleFollowupsDue({}),()=>c.apiPeopleHealth(),()=>c.searchPeople({}),()=>c.searchPersonById('x'),()=>c.searchPeopleSuggestions({query:'xx'}),()=>c.getPeopleSearchFilters()]},
    {spec:'Policy',extra:'src/policy/PolicySearchApi.js',calls:c=>[()=>c.apiPolicyGet({policyId:'x'}),()=>c.apiPolicyRenewalHistory({policyId:'x'}),()=>c.apiPolicyGetByNumber({policyNumber:'x'}),()=>c.apiPolicySearch({}),()=>c.apiPolicyByCompany({companyId:'x'}),()=>c.apiPolicyByPerson({personId:'x'}),()=>c.apiPolicyRenewalsDue({}),()=>c.apiPolicyHealth(),()=>c.searchPolicies({}),()=>c.searchPolicyById('x'),()=>c.searchPolicyByNumber('x'),()=>c.searchPoliciesByCompany('x'),()=>c.searchPoliciesByPerson('x'),()=>c.searchPolicyRenewalsDue({}),()=>c.searchPolicySuggestions({query:'xx'}),()=>c.getPolicySearchFilters(),()=>c.apiPolicySearchHealth()]},
    {spec:'Document',calls:c=>[()=>c.apiDocumentGet({documentId:'x'}),()=>c.apiDocumentSearch({}),()=>c.apiDocumentExpirySummary({}),()=>c.getDocumentFilters(),()=>c.getDocumentLinkOptions()]},
    {spec:'Task',calls:c=>[()=>c.apiTaskGet({taskId:'x'}),()=>c.apiTaskSearch({})]},
    {spec:'Meeting',calls:c=>[()=>c.apiMeetingGet({meetingId:'x'}),()=>c.apiMeetingSearch({}),()=>c.getMeetingFilters()]},
    {spec:'Communication',extras:['src/communication/MetaWhatsAppProvider.js','src/communication/WaLeadWhatsAppProvider.js'],calls:c=>[()=>c.apiCommunicationSearch({}),()=>c.apiCommunicationSummary({}),()=>c.getMetaWhatsAppConfigStatus(),()=>c.getWaLeadWhatsAppConfigStatus()]}
  ];
  groups.forEach(group=>{const spec=moduleSpecs.find(x=>x.name===group.spec),c=runtime({moduleName:group.spec,migration:true});c[spec.schema]=c.schema;repository(c,spec.repo);load(c,spec.backend);(group.extras||[group.extra]).filter(Boolean).forEach(file=>load(c,file));const before=JSON.parse(JSON.stringify(c.effects)),codes=group.calls(c).map(call=>errorCode(call));assert(codes.every(code=>code==='MIGRATION_REQUIRED'),group.spec+' read alias escaped migration-required');assert(c.effects.row===0&&c.effects.audit===0&&c.effects.flush===0&&c.effects.propertyWrite===0&&c.effects.trigger===0&&c.effects.drive===0&&c.effects.provider===0,group.spec+' migration read mutated state');inventory[group.spec]={aliases:codes.length,codes:codes,before:before,after:c.effects};});
  return{success:true,inventory:inventory};
}

function staticAndInventory(){
  const ignored=new Set(source('.claspignore').split(/\r?\n/).filter(line=>/\.js$/.test(line))),currentFiles=[];function walk(dir){fs.readdirSync(dir,{withFileTypes:true}).forEach(entry=>{const full=path.join(dir,entry.name);if(entry.isDirectory())walk(full);else if(entry.name.endsWith('.js')){const relative=path.relative(path.join(root,'src'),full).replace(/\\/g,'/');if(!ignored.has(relative))currentFiles.push('src/'+relative);}});}walk(path.join(root,'src'));
  const baselineFiles=childProcess.execFileSync('git',['ls-tree','-r','--name-only',baseline,'src'],{cwd:root,encoding:'utf8'}).split(/\r?\n/).filter(file=>file.endsWith('.js')&&!ignored.has(file.slice(4))),hazard=/^(?:api(?:Company|People|Policy|Document|Task|Meeting|Communication)|migrate|ensure|install|remove|audit|createJSKOSProductionBackup|getJSKOSReleaseReadinessStatus|send|process|runDaily|runWaLead|triggerWaLead|handleMeta|reconcile|repair|test)/;
  function mask(text){let out='',state='code',escaped=false;for(let i=0;i<text.length;i++){const ch=text[i],next=text[i+1];if(state==='line'){if(ch==='\n'){state='code';out+='\n';}else out+=' ';continue;}if(state==='block'){if(ch==='*'&&next==='/'){out+='  ';i++;state='code';}else out+=ch==='\n'?'\n':' ';continue;}if(state!=='code'){if(escaped){escaped=false;out+=' ';continue;}if(ch==='\\'){escaped=true;out+=' ';continue;}if((state==='single'&&ch==="'")||(state==='double'&&ch==='"')||(state==='template'&&ch==='`'))state='code';out+=ch==='\n'?'\n':' ';continue;}if(ch==='/'&&next==='/'){out+='  ';i++;state='line';continue;}if(ch==='/'&&next==='*'){out+='  ';i++;state='block';continue;}if(ch==="'"){state='single';out+=' ';continue;}if(ch==='"'){state='double';out+=' ';continue;}if(ch==='`'){state='template';out+=' ';continue;}out+=ch;}return out;}
  function scan(text){const clean=mask(text),matches=[],pattern=/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g;let depth=0,index=0,match;while((match=pattern.exec(clean))){while(index<match.index){if(clean[index]==='{')depth++;else if(clean[index]==='}')depth--;index++;}if(depth===0&&!match[1].endsWith('_')&&hazard.test(match[1]))matches.push({symbol:match[1],line:text.slice(0,match.index).split(/\r?\n/).length});}return matches;}
  const surfaces=new Map();function addRevision(revision,files,reader){files.forEach(file=>scan(reader(file)).forEach(item=>{const key=file+'#'+item.symbol,entry=surfaces.get(key)||{symbol:item.symbol,path:file,baselineLine:null,currentLine:null};entry[revision+'Line']=item.line;surfaces.set(key,entry);}));}addRevision('baseline',baselineFiles,file=>childProcess.execFileSync('git',['show',baseline+':'+file],{cwd:root,encoding:'utf8'}));addRevision('current',currentFiles,file=>source(file));
  const namespaceManifest=[['JSKOS.DocumentAutomation.runDaily','src/document/DocumentAutomation.js','private-capability-only'],['JSKOS.TaskAutomation.runDaily','src/task/TaskAutomation.js','private-capability-only'],['JSKOS.TaskNotifications.sendDaily','src/task/TaskNotifications.js','private-capability-only'],['JSKOS.MeetingAutomation.runDaily','src/meeting/MeetingAutomation.js','private-capability-only'],['JSKOS.EndorsementAutomation.runDaily','src/endorsement/EndorsementAutomation.js','private-capability-only']];namespaceManifest.forEach(item=>surfaces.set(item[1]+'#'+item[0],{symbol:item[0],path:item[1],baselineLine:null,currentLine:1,forcedBoundary:item[2]}));
  const admin=/^(?:migrate|ensureBuild|ensureWaLead|install|removeDaily|audit|createJSKOS|getJSKOS|send(?:Queued|Meta|WaLead|Executive)|process|runDaily|runWaLead|triggerWaLead|reconcile|repair)/,webhook=/^handleMetaWhatsAppWebhook/,read=/^(?:api.*(?:Get|Search|Health|Summary|By|Renewal)|get|search)/;const inventory=Array.from(surfaces.values()).map(entry=>Object.assign(entry,{classification:entry.forcedBoundary?'private-trusted-system':webhook.test(entry.symbol)?'webhook-existing-boundary':admin.test(entry.symbol)?'admin-or-trusted':read.test(entry.symbol)?'authenticated-read':'authorized-user',permissionOrBoundary:entry.forcedBoundary|| (webhook.test(entry.symbol)?'existing webhook verification boundary':admin.test(entry.symbol)?'LegacyMutationAuthority.requireAdmin or private trusted capability':'LegacyMutationAuthority.requireUser/module operation'),probeIds:[entry.symbol.startsWith('api')?'A01':entry.symbol.startsWith('test')?'C16':'C17']})).sort((a,b)=>(a.path+a.symbol).localeCompare(b.path+b.symbol));
  const mandatory=['createJSKOSProductionBackup','getJSKOSReleaseReadinessStatus','migrateCompanyDatabase','migratePeopleDatabase','migratePolicyDatabase','migrateDocumentDatabase','migrateTaskDatabase','migrateMeetingDatabase','migrateCommunicationDatabase','migrateClaimDatabase','migrateEndorsementDatabase','migrateQuoteDatabase','migrateRevenueDatabase','ensureBuild1002Automation','ensureBuild1004Tasks','ensureBuild1005Meetings','ensureBuild1006Communications','ensureBuild1007Claims','ensureBuild1008Documents','ensureBuild1009Endorsements','ensureBuild1010Quotes','ensureBuild1011Revenue','installDocumentExpiryTrigger','ensureWaLeadCommunicationAutomation','processMetaWhatsAppOutbox','sendMetaWhatsAppLiveTest','processWaLeadWhatsAppOutbox','sendWaLeadWhatsAppLiveTest','triggerWaLeadRenewalTemplateLiveTest','runDailyTaskAutomation','runDailyTaskNotifications','runDailyMeetingAutomation','runDailyDocumentExpiryAutomation','runDailyEndorsementAutomation','runDailyQuoteAutomation','runDailyRenewalAutomation','runDailyRevenueAutomation','installAllAutomationTriggers','auditAutomationTriggers'];
  const names=new Set(inventory.map(x=>x.symbol));mandatory.forEach(name=>assert(names.has(name),'Public inventory missing '+name));const stale=inventory.filter(item=>item.baselineLine===null&&item.currentLine===null);assert(!stale.length,'Stale public manifest entries: '+stale.map(x=>x.symbol).join(','));
  const allSource=currentFiles.map(file=>source(file)).join('\n');assert(!/function\s+(?:runDaily\w+Automation_|process\w+Outbox_)\s*\([^)]*payload/i.test(allSource),'Private worker accepts browser payload');assert(source('src/core/Router.js').indexOf('bootstrapBuild1002Automation_();')===-1,'Router still bootstraps before authorization');
  return{success:true,scanner:{baselineFiles:baselineFiles.length,currentFiles:currentFiles.length,lexicalStates:['comments','quoted strings','template literals','brace depth'],unionEntries:inventory.length},inventory:inventory,mandatory:mandatory};
}

function releaseGates(){
  const config=source('src/core/Config.js');assert(/APP:\s*Object\.freeze\(\{[\s\S]*?VERSION:\s*'1\.5\.14'/.test(config),'Runtime version is not 1.5.14');
  const js=[];function walk(dir){fs.readdirSync(dir,{withFileTypes:true}).forEach(entry=>{const full=path.join(dir,entry.name);if(entry.isDirectory())walk(full);else if(entry.name.endsWith('.js'))js.push(full);});}walk(path.join(root,'src'));js.forEach(file=>childProcess.execFileSync(process.execPath,['--check',file],{stdio:'pipe'}));
  const html=[];function walkHtml(dir){fs.readdirSync(dir,{withFileTypes:true}).forEach(entry=>{const full=path.join(dir,entry.name);if(entry.isDirectory())walkHtml(full);else if(entry.name.endsWith('.html'))html.push(full);});}walkHtml(path.join(root,'src'));let blocks=0;html.forEach(file=>{const text=fs.readFileSync(file,'utf8'),pattern=/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;let match;while((match=pattern.exec(text))){new Function(match[1].replace(/<\?[!=]?[\s\S]*?\?>/g,'null'));blocks++;}});assert(blocks>0,'No browser script blocks parsed');
  childProcess.execFileSync('git',['diff','--check'],{cwd:root,stdio:'pipe'});const changed=childProcess.execFileSync('git',['diff','--name-only',baseline],{cwd:root,encoding:'utf8'}).split(/\r?\n/).filter(Boolean);assert(changed.length>0,'Build 1025 diff is empty');const status=childProcess.execFileSync('git',['status','--short'],{cwd:root,encoding:'utf8'});assert(!status.trim(),'Checkpoint worktree is not clean: '+status.trim());
  const manifest=source('src/appsscript.json'),manifestBlob=childProcess.execFileSync('git',['hash-object','src/appsscript.json'],{cwd:root,encoding:'utf8'}).trim(),baselineManifestBlob=childProcess.execFileSync('git',['rev-parse',baseline+':src/appsscript.json'],{cwd:root,encoding:'utf8'}).trim();assert(manifestBlob===baselineManifestBlob,'Manifest changed');JSON.parse(manifest);
  const ignore=source('.claspignore');assert(ignore.includes('core/Build1025SecurityTest.js'),'Build 1025 source test is upload-eligible');const sourceTests=js.filter(file=>/Test\.js$/.test(file)).map(file=>path.relative(path.join(root,'src'),file).replace(/\\/g,'/'));const missed=sourceTests.filter(file=>!ignore.split(/\r?\n/).includes(file));assert(!missed.length,'Source tests missing exact clasp exclusions: '+missed.join(', '));
  const diff=childProcess.execFileSync('git',['diff','--unified=0',baseline],{cwd:root,encoding:'utf8'});assert(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|AIza[0-9A-Za-z_-]{30,}|(?:api[_-]?key|secret|token)\s*[:=]\s*["'][^"']{16,}["']/i.test(diff),'Credential-like material in diff');
  return{success:true,productionJs:js.length,browserBlocks:blocks,changedFiles:changed,manifestBlob:manifestBlob,sourceTestsExcluded:sourceTests.length};
}

const tests=[
  {name:'AUTHORITY_AND_ZERO_EFFECT_DENIAL',assertions:['A01','A02','A03','A04','A05','A06','A07','A08','A09','A10','A11','A12','A13','A14','A15','B09','C08','C09','C11'],run:authorityProbe},
  {name:'SEVEN_MODULE_ACTOR_AND_AUDIT_SINKS',assertions:['B01','B02','B03','B04','B05','B06','B07','B08','B10','B11','C12'],run:actorAndDenialProbes},
  {name:'PRIVILEGED_AND_TRUSTED_SURFACE',assertions:['C01','C02','C03','C04','C05','C06','C07','C10','C13','C14','C15','C16','C17'],run:staticAndInventory},
  {name:'CONCURRENCY_AND_UI',assertions:['D01','D02','D03','D04','D05','D06','D07','D08','D09','D10','D11','D12','D13'],run:versionValidation},
  {name:'MIGRATION_REQUIRED_READ_ALIASES',assertions:['E01','E02','E03','E04','E05','E06','E07','E08','E09','E10','E11','E12'],run:readAliasProbes},
  {name:'RELEASE_AND_REGRESSION_GATES',assertions:['F01','F02','F03','F04','F05','F06','F07','F08','F09','F10','F11','F12','F13','F14','F15'],run:releaseGates}
];
const results=tests.map(test=>{try{return{name:test.name,success:true,assertions:test.assertions,result:test.run()};}catch(error){return{name:test.name,success:false,assertions:test.assertions,error:error&&error.stack?error.stack:String(error)};}}),observed=new Set(results.flatMap(x=>x.assertions)),missing=assertionIds.filter(id=>!observed.has(id)),unknown=Array.from(observed).filter(id=>!assertionIds.includes(id));if(missing.length||unknown.length)results.push({name:'ASSERTION_COVERAGE',success:false,assertions:[],error:'missing='+missing.join(',')+' unknown='+unknown.join(',')});else results.push({name:'ASSERTION_COVERAGE',success:true,assertions:[],result:{expected:assertionIds.length,observed:observed.size}});const failed=results.filter(x=>!x.success),report={build:1025,passed:results.length-failed.length,failed:failed.length,assertionCount:assertionIds.length,results:results};process.stdout.write(JSON.stringify(report,null,2)+'\n');if(failed.length)process.exitCode=1;
