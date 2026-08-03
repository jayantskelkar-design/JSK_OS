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

function apiQuoteConvertToPolicy(payload){payload=payload||{};return quoteApi_('convert-policy',function(){var draft=apiQuoteConversionDraft(payload);if(!draft.success)throw new Error(draft.error.message);if(draft.data.missingFields.length)throw new Error('Complete required policy fields: '+draft.data.missingFields.join(', ')+'.');var quoteRepo=new QuoteRepository(),quote=quoteRepo.find(payload.quoteId,false),policy=new PolicyRepository().create(draft.data.policy,payload.actor||'Quote Conversion');quoteRepo.update(quote.quoteId,{status:'Converted',policyId:policy.policyId},payload.actor||'Quote Conversion',quote.recordVersion);return{quoteId:quote.quoteId,policy:policy};});}

function apiQuotePrintSummary(payload){payload=payload||{};return quoteApi_('print-summary',function(){var quote=new QuoteRepository().find(payload.quoteId,false);if(!quote)throw new Error('Quote not found.');return{title:'Insurance Quote '+quote.quoteNumber,lines:[['Insurer',quote.insurerName],['Product',quote.productName],['Premium',quote.premium],['GST',quote.gstAmount],['Total Premium',quote.totalPremium],['Sum Insured',quote.sumInsured],['Deductible',quote.deductible],['Coverage',quote.coverage],['Exclusions',quote.exclusions],['Expiry Date',quote.expiryDate],['Client Decision',quote.clientDecision]]};});}
