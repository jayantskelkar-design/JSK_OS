/** JSK OS Build 1006 - Communication Hub service and APIs. */
var JSKOS=JSKOS||{};
JSKOS.CommunicationService=Object.freeze({
  queue:function(data,actor){ensureBuild1006Communications();var lock=LockService.getScriptLock();lock.waitLock(30000);try{return new CommunicationRepository().queue(data,actor);}finally{lock.releaseLock();}},
  search:function(criteria){ensureBuild1006Communications();return new CommunicationRepository().search(criteria||{});}
});
function communicationApiExecute_(operation,callback){try{return{success:true,data:callback(),error:null,meta:{operation:operation,timestamp:new Date().toISOString()}};}catch(error){console.error('Communication API '+operation+' failed: '+(error.stack||error));return{success:false,data:null,error:{name:error.name||'Error',message:error.message||String(error),code:error.code||'',details:error.currentVersion?{currentVersion:error.currentVersion}:{} }};}}
function apiCommunicationQueue(payload){return communicationApiExecute_('queue',function(){var request=payload&&typeof payload==='object'?payload:{};return JSKOS.CommunicationService.queue(request.data||{},request.actor);});}
function apiCommunicationSearch(payload){return communicationApiExecute_('search',function(){return JSKOS.CommunicationService.search(payload||{});});}
function apiCommunicationUpdate(payload){return communicationApiExecute_('update',function(){var request=payload&&typeof payload==='object'?payload:{};ensureBuild1006Communications();return new CommunicationRepository().update(request.communicationId,request.data||{},request.actor,request.expectedVersion);});}
