import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../poetry-dictation.js',import.meta.url),'utf8');
const localSpeechSource=fs.readFileSync(new URL('../local-speech-privacy.js',import.meta.url),'utf8');
const timers=new Map();
let nextTimer=1;
const instances=[];
class FakeRecognition{
 constructor(){this.lang='';this.continuous=false;this.interimResults=false;this.maxAlternatives=0;this.started=false;instances.push(this)}
 start(){this.started=true;this.onstart?.()}
 stop(){this.stopped=true;this.onend?.()}
 abort(){this.aborted=true;this.onend?.()}
 emit(transcripts,resultIndex=0){
  const results=transcripts.map(item=>({isFinal:item.final!==false,0:{transcript:item.text}}));
  this.onresult?.({results,resultIndex});
 }
 error(error){this.onerror?.({error})}
 end(){this.onend?.()}
}
FakeRecognition.prototype.processLocally=false;
class RemoteOnlyRecognition{
 constructor(){this.started=false}
 start(){this.started=true}
 stop(){}
}
const browser={
 SpeechRecognition:FakeRecognition,
 setTimeout(callback){const id=nextTimer++;timers.set(id,callback);return id},
 clearTimeout(id){timers.delete(id)}
};
vm.runInNewContext(localSpeechSource,{window:browser,globalThis:browser,WeakSet,Array,Object,String,Number,Math});
vm.runInNewContext(source,{window:browser,globalThis:browser,WeakSet,Array,Object,String,Number,Math});
assert.ok(browser.AnwarPoetryDictation,'dictation controller is exported');
assert.deepEqual(Array.from(browser.AnwarPoetryDictation.LANGUAGES),['ar'],'only standard Arabic is enabled');

function flushTimers(){
 let rounds=0;
 while(timers.size&&rounds++<10){
  const [id,callback]=timers.entries().next().value;
  timers.delete(id);callback();
 }
 assert.ok(rounds<10,'retry timers must remain bounded');
}
function result(text,final=true){return {text,final}}

const inserted=[],statuses=[];
let controller=browser.AnwarPoetryDictation.create({
 onText:(text,parts)=>inserted.push({text,parts}),
 onStatus:(state,detail)=>statuses.push({state,detail}),
 setTimeout:callback=>{const id=nextTimer++;timers.set(id,callback);return id},
 clearTimeout:id=>timers.delete(id)
});
assert.equal(controller.start(),true,'dictation should start when SpeechRecognition exists');
assert.equal(instances[0].lang,'ar','standard Arabic is the sole recognition language');
assert.equal(instances[0].processLocally,true,'the recognizer must force local processing before any microphone start');
assert.equal(controller.getLanguage(),'ar','controller exposes Arabic only');
assert.equal(instances[0].continuous,true,'recognition stays continuous where supported');
assert.equal(instances[0].interimResults,true,'interim recognition is enabled');

instances[0].emit([result('يا ليل')]);
instances[0].emit([result('يا ليل')]);
assert.deepEqual(inserted.map(item=>item.text),['يا ليل','يا ليل'],'fresh Android one-result batches must preserve repeated spoken phrases');

instances[0].emit([result('يا ليل'),result('يا ليل'),result('طاب السمر')],2);
assert.deepEqual(inserted.map(item=>item.text),['يا ليل','يا ليل','طاب السمر'],'cumulative browser results append only the newly finalized phrase');

instances[0].emit([result('كلمات مؤقتة',false)]);
assert.equal(inserted.length,3,'interim speech must not be inserted as final text');
controller.stop();
assert.equal(controller.isRequested(),false,'manual stop clears the recording request');
assert.equal(controller.isActive(),false,'manual stop clears active capture');

const unsupportedArabic=browser.AnwarPoetryDictation.create({onStatus:(state,detail)=>statuses.push({state,detail})});
unsupportedArabic.start();
const beforeUnsupported=instances.length;
instances.at(-1).error('language-not-supported');
assert.equal(unsupportedArabic.isRequested(),false,'unsupported Arabic recognition fails clearly without switching languages');
assert.equal(instances.length,beforeUnsupported,'no non-Arabic or alternate locale is attempted');
assert.ok(statuses.some(item=>item.state==='error'&&/العربية/.test(item.detail)),'Arabic-only limitation is explained to the user');

const interrupted=browser.AnwarPoetryDictation.create({onStatus:(state,detail)=>statuses.push({state,detail})});
interrupted.start();
const beforeRestart=instances.length;
instances.at(-1).end();
assert.equal(timers.size,1,'unexpected session end schedules a reconnect');
flushTimers();
assert.equal(instances.length,beforeRestart+1,'unexpected session end starts a new recognition session');
interrupted.stop();
assert.ok(statuses.some(item=>item.state==='restarting'),'temporary recognition interruption is surfaced to the UI');

const unsupported={};
vm.runInNewContext(localSpeechSource,{window:unsupported,globalThis:unsupported,WeakSet,Array,Object,String,Number,Math});
vm.runInNewContext(source,{window:unsupported,globalThis:unsupported,WeakSet,Array,Object,String,Number,Math});
let unsupportedStatus='';
const unavailable=unsupported.AnwarPoetryDictation.create({onStatus:(state)=>unsupportedStatus=state});
assert.equal(unavailable.start(),false,'unsupported browsers must not pretend to start');
assert.equal(unsupportedStatus,'error','unsupported browser state is reported');

const remoteOnly={SpeechRecognition:RemoteOnlyRecognition};
vm.runInNewContext(localSpeechSource,{window:remoteOnly,globalThis:remoteOnly,WeakSet,Array,Object,String,Number,Math});
vm.runInNewContext(source,{window:remoteOnly,globalThis:remoteOnly,WeakSet,Array,Object,String,Number,Math});
let remoteOnlyError='';
const remoteController=remoteOnly.AnwarPoetryDictation.create({onStatus:(state,detail)=>{if(state==='error')remoteOnlyError=detail}});
assert.equal(remoteController.start(),false,'a recognizer without processLocally support must not start');
assert.match(remoteOnlyError,/لم نبدأ الميكروفون|محلي/,'unsupported remote-only recognition is rejected with a privacy explanation');

console.log('PASS Arabic poetry dictation requires processLocally=true; remote-only recognition is rejected before microphone capture');
