'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),root=path.resolve(__dirname,'..');let assertions=0,calls=[];
function assert(value,message){assertions++;if(!value)throw new Error(message);}
function source(file){return fs.readFileSync(path.join(root,file),'utf8');}
function visionResponse(text,status){return{getResponseCode(){return status||200;},getContentText(){return JSON.stringify(status&&status!==200?{error:{code:status}}:{responses:[{fullTextAnnotation:{text,pages:[{confidence:.88}]}}]});}};}
const context={Object,Array,String,Number,Boolean,Math,JSON,Error,UrlFetchApp:{fetch(url,options){calls.push({url,options});return visionResponse(context.nextText.shift());}},ScriptApp:{getOAuthToken(){return'SYNTHETIC_TOKEN';}}};vm.createContext(context);vm.runInContext(source('src/garuda/GarudaCloudVisionOcr.js'),context,{filename:'GarudaCloudVisionOcr.js'});vm.runInContext(source('src/garuda/GarudaVisitingCard.js'),context,{filename:'GarudaVisitingCard.js'});
const ocr=context.JSKOS.GarudaCloudVisionOcr,card=context.JSKOS.GarudaVisitingCard;
function run(){
  const front='Aarav Mehta\nDirector\nSynthetic Industries Pvt Ltd\nMobile: +91 98765 43210\naarav@example.com';
  const back='www.synthetic.example\nTel: 020 41234567\nAddress: Plot 7, Industrial Estate, Pune - 411001\nGSTIN: 27ABCDE1234F1Z5\nProducts / Services: Industrial components';
  const parsedFront=ocr.parse(front,.9),parsedBack=ocr.parse(back,.8);
  assert(parsedFront.personName==='Aarav Mehta','Name on Front failed');assert(parsedFront.companyName==='Synthetic Industries Pvt Ltd','Company on Front failed');assert(parsedFront.primaryMobile,'Primary mobile failed');assert(parsedFront.email==='aarav@example.com','Email failed');
  assert(parsedBack.website==='www.synthetic.example','www-only website failed');assert(parsedBack.address&&/Pune/.test(parsedBack.address),'Address on Back failed');assert(parsedBack.gstin==='27ABCDE1234F1Z5','GSTIN failed');assert(parsedBack.productsServices==='Industrial components','Products/services failed');
  const merged=card.merge(parsedFront,parsedBack);assert(merged.fields.website==='https://www.synthetic.example','Version 180 website normalization failed');assert(merged.provenance.personName==='VISITING_CARD_FRONT','Front provenance failed');assert(merged.provenance.website==='VISITING_CARD_BACK','Back provenance failed');assert(merged.requiresReview===true,'Human review not mandatory');
  const observedFront='Jayant S. Kelkar\nFinancial & Insurance Advisor\nJSK Investment\nMobile: 9822056085\njsk.investment@gmail.com\nwww.jayantskelkar.com\nThe Pentagon Building,\nPune-Satara Road, Pune - 411037\nMaharashtra, India';
  const observedBack='RISK MANAGEMENT\nWEALTH CREATION\nBUSINESS PROTECTION\nTRUST & SUPPORT\nOUR SERVICES\nCorporate Insurance solutions for businesses and families';
  const observedParsedFront=ocr.parse(observedFront,.88),observedParsedBack=ocr.parse(observedBack,.88),observedMerged=card.merge(observedParsedFront,observedParsedBack);
  assert(observedParsedFront.personName==='Jayant S. Kelkar','Observed Front person name failed');assert(observedParsedFront.designation==='Financial & Insurance Advisor','Observed Front designation failed');assert(observedParsedFront.companyName==='JSK Investment','Observed Front company failed');
  assert(observedParsedFront.address==='The Pentagon Building, Pune-Satara Road, Pune - 411037, Maharashtra, India','Observed multiline address failed');assert(!observedParsedBack.personName&&!observedParsedBack.companyName,'Back heading/marketing text accepted as identity');
  assert(observedMerged.fields.personName==='Jayant S. Kelkar'&&observedMerged.fields.companyName==='JSK Investment','Front identity preference failed');assert(observedMerged.fields.website==='https://www.jayantskelkar.com','Observed website normalization failed');assert(observedMerged.conflicts.length===0,'Valid observed identity created false review conflict');
  const live183Front='JSK\nINVESTMENT\nJayant\nS.\nKelkar\nFinancial & Insurance Advisor\nMobile: 9822056085\njsk.investment@gmail.com\nwww.jayantskelkar.com\nThe Pentagon Building,\nPune-Satara Road, Pune - 411037\nMaharashtra, India',live183Parsed=ocr.parse(live183Front,.88),live183Merged=card.merge(live183Parsed,{});
  assert(live183Parsed.personName==='Jayant S. Kelkar'&&live183Parsed.confidence.personName>=.85,'Version 183 split-line person name failed');assert(live183Parsed.companyName==='JSK Investment'&&live183Parsed.confidence.companyName>=.85,'Version 183 split company reconstruction failed');assert(live183Merged.fields.personName==='Jayant S. Kelkar'&&live183Merged.fields.companyName==='JSK Investment'&&!live183Merged.conflicts.length,'Version 183 observed identity retained review defects');
  [['Jayant Kelkar\nFinancial & Insurance Advisor','Jayant Kelkar'],['JAYANT S. KELKAR\nFinancial & Insurance Advisor','JAYANT S. KELKAR'],['Jayant\nR.\nKelkar\nFinancial & Insurance Advisor','Jayant R. Kelkar']].forEach(item=>assert(ocr.parse(item[0],.9).personName===item[1],'Personal-name layout failed: '+item[1]));
  [['ABC ENTERPRISES','ABC Enterprises'],['XYZ SOLUTIONS','XYZ Solutions'],['PQR INDUSTRIES','PQR Industries']].forEach(item=>assert(ocr.parse(item[0],.9).companyName===item[1],'One-line branded company failed: '+item[1]));
  const genericCompany=ocr.parse('INVESTMENT',.9),genericMerged=card.merge(genericCompany,{});assert(genericCompany.companyName==='Investment'&&genericCompany.confidence.companyName<.7&&!genericMerged.fields.companyName&&genericMerged.conflicts.some(item=>item.reason==='INCOMPLETE_COMPANY_NAME'),'Generic company evidence did not remain unresolved');
  ['RISK MANAGEMENT','WEALTH CREATION','OUR SERVICES','CORPORATE INSURANCE','JSK INVESTMENT'].forEach(value=>assert(!ocr.parse(value+'\nFinancial & Insurance Advisor',.9).personName,'Heading/company accepted as person: '+value));
  const duplicate=card.merge({primaryMobile:'9876543210',mobile:'9876543210'},{primaryMobile:'9876543210',mobile:'9876543210'});assert(duplicate.fields.primaryMobile==='9876543210'&&!duplicate.fields.alternateMobile,'Duplicate phone created alternate');
  const two=card.merge({primaryMobile:'9876543210',mobile:'9876543210'},{primaryMobile:'9123456780',mobile:'9123456780'});assert(two.fields.alternateMobile==='9123456780','Two mobile numbers failed');
  const unsafeBack=card.merge({}, {personName:'RISK MANAGEMENT',companyName:'Corporate Insurance solutions for clients',confidence:{personName:.9,companyName:.9},address:'The Pentagon Building'});assert(!unsafeBack.fields.personName&&!unsafeBack.fields.companyName&&unsafeBack.conflicts.some(item=>item.reason==='PROBABLE_HEADING')&&unsafeBack.conflicts.some(item=>item.reason==='INCOMPLETE_ADDRESS'),'Unsafe Back identity/address did not require review');
  context.nextText=[front,back];calls=[];const extracted=ocr.extract({front:{base64:'FRONT'},back:{base64:'BACK'}});assert(calls.length===2&&extracted.front.email&&extracted.back.website,'Front/Back were not separate Vision calls');const request=JSON.parse(calls[0].options.payload);assert(calls[0].url==='https://vision.googleapis.com/v1/images:annotate'&&calls[0].options.headers.Authorization==='Bearer SYNTHETIC_TOKEN','Cloud Vision OAuth failed');assert(request.requests[0].features[0].type==='DOCUMENT_TEXT_DETECTION'&&request.requests[0].image.content==='FRONT','Vision request invalid');
  assert(!/api[_-]?key|key=/.test(calls[0].url+JSON.stringify(calls[0].options)),'API key exposed');
  const manifest=JSON.parse(source('src/appsscript.json'));
  const requiredScopes=[
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/script.send_mail',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/script.scriptapp',
    'https://www.googleapis.com/auth/cloud-vision',
    'https://www.googleapis.com/auth/script.external_request'
  ];
  assert(requiredScopes.every(scope=>manifest.oauthScopes.includes(scope)),'Complete audited OAuth scope inventory missing');
  const provider=source('src/garuda/GarudaCloudVisionOcr.js'),backend=source('src/garuda/GarudaBackend.js');assert(!/DriveApp|PropertiesService|console\.|Logger\./.test(provider),'OCR provider persists or logs PII');assert(!/appendRow|setValues|setValue|insertSheet/.test(provider+backend),'OCR path writes data');
  let unavailable=null;context.UrlFetchApp.fetch=function(){throw new Error('secret provider detail');};try{ocr.extract({front:{base64:'X'}});}catch(error){unavailable=error;}assert(unavailable&&unavailable.code==='GARUDA_OCR_UNAVAILABLE'&&!/secret provider detail/.test(unavailable.message),'Vision error did not fail closed');
}
try{run();process.stdout.write(JSON.stringify({success:true,assertions,calls:'SYNTHETIC_ONLY'},null,2)+'\n');}catch(error){process.stdout.write(JSON.stringify({success:false,assertions,error:error.stack},null,2)+'\n');process.exitCode=1;}
