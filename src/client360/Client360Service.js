/** JSK OS Client 360 v0.1 - read-only client aggregation. */
class Client360NotFoundError extends Error { constructor(message) { super(message || 'Client record was not found.'); this.name='Client360NotFoundError'; this.code='CLIENT_360_NOT_FOUND'; } }
class Client360ValidationError extends Error { constructor(message) { super(message || 'Company ID or Person ID is required.'); this.name='Client360ValidationError'; this.code='CLIENT_360_VALIDATION_ERROR'; } }

class Client360Service {
  constructor(options) { this.options=options||{}; this.factories=this.options.factories||{}; this.accessControl=this.options.accessControl||JSKOS.AccessControl; }
  getClient360(request) {
    request=request&&typeof request==='object'?request:{};
    var companyId=this.text_(request.companyId).toUpperCase(),personId=this.text_(request.personId).toUpperCase();
    if(!companyId&&!personId)throw new Client360ValidationError();
    var companyRepo=this.repository_('company',CompanyRepository),peopleRepo=this.repository_('people',PeopleRepository);
    var person=personId?peopleRepo.findById(personId):null;
    if(personId&&!person)throw new Client360NotFoundError('Person not found: '+personId);
    if(person&&companyId&&person.companyId&&this.text_(person.companyId).toUpperCase()!==companyId)throw new Client360ValidationError('The selected person is not linked to the selected company.');
    companyId=companyId||this.text_(person&&person.companyId).toUpperCase();
    var company=companyId?companyRepo.findById(companyId,{includeDeleted:false}):null;
    if(request.companyId&&!company)throw new Client360NotFoundError('Company not found: '+companyId);
    var relatedPeople=companyId?peopleRepo.findByCompanyId(companyId,false):(person?[person]:[]);
    if(person&&!relatedPeople.some(function(x){return x.personId===person.personId;}))relatedPeople.unshift(person);
    var links={companyId:companyId||'',personId:personId||'',peopleIds:relatedPeople.map(function(x){return x.personId;}).filter(Boolean)};
    var s={};
    s.policies=this.source_('policies',function(){return this.collectPaged_(this.repository_('policy',PolicyRepository),links);});
    var policyIds=s.policies.items.map(function(x){return x.policyId;}).filter(Boolean);
    s.claims=this.linkedSource_('claims','claim',ClaimRepository,links);
    s.tasks=this.linkedSource_('tasks','task',TaskRepository,links);
    s.meetings=this.linkedSource_('meetings','meeting',MeetingRepository,links);
    s.communications=this.linkedSource_('communications','communication',CommunicationRepository,links);
    s.documents=this.linkedSource_('documents','document',DocumentRepository,links);
    s.quotes=this.source_('quotes',function(){var repo=this.repository_('quote',QuoteRepository),items=[];if(links.companyId)items=items.concat(this.items_(repo.search({companyId:links.companyId})));if(links.personId){items=items.concat(this.items_(repo.search({})).filter(function(x){return String(x.personId||'').toUpperCase()===links.personId;}));}return this.unique_(items);});
    s.endorsements=this.source_('endorsements',function(){return this.collectByValues_(this.repository_('endorsement',EndorsementRepository),'policyId',policyIds);});
    s.revenue=this.source_('revenue',function(){var repo=this.repository_('revenue',RevenueRepository),items=this.items_(repo.search(companyId?{companyId:companyId}:{}));if(!companyId&&policyIds.length)items=items.filter(function(x){return policyIds.indexOf(x.policyId)!==-1;});return items;});
    return {identity:this.identity_(company,person),relationships:{company:company,people:relatedPeople},sections:s,summary:this.summary_(s),timeline:this.timeline_(s),meta:{version:'0.1.0',readOnly:true,generatedAt:new Date().toISOString(),requestedCompanyId:this.text_(request.companyId),requestedPersonId:this.text_(request.personId)}};
  }
  source_(moduleName,callback){if(!this.canView_(moduleName))return{available:false,authorized:false,items:[],total:0,error:'Not authorized.'};try{var items=callback.call(this)||[];return{available:true,authorized:true,items:items,total:items.length,error:null};}catch(error){console.warn('Client 360 source unavailable: '+moduleName+' - '+(error.message||error));return{available:false,authorized:true,items:[],total:0,error:error.message||String(error)};}}
  linkedSource_(moduleName,factoryName,Constructor,links){return this.source_(moduleName,function(){return this.collectLinked_(this.repository_(factoryName,Constructor),links);});}
  collectLinked_(repo,links){var items=[];if(links.companyId)items=items.concat(this.items_(repo.search({companyId:links.companyId})));var ids=links.personId?[links.personId]:links.peopleIds;ids.forEach(function(id){items=items.concat(this.items_(repo.search({personId:id})));},this);return this.unique_(items);}
  collectByValues_(repo,field,values){var items=[];values.forEach(function(v){var c={};c[field]=v;items=items.concat(this.items_(repo.search(c)));},this);return this.unique_(items);}
  collectPaged_(repo,links){var self=this,items=[];function collect(filter){var c={includeDeleted:false,page:1,pageSize:100},r;Object.keys(filter).forEach(function(k){c[k]=filter[k];});do{r=repo.search(c);items=items.concat(self.items_(r));c.page+=1;}while(r&&r.pagination&&r.pagination.hasNext);}if(links.companyId)collect({companyId:links.companyId});if(links.personId)collect({personId:links.personId});return this.unique_(items);}
  summary_(s){var revenue=s.revenue.items||[],today=new Date(),next90=new Date(today.getTime()+90*86400000);today.setHours(0,0,0,0);return{policies:s.policies.total,activePolicies:s.policies.items.filter(function(x){return['active','issued','renewal due'].indexOf(String(x.policyStatus||x.status||'').toLowerCase())!==-1;}).length,renewalsDue:s.policies.items.filter(function(x){var d=new Date(x.renewalDate||'');return!isNaN(d.getTime())&&d<=next90;}).length,claims:s.claims.total,openTasks:s.tasks.items.filter(function(x){return['completed','cancelled'].indexOf(String(x.status||'').toLowerCase())===-1;}).length,upcomingTasks:s.tasks.items.filter(function(x){var d=new Date(x.dueDate||'');return['completed','cancelled'].indexOf(String(x.status||'').toLowerCase())===-1&&!isNaN(d.getTime())&&d>=today;}).length,meetings:s.meetings.total,communications:s.communications.total,documents:s.documents.total,quotes:s.quotes.total,endorsements:s.endorsements.total,financial:revenue.reduce(function(a,x){a.expected+=Number(x.netReceivable||x.expectedCommission||0);a.received+=Number(x.amountReceived||0);a.outstanding+=Number(x.outstandingAmount||0);return a;},{expected:0,received:0,outstanding:0})};}
  timeline_(s){var d={policies:['policyId','Policy'],claims:['claimId','Claim'],tasks:['taskId','Task'],meetings:['meetingId','Meeting'],communications:['communicationId','Communication'],documents:['documentId','Document'],quotes:['quoteId','Quote'],endorsements:['endorsementId','Endorsement'],revenue:['revenueId','Revenue']},events=[];Object.keys(d).forEach(function(k){s[k].items.forEach(function(x){var date=x.updatedAt||x.createdAt||x.sentAt||x.startAt||x.dueDate||x.renewalDate||'';if(date)events.push({module:k,entityId:x[d[k][0]]||'',type:d[k][1],title:x.title||x.documentName||x.quoteNumber||x.claimNumber||x.policyNumber||x.requestNumber||x.subject||x.invoiceNumber||d[k][1],status:x.status||x.policyStatus||x.paymentStatus||'',date:date});});});events.sort(function(a,b){return new Date(b.date||0)-new Date(a.date||0);});return events.slice(0,30);}
  identity_(company,person){var p=person||company||{};return{type:person?'Person':'Company',id:person?person.personId:company&&company.companyId,name:person?person.fullName:company&&company.companyName,status:p.status||'',mobile:person&&person.mobile||'',email:person&&person.email||'',companyName:company&&company.companyName||'',companyId:company&&company.companyId||'',personId:person&&person.personId||'',area:p.area||company&&company.area||'',owner:company&&company.ownerPersonId||''};}
  repository_(name,Constructor){return this.factories[name]?this.factories[name]():new Constructor();}
  canView_(moduleName){return!this.accessControl||typeof this.accessControl.hasPermission!=='function'||this.accessControl.hasPermission(moduleName+'.view');}
  items_(r){if(Array.isArray(r))return r;return r&&Array.isArray(r.items)?r.items:[];}
  unique_(items){var seen={};return items.filter(function(x){var id=x&&(x.policyId||x.claimId||x.taskId||x.meetingId||x.communicationId||x.documentId||x.quoteId||x.endorsementId||x.revenueId||JSON.stringify(x));if(seen[id])return false;seen[id]=true;return true;});}
  text_(v){return String(v||'').trim();}
}

function client360ApiExecute_(callback){try{JSKOS.AccessControl.requireModuleOperation('client360','view');return{success:true,data:JSON.parse(JSON.stringify(callback())),error:null,meta:{version:'0.1.0',timestamp:new Date().toISOString()}};}catch(error){return{success:false,data:null,error:{name:error.name||'Error',code:error.code||'CLIENT_360_ERROR',message:error.message||String(error)},meta:{version:'0.1.0',timestamp:new Date().toISOString()}};}}
function apiClient360Get(payload){return client360ApiExecute_(function(){return new Client360Service().getClient360(payload||{});});}
