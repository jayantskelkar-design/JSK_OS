/** JSK OS Build 1009 - Endorsement public API. */
function endorsementApi_(op,fn){try{return{success:true,data:JSON.parse(JSON.stringify(fn())),error:null,meta:{operation:op}};}catch(e){return{success:false,data:null,error:{message:e.message||String(e),code:e.code||'',details:e.currentVersion?{currentVersion:e.currentVersion}:{}}};}}
function endorsementRepo_(){return new EndorsementRepository();}
function apiEndorsementCreate(p){p=p||{};return endorsementApi_('create',function(){return endorsementRepo_().create(p.data||p,p.actor);});}
function apiEndorsementUpdate(p){p=p||{};return endorsementApi_('update',function(){return endorsementRepo_().update(p.endorsementId,p.data||{},p.actor,p.expectedVersion);});}
function apiEndorsementDelete(p){p=p||{};return endorsementApi_('delete',function(){return endorsementRepo_().remove(p.endorsementId,p.actor,p.expectedVersion);});}
function apiEndorsementSearch(p){return endorsementApi_('search',function(){return endorsementRepo_().search(p||{});});}
function getEndorsementFilters(){return{types:JSK_ENDORSEMENT_SCHEMA.TYPE_VALUES.slice(),statuses:JSK_ENDORSEMENT_SCHEMA.STATUS_VALUES.slice(),priorities:JSK_ENDORSEMENT_SCHEMA.PRIORITY_VALUES.slice()};}
