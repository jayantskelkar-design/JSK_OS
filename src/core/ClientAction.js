/** JSK OS Build 1016 - bounded, read-only Client Action readiness. */
var JSKOS = JSKOS || {};

JSKOS.ClientAction = Object.freeze((function () {
  'use strict';
  var STATUSES=Object.freeze({READY:'READY',BLOCKED:'BLOCKED',INCOMPLETE:'INCOMPLETE',UNSUPPORTED:'UNSUPPORTED'});
  var ROUTES=Object.freeze({companies:true,people:true,policies:true,quotes:true,endorsements:true});
  var CATALOG=Object.freeze([
    Object.freeze({actionId:'initiate-quote',actionType:'CREATE',label:'Initiate Quote',sourceModule:'quotes',targetRoute:'quotes',permission:'quotes.create',requiresAny:['companyId','personId']}),
    Object.freeze({actionId:'review-quotes',actionType:'REVIEW',label:'Review Quotes',sourceModule:'quotes',targetRoute:'quotes',permission:'quotes.view',requiresAny:['companyId','personId']}),
    Object.freeze({actionId:'open-policy',actionType:'OPEN',label:'Open Policy',sourceModule:'policies',targetRoute:'policies',permission:'policies.view',requires:['policyIds']}),
    Object.freeze({actionId:'review-renewal',actionType:'REVIEW',label:'Review Renewal',sourceModule:'policies',targetRoute:'policies',permission:'policies.view',requires:['policyIds']}),
    Object.freeze({actionId:'review-endorsements',actionType:'REVIEW',label:'Review Endorsements',sourceModule:'endorsements',targetRoute:'endorsements',permission:'endorsements.view',requires:['policyIds']}),
    Object.freeze({actionId:'open-company',actionType:'OPEN',label:'Open Company',sourceModule:'companies',targetRoute:'companies',permission:'companies.view',requires:['companyId']}),
    Object.freeze({actionId:'open-person',actionType:'OPEN',label:'Open Person',sourceModule:'people',targetRoute:'people',permission:'people.view',requires:['personId']})
  ]);

  function has_(context,field){return field==='policyIds'?context.policyIds.length>0:Boolean(context[field]);}
  function missing_(definition,context){
    var missing=(definition.requires||[]).filter(function(field){return!has_(context,field);});
    if(definition.requiresAny&&!definition.requiresAny.some(function(field){return has_(context,field);}))missing.push(definition.requiresAny.join(' or '));
    return missing;
  }
  function allowed_(accessControl,permission){
    return !accessControl||typeof accessControl.hasPermission!=='function'||accessControl.hasPermission(permission);
  }
  function href_(route,context,actionId){
    if(!ROUTES[route])return'';
    var query=['page='+encodeURIComponent(route),'clientAction='+encodeURIComponent(actionId)];
    if(context.companyId)query.push('companyId='+encodeURIComponent(context.companyId));
    if(context.personId)query.push('personId='+encodeURIComponent(context.personId));
    if(context.policyIds.length)query.push('policyIds='+encodeURIComponent(context.policyIds.join(',')));
    return'?'+query.join('&');
  }
  function descriptor_(definition,context,accessControl){
    var missing=missing_(definition,context),supported=Boolean(ROUTES[definition.targetRoute]),permitted=allowed_(accessControl,definition.permission);
    var status=!supported?STATUSES.UNSUPPORTED:!permitted?STATUSES.BLOCKED:missing.length?STATUSES.INCOMPLETE:context.malformed?STATUSES.BLOCKED:STATUSES.READY;
    var reason=status===STATUSES.BLOCKED?'ACTION_NOT_AVAILABLE':status===STATUSES.INCOMPLETE?'MISSING_CONTEXT':status===STATUSES.UNSUPPORTED?'UNSUPPORTED_DESTINATION':'READY';
    return{actionId:definition.actionId,actionType:definition.actionType,label:definition.label,sourceModule:definition.sourceModule,targetRoute:definition.targetRoute,companyId:context.companyId,personId:context.personId,policyIds:context.policyIds.slice(),permission:definition.permission,status:status,reasonCode:reason,missingFields:status===STATUSES.INCOMPLETE?missing:[],context:{companyId:context.companyId,personId:context.personId,policyIds:context.policyIds.slice()},metadata:{readOnly:true,sourceOwned:true,bounded:true},href:status===STATUSES.READY?href_(definition.targetRoute,context,definition.actionId):''};
  }
  function evaluate(input,options){
    options=options||{};
    var context=JSKOS.ClientContext.normalize(input||{}, {policyLimit:50});
    var actions=CATALOG.map(function(definition){return descriptor_(definition,context,options.accessControl);});
    return{status:context.active?(actions.some(function(x){return x.status===STATUSES.READY;})?STATUSES.READY:STATUSES.INCOMPLETE):STATUSES.INCOMPLETE,context:{companyId:context.companyId,personId:context.personId,policyIds:context.policyIds.slice()},actions:actions,metadata:{build:1016,readOnly:true,persisted:false,bounded:true,count:actions.length}};
  }
  return{STATUSES:STATUSES,catalog:function(){return CATALOG.map(function(x){return Object.assign({},x);});},evaluate:evaluate};
})());
