/** Client 360 v0.1 aggregation and regression tests. */
function client360TestFactories_(options) {
  options = options || {};
  var company = options.company === undefined ? { companyId: 'COM-1', companyName: 'Acme', status: 'Active', area: 'Central' } : options.company;
  var people = options.people === undefined ? [{ personId: 'PER-1', companyId: 'COM-1', fullName: 'Asha', mobile: '9999999999' }] : options.people;
  function records(name) { return options[name] || []; }
  function searchable(name) { return function () { return { search: function (criteria) { if(options.failSource===name)throw new Error('private repository failure');if(options.queryCounts)options.queryCounts[name]=(options.queryCounts[name]||0)+1;var items=records(name).filter(function(x){return(!criteria.companyId||x.companyId===criteria.companyId)&&(!criteria.personId||x.personId===criteria.personId);});return { items: items, total: items.length }; } }; }; }
  return {
    company: function () { return { findById: function (id) { return company && id === company.companyId ? company : null; } }; },
    people: function () { return {
      findById: function (id) { return people.filter(function (p) { return p.personId === id; })[0] || null; },
      findByCompanyId: function (id) { return people.filter(function (p) { return p.companyId === id; }); }
    }; },
    policy: function () { return { search: function (criteria) { var items=records('policies').filter(function(x){return(!criteria.companyId||x.companyId===criteria.companyId)&&(!criteria.personId||x.personId===criteria.personId);});return{items:items,pagination:{hasNext:false}}; } }; },
    claim: searchable('claims'), task: searchable('tasks'), meeting: searchable('meetings'),
    communication: searchable('communications'), document: searchable('documents'), quote: searchable('quotes'),
    endorsement: searchable('endorsements'), revenue: searchable('revenue')
  };
}

function client360TestService_(options, deniedModule, serviceOptions) {
  options=options||{};
  return new Client360Service({
    factories: client360TestFactories_(options),
    accessControl: { hasPermission: function (permission) { return permission !== deniedModule + '.view'; } },
    referenceDate: serviceOptions&&serviceOptions.referenceDate,
    limit: serviceOptions&&serviceOptions.limit,
    staleDays: serviceOptions&&serviceOptions.staleDays
  });
}

function testClient360CompanyResolution() {
  var result = client360TestService_({ policies: [{ policyId:'POL-1',companyId:'COM-1',policyNumber:'P1',policyStatus:'Active',updatedAt:'2026-08-01' }], tasks:[{taskId:'TSK-1',companyId:'COM-1',status:'Open'}], revenue:[{revenueId:'REV-1',companyId:'COM-1',netReceivable:1000,amountReceived:600,outstandingAmount:400,updatedAt:'2026-08-02'}] }).getClient360({companyId:'COM-1'});
  if(result.identity.type!=='Company'||result.identity.id!=='COM-1'||result.summary.policies!==1||result.summary.openTasks!==1||result.summary.financial.outstanding!==400||result.timeline.length!==2)throw new Error('Company resolution aggregation failed.');
  return {success:true,identity:result.identity,summary:result.summary};
}

function testClient360PersonResolution() {
  var result = client360TestService_({ policies:[{policyId:'POL-C',companyId:'COM-1'},{policyId:'POL-P',personId:'PER-1'}] }).getClient360({personId:'PER-1'});
  if(result.identity.type!=='Person'||result.relationships.company.companyId!=='COM-1'||result.sections.policies.total!==2)throw new Error('Person and company relationship resolution failed.');
  return {success:true,policyCount:result.sections.policies.total};
}

function testClient360EmptyAndUnavailableSources() {
  var result=client360TestService_({},'revenue').getClient360({companyId:'COM-1'});
  if(result.timeline.length!==0||result.sections.claims.total!==0||result.sections.revenue.authorized!==false||result.summary.financial.outstanding!==0)throw new Error('Empty or unavailable source contract failed.');
  return {success:true};
}

function testClient360MissingRelationships() {
  var service=client360TestService_({company:null,people:[{personId:'PER-X',fullName:'Independent'}]});
  var result=service.getClient360({personId:'PER-X'});
  if(result.relationships.company!==null||result.identity.personId!=='PER-X')throw new Error('Independent person relationship handling failed.');
  var missing=false;try{service.getClient360({personId:'PER-MISSING'});}catch(error){missing=error.code==='CLIENT_360_NOT_FOUND';}
  if(!missing)throw new Error('Missing person did not return Client 360 not-found error.');
  var mismatch=false;try{client360TestService_({company:{companyId:'COM-2',companyName:'Other'}}).getClient360({companyId:'COM-2',personId:'PER-1'});}catch(error){mismatch=error.code==='CLIENT_360_VALIDATION_ERROR';}
  if(!mismatch)throw new Error('Mismatched Company and Person IDs were accepted.');
  return {success:true};
}

function testClient360AuthorizationContract() {
  if(JSK_ACCESS.ROUTE_PERMISSIONS.client360!=='client360.view')throw new Error('Client 360 route is not protected.');
  if(JSKOS.AccessControl.getOperationPermission('client360','view')!=='client360.view')throw new Error('Client 360 API permission mapping failed.');
  if(typeof apiClient360Get!=='function'||typeof client360ApiExecute_!=='function')throw new Error('Client 360 API is unavailable.');
  return {success:true};
}

function testClient360UiRendering() {
  var content=renderClient360Ui({companyId:'COM-1'}).getContent(),markers=['Client 360','clientLookup','apiClient360Get','Financial summary','Recent activity','Needs Attention','healthBanner'];
  var missing=markers.filter(function(x){return content.indexOf(x)===-1;});
  if(missing.length)throw new Error('Client 360 UI markers missing: '+missing.join(', '));
  return {success:true,markersChecked:markers.length};
}

function testClient360RegressionSafety() {
  var checks={companyApi:typeof apiCompanyGet==='function',peopleApi:typeof apiPeopleGet==='function',companyRoute:JSKOS.Router.resolve({parameter:{page:'companies'}})==='companies',peopleRoute:JSKOS.Router.resolve({parameter:{page:'people'}})==='people',clientRoute:JSKOS.Router.resolve({parameter:{page:'client360'}})==='client360'};
  var failed=Object.keys(checks).filter(function(k){return!checks[k];});if(failed.length)throw new Error('Client 360 regression contract failed: '+failed.join(', '));return{success:true,checks:checks};
}

function testClient360FilterRegressionSafety() {
  var communication=Object.create(CommunicationRepository.prototype);
  communication._entries=function(){return[{record:{'Communication ID':'C1','Company ID':'COM-1','Person ID':'PER-1','Is Deleted':false}},{record:{'Communication ID':'C2','Company ID':'COM-2','Person ID':'PER-2','Is Deleted':false}}];};
  communication._bool=function(v){return v===true;};communication._format=function(r){return{communicationId:r['Communication ID'],companyId:r['Company ID'],personId:r['Person ID']};};
  var allCommunications=communication.search({}).items,linkedCommunications=communication.search({companyId:'COM-1',personId:'PER-1'}).items;
  var revenue=Object.create(RevenueRepository.prototype);revenue.h=['Revenue ID'];revenue.sheet={getLastRow:function(){return 3;},getRange:function(){return{getValues:function(){return[[{revenueId:'R1',companyId:'COM-1',policyId:'P1'}],[{revenueId:'R2',companyId:'COM-2',policyId:'P2'}]];}};}};revenue.obj_=function(row){return row[0];};
  var allRevenue=revenue.search({}).items,linkedRevenue=revenue.search({companyId:'COM-1',policyId:'P1'}).items;
  if(allCommunications.length!==2||linkedCommunications.length!==1||allRevenue.length!==2||linkedRevenue.length!==1)throw new Error('Backward-compatible linked filter regression failed.');
  return{success:true};
}

function testBuild1014AttentionRankingAndDateBoundaries() {
  var result=client360TestService_({
    policies:[
      {policyId:'P30',companyId:'COM-1',policyNumber:'P30',renewalDate:'2026-09-08'},
      {policyId:'P60',companyId:'COM-1',policyNumber:'P60',renewalDate:'2026-10-08'},
      {policyId:'P90',companyId:'COM-1',policyNumber:'P90',renewalDate:'2026-11-07'},
      {policyId:'P91',companyId:'COM-1',renewalDate:'2026-11-08'},
      {policyId:'BAD',companyId:'COM-1',renewalDate:'not-a-date'}
    ],
    tasks:[{taskId:'T-OVER',companyId:'COM-1',title:'Overdue',status:'Open',dueDate:'2026-08-08'}],
    claims:[{claimId:'C-OPEN',companyId:'COM-1',status:'Open'}]
  },'',{referenceDate:'2026-08-09'}).getClient360({companyId:'COM-1'});
  var renewals=result.attention.filter(function(x){return x.kind==='renewal';});
  if(renewals.length!==3||renewals[0].daysUntil!==30||renewals[1].daysUntil!==60||renewals[2].daysUntil!==90)throw new Error('30/60/90 renewal boundaries failed.');
  if(result.attention[0].kind!=='overdue-task'||result.attention[0].priority!==1)throw new Error('Deterministic attention priority failed.');
  return{success:true,attention:result.attention.length};
}

function testBuild1014DuplicatePreventionAndQueryBounds() {
  var counts={},options={queryCounts:counts,claims:[{claimId:'CL-1',companyId:'COM-1',personId:'PER-1'},{claimId:'CL-1',companyId:'COM-1',personId:'PER-1'}]};
  var result=client360TestService_(options,'',{referenceDate:'2026-08-09'}).getClient360({companyId:'COM-1',personId:'PER-1'});
  if(result.sections.claims.total!==1)throw new Error('Duplicate claim was not removed.');
  if(counts.claims!==1||result.sections.claims.pagination.queryCount!==1)throw new Error('Linked query bound failed.');
  return{success:true,queryCount:counts.claims};
}

function testBuild1014PartialFailureAndDiagnostics() {
  var result=client360TestService_({failSource:'claims',tasks:[{taskId:'T1',companyId:'COM-1',status:'Open'}]},'',{referenceDate:'2026-08-09'}).getClient360({companyId:'COM-1'});
  if(result.meta.sourceHealth.state!=='partial'||result.sections.claims.state!=='failed'||result.sections.tasks.total!==1)throw new Error('Partial-source resilience failed.');
  if(result.sections.claims.error!=='Source unavailable.'||JSON.stringify(result).indexOf('private repository failure')!==-1)throw new Error('Diagnostics exposed repository information.');
  return{success:true};
}

function testBuild1014AuthorizationIsolation() {
  var result=client360TestService_({revenue:[{revenueId:'SECRET',companyId:'COM-1',outstandingAmount:999}]},'revenue',{referenceDate:'2026-08-09'}).getClient360({companyId:'COM-1'});
  if(result.sections.revenue.state!=='unauthorized'||result.sections.revenue.items.length||result.summary.financial.outstanding!==0)throw new Error('Unauthorized revenue leaked into Client 360.');
  if(result.attention.some(function(x){return x.module==='revenue';}))throw new Error('Unauthorized revenue leaked into attention intelligence.');
  return{success:true};
}

function testBuild1014PersonQuoteIsolation() {
  var result=client360TestService_({company:null,people:[{personId:'PER-X',fullName:'Independent'}],quotes:[{quoteId:'Q-X',personId:'PER-X'},{quoteId:'Q-OTHER',personId:'PER-OTHER'}]},'',{referenceDate:'2026-08-09'}).getClient360({personId:'PER-X'});
  if(result.sections.quotes.total!==1||result.sections.quotes.items[0].quoteId!=='Q-X')throw new Error('Person quote isolation failed.');
  return{success:true};
}

function testBuild1014DeepLinkContext() {
  var result=client360TestService_({},'',{referenceDate:'2026-08-09'}).getClient360({companyId:'com-1',personId:'per-1'});
  if(result.navigation.claims!=='?page=claims&companyId=COM-1&personId=PER-1'||result.sections.claims.links!==result.navigation.claims)throw new Error('Deep-link context was not preserved.');
  return{success:true};
}

function testBuild1014LimitsAndStaleStates() {
  var tasks=[];for(var i=0;i<20;i++)tasks.push({taskId:'T'+i,companyId:'COM-1',status:'Completed',updatedAt:'2025-01-01'});
  var result=client360TestService_({tasks:tasks},'',{referenceDate:'2026-08-09',limit:10,staleDays:90}).getClient360({companyId:'COM-1'});
  if(result.sections.tasks.total!==10||!result.sections.tasks.pagination.truncated||result.sections.tasks.state!=='stale')throw new Error('Limit, pagination, or stale-state contract failed.');
  return{success:true};
}

function testBuild1014ReadOnlyEnforcement() {
  ['create','update','remove','delete','archive'].forEach(function(name){if(typeof Client360Service.prototype[name]==='function')throw new Error('Client 360 exposes mutating method: '+name);});
  if(typeof apiClient360Get!=='function'||typeof apiClient360Create==='function'||typeof apiClient360Update==='function')throw new Error('Client 360 API read-only boundary failed.');
  return{success:true};
}

function testBuild1014BackwardCompatibility() {
  var result=client360TestService_({},'',{referenceDate:'2026-08-09'}).getClient360({companyId:'COM-1'});
  if(!result.identity||!result.relationships||!result.sections||!result.summary||!result.timeline||result.meta.readOnly!==true)throw new Error('Client 360 v0.1 response contract changed incompatibly.');
  if(typeof apiCompanyGet!=='function'||typeof apiPeopleGet!=='function')throw new Error('Existing Company/People APIs unavailable.');
  return{success:true};
}

function testBuild1015RelationshipIntegrity() {
  var result=client360TestService_({people:[{personId:'PER-1',companyId:'COM-1',fullName:'Asha'},{personId:'PER-1',companyId:'COM-1',fullName:'Duplicate'}]},'',{referenceDate:'2026-08-09'}).getClient360({companyId:'COM-1'});
  var integrity=result.relationships.integrity;
  if(integrity.count!==1||integrity.items[0].code!=='DUPLICATE_PERSON_REFERENCE'||integrity.readOnly!==true)throw new Error('Duplicate relationship detection failed.');
  var orphan=client360TestService_({company:null,people:[{personId:'PER-X',companyId:'COM-X',fullName:'Orphan'}]},'',{referenceDate:'2026-08-09'}).getClient360({personId:'PER-X'});
  if(!orphan.relationships.integrity.items.some(function(x){return x.code==='ORPHANED_PERSON_COMPANY';}))throw new Error('Orphan relationship detection failed.');
  return{success:true};
}

function testBuild1015EndorsementBatching() {
  var counts={},result=client360TestService_({queryCounts:counts,policies:[{policyId:'POL-1',companyId:'COM-1'},{policyId:'POL-2',companyId:'COM-1'}],endorsements:[{endorsementId:'END-1',companyId:'COM-1',policyId:'POL-1'}]},'',{referenceDate:'2026-08-09'}).getClient360({companyId:'COM-1'});
  if(counts.endorsements!==1||result.sections.endorsements.pagination.queryCount!==1)throw new Error('Endorsement batching failed.');
  return{success:true};
}

function testBuild1015UnifiedContextMetadata() {
  var result=client360TestService_({},'',{referenceDate:'2026-08-09'}).getClient360({companyId:' com-1 ',personId:'per-1',policyIds:['POL-1','POL-1','bad id']});
  if(result.meta.build!==1017||result.meta.clientContext.companyId!=='COM-1'||result.meta.clientContext.policyIds.length!==1||!result.meta.clientContext.malformed)throw new Error('Unified Client 360 context metadata failed.');
  if(result.meta.readOnly!==true||typeof apiClient360Create==='function')throw new Error('Build 1015 changed Client 360 read-only boundary.');
  return{success:true};
}

function testBuild1014Client360IntelligenceReleaseCandidate() {
  return runJSKOSReleaseSuite_(1014,[
    {name:'Attention ranking and date boundaries',run:testBuild1014AttentionRankingAndDateBoundaries},
    {name:'Duplicate prevention and query bounds',run:testBuild1014DuplicatePreventionAndQueryBounds},
    {name:'Company and Person aggregation',run:testClient360PersonResolution},
    {name:'Partial-source resilience',run:testBuild1014PartialFailureAndDiagnostics},
    {name:'Authorization isolation',run:testBuild1014AuthorizationIsolation},
    {name:'Person quote isolation',run:testBuild1014PersonQuoteIsolation},
    {name:'Deep-link context',run:testBuild1014DeepLinkContext},
    {name:'Operational UI rendering',run:testClient360UiRendering},
    {name:'Pagination, limits and stale states',run:testBuild1014LimitsAndStaleStates},
    {name:'Backward compatibility',run:testBuild1014BackwardCompatibility},
    {name:'Read-only enforcement',run:testBuild1014ReadOnlyEnforcement}
  ],null);
}

function testClient360V01ReleaseCandidate() {
  return runJSKOSReleaseSuite_('CLIENT-360-0.1',[
    {name:'Company resolution',run:testClient360CompanyResolution},{name:'Person resolution',run:testClient360PersonResolution},
    {name:'Empty and unavailable sources',run:testClient360EmptyAndUnavailableSources},{name:'Missing relationships',run:testClient360MissingRelationships},
    {name:'Authorization',run:testClient360AuthorizationContract},{name:'UI rendering',run:testClient360UiRendering},
    {name:'Regression safety',run:testClient360RegressionSafety},{name:'Linked filter regression safety',run:testClient360FilterRegressionSafety}
  ],null);
}
