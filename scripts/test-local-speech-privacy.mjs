import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const helper=fs.readFileSync(new URL('../local-speech-privacy.js',import.meta.url),'utf8');
const tasbih=fs.readFileSync(new URL('../tasbih-controller.js',import.meta.url),'utf8');
const poetry=fs.readFileSync(new URL('../poetry-dictation.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const headers=fs.readFileSync(new URL('../_headers',import.meta.url),'utf8');
const worker=fs.readFileSync(new URL('../service-worker.js',import.meta.url),'utf8');
const core=fs.readFileSync(new URL('../app-core.js',import.meta.url),'utf8');

class LocalRecognizer {
  constructor(){this.lang='';this.started=false}
  start(){this.started=true}
  stop(){}
}
LocalRecognizer.prototype.processLocally=false;
LocalRecognizer.available=()=>Promise.resolve('available');
const localWindow={SpeechRecognition:LocalRecognizer};
vm.runInNewContext(helper,{window:localWindow,globalThis:localWindow});
assert.equal(localWindow.AnwarLocalSpeech.supported(),true,'recognizer with processLocally support is eligible');
const session=localWindow.AnwarLocalSpeech.create('ar-MA');
assert.equal(session.lang,'ar-MA','the requested Arabic locale is preserved');
assert.equal(session.processLocally,true,'the helper sets processLocally before returning the recognizer');
session.start();
assert.equal(session.started,true,'a verified local recognizer can start after the local-only flag is set');

class RemoteOnlyRecognizer {
  constructor(){this.started=false}
  start(){this.started=true}
  stop(){}
}
const remoteWindow={SpeechRecognition:RemoteOnlyRecognizer};
vm.runInNewContext(helper,{window:remoteWindow,globalThis:remoteWindow});
assert.equal(remoteWindow.AnwarLocalSpeech.supported(),false,'remote-only recognizers are not eligible');
assert.throws(()=>remoteWindow.AnwarLocalSpeech.create('ar'),/أوقفنا الميكروفون/,'remote-only recognizers are rejected before microphone start');

class NoOpLocalFlagRecognizer{
  start(){}
  stop(){}
}
NoOpLocalFlagRecognizer.prototype.processLocally=false;
const noOpWindow={SpeechRecognition:NoOpLocalFlagRecognizer};
vm.runInNewContext(helper,{window:noOpWindow,globalThis:noOpWindow});
assert.equal(noOpWindow.AnwarLocalSpeech.supported(),false,'a no-op processLocally property without local availability support is rejected');


const absentWindow={};
vm.runInNewContext(helper,{window:absentWindow,globalThis:absentWindow});
assert.equal(absentWindow.AnwarLocalSpeech.supported(),false,'a browser without speech recognition fails closed');

assert.doesNotMatch(helper,/\.install\s*\(/,'the app never downloads speech models automatically');
assert.match(tasbih,/new\s+SpeechRecognition\(\)/,'tasbih alone has a dedicated browser speech recognizer');
assert.doesNotMatch(tasbih,/AnwarLocalSpeech|processLocally/,'tasbih does not inherit the writing tools local-only restriction');
assert.doesNotMatch(tasbih,/window\.confirm\(['\"]تنبيه خصوصية/,'tasbih does not add a blocking privacy confirmation dialog');
assert.match(poetry,/localSpeech\.create\(LANGUAGES\[0\]\)/,'the dormant dictation module remains local-only if ever reused');
assert.doesNotMatch(html,/id="sp"|poetry-dictation\.js/,'writing tools expose no dictation microphone control or script');
assert.doesNotMatch(core,/id==='sp'\)togglePoetryDictation/,'the notebook toolbar cannot start microphone dictation');
assert.ok(html.indexOf('local-speech-privacy.js')<html.indexOf('tasbih-controller.js'),'the tasbih voice code remains separated from local-only writing recognition');
assert.match(html,/tasbih-controller\.js\?v=20261126-4/,'the tasbih voice fix receives a fresh browser asset URL');
assert.match(headers,/microphone=\(self\)/,'microphone access is limited to this origin');
assert.match(headers,/on-device-speech-recognition=\(self\)/,'on-device speech recognition is explicitly permitted for this origin');
assert.match(worker,/\.\/local-speech-privacy\.js/,'the local speech privacy gate is included in the offline shell');
assert.match(worker,/anwar-shell-\d{4}-\d{2}-\d{2}-v\d+/,'the offline shell uses a dated, versioned release cache');
assert.match(html,/قد يرسل المتصفح الصوت إلى خدمة التعرف التابعة له/,'tasbih warns that browser recognition may send audio to its provider');

console.log('PASS: writing dictation is removed; tasbih voice starts from its button and the interface discloses possible browser-provider audio processing.');

const appCorePreload=html.match(/<link rel="preload" href="([^"]*app-core[.]js[?]v=[^"]+)" as="script">/);
const appCoreScript=html.match(/<script src="([^"]*app-core[.]js[?]v=[^"]+)" defer><\/script>/);
assert.ok(appCorePreload&&appCoreScript&&appCorePreload[1]===appCoreScript[1],'the app-core preload and executed script always use the same cache-busted URL');
