/** JSK OS Build 1006 - Communication Hub service and APIs. */
var JSKOS=JSKOS||{};
JSKOS.CommunicationService=Object.freeze({
  queue:function(data,authority){JSKOS.LegacyMutationAuthority.assertUser(authority);requireBuild1006Communications_();var lock=LockService.getScriptLock();lock.waitLock(30000);try{return new CommunicationRepository().queue(data,JSKOS.LegacyMutationAuthority.actor(authority));}finally{lock.releaseLock();}},
  search:function(criteria,authority){JSKOS.LegacyMutationAuthority.assertUser(authority);requireBuild1006Communications_();return new CommunicationRepository().search(criteria||{});},
  summary:function(criteria,authority){
    JSKOS.LegacyMutationAuthority.assertUser(authority);requireBuild1006Communications_();
    var items=new CommunicationRepository().search(criteria||{}).items;
    var counts={total:items.length,queued:0,sent:0,delivered:0,read:0,failed:0};
    items.forEach(function(item){var key=String(item.status||'').toLowerCase();if(counts[key]!==undefined)counts[key]++;});
    return counts;
  },
  retry:function(communicationId,authority,expectedVersion){
    JSKOS.LegacyMutationAuthority.assertUser(authority);requireBuild1006Communications_();
    var repository=new CommunicationRepository();
    var item=repository.findById(communicationId);
    if(!item)throw new Error('Communication not found.');
    if(item.status!=='Failed')throw new Error('Only failed communications can be retried.');
    if(/(?:META|WALEAD)-LIVE-TEST-/i.test(String(item.idempotencyKey||'')))throw new Error('Controlled live-test rows cannot be retried.');
    return repository.update(communicationId,{status:'Queued',attemptCount:0,nextRetryAt:'',lastError:''},JSKOS.LegacyMutationAuthority.actor(authority),expectedVersion);
  }
});
function communicationApiExecute_(operation,callback){try{var authority=JSKOS.LegacyMutationAuthority.requireUser('communications',operation);requireBuild1006Communications_();return{success:true,data:callback(authority),error:null,meta:{operation:operation,timestamp:new Date().toISOString()}};}catch(error){console.error('Communication API '+operation+' failed: '+(error.stack||error));return{success:false,data:null,error:{name:error.name||'Error',message:error.message||String(error),code:error.code||'',details:error.currentVersion?{currentVersion:error.currentVersion}:{} }};}}
function apiCommunicationQueue(payload){return communicationApiExecute_('queue',function(authority){var request=payload&&typeof payload==='object'?payload:{};return JSKOS.CommunicationService.queue(request.data||{},authority);});}
function apiCommunicationSearch(payload){return communicationApiExecute_('search',function(authority){return JSKOS.CommunicationService.search(payload||{},authority);});}
function apiCommunicationSummary(payload){return communicationApiExecute_('summary',function(authority){return JSKOS.CommunicationService.summary(payload||{},authority);});}
function apiCommunicationRetry(payload){return communicationApiExecute_('retry',function(authority){var request=payload&&typeof payload==='object'?payload:{};return JSKOS.CommunicationService.retry(request.communicationId,authority,request.expectedVersion);});}
function apiCommunicationUpdate(payload){return communicationApiExecute_('update',function(authority){var request=payload&&typeof payload==='object'?payload:{};requireBuild1006Communications_();return new CommunicationRepository().update(request.communicationId,request.data||{},JSKOS.LegacyMutationAuthority.actor(authority),request.expectedVersion);});}
