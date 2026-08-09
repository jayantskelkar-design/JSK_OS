/** Client 360 v0.1 aggregation and regression tests. */
function client360TestFactories_(options) {
  options = options || {};
  var company = options.company === undefined ? { companyId: 'COM-1', companyName: 'Acme', status: 'Active', area: 'Central' } : options.company;
  var people = options.people === undefined ? [{ personId: 'PER-1', companyId: 'COM-1', fullName: 'Asha', mobile: '9999999999' }] : options.people;
  function records(name) { return options[name] || []; }
  function searchable(name) { return function () { return { search: function () { return { items: records(name), total: records(name).length }; } }; }; }
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

function client360TestService_(options, deniedModule) {
  return new Client360Service({
    factories: client360TestFactories_(options),
    accessControl: { hasPermission: function (permission) { return permission !== deniedModule + '.view'; } }
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
  var content=renderClient360Ui({companyId:'COM-1'}).getContent(),markers=['Client 360','clientLookup','apiClient360Get','Financial summary','Recent activity'];
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

function testClient360V01ReleaseCandidate() {
  return runJSKOSReleaseSuite_('CLIENT-360-0.1',[
    {name:'Company resolution',run:testClient360CompanyResolution},{name:'Person resolution',run:testClient360PersonResolution},
    {name:'Empty and unavailable sources',run:testClient360EmptyAndUnavailableSources},{name:'Missing relationships',run:testClient360MissingRelationships},
    {name:'Authorization',run:testClient360AuthorizationContract},{name:'UI rendering',run:testClient360UiRendering},
    {name:'Regression safety',run:testClient360RegressionSafety},{name:'Linked filter regression safety',run:testClient360FilterRegressionSafety}
  ],null);
}
