/** JSK OS Build 1014 - read-only Client 360 operational intelligence. */
class Client360NotFoundError extends Error { constructor(message) { super(message || 'Client record was not found.'); this.name='Client360NotFoundError'; this.code='CLIENT_360_NOT_FOUND'; } }
class Client360ValidationError extends Error { constructor(message) { super(message || 'Company ID or Person ID is required.'); this.name='Client360ValidationError'; this.code='CLIENT_360_VALIDATION_ERROR'; } }

class Client360Service {
  constructor(options) {
    this.options=options||{};
    this.factories=this.options.factories||{};
    this.accessControl=this.options.accessControl||JSKOS.AccessControl;
    this.referenceDate=this.day_(this.options.referenceDate||new Date())||this.day_(new Date());
    this.limit=Math.max(10,Math.min(Number(this.options.limit)||250,500));
    this.staleDays=Math.max(1,Number(this.options.staleDays)||90);
  }

  getClient360(request) {
    request=request&&typeof request==='object'?request:{};
    var companyId=this.id_(request.companyId),personId=this.id_(request.personId);
    if(!companyId&&!personId)throw new Client360ValidationError();
    var companyRepo=this.repository_('company',CompanyRepository),peopleRepo=this.repository_('people',PeopleRepository);
    var person=personId?peopleRepo.findById(personId):null;
    if(personId&&!person)throw new Client360NotFoundError('Person not found: '+personId);
    var linkedCompanyId=this.id_(person&&person.companyId);
    if(person&&companyId&&linkedCompanyId&&linkedCompanyId!==companyId)throw new Client360ValidationError('The selected person is not linked to the selected company.');
    companyId=companyId||linkedCompanyId;
    var company=companyId?companyRepo.findById(companyId,{includeDeleted:false}):null;
    if(request.companyId&&!company)throw new Client360NotFoundError('Company not found: '+companyId);
    var relatedPeople=companyId?peopleRepo.findByCompanyId(companyId,false):(person?[person]:[]);
    relatedPeople=this.uniqueBy_(relatedPeople,'personId');
    if(person&&!relatedPeople.some(function(x){return this.id_(x.personId)===personId;},this))relatedPeople.unshift(person);
    var links={companyId:companyId||'',personId:personId||''};
    this.currentLinks_=links;
    var s={};
    s.policies=this.source_('policies',function(){return this.collectPaged_(this.repository_('policy',PolicyRepository),links);});
    var policyIds=s.policies.items.map(function(x){return x.policyId;}).filter(Boolean).slice(0,this.limit);
    s.claims=this.linkedSource_('claims','claim',ClaimRepository,links);
    s.tasks=this.linkedSource_('tasks','task',TaskRepository,links);
    s.meetings=this.linkedSource_('meetings','meeting',MeetingRepository,links);
    s.communications=this.linkedSource_('communications','communication',CommunicationRepository,links);
    s.documents=this.linkedSource_('documents','document',DocumentRepository,links);
    s.quotes=this.linkedSource_('quotes','quote',QuoteRepository,links);
    s.endorsements=this.source_('endorsements',function(){return this.collectByValues_(this.repository_('endorsement',EndorsementRepository),'policyId',policyIds);});
    s.revenue=this.source_('revenue',function(){return this.collectRevenue_(this.repository_('revenue',RevenueRepository),links,policyIds);});
    var attention=this.attention_(s),sourceHealth=this.sourceHealth_(s);
    return {
      identity:this.identity_(company,person),
      relationships:{company:company,people:relatedPeople},
      sections:s,
      summary:this.summary_(s),
      attention:attention,
      timeline:this.timeline_(s),
      navigation:this.navigation_(links),
      meta:{version:'0.2.0',build:1014,readOnly:true,generatedAt:new Date().toISOString(),referenceDate:this.isoDay_(this.referenceDate),sourceHealth:sourceHealth,requestedCompanyId:this.text_(request.companyId),requestedPersonId:this.text_(request.personId)}
    };
  }

  source_(moduleName,callback) {
    if(!this.canView_(moduleName))return this.sourceResult_(moduleName,[],{state:'unauthorized',authorized:false,available:false,totalAvailable:0,queryCount:0});
    try {
      var result=callback.call(this),items=this.items_(result),meta=result&&result.meta||{};
      return this.sourceResult_(moduleName,items,{state:items.length?'ready':'empty',authorized:true,available:true,totalAvailable:meta.totalAvailable===undefined?items.length:meta.totalAvailable,queryCount:meta.queryCount||1,truncated:Boolean(meta.truncated)});
    } catch(error) {
      console.warn('Client 360 source unavailable: '+moduleName+' - '+(error.message||error));
      return this.sourceResult_(moduleName,[],{state:'failed',authorized:true,available:false,totalAvailable:0,queryCount:0});
    }
  }

  sourceResult_(moduleName,items,meta) {
    items=this.unique_(items||[]);
    var totalAvailable=Math.max(items.length,Number(meta.totalAvailable)||0),truncated=Boolean(meta.truncated||items.length>this.limit);
    if(items.length>this.limit)items=items.slice(0,this.limit);
    var stale=meta.state==='ready'&&this.isStale_(items);
    return {available:meta.available,authorized:meta.authorized,state:stale?'stale':meta.state,stale:stale,items:items,total:items.length,error:meta.state==='failed'?'Source unavailable.':null,pagination:{limit:this.limit,returned:items.length,totalAvailable:totalAvailable,truncated:truncated,queryCount:Number(meta.queryCount)||0},links:this.navigationLink_(moduleName)};
  }

  linkedSource_(moduleName,factoryName,Constructor,links){return this.source_(moduleName,function(){return this.collectLinked_(this.repository_(factoryName,Constructor),links);});}

  collectLinked_(repo,links) {
    var items=[],queryCount=0;
    if(links.companyId){items=items.concat(this.items_(repo.search({companyId:links.companyId})));queryCount++;}
    if(links.personId){items=items.concat(this.items_(repo.search({personId:links.personId})));queryCount++;}
    return {items:this.unique_(items),meta:{queryCount:queryCount,totalAvailable:items.length}};
  }

  collectByValues_(repo,field,values) {
    var items=[],queryCount=0;
    values.slice(0,this.limit).forEach(function(value){var criteria={};criteria[field]=value;items=items.concat(this.items_(repo.search(criteria)));queryCount++;},this);
    return {items:this.unique_(items),meta:{queryCount:queryCount,totalAvailable:items.length,truncated:values.length>this.limit}};
  }

  collectPaged_(repo,links) {
    var self=this,items=[],queryCount=0,totalAvailable=0,truncated=false;
    function collect(filter){var criteria={includeDeleted:false,page:1,pageSize:100},result;Object.keys(filter).forEach(function(k){criteria[k]=filter[k];});do{result=repo.search(criteria);queryCount++;items=items.concat(self.items_(result));totalAvailable+=Number(result&&result.total)||Number(result&&result.pagination&&result.pagination.total)||self.items_(result).length;criteria.page++;if(items.length>=self.limit){truncated=Boolean(result&&result.pagination&&result.pagination.hasNext)||items.length>self.limit;break;}}while(result&&result.pagination&&result.pagination.hasNext);}
    if(links.companyId)collect({companyId:links.companyId});
    if(links.personId)collect({personId:links.personId});
    return {items:this.unique_(items),meta:{queryCount:queryCount,totalAvailable:totalAvailable,truncated:truncated}};
  }

  collectRevenue_(repo,links,policyIds) {
    var items=[],queryCount=0;
    if(links.companyId){items=this.items_(repo.search({companyId:links.companyId}));queryCount++;}
    else if(policyIds.length){items=this.items_(repo.search({})).filter(function(x){return policyIds.indexOf(x.policyId)!==-1;});queryCount++;}
    return {items:this.unique_(items),meta:{queryCount:queryCount,totalAvailable:items.length}};
  }

  attention_(s) {
    var items=[],self=this;
    function add(module,item,kind,title,date,priority,reason,amount){items.push({module:module,entityId:self.entityId_(item),kind:kind,title:title,priority:priority,priorityLabel:['','Critical','High','Medium','Low'][priority]||'Low',date:date?self.isoDay_(date):'',daysUntil:date?self.days_(date):null,reason:reason,amount:Number(amount)||0,href:self.navigationLink_(module)});}
    s.policies.items.forEach(function(x){var d=self.day_(x.renewalDate);if(!d)return;var days=self.days_(d);if(days<0||days>90)return;var bucket=days<=30?30:days<=60?60:90;add('policies',x,'renewal','Renewal: '+(x.policyNumber||x.policyId||'Policy'),d,bucket===30?2:bucket===60?3:4,'Due within '+bucket+' days');});
    s.tasks.items.forEach(function(x){if(self.closed_(x.status))return;var d=self.day_(x.dueDate);if(!d)return;var days=self.days_(d);if(days<0)add('tasks',x,'overdue-task',x.title||'Overdue task',d,1,'Task is overdue');else if(days<=30)add('tasks',x,'upcoming-task',x.title||'Upcoming task',d,days<=7?2:3,'Task due in '+days+' days');});
    s.claims.items.forEach(function(x){if(!self.closedClaim_(x.status||x.claimStatus))add('claims',x,'open-claim','Open claim: '+(x.claimNumber||x.claimId||'Claim'),self.day_(x.updatedAt||x.createdAt),2,'Claim requires servicing');});
    [['quotes','expiryDate','Quote'],['documents','expiryDate','Document']].forEach(function(spec){s[spec[0]].items.forEach(function(x){if(self.closed_(x.status))return;var d=self.day_(x[spec[1]]);if(!d)return;var days=self.days_(d);if(days>60)return;add(spec[0],x,days<0?'expired':'expiring',spec[2]+': '+(x.quoteNumber||x.documentName||self.entityId_(x)||spec[2]),d,days<0?1:days<=30?2:3,days<0?'Expired '+Math.abs(days)+' days ago':'Expires in '+days+' days');});});
    s.revenue.items.forEach(function(x){var amount=Number(x.outstandingAmount||0);if(amount>0)add('revenue',x,'outstanding-revenue','Outstanding revenue: '+(x.invoiceNumber||x.policyNumber||x.revenueId||'Revenue'),self.day_(x.updatedAt||x.createdAt),3,'Payment remains outstanding',amount);});
    return items.sort(function(a,b){return a.priority-b.priority||self.dateValue_(a.date)-self.dateValue_(b.date)||a.module.localeCompare(b.module)||String(a.entityId).localeCompare(String(b.entityId));});
  }

  sourceHealth_(sections) {
    var states={},failed=[],stale=[],restricted=[];
    Object.keys(sections).forEach(function(k){states[k]=sections[k].state;if(sections[k].state==='failed')failed.push(k);if(sections[k].state==='stale')stale.push(k);if(sections[k].state==='unauthorized')restricted.push(k);});
    return {state:failed.length?'partial':stale.length?'stale':'complete',states:states,failedSources:failed,staleSources:stale,restrictedSources:restricted};
  }

  navigation_(links) {
    var self=this,result={};
    ['policies','claims','tasks','meetings','communications','documents','quotes','endorsements','revenue'].forEach(function(moduleName){result[moduleName]=self.navigationLink_(moduleName,links);});
    return result;
  }

  navigationLink_(moduleName,links) {
    links=links||this.currentLinks_||{};
    var query=['page='+encodeURIComponent(moduleName)];
    if(links.companyId)query.push('companyId='+encodeURIComponent(links.companyId));
    if(links.personId)query.push('personId='+encodeURIComponent(links.personId));
    return '?'+query.join('&');
  }

  summary_(s){var revenue=s.revenue.items||[],today=this.referenceDate,next90=new Date(today.getTime()+90*86400000);return{policies:s.policies.total,activePolicies:s.policies.items.filter(function(x){return['active','issued','renewal due'].indexOf(String(x.policyStatus||x.status||'').toLowerCase())!==-1;}).length,renewalsDue:s.policies.items.filter(function(x){var d=this.day_(x.renewalDate);return d&&d>=today&&d<=next90;},this).length,claims:s.claims.total,openTasks:s.tasks.items.filter(function(x){return!this.closed_(x.status);},this).length,upcomingTasks:s.tasks.items.filter(function(x){var d=this.day_(x.dueDate);return!this.closed_(x.status)&&d&&d>=today;},this).length,meetings:s.meetings.total,communications:s.communications.total,documents:s.documents.total,quotes:s.quotes.total,endorsements:s.endorsements.total,financial:revenue.reduce(function(a,x){a.expected+=Number(x.netReceivable||x.expectedCommission||0);a.received+=Number(x.amountReceived||0);a.outstanding+=Number(x.outstandingAmount||0);return a;},{expected:0,received:0,outstanding:0})};}
  timeline_(s){var d={policies:['policyId','Policy'],claims:['claimId','Claim'],tasks:['taskId','Task'],meetings:['meetingId','Meeting'],communications:['communicationId','Communication'],documents:['documentId','Document'],quotes:['quoteId','Quote'],endorsements:['endorsementId','Endorsement'],revenue:['revenueId','Revenue']},events=[];Object.keys(d).forEach(function(k){if(!s[k].authorized)return;s[k].items.forEach(function(x){var date=x.updatedAt||x.createdAt||x.sentAt||x.startAt||x.dueDate||x.renewalDate||'';if(date)events.push({module:k,entityId:x[d[k][0]]||'',type:d[k][1],title:x.title||x.documentName||x.quoteNumber||x.claimNumber||x.policyNumber||x.requestNumber||x.subject||x.invoiceNumber||d[k][1],status:x.status||x.policyStatus||x.paymentStatus||'',date:date});});});events.sort(function(a,b){return new Date(b.date||0)-new Date(a.date||0)||a.module.localeCompare(b.module)||String(a.entityId).localeCompare(String(b.entityId));});return events.slice(0,30);}
  identity_(company,person){var p=person||company||{};return{type:person?'Person':'Company',id:person?person.personId:company&&company.companyId,name:person?person.fullName:company&&company.companyName,status:p.status||'',mobile:person&&person.mobile||'',email:person&&person.email||'',companyName:company&&company.companyName||'',companyId:company&&company.companyId||'',personId:person&&person.personId||'',area:p.area||company&&company.area||'',owner:company&&company.ownerPersonId||''};}
  isStale_(items){var dates=items.map(function(x){return this.day_(x.updatedAt||x.createdAt||x.sentAt||x.startAt||x.dueDate||x.renewalDate);},this).filter(Boolean);if(!dates.length)return false;var latest=Math.max.apply(null,dates.map(function(x){return x.getTime();}));return (this.referenceDate.getTime()-latest)>this.staleDays*86400000;}
  closed_(status){return['completed','cancelled','closed','converted','rejected','expired','received'].indexOf(String(status||'').toLowerCase())!==-1;}
  closedClaim_(status){return['settled','closed','rejected','withdrawn','cancelled'].indexOf(String(status||'').toLowerCase())!==-1;}
  entityId_(x){return x&&(x.policyId||x.claimId||x.taskId||x.meetingId||x.communicationId||x.documentId||x.quoteId||x.endorsementId||x.revenueId)||'';}
  repository_(name,Constructor){return this.factories[name]?this.factories[name]():new Constructor();}
  canView_(moduleName){return!this.accessControl||typeof this.accessControl.hasPermission!=='function'||this.accessControl.hasPermission(moduleName+'.view');}
  items_(result){if(Array.isArray(result))return result;return result&&Array.isArray(result.items)?result.items:[];}
  unique_(items){var seen={};return items.filter(function(x){var id=this.entityId_(x)||JSON.stringify(x);id=String(id).toUpperCase();if(seen[id])return false;seen[id]=true;return true;},this);}
  uniqueBy_(items,key){var seen={};return(items||[]).filter(function(x){var id=this.id_(x&&x[key]);if(!id||seen[id])return false;seen[id]=true;return true;},this);}
  day_(value){if(!value)return null;var date=value instanceof Date?new Date(value.getTime()):new Date(String(value).length===10?String(value)+'T00:00:00':value);if(isNaN(date.getTime()))return null;date.setHours(0,0,0,0);return date;}
  days_(date){return Math.round((date.getTime()-this.referenceDate.getTime())/86400000);}
  dateValue_(value){var d=this.day_(value);return d?d.getTime():8640000000000000;}
  isoDay_(date){var d=this.day_(date);if(!d)return'';return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  id_(value){return this.text_(value).toUpperCase();}
  text_(value){return String(value||'').trim();}
}

function client360ApiExecute_(callback){try{JSKOS.AccessControl.requireModuleOperation('client360','view');return{success:true,data:JSON.parse(JSON.stringify(callback())),error:null,meta:{version:'0.2.0',build:1014,timestamp:new Date().toISOString(),readOnly:true}};}catch(error){return{success:false,data:null,error:{name:error.name||'Error',code:error.code||'CLIENT_360_ERROR',message:error.message||String(error)},meta:{version:'0.2.0',build:1014,timestamp:new Date().toISOString(),readOnly:true}};}}
function apiClient360Get(payload){return client360ApiExecute_(function(){return new Client360Service().getClient360(payload||{});});}
