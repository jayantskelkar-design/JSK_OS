/** JSK OS Build 1017 - non-persistent Workflow Intent contract. */
var JSKOS=JSKOS||{};
JSKOS.WorkflowIntent=Object.freeze((function(){
  'use strict';
  function text_(value){return String(value||'').trim();}
  function action_(actionId,context,accessControl){return JSKOS.ClientAction.evaluate(context,{accessControl:accessControl}).actions.filter(function(item){return item.actionId===text_(actionId).toLowerCase();})[0]||null;}
  function relationship_(context,validator){if(!context.companyId||!context.personId)return{safe:true};try{return validator?validator(context):{safe:true};}catch(error){return{safe:false};}}
  function blocked_(actionId,context,status,reason,missing){return{actionId:text_(actionId),status:status,reasonCode:reason,missingFields:missing||[],context:{companyId:context.companyId,personId:context.personId,policyIds:context.policyIds.slice()},draftPayload:{},destinationModule:'',destinationRoute:'',reviewRequired:true,metadata:{build:1017,readOnly:true,persisted:false,sourceOwned:true,bounded:true}};}
  function prepare(actionId,input,options){
    options=options||{};var context=JSKOS.ClientContext.normalize(input||{},{policyLimit:50});
    if(context.malformed)return blocked_(actionId,context,'BLOCKED','ACTION_NOT_AVAILABLE');
    var action=action_(actionId,context,options.accessControl);
    if(!action)return blocked_(actionId,context,'UNSUPPORTED','UNSUPPORTED_ACTION');
    var relationship=relationship_(context,options.relationshipValidator);
    if(!relationship.safe)return blocked_(actionId,context,'BLOCKED','ACTION_NOT_AVAILABLE');
    if(action.status==='BLOCKED')return blocked_(action.actionId,context,'BLOCKED','ACTION_NOT_AVAILABLE');
    if(action.status==='UNSUPPORTED')return blocked_(action.actionId,context,'UNSUPPORTED','UNSUPPORTED_ACTION');
    var draft={actionId:action.actionId,actionType:action.actionType,companyId:action.companyId,personId:action.personId,policyIds:action.policyIds.slice(),destinationModule:action.sourceModule};
    return{actionId:action.actionId,actionType:action.actionType,label:action.label,status:action.status,reasonCode:action.reasonCode,missingFields:action.missingFields.slice(),availableFields:Object.keys(draft).filter(function(key){return key!=='policyIds'?Boolean(draft[key]):draft[key].length>0;}),context:{companyId:action.companyId,personId:action.personId,policyIds:action.policyIds.slice()},draftPayload:draft,destinationModule:action.sourceModule,destinationRoute:action.targetRoute,reviewRequired:true,metadata:{build:1017,readOnly:true,persisted:false,sourceOwned:true,bounded:true}};
  }
  function handoff(actionId,input,options){var intent=prepare(actionId,input,options);if(intent.status!=='READY')return{status:intent.status,reasonCode:intent.reasonCode,href:'',reviewRequired:true,metadata:intent.metadata};var action=action_(actionId,intent.context,options&&options.accessControl);if(!action||action.status!=='READY')return{status:'BLOCKED',reasonCode:'ACTION_NOT_AVAILABLE',href:'',reviewRequired:true,metadata:intent.metadata};return{status:'READY',reasonCode:'READY',href:action.href,reviewRequired:true,metadata:intent.metadata};}
  return{prepare:prepare,handoff:handoff};
})());
