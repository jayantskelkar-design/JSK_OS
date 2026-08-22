/** JSK OS Build 1010 Phase 3 - Quote decision and conversion services. */
(function(){
  var originalNormalize=QuoteRepository.prototype.norm_;
  QuoteRepository.prototype.norm_=function(data){
    var normalized=originalNormalize.call(this,data||{});
    if(normalized.premium!==undefined&&normalized.premium!==''){
      if(normalized.gstAmount===undefined||normalized.gstAmount==='')normalized.gstAmount=Math.round(Number(normalized.premium)*0.18*100)/100;
      if(normalized.totalPremium===undefined||normalized.totalPremium==='')normalized.totalPremium=Math.round((Number(normalized.premium)+Number(normalized.gstAmount||0))*100)/100;
    }
    return normalized;
  };
})();

function apiQuoteConversionDraft(payload){payload=payload||{};return quoteApi_('conversion-draft',function(){var quote=new QuoteRepository().find(payload.quoteId,false);if(!quote)throw new Error('Quote not found.');if(quote.clientDecision!=='Approved'&&quote.status!=='Approved')throw new Error('Client approval is required before policy conversion.');return{quoteId:quote.quoteId,policy:{policyNumber:payload.policyNumber||'',policyType:payload.policyType||'',insuredName:payload.insuredName||'',insurerName:quote.insurerName||'',proposalNumber:quote.proposalNumber||'',companyId:quote.companyId||'',personId:quote.personId||'',premiumAmount:Number(quote.premium||0),totalPremium:Number(quote.totalPremium||0),sumInsured:Number(quote.sumInsured||0),assignedOwner:quote.assignedOwner||''},missingFields:['policyNumber','policyType','insuredName'].filter(function(key){return !payload[key];})};});}

function ensureBuild1023QuoteConversionSchemas_(){requireBuild1010Quotes_();requirePolicySchema_();}
function quoteConversionHash_(value){var bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value,Utilities.Charset.UTF_8);return bytes.map(function(byte){return('0'+((byte+256)%256).toString(16)).slice(-2);}).join('');}
function quoteConversionService_(){ensureBuild1023QuoteConversionSchemas_();var spreadsheet=JSKOS.ConfigService.getSpreadsheet();return JSKOS.QuoteConversion.create({quoteRepository:new QuoteRepository(),policyRepository:new PolicyRepository(spreadsheet),lockProvider:function(){return LockService.getScriptLock();},clock:function(){return new Date();},uuid:function(){return Utilities.getUuid();},canonicalize:function(value){return JSKOS.WorkflowConfirmation.canonicalize(value);},hash:quoteConversionHash_});}
function apiQuoteConvertToPolicy(payload){payload=payload||{};return quoteApi_('convert-policy',function(context){JSKOS.AccessControl.requireModuleOperation('policies','create');var actor=quoteServerActor_(context),request={quoteId:payload.quoteId,policyNumber:payload.policyNumber,policyType:payload.policyType,insuredName:payload.insuredName};return quoteConversionService_().convert(request,actor);});}

function apiQuotePrintSummary(payload){payload=payload||{};return quoteApi_('print-summary',function(){var quote=new QuoteRepository().find(payload.quoteId,false);if(!quote)throw new Error('Quote not found.');return{title:'Insurance Quote '+quote.quoteNumber,lines:[['Insurer',quote.insurerName],['Product',quote.productName],['Premium',quote.premium],['GST',quote.gstAmount],['Total Premium',quote.totalPremium],['Sum Insured',quote.sumInsured],['Deductible',quote.deductible],['Coverage',quote.coverage],['Exclusions',quote.exclusions],['Expiry Date',quote.expiryDate],['Client Decision',quote.clientDecision]]};});}
function apiQuoteDecision(payload){payload=payload||{};return quoteApi_('decision',function(context){var actor=quoteServerActor_(context),repo=new QuoteRepository(),quote=repo.find(payload.quoteId,false);if(!quote)throw new Error('Quote not found.');var decision=String(payload.decision||'');if(JSK_QUOTE_SCHEMA.DECISION_VALUES.indexOf(decision)===-1)throw new Error('Select a valid client decision.');return repo.update(quote.quoteId,{clientDecision:decision,status:decision==='Approved'?'Approved':decision==='Rejected'?'Rejected':quote.status},actor,quote.recordVersion);});}
