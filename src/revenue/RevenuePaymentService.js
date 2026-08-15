/** JSK OS Build 1024 - durable Revenue payment journal and recovery service. */
var JSKOS=JSKOS||{};
(function(namespace){
  'use strict';

  var MAX_ROWS=500,MAX_SAFE=Number.MAX_SAFE_INTEGER;
  function paymentError_(code,message,data){var error=new Error(message),actions={REVENUE_PAYMENT_VALIDATION:'CORRECT_AND_RETRY',REVENUE_FINANCIAL_INVALID:'CORRECT_AND_RETRY',REVENUE_PAYMENT_FORMULA:'CORRECT_AND_RETRY',REVENUE_NOT_FOUND:'CORRECT_AND_RETRY',REVENUE_ARCHIVED:'CORRECT_AND_RETRY',REVENUE_PAYMENT_OVERPAYMENT:'CORRECT_AND_RETRY',REVENUE_FINANCIAL_CONFLICT:'INSPECT'},base=actions[code]?{state:'NOT_ACCEPTED',action:actions[code]}:null;error.code=code;error.data=base?Object.assign(base,data||{}):(data||null);return error;}
  function text_(value){return value===null||value===undefined?'':String(value).trim();}
  function upper_(value){return text_(value).toUpperCase();}
  function blank_(value){return value===null||value===undefined||String(value).trim()==='';}
  function email_(value){var email=text_(value).toLowerCase();if(email==='system'||!/^[a-z0-9._%+\-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email))throw paymentError_('REVENUE_ACTOR_INVALID','Authenticated Revenue actor is unavailable.');return email;}
  function formulaSafe_(value,max,label){var result=text_(value);if(result.length>max)throw paymentError_('REVENUE_PAYMENT_VALIDATION',label+' is too long.');if(/^[=+\-@]/.test(result))throw paymentError_('REVENUE_PAYMENT_FORMULA',label+' cannot begin with a formula character.');return result;}
  function decimal_(value,maxFraction,label,allowZero){
    if(typeof value!=='number'&&typeof value!=='string')throw paymentError_('REVENUE_FINANCIAL_INVALID',label+' is invalid.');
    if(typeof value==='number'&&!Number.isFinite(value))throw paymentError_('REVENUE_FINANCIAL_INVALID',label+' is invalid.');
    var raw=typeof value==='string'?value.trim():String(value),pattern=new RegExp('^(0|[1-9][0-9]{0,12})(?:\\.([0-9]{1,'+maxFraction+'}))?$'),match=pattern.exec(raw);
    if(!match)throw paymentError_('REVENUE_FINANCIAL_INVALID',label+' is invalid.');
    var whole=Number(match[1]),fraction=match[2]||'',six=(fraction+'000000').slice(0,6),paise=whole*100+Number(six.slice(0,2)||'0');
    if(Number(six.charAt(2)||'0')>=5)paise+=1;
    if(paise>MAX_SAFE||(!allowZero&&paise===0))throw paymentError_('REVENUE_FINANCIAL_INVALID',label+' is outside the supported range.');
    return paise;
  }
  function paymentPaise_(value){
    if(typeof value!=='number'&&typeof value!=='string')throw paymentError_('REVENUE_PAYMENT_VALIDATION','Payment amount is invalid.');
    if(typeof value==='number'&&!Number.isFinite(value))throw paymentError_('REVENUE_PAYMENT_VALIDATION','Payment amount is invalid.');
    var raw=typeof value==='string'?value.trim():String(value);
    if(!/^(0|[1-9][0-9]{0,12})(?:\.[0-9]{1,2})?$/.test(raw))throw paymentError_('REVENUE_PAYMENT_VALIDATION','Payment amount is invalid.');
    try{return decimal_(raw,2,'Payment amount',false);}catch(error){throw paymentError_('REVENUE_PAYMENT_VALIDATION',error.message);}
  }
  function rateMillionths_(value){
    if(blank_(value))return 0;
    if(typeof value!=='number'&&typeof value!=='string')throw paymentError_('REVENUE_FINANCIAL_INVALID','Commission rate is invalid.');
    var raw=typeof value==='string'?value.trim():String(value),match=/^(0|[1-9][0-9]?|100)(?:\.([0-9]{1,6}))?$/.exec(raw);
    if(!match)throw paymentError_('REVENUE_FINANCIAL_INVALID','Commission rate is invalid.');
    var result=Number(match[1])*1000000+Number(((match[2]||'')+'000000').slice(0,6));
    if(result>100000000)throw paymentError_('REVENUE_FINANCIAL_INVALID','Commission rate is invalid.');
    return result;
  }
  function roundedRateAmount_(amount,rate){var denominator=100000000,base=10000,major=Math.floor(amount/denominator),remainder=amount-major*denominator,left=Math.floor(remainder/base),right=remainder-left*base,rateLeft=Math.floor(rate/base),rateRight=rate-rateLeft*base,middle=left*rateRight+right*rateLeft,tail=middle*base+right*rateRight,quotient=major*rate+left*rateLeft+Math.floor(tail/denominator);if((tail%denominator)*2>=denominator)quotient+=1;if(quotient>MAX_SAFE)throw paymentError_('REVENUE_FINANCIAL_INVALID','Financial calculation exceeds the supported range.');return quotient;}
  function financial_(record){
    record=record||{};
    var premium=decimal_(blank_(record.premiumAmount)?0:record.premiumAmount,6,'Premium amount',true),gst=decimal_(blank_(record.gstAmount)?0:record.gstAmount,6,'GST amount',true),tds=decimal_(blank_(record.tdsAmount)?0:record.tdsAmount,6,'TDS amount',true),derived=blank_(record.expectedCommission),expected;
    if(derived)expected=roundedRateAmount_(premium,rateMillionths_(record.commissionRate));else expected=decimal_(record.expectedCommission,6,'Expected commission',true);
    var net=expected+gst-tds;if(net<0||!Number.isSafeInteger(net))throw paymentError_('REVENUE_FINANCIAL_INVALID','Net receivable is invalid.');
    return{premiumPaise:premium,gstPaise:gst,tdsPaise:tds,expectedCommissionPaise:expected,netReceivablePaise:net,derivedExpected:derived,expectedCommission:expected/100,netReceivable:net/100};
  }
  function dateDay_(value,required){
    if(blank_(value)){if(required)throw paymentError_('REVENUE_PAYMENT_VALIDATION','Payment date is invalid.');return'';}
    if(value instanceof Date){if(isNaN(value.getTime()))throw paymentError_('REVENUE_PAYMENT_VALIDATION','Payment date is invalid.');return value.getFullYear()+'-'+String(value.getMonth()+1).padStart(2,'0')+'-'+String(value.getDate()).padStart(2,'0');}
    var raw=String(value),match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);if(!match)throw paymentError_('REVENUE_PAYMENT_VALIDATION','Payment date must use YYYY-MM-DD.');
    var date=new Date(Number(match[1]),Number(match[2])-1,Number(match[3]));if(date.getFullYear()!==Number(match[1])||date.getMonth()!==Number(match[2])-1||date.getDate()!==Number(match[3]))throw paymentError_('REVENUE_PAYMENT_VALIDATION','Payment date is invalid.');return raw;
  }
  function timestamp_(value){var date=value instanceof Date?value:new Date(value);if(isNaN(date.getTime()))throw paymentError_('REVENUE_PAYMENT_CONFLICT','Payment timestamp is invalid.');return date.getTime();}
  function request_(payload){
    if(!payload||typeof payload!=='object'||Array.isArray(payload))throw paymentError_('REVENUE_PAYMENT_VALIDATION','Payment request is invalid.');
    var key=upper_(payload.requestKey),revenueId=upper_(payload.revenueId);if(!/^RPK-[A-F0-9]{32}$/.test(key))throw paymentError_('REVENUE_PAYMENT_VALIDATION','Stable payment request key is required.');if(!revenueId||revenueId.length>100)throw paymentError_('REVENUE_PAYMENT_VALIDATION','Revenue ID is invalid.');
    var explicit=!blank_(payload.paymentDate),date=explicit?dateDay_(payload.paymentDate,true):'SERVER_ASSIGNED';
    return{requestKey:key,revenueId:revenueId,amountPaise:paymentPaise_(payload.amount),dateIdentity:date,paymentDate:explicit?date:'',reference:formulaSafe_(payload.reference,200,'Reference'),notes:formulaSafe_(payload.notes,1000,'Notes')};
  }
  function canonical_(request){return['revenueId','amountPaise','dateIdentity','reference','notes'].map(function(key){var value=String(request[key]);return key.length+':'+key+'='+value.length+':'+value;}).join('|');}
  function fingerprint_(request,hash){var value=String(hash(canonical_(request))||'').toLowerCase();if(!/^[a-f0-9]{64}$/.test(value))throw paymentError_('REVENUE_PAYMENT_RECOVERY_REQUIRED','Payment fingerprint is unavailable.');return value;}
  function newPaymentId_(uuid){var value=String(uuid()||'').replace(/[^A-Fa-f0-9]/g,'').toUpperCase();if(value.length<16)throw paymentError_('REVENUE_PAYMENT_RECOVERY_REQUIRED','Payment identity is unavailable.');return'PAY-'+value.slice(0,16);}
  function migrationKey_(key){return /^RPK-MIG-[A-F0-9]{24}$/.test(key);}
  function rowRequest_(row){return{requestKey:upper_(row.requestKey),revenueId:upper_(row.revenueId),amountPaise:paymentPaise_(row.amount),dateIdentity:row.dateIdentity||dateDay_(row.paymentDate,true),paymentDate:dateDay_(row.paymentDate,true),reference:formulaSafe_(row.reference,200,'Reference'),notes:formulaSafe_(row.notes,1000,'Notes')};}
  function validateRows_(rows,hash,targetId){
    var ids={},keys={},valid=[];
    (rows||[]).forEach(function(row){
      var id=upper_(row.paymentId),key=upper_(row.requestKey),legacy=Boolean(row.legacy);
      if(!id)throw paymentError_('REVENUE_PAYMENT_CONFLICT','Payment ID is missing.');if(ids[id])throw paymentError_('REVENUE_PAYMENT_CONFLICT','Duplicate Payment ID evidence.');ids[id]=true;
      if(!key||(!/^RPK-[A-F0-9]{32}$/.test(key)&&!migrationKey_(key)))throw paymentError_('REVENUE_PAYMENT_CONFLICT','Payment request identity is malformed.');if(keys[key])throw paymentError_('REVENUE_PAYMENT_CONFLICT','Duplicate payment request evidence.');keys[key]=true;
      var request=rowRequest_(row),state=upper_(row.state);if(['ACCEPTED','COMPLETED'].indexOf(state)===-1)throw paymentError_('REVENUE_PAYMENT_CONFLICT','Payment state is invalid.');
      var stored=String(row.payloadFingerprint||'').toLowerCase(),explicit=fingerprint_(request,hash),serverAssigned=fingerprint_(Object.assign({},request,{dateIdentity:'SERVER_ASSIGNED'}),hash);if(stored!==explicit&&stored!==serverAssigned)throw paymentError_('REVENUE_PAYMENT_CONFLICT','Payment fingerprint evidence is contradictory.');request.dateIdentity=stored===serverAssigned?'SERVER_ASSIGNED':request.paymentDate;if(!legacy)email_(row.createdBy);
      timestamp_(row.createdAt);if(state==='COMPLETED'){timestamp_(row.completedAt);if(!text_(row.completedBy))throw paymentError_('REVENUE_PAYMENT_CONFLICT','Payment completion actor is missing.');}
      if(targetId&&!request.revenueId)throw paymentError_('REVENUE_PAYMENT_CONFLICT','Payment Revenue linkage is invalid.');
      valid.push(Object.assign({},row,{paymentId:id,requestKey:key,revenueId:request.revenueId,amountPaise:request.amountPaise,paymentDate:request.paymentDate,state:state,reference:request.reference,notes:request.notes,createdAtMs:timestamp_(row.createdAt)}));
    });
    return valid;
  }
  function targetRows_(rows,revenueId){return rows.filter(function(row){return row.revenueId===revenueId;});}
  function scopedRows_(rawRows,hash,revenueId,requestKey,paymentId){var targetIds={},targetKeys={};(rawRows||[]).forEach(function(row){if(upper_(row.revenueId)===revenueId){targetIds[upper_(row.paymentId)]=true;targetKeys[upper_(row.requestKey)]=true;}});if(requestKey)targetKeys[requestKey]=true;if(paymentId)targetIds[paymentId]=true;var candidates=(rawRows||[]).filter(function(row){return upper_(row.revenueId)===revenueId||targetIds[upper_(row.paymentId)]||targetKeys[upper_(row.requestKey)];});return validateRows_(candidates,hash,revenueId);}
  function aggregate_(rows,revenue){
    var total=0;rows.forEach(function(row){total+=row.amountPaise;if(!Number.isSafeInteger(total))throw paymentError_('REVENUE_FINANCIAL_INVALID','Payment total exceeds the supported range.');});
    var finance=financial_(revenue),sorted=rows.slice().sort(function(a,b){return a.paymentDate.localeCompare(b.paymentDate)||a.createdAtMs-b.createdAtMs||a.paymentId.localeCompare(b.paymentId);}),latest=sorted.length?sorted[sorted.length-1]:null,status;
    if(total>0&&total<finance.netReceivablePaise)status='Partially Received';else if(finance.netReceivablePaise>0&&total>=finance.netReceivablePaise)status='Received';else status=['Expected','Invoiced','Overdue','Disputed','Written Off'].indexOf(revenue.paymentStatus)!==-1?revenue.paymentStatus:'Expected';
    return{amountReceived:total/100,outstandingAmount:Math.max(0,finance.netReceivablePaise-total)/100,paymentStatus:status,receivedDate:latest?latest.paymentDate:'',reconciliationReference:latest?latest.reference:'',expectedCommission:finance.expectedCommission,netReceivable:finance.netReceivable,totalPaise:total,netReceivablePaise:finance.netReceivablePaise};
  }
  function completeMatches_(revenue,aggregate){return Number(revenue.amountReceived||0)===aggregate.amountReceived&&Number(revenue.outstandingAmount||0)===aggregate.outstandingAmount&&String(revenue.paymentStatus||'')===aggregate.paymentStatus&&dateDay_(revenue.receivedDate,false)===aggregate.receivedDate&&String(revenue.reconciliationReference||'')===aggregate.reconciliationReference&&Number(revenue.netReceivable||0)===aggregate.netReceivable;}

  function create(options){
    options=options||{};var payments=options.paymentRepository,revenues=options.revenueRepository,lockProvider=options.lockProvider,clock=options.clock||function(){return new Date();},uuid=options.uuid,hash=options.hash,flush=options.flush||function(){},fault=options.fault||function(){},day=options.day||function(value){return dateDay_(value,true);};
    if(!payments||!revenues||typeof lockProvider!=='function'||typeof uuid!=='function'||typeof hash!=='function')throw new Error('Revenue payment dependencies are incomplete.');
    function actor_(value){return email_(value);}
    function fire_(name,context){fault(name,context||{});}
    function withLock_(callback){var lock=lockProvider(),acquired=false;try{lock.waitLock(30000);acquired=true;}catch(error){throw paymentError_('REVENUE_PAYMENT_LOCK_UNAVAILABLE','Revenue payment is busy. Try again.',{state:'NOT_ACCEPTED',action:'RETRY'});}try{return callback(lock);}finally{if(acquired)lock.releaseLock();}}
    function readAll_(){try{return payments.all();}catch(error){throw paymentError_('REVENUE_PAYMENT_RECOVERY_REQUIRED','Payment evidence lookup is unavailable.');}}
    function findRevenue_(id){var matches=revenues.findAllById(id)||[];if(!matches.length)throw paymentError_('REVENUE_NOT_FOUND','Revenue record not found.',{state:'NOT_ACCEPTED'});if(matches.length>1)throw paymentError_('REVENUE_PAYMENT_CONFLICT','Revenue identity is duplicated.');if(matches[0].isDeleted)throw paymentError_('REVENUE_ARCHIVED','Revenue record is archived.',{state:'NOT_ACCEPTED'});return matches[0];}
    function proveRow_(id,state){var raw=readAll_(),rawMatches=raw.filter(function(row){return upper_(row.paymentId)===id;});if(rawMatches.length!==1)throw paymentError_('REVENUE_PAYMENT_RECOVERY_REQUIRED','Payment write could not be proven.',{paymentId:id,state:'UNKNOWN',action:'RETRY_OR_RECONCILE'});var rows=scopedRows_(raw,hash,upper_(rawMatches[0].revenueId),upper_(rawMatches[0].requestKey),id),matches=rows.filter(function(row){return row.paymentId===id;});if(matches.length!==1||matches[0].state!==state)throw paymentError_('REVENUE_PAYMENT_RECOVERY_REQUIRED','Payment write could not be proven.',{paymentId:id,state:'UNKNOWN',action:'RETRY_OR_RECONCILE'});return matches[0];}
    function finalize_(request,actor,row,revenue,existing,lock){
      var rows=scopedRows_(readAll_(),hash,revenue.revenueId,request.requestKey,row.paymentId),target=targetRows_(rows,revenue.revenueId),aggregate=aggregate_(target,revenue),wasComplete=row.state==='COMPLETED';
      if(!existing&&aggregate.totalPaise>aggregate.netReceivablePaise)throw paymentError_('REVENUE_PAYMENT_OVERPAYMENT','Payment exceeds the outstanding Revenue amount.',{state:'NOT_ACCEPTED'});
      fire_('beforeAggregateWrite',{paymentId:row.paymentId});var updated=revenues.applyAggregateUnderLock(revenue.revenueId,aggregate,actor,clock(),lock);fire_('afterAggregateWriteBeforeFlush',{paymentId:row.paymentId});flush();fire_('afterAggregateFlushBeforeReadBack',{paymentId:row.paymentId});
      var aggregateRead=findRevenue_(revenue.revenueId);if(!completeMatches_(aggregateRead,aggregate))throw paymentError_('REVENUE_PAYMENT_RECOVERY_REQUIRED','Revenue aggregate write could not be proven.',{paymentId:row.paymentId,requestKey:request.requestKey,state:row.state,action:'RETRY_OR_RECONCILE'});fire_('afterAggregateReadBack',{paymentId:row.paymentId});
      if(!wasComplete){fire_('beforeCompletionWrite',{paymentId:row.paymentId});if(existing)payments.recoverUnderLock(row.paymentId,actor,clock(),lock);else payments.completeUnderLock(row.paymentId,actor,clock(),lock);fire_('afterCompletionWriteBeforeFlush',{paymentId:row.paymentId});flush();fire_('afterCompletionFlushBeforeReadBack',{paymentId:row.paymentId});row=proveRow_(row.paymentId,'COMPLETED');fire_('afterCompletionReadBack',{paymentId:row.paymentId});}
      else row=proveRow_(row.paymentId,'COMPLETED');
      var outcome=existing?(wasComplete&&completeMatches_(revenue,aggregate)?'ALREADY_COMPLETED':'RECOVERED'):'COMPLETED',code=outcome==='COMPLETED'?'REVENUE_PAYMENT_COMPLETED':outcome==='RECOVERED'?'REVENUE_PAYMENT_RECOVERED':'REVENUE_PAYMENT_ALREADY_COMPLETED';
      fire_('beforeResponseDelivery',{paymentId:row.paymentId});return{outcome:outcome,code:code,paymentId:row.paymentId,requestKey:request.requestKey,state:'COMPLETED',action:'NONE',revenue:updated};
    }
    function record(payload,actor){
      var request=request_(payload),serverActor=actor_(actor),fingerprint=fingerprint_(request,hash),paymentId='',appendAttempted=false;
      try{return withLock_(function(lock){
        var revenue=findRevenue_(request.revenueId),finance=financial_(revenue);if(!blank_(revenue.netReceivable)&&decimal_(revenue.netReceivable,6,'Net receivable',true)!==finance.netReceivablePaise)throw paymentError_('REVENUE_FINANCIAL_CONFLICT','Stored net receivable is inconsistent.');
        var rawRows=readAll_(),rows=scopedRows_(rawRows,hash,request.revenueId,request.requestKey),matches=rows.filter(function(row){return row.requestKey===request.requestKey;});if(matches.length>1)throw paymentError_('REVENUE_PAYMENT_CONFLICT','Duplicate payment request evidence.');
        if(matches.length){var existing=matches[0];paymentId=existing.paymentId;if(String(existing.payloadFingerprint).toLowerCase()!==fingerprint)throw paymentError_('REVENUE_PAYMENT_CONFLICT','Payment request inputs changed.',{paymentId:paymentId,requestKey:request.requestKey,state:'CONFLICT',action:'INSPECT'});appendAttempted=true;return finalize_(request,serverActor,existing,revenue,true,lock);}
        var target=targetRows_(rows,request.revenueId),before=aggregate_(target,revenue);if(before.totalPaise+request.amountPaise>before.netReceivablePaise)throw paymentError_('REVENUE_PAYMENT_OVERPAYMENT','Payment exceeds the outstanding Revenue amount.',{state:'NOT_ACCEPTED'});
        paymentId=newPaymentId_(uuid);if(rawRows.some(function(row){return upper_(row.paymentId)===paymentId;}))throw paymentError_('REVENUE_PAYMENT_CONFLICT','Generated Payment ID is already in use.');
        var now=clock(),paymentDate=request.paymentDate||day(now),row={paymentId:paymentId,revenueId:request.revenueId,paymentDate:paymentDate,amount:request.amountPaise/100,reference:request.reference,notes:request.notes,createdAt:now,createdBy:serverActor,requestKey:request.requestKey,payloadFingerprint:fingerprint,state:'ACCEPTED',completedAt:'',completedBy:'',recoveryAt:'',recoveryBy:'',lastError:'',dateIdentity:request.dateIdentity,legacy:false};
        fire_('beforeAcceptedAppend',{paymentId:paymentId});appendAttempted=true;payments.appendAcceptedUnderLock(row,lock);fire_('afterAcceptedAppendBeforeFlush',{paymentId:paymentId});flush();fire_('afterAcceptedFlushBeforeReadBack',{paymentId:paymentId});row=proveRow_(paymentId,'ACCEPTED');fire_('afterAcceptedReadBack',{paymentId:paymentId});return finalize_(request,serverActor,row,revenue,false,lock);
      });}catch(error){if(error.code)throw error;if(appendAttempted)throw paymentError_('REVENUE_PAYMENT_RECOVERY_REQUIRED','Payment acceptance requires recovery.',{paymentId:paymentId,requestKey:request.requestKey,state:'UNKNOWN',action:'RETRY_OR_RECONCILE'});throw error;}
    }
    function window_(criteria,history){
      criteria=criteria||{};var offset=Number(criteria.offset||0);if(!Number.isInteger(offset)||offset<0)throw paymentError_('REVENUE_PAYMENT_VALIDATION','Read offset is invalid.');var revenueId=upper_(criteria.revenueId),requestKey=upper_(criteria.requestKey);if(history&&!revenueId)throw paymentError_('REVENUE_PAYMENT_VALIDATION','Revenue ID is required.');if(!history&&Boolean(revenueId)===Boolean(requestKey))throw paymentError_('REVENUE_PAYMENT_VALIDATION','Specify exactly one inspection identity.');
      var page=payments.readWindow(offset,MAX_ROWS);if(page.missing)return{totalLedgerRows:0,rowsRead:0,offset:offset,nextOffset:offset,truncated:false,scope:'LOCAL_PAGE',integrityState:'UNAVAILABLE',items:history?[]:undefined,findings:history?undefined:[{code:'PAYMENT_SHEET_MISSING'}]};var global=offset===0&&page.totalLedgerRows<=MAX_ROWS,items=[],findings=[];try{var rows=validateRows_(page.rows,hash,revenueId);items=rows.filter(function(row){return revenueId?row.revenueId===revenueId:row.requestKey===requestKey;});if(global){var aggregateRevenueId=revenueId||(items.length===1?items[0].revenueId:'');if(aggregateRevenueId){var revenue=findRevenue_(aggregateRevenueId),agg=aggregate_(targetRows_(rows,aggregateRevenueId),revenue);if(agg.totalPaise>agg.netReceivablePaise)findings.push({code:'LEGACY_OVERPAYMENT',revenueId:aggregateRevenueId,amountReceived:agg.amountReceived,netReceivable:agg.netReceivable});if(!completeMatches_(revenue,agg))findings.push({code:'AGGREGATE_MISMATCH',revenueId:aggregateRevenueId});}}items.forEach(function(row){if(row.state==='ACCEPTED')findings.push({code:'PAYMENT_ACCEPTED',paymentId:row.paymentId});});}catch(error){findings.push({code:error.code||'REVENUE_PAYMENT_INSPECTION_UNAVAILABLE'});}
      var base={totalLedgerRows:page.totalLedgerRows,rowsRead:page.rows.length,offset:offset,nextOffset:offset+page.rows.length,truncated:offset+page.rows.length<page.totalLedgerRows,scope:global?'GLOBAL':'LOCAL_PAGE',integrityState:global?(findings.length?'ISSUES_FOUND':'VERIFIED'):'UNVERIFIED_LIMIT'};
      if(history){base.items=items.slice(0,100).map(function(row){return{paymentId:row.paymentId,revenueId:row.revenueId,paymentDate:row.paymentDate,amount:row.amount,reference:row.reference,createdAt:row.createdAt,createdBy:row.createdBy,state:row.state};});}else base.findings=findings;return base;
    }
    function inspect(criteria){return window_(criteria,false);}function history(criteria){return window_(criteria,true);}
    function reconcile(criteria,actor){var revenueId=upper_(criteria&&criteria.revenueId),serverActor=actor_(actor);if(!revenueId)throw paymentError_('REVENUE_PAYMENT_VALIDATION','Revenue ID is required.');return withLock_(function(lock){var page=payments.readWindow(0,MAX_ROWS);if(page.totalLedgerRows>MAX_ROWS)throw paymentError_('REVENUE_PAYMENT_INSPECTION_LIMIT','Payment evidence exceeds the reconciliation limit.');var revenue=findRevenue_(revenueId),rows=scopedRows_(page.rows,hash,revenueId),target=targetRows_(rows,revenueId),agg=aggregate_(target,revenue),changed=!completeMatches_(revenue,agg)||target.some(function(row){return row.state==='ACCEPTED';});if(!changed)return{outcome:'VERIFIED',revenueId:revenueId,state:'COMPLETED',action:'NONE'};var updated=revenues.applyAggregateUnderLock(revenueId,agg,serverActor,clock(),lock);target.filter(function(row){return row.state==='ACCEPTED';}).forEach(function(row){payments.recoverUnderLock(row.paymentId,serverActor,clock(),lock);});flush();return{outcome:'RECOVERED',revenueId:revenueId,state:'COMPLETED',action:'NONE',revenue:updated};});}
    return Object.freeze({record:record,inspect:inspect,history:history,reconcile:reconcile});
  }

  namespace.RevenuePayment=Object.freeze({create:create,financial:financial_,moneyPaise:function(value){return decimal_(value,6,'Amount',true);},paymentPaise:paymentPaise_,dateDay:dateDay_,email:email_,request:request_,fingerprint:fingerprint_,aggregate:aggregate_,aggregateMatches:completeMatches_,validateRows:validateRows_,error:paymentError_,MAX_ROWS:MAX_ROWS});
})(JSKOS);
