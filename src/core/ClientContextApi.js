/** Build 1015 permission-protected contextual search adapters. */
function clientContextApi_(moduleName, callback) {
  try {
    JSKOS.AccessControl.requireModuleOperation(moduleName, 'view');
    return {success:true,data:JSON.parse(JSON.stringify(callback())),error:null};
  } catch(error) {
    return {success:false,data:null,error:{code:error.code||'CONTEXT_SEARCH_ERROR',message:error.code==='FORBIDDEN'?'You do not have permission to view this data.':'Contextual search is unavailable.'}};
  }
}

function contextualRepositoryResult_(repository, criteria, options) {
  criteria=criteria||{};options=options||{};
  var context=JSKOS.ClientContext.normalize(criteria,{policyLimit:options.policyLimit});
  var base={},queryCount=0,result={items:[]},unsupported=false;
  ['query','status','claimType','documentType','category','paymentStatus','meetingType','owner','priority','dateView','endorsementType'].forEach(function(key){if(criteria[key]!==undefined)base[key]=criteria[key];});
  if(!context.active){result=repository.search(criteria);queryCount=1;}
  else if(context.companyId){base.companyId=context.companyId;result=repository.search(base);queryCount=1;}
  else if(context.policyIds.length&&options.supportsPolicyIds){base.policyIds=context.policyIds;result=repository.search(base);queryCount=1;}
  else if(context.policyIds.length&&options.supportsPolicyId){var items=[];context.policyIds.forEach(function(id){base.policyId=id;items=items.concat((repository.search(base).items||[]));queryCount++;});result={items:items};}
  else if(context.personId&&options.safePersonFallback){base.personId=context.personId;result=repository.search(base);queryCount=1;}
  else{unsupported=true;result={items:[]};}
  var filtered=JSKOS.ClientContext.filter(result.items||[],context,{limit:criteria.limit,queryCount:queryCount});
  filtered.meta.unsupported=unsupported;
  return filtered;
}

function apiContextQuoteSearch(payload){return clientContextApi_('quotes',function(){return contextualRepositoryResult_(new QuoteRepository(),payload,{supportsPolicyId:false,safePersonFallback:true});});}
function apiContextRevenueSearch(payload){return clientContextApi_('revenue',function(){return contextualRepositoryResult_(new RevenueRepository(),payload,{supportsPolicyId:true});});}
function apiContextEndorsementSearch(payload){return clientContextApi_('endorsements',function(){return contextualRepositoryResult_(new EndorsementRepository(),payload,{supportsPolicyIds:true});});}
