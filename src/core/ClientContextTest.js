/** Build 1015 shared Client Context contracts. */
function testBuild1015ClientContextNormalization() {
  var context=JSKOS.ClientContext.normalize({companyId:' com-1 ',personId:'per-1',policyIds:['pol-1','POL-1','bad id','POL-2']});
  if(context.companyId!=='COM-1'||context.personId!=='PER-1'||context.policyIds.join(',')!=='POL-1,POL-2'||!context.malformed)throw new Error('Client context normalization failed.');
  var empty=JSKOS.ClientContext.normalize({});if(empty.active||empty.malformed)throw new Error('Empty context changed normal behavior.');
  return{success:true};
}
function testBuild1015PolicyIdBounds() {
  var ids=[];for(var i=0;i<120;i++)ids.push('POL-'+i);var context=JSKOS.ClientContext.normalize({policyIds:ids},{policyLimit:50});
  if(context.policyIds.length!==50||!context.meta.truncated||context.meta.available!==120)throw new Error('policyIds bounds failed.');
  return{success:true};
}
function testBuild1015ContextMatching() {
  var context={companyId:'COM-1',personId:'PER-1',policyIds:['POL-1']};
  if(!JSKOS.ClientContext.matches({companyId:'com-1',personId:'per-1',policyId:'pol-1'},context))throw new Error('Context match failed.');
  if(JSKOS.ClientContext.matches({companyId:'COM-2',personId:'PER-1',policyId:'POL-1'},context))throw new Error('Company isolation failed.');
  return{success:true};
}
function testBuild1015ContextPreservationAndClear() {
  var context=JSKOS.ClientContext.normalize({companyId:'COM-1',personId:'PER-1',policyIds:['POL-1']});
  if(JSKOS.ClientContext.query(context)!=='companyId=COM-1&personId=PER-1&policyIds=POL-1')throw new Error('Context query preservation failed.');
  if(JSKOS.ClientContext.query(JSKOS.ClientContext.normalize({}))!=='')throw new Error('Clear context failed.');
  return{success:true};
}
function testBuild1015ContextualRepositoryIsolation() {
  var calls=0,repo={search:function(criteria){calls++;var items=[{quoteId:'Q1',companyId:'COM-1',personId:'PER-1'},{quoteId:'Q2',companyId:'COM-1',personId:'PER-2'},{quoteId:'Q3',companyId:'COM-2',personId:'PER-1'}];return{items:criteria.companyId?items.filter(function(x){return x.companyId===criteria.companyId;}):items};}};
  var result=contextualRepositoryResult_(repo,{companyId:'COM-1',personId:'PER-1'},{supportsPolicyId:false});
  if(result.items.length!==1||result.items[0].quoteId!=='Q1'||calls!==1||result.meta.queryCount!==1)throw new Error('Contextual quote isolation failed.');
  var unsupported=contextualRepositoryResult_(repo,{personId:'PER-1'},{supportsPolicyId:false});
  if(unsupported.items.length||!unsupported.meta.unsupported)throw new Error('Unsupported context exposed unrelated records.');
  var fallback=contextualRepositoryResult_(repo,{personId:'PER-1'},{safePersonFallback:true});
  if(fallback.items.length!==2||fallback.items.some(function(x){return x.personId!=='PER-1';}))throw new Error('Safe Person fallback leaked unrelated records.');
  return{success:true};
}
function testBuild1015PolicyContextFallback() {
  var calls=0,repo={search:function(criteria){calls++;return{items:[{revenueId:'R-'+criteria.policyId,policyId:criteria.policyId}]};}};
  var result=contextualRepositoryResult_(repo,{policyIds:['POL-1','POL-2']},{supportsPolicyId:true});
  if(result.items.length!==2||calls!==2||result.meta.queryCount!==2)throw new Error('Bounded policy context fallback failed.');
  return{success:true};
}
