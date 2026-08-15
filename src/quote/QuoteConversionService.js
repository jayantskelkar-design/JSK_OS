/** JSK OS Build 1023 - durable Quote to Policy conversion control. */
var JSKOS=JSKOS||{};
(function(namespace){
  'use strict';

  function conversionError_(code,message){var error=new Error(message);error.code=code;return error;}
  function text_(value){return value===null||value===undefined?'':String(value).trim();}
  function upper_(value){return text_(value).toUpperCase();}
  function recovery_(message){return conversionError_('QUOTE_CONVERSION_RECOVERY_REQUIRED',message||'Quote conversion requires recovery.');}
  function conflict_(message){return conversionError_('QUOTE_CONVERSION_CONFLICT',message||'Quote conversion evidence is contradictory.');}

  function create(options){
    options=options||{};
    var quotes=options.quoteRepository,policies=options.policyRepository,lockProvider=options.lockProvider,
      clock=options.clock||function(){return new Date();},uuid=options.uuid,
      canonicalize=options.canonicalize,hash=options.hash;
    if(!quotes||!policies||typeof lockProvider!=='function'||typeof uuid!=='function'||
       typeof canonicalize!=='function'||typeof hash!=='function')throw new Error('Quote conversion dependencies are incomplete.');

    function request_(payload){
      if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error('Quote conversion request is invalid.');
      var request={quoteId:upper_(payload.quoteId),policyNumber:text_(payload.policyNumber),policyType:text_(payload.policyType),insuredName:text_(payload.insuredName)};
      if(!request.quoteId)throw new Error('Quote ID is required.');
      return request;
    }

    function policyDraft_(quote,request){
      if(quote.clientDecision!=='Approved'&&quote.status!=='Approved')throw new Error('Client approval is required before policy conversion.');
      var missing=['policyNumber','policyType','insuredName'].filter(function(key){return !request[key];});
      if(missing.length)throw new Error('Complete required policy fields: '+missing.join(', ')+'.');
      return{
        policyNumber:request.policyNumber,policyType:request.policyType,insuredName:request.insuredName,
        insurerName:text_(quote.insurerName),proposalNumber:text_(quote.proposalNumber),
        companyId:upper_(quote.companyId),personId:upper_(quote.personId),
        netPremium:Number(quote.premium||0),totalPremium:Number(quote.totalPremium||0),
        sumInsured:Number(quote.sumInsured||0),assignedOwner:text_(quote.assignedOwner)
      };
    }

    function fingerprint_(draft){var value=String(hash(canonicalize(draft))||'').toLowerCase();if(!/^[a-f0-9]{64}$/.test(value))throw new Error('Quote conversion fingerprint is unavailable.');return value;}
    function newIdentity_(){var value=String(uuid()||'').replace(/[^A-Fa-f0-9]/g,'').toUpperCase();if(value.length<32)throw new Error('Quote conversion identity is unavailable.');return'QCV-'+value.slice(0,32);}
    function outcome_(name,quote,policy){return{outcome:name,quoteId:quote.quoteId,policy:policy};}

    function lookupEvidence_(quoteId,conversionId){
      try{return policies.findQuoteConversionEvidence(quoteId,conversionId)||[];}
      catch(error){throw recovery_('Policy conversion evidence lookup is unavailable.');}
    }
    function lookupSource_(quoteId){
      try{return policies.findAllBySourceQuoteId(quoteId)||[];}
      catch(error){throw recovery_('Policy source Quote lookup is unavailable.');}
    }
    function lookupHistorical_(policyId){
      try{return policies.findAllByPolicyId(policyId)||[];}
      catch(error){throw recovery_('Historical Policy lookup is unavailable.');}
    }

    function exactEvidence_(quote){
      var quoteId=upper_(quote.quoteId),conversionId=upper_(quote.quoteConversionId),rows=lookupEvidence_(quoteId,conversionId),exact=[],contradictory=[];
      rows.forEach(function(policy){
        var source=upper_(policy.sourceQuoteId),conversion=upper_(policy.quoteConversionId);
        if(source===quoteId&&conversion===conversionId)exact.push(policy);else contradictory.push(policy);
      });
      if(contradictory.length||exact.length>1)throw conflict_('Policy conversion evidence is contradictory or multiple.');
      return exact;
    }

    function verifyLinkedPolicy_(quote,policy){
      var policyId=upper_(policy&&policy.policyId);
      if(!policyId||policy.isDeleted)throw conflict_('The linked Policy is unavailable.');
      if(quote.policyId&&upper_(quote.policyId)!==policyId)throw conflict_('Quote Policy ID contradicts destination evidence.');
      if(quote.quoteConversionPolicyId&&upper_(quote.quoteConversionPolicyId)!==policyId)throw conflict_('Quote conversion Policy evidence contradicts the destination.');
      if(!text_(quote.quoteConversionActor)||text_(policy.createdBy).toLowerCase()!==text_(quote.quoteConversionActor).toLowerCase())throw conflict_('Quote and Policy actor evidence is contradictory.');
      return policyId;
    }

    function historical_(quote){
      if(!quote.policyId)throw recovery_('Historical converted Quote has no Policy link.');
      var matches=lookupHistorical_(quote.policyId);
      if(matches.length>1)throw conflict_('Historical Policy evidence is ambiguous.');
      if(!matches.length||matches[0].isDeleted)throw recovery_('Historical Policy destination is unavailable.');
      return outcome_('ALREADY_COMPLETED',quote,matches[0]);
    }

    function markRecovery_(quoteId,conversionId,actor,lock){
      try{quotes.markConversionRecoveryUnderLock(quoteId,conversionId,'QUOTE_CONVERSION_RECOVERY_REQUIRED',actor,clock(),lock);}catch(ignored){}
    }

    function createAndFinalize_(quote,conversionId,draft,fingerprint,actor,lock){
      var policy;
      try{policy=policies.createFromQuoteUnderLock(draft,actor,quote.quoteId,conversionId,lock);}
      catch(error){markRecovery_(quote.quoteId,conversionId,actor,lock);throw recovery_('Policy creation outcome requires recovery.');}
      if(!policy||policy.isDeleted||upper_(policy.sourceQuoteId)!==upper_(quote.quoteId)||upper_(policy.quoteConversionId)!==conversionId){markRecovery_(quote.quoteId,conversionId,actor,lock);throw recovery_('Created Policy linkage could not be verified.');}
      if(text_(policy.createdBy).toLowerCase()!==text_(actor).toLowerCase()||text_(policy.updatedBy).toLowerCase()!==text_(actor).toLowerCase())throw conflict_('Created Policy actor evidence is contradictory.');
      var matches=exactEvidence_(Object.assign({},quote,{quoteConversionId:conversionId}));
      if(matches.length!==1||upper_(matches[0].policyId)!==upper_(policy.policyId)){markRecovery_(quote.quoteId,conversionId,actor,lock);throw recovery_('Created Policy evidence could not be proven.');}
      try{
        quotes.recordConversionPolicyUnderLock(quote.quoteId,conversionId,policy.policyId,actor,clock(),lock);
        var complete=quotes.completeConversionUnderLock(quote.quoteId,conversionId,policy.policyId,actor,clock(),lock);
        return outcome_('COMPLETED',complete,policy);
      }catch(error){markRecovery_(quote.quoteId,conversionId,actor,lock);throw recovery_('Quote finalization requires recovery.');}
    }

    function resume_(quote,request,actor,lock){
      var conversionId=upper_(quote.quoteConversionId),state=text_(quote.quoteConversionState),allowed=['INTENT_RECORDED','POLICY_CREATED','COMPLETE','RECOVERY_REQUIRED'];
      if(!/^QCV-[A-F0-9]{32}$/.test(conversionId)||allowed.indexOf(state)===-1)throw conflict_('Quote conversion journal is invalid.');
      var exact=exactEvidence_(quote),workflowActor=text_(quote.quoteConversionActor).toLowerCase();
      if(exact.length){
        var policy=exact[0],policyId=verifyLinkedPolicy_(quote,policy);
        if(state==='COMPLETE'){
          if(upper_(quote.policyId)!==policyId||upper_(quote.quoteConversionPolicyId)!==policyId)throw conflict_('Complete Quote evidence is inconsistent.');
          return outcome_('ALREADY_COMPLETED',quote,policy);
        }
        var existingDraft=policyDraft_(quote,request),existingFingerprint=fingerprint_(existingDraft);
        if(existingFingerprint!==text_(quote.quoteConversionFingerprint).toLowerCase())throw conflict_('Quote conversion payload changed while recovery was pending.');
        try{
          if(state!=='POLICY_CREATED'||upper_(quote.quoteConversionPolicyId)!==policyId)quotes.recordConversionPolicyUnderLock(quote.quoteId,conversionId,policyId,workflowActor,clock(),lock);
          var finalized=quotes.completeConversionUnderLock(quote.quoteId,conversionId,policyId,workflowActor,clock(),lock);
          return outcome_('ALREADY_COMPLETED',finalized,policy);
        }catch(error){markRecovery_(quote.quoteId,conversionId,workflowActor,lock);throw recovery_('Quote recovery finalization is unavailable.');}
      }

      if(state==='COMPLETE'||quote.policyId||quote.quoteConversionPolicyId)throw conflict_('Quote claims Policy evidence that cannot be found.');
      var draft=policyDraft_(quote,request),currentFingerprint=fingerprint_(draft);
      if(currentFingerprint!==text_(quote.quoteConversionFingerprint).toLowerCase())throw conflict_('Quote conversion payload changed while recovery was pending.');
      return createAndFinalize_(quote,conversionId,draft,currentFingerprint,workflowActor,lock);
    }

    function locked_(request,actor,lock){
      var quote=quotes.find(request.quoteId,true);
      if(!quote)throw new Error('Quote not found.');
      if(quote.isDeleted)throw new Error('Quote is archived.');
      if(quote.quoteConversionId)return resume_(quote,request,actor,lock);
      if(quote.status==='Converted')return historical_(quote);
      if(quote.policyId)throw conflict_('Quote already carries Policy evidence without a conversion journal.');
      var sourceMatches=lookupSource_(quote.quoteId);
      if(sourceMatches.length>1)throw conflict_('Multiple Policies already reference this Quote.');
      if(sourceMatches.length===1)throw recovery_('A Policy already references this Quote without a recoverable journal identity.');
      var draft=policyDraft_(quote,request),fingerprint=fingerprint_(draft),conversionId=newIdentity_(),intent;
      try{intent=quotes.beginConversionUnderLock(quote.quoteId,conversionId,fingerprint,actor,clock(),lock);}
      catch(error){throw recovery_('Quote conversion intent could not be persisted safely.');}
      return createAndFinalize_(intent,conversionId,draft,fingerprint,actor,lock);
    }

    function convert(payload,actor){
      var request=request_(payload),lock=lockProvider(),acquired=false;
      try{lock.waitLock(30000);acquired=true;}
      catch(error){throw conversionError_('QUOTE_CONVERSION_LOCK_UNAVAILABLE','Quote conversion is busy. Try again.');}
      try{return locked_(request,actor,lock);}
      finally{if(acquired)lock.releaseLock();}
    }

    return Object.freeze({convert:convert});
  }

  namespace.QuoteConversion=Object.freeze({create:create});
})(JSKOS);
