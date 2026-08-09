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
