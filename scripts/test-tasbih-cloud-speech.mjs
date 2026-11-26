import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../tasbih-cloud-speech.js',import.meta.url),'utf8');
let now=0,level=0,nextFrame=1;
const frames=new Map(),recorders=[],requests=[],counts=[],statuses=[];
let trackStopped=false,audioContextClosed=false,getUserMediaCalls=0;

class MockMediaRecorder{
 static isTypeSupported(type){return type==='audio/webm;codecs=opus'||type==='audio/webm'}
 constructor(stream,options){
  this.stream=stream;this.options=options;this.mimeType=options.mimeType;this.state='inactive';
  recorders.push(this);
 }
 start(){assert.equal(this.state,'inactive');this.state='recording'}
 stop(){
  if(this.state!=='recording')return;
  this.state='inactive';
  this.ondataavailable?.({data:new Blob([new Uint8Array(1024)],{type:this.mimeType})});
  this.onstop?.();
 }
}
class MockAudioContext{
 constructor(){this.state='running';this.closed=false}
 createAnalyser(){
  return {fftSize:1024,connect(){},disconnect(){},getFloatTimeDomainData(array){array.fill(level)}};
 }
 createMediaStreamSource(stream){return {stream,connect(){},disconnect(){}}}
 async resume(){this.state='running'}
 async close(){this.closed=true;audioContextClosed=true}
}
const track={stop(){trackStopped=true}};
const stream={getTracks(){return [track]}};
const sandbox={
 navigator:{mediaDevices:{async getUserMedia(constraints){getUserMediaCalls++;assert.equal(constraints.video,false);return stream}}},
 MediaRecorder:MockMediaRecorder,
 AudioContext:MockAudioContext,
 Blob,FormData,Response,URL,performance:{now(){return now}},
 requestAnimationFrame(callback){const id=nextFrame++;frames.set(id,callback);return id},
 cancelAnimationFrame(id){frames.delete(id)},
 async fetch(url,options){
  requests.push({url,options});
  assert.equal(options.method,'POST');
  assert.equal(options.credentials,'omit');
  assert.equal(options.cache,'no-store');
  assert.equal(options.referrerPolicy,'no-referrer');
  assert.equal(options.body.get('phrase'),'سبحان الله');
  assert.equal(options.body.get('consent'),'true');
  assert.equal(options.body.get('audio').type,'audio/webm;codecs=opus');
  return new Response(JSON.stringify({matches:2}),{status:200,headers:{'Content-Type':'application/json'}});
 }
};
sandbox.window=sandbox;sandbox.globalThis=sandbox;
vm.runInNewContext(source,sandbox,{timeout:3000});
assert.equal(sandbox.AnwarTasbihCloudSpeech.supported(),true,'capture support requires MediaRecorder, Web Audio and getUserMedia');
const engine=sandbox.AnwarTasbihCloudSpeech.create({
 baseUrl:'https://anwar-api-gateway.test-account.workers.dev',
 phrase:'سبحان الله',
 onCount:value=>counts.push(value),
 onStatus:(state,message)=>statuses.push({state,message})
});
await engine.start();
assert.equal(getUserMediaCalls,1,'the microphone is requested once after the UI consent step');
assert.equal(recorders.length,1,'one continuous recorder starts for the voice session');
assert.ok(frames.size>0,'the silence detector starts monitoring audio levels');

function nextFrameAt(time,amplitude){
 now=time;level=amplitude;
 const callbacks=[...frames.values()];
 frames.clear();
 for(const callback of callbacks)callback();
}
nextFrameAt(100,0.06);
nextFrameAt(400,0.06);
nextFrameAt(1251,0);
await Promise.resolve();
await Promise.resolve();
await Promise.resolve();
console.log('VAD TEST DIAGNOSTICS',JSON.stringify({requests:requests.length,recorders:recorders.length,frames:frames.size,now,level,statuses,counts}));
assert.equal(requests.length,1,'a natural pause closes and uploads exactly one short audio segment; statuses='+JSON.stringify(statuses)+'; recorderCount='+recorders.length+'; activeFrames='+frames.size);
assert.equal(requests[0].url,'https://anwar-api-gateway.test-account.workers.dev/v1/tasbih/count');
assert.equal(counts.length,1);
assert.equal(counts[0],2,'the client receives only the integer count from the server');
assert.ok(!JSON.stringify(statuses).includes('سبحان الله'),'the spoken phrase is never surfaced in UI status messages');
assert.equal(recorders.length,2,'the recorder restarts automatically after each processed segment');

engine.stop();
assert.equal(trackStopped,true,'stopping the voice counter releases the microphone track');
assert.equal(audioContextClosed,true,'stopping the voice counter closes the analysis context');
assert.equal(frames.size,0,'stopping the voice counter removes the silence-monitor animation frame');

const invalid=sandbox.AnwarTasbihCloudSpeech.create({
 baseUrl:'https://untrusted.example',
 phrase:'سبحان الله'
});
await assert.rejects(()=>invalid.start(),/بوابة العد الصوتي غير مطابقة/,'the client rejects any gateway host outside the exact Anwar worker pattern');
assert.equal(getUserMediaCalls,1,'an invalid gateway is rejected before requesting microphone permission');

const unsupported={navigator:{mediaDevices:{getUserMedia(){throw new Error('should not be called')}}},MediaRecorder:class{static isTypeSupported(){return false}},AudioContext:MockAudioContext};
unsupported.window=unsupported;unsupported.globalThis=unsupported;
vm.runInNewContext(source,unsupported);
const noFormat=unsupported.AnwarTasbihCloudSpeech.create({baseUrl:'https://anwar-api-gateway.test-account.workers.dev',phrase:'سبحان الله'});
await assert.rejects(()=>noFormat.start(),/صيغة صوتية مناسبة/,'unsupported recording formats fail before microphone capture');

console.log('PASS: tasbih uses one consented microphone session, automatically segments after silence, uploads only bounded audio chunks, receives count-only responses, and releases microphone resources on stop.');
