/** JSK OS Build 1006 - Communication Hub service and APIs. */
var JSKOS=JSKOS||{};
JSKOS.CommunicationService=Object.freeze({
  queue:function(data,actor){ensureBuild1006Communications();var lock=LockService.getScriptLock();lock.waitLock(30000);try{return new CommunicationRepository().queue(data,actor);}finally{lock.releaseLock();}},
  search:function(criteria){ensureBuild1006Communications();return new CommunicationRepository().search(criteria||{});},
  summary:function(criteria){
    ensureBuild1006Communications();
    var items=new CommunicationRepository().search(criteria||{}).items;
    var counts={total:items.length,queued:0,sent:0,delivered:0,read:0,failed:0};
    items.forEach(function(item){var key=String(item.status||'').toLowerCase();if(counts[key]!==undefined)counts[key]++;});
    return counts;
  },
  retry:function(communicationId,actor,expectedVersion){
    ensureBuild1006Communications();
    var repository=new CommunicationRepository();
    var item=repository.findById(communicationId);
    if(!item)throw new Error('Communication not found.');
    if(item.status!=='Failed')throw new Error('Only failed communications can be retried.');
    if(/(?:META|WALEAD)-LIVE-TEST-/i.test(String(item.idempotencyKey||'')))throw new Error('Controlled live-test rows cannot be retried.');
    return repository.update(communicationId,{status:'Queued',attemptCount:0,nextRetryAt:'',lastError:''},actor,expectedVersion);
  }
});
function communicationApiExecute_(operation,callback){try{return{success:true,data:callback(),error:null,meta:{operation:operation,timestamp:new Date().toISOString()}};}catch(error){console.error('Communication API '+operation+' failed: '+(error.stack||error));return{success:false,data:null,error:{name:error.name||'Error',message:error.message||String(error),code:error.code||'',details:error.currentVersion?{currentVersion:error.currentVersion}:{} }};}}
function apiCommunicationQueue(payload){return communicationApiExecute_('queue',function(){var request=payload&&typeof payload==='object'?payload:{};return JSKOS.CommunicationService.queue(request.data||{},request.actor);});}
function apiCommunicationSearch(payload){return communicationApiExecute_('search',function(){return JSKOS.CommunicationService.search(payload||{});});}
function apiCommunicationSummary(payload){return communicationApiExecute_('summary',function(){return JSKOS.CommunicationService.summary(payload||{});});}
function apiCommunicationRetry(payload){return communicationApiExecute_('retry',function(){var request=payload&&typeof payload==='object'?payload:{};return JSKOS.CommunicationService.retry(request.communicationId,request.actor,request.expectedVersion);});}
function apiCommunicationUpdate(payload){return communicationApiExecute_('update',function(){var request=payload&&typeof payload==='object'?payload:{};ensureBuild1006Communications();return new CommunicationRepository().update(request.communicationId,request.data||{},request.actor,request.expectedVersion);});}
