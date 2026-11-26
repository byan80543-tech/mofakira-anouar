/* Automatic, short-segment speech capture for the original Anwar tasbih.
 * Audio is sent only after explicit consent to the exact configured Anwar gateway.
 * No transcript or audio is persisted by this module.
 */
(function installAnwarTasbihCloudSpeech(root){
 'use strict';

 function create(options){
  const settings=options&&typeof options==='object'?options:{};
  const phrase=String(settings.phrase||'').trim();
  const baseUrl=String(settings.baseUrl||'').trim();
  const onCount=typeof settings.onCount==='function'?settings.onCount:()=>{};
  const onStatus=typeof settings.onStatus==='function'?settings.onStatus:()=>{};
  let running=false,stream=null,audioContext=null,analyser=null,source=null;
  let frameId=null,recorderState=null,uploadQueue=[],uploading=false,activeAbortController=null;
  let mimeType='',sessionNumber=0;

  const SILENCE_MS=850;
  const MAX_SEGMENT_MS=9000;
  const MAX_IDLE_RECORDING_MS=12000;
  const MIN_SPEECH_MS=280;
  const RMS_THRESHOLD=0.018;
  const MAX_QUEUED_SEGMENTS=2;

  function status(state,message){
   try{onStatus(state,String(message||''))}catch(error){}
  }

  function endpoint(){
   if(!baseUrl)throw new Error('لم تُضبط بوابة العد الصوتي بعد.');
   let base;
   try{base=new URL(baseUrl)}catch(error){throw new Error('عنوان بوابة العد الصوتي غير صالح.')}
   if(base.protocol!=='https:'||!/^anwar-api-gateway\.[a-z0-9-]+\.workers\.dev$/i.test(base.hostname)||base.pathname!=='/'||base.search||base.hash){
    throw new Error('بوابة العد الصوتي غير مطابقة لعنوان الخدمة المعتمد.');
   }
   return new URL('/v1/tasbih/count',base.origin).href;
  }

  function chooseMimeType(){
   const Recorder=root.MediaRecorder;
   if(!Recorder)throw new Error('تسجيل الصوت المؤقت غير مدعوم في هذا المتصفح.');
   const choices=['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/ogg'];
   if(typeof Recorder.isTypeSupported!=='function')return 'audio/webm';
   return choices.find(type=>Recorder.isTypeSupported(type))||'';
  }

  function cleanup(){
   if(frameId!==null){root.cancelAnimationFrame(frameId);frameId=null}
   if(source){try{source.disconnect()}catch(error){}source=null}
   if(analyser){try{analyser.disconnect()}catch(error){}analyser=null}
   if(audioContext){
    const context=audioContext;audioContext=null;
    try{context.close()}catch(error){}
   }
   if(stream){
    for(const track of stream.getTracks()){try{track.stop()}catch(error){}}
    stream=null;
   }
   recorderState=null;
  }

  function enqueue(blob,number){
   if(!blob||blob.size<700)return;
   if(uploadQueue.length>=MAX_QUEUED_SEGMENTS){
    status(running?'listening':'idle','تأخر الاتصال؛ لم نرسل مقطعاً إضافياً حتى لا تتراكم التسجيلات.');
    return;
   }
   uploadQueue.push({blob,number});
   pumpQueue();
  }

  async function pumpQueue(){
   if(uploading)return;
   uploading=true;
   while(uploadQueue.length){
    const item=uploadQueue.shift();
    let form=null,heldBlob=item.blob;
    const abortController=typeof root.AbortController==='function'?new root.AbortController():null;
    activeAbortController=abortController;
    try{
     status(running?'listening':'idle','جارٍ التحقق من الذكر المنطوق...');
     form=new root.FormData();
     form.append('audio',heldBlob,'tasbih-segment.webm');
     form.append('phrase',phrase);
     form.append('consent','true');
     const response=await root.fetch(endpoint(),{
      method:'POST',
      body:form,
      credentials:'omit',
      cache:'no-store',
      referrerPolicy:'no-referrer',
      ...(abortController?{signal:abortController.signal}:{})
     });
     let payload=null;
     try{payload=await response.json()}catch(error){}
     if(!response.ok)throw new Error(response.status===429?'تجاوزت طلبات العد الصوتي الحد المؤقت. انتظر قليلاً.':'تعذر معالجة المقطع الصوتي هذه المرة.');
     const matches=Number(payload&&payload.matches);
     if(!Number.isSafeInteger(matches)||matches<0||matches>100)throw new Error('وصلت نتيجة عد غير صالحة؛ لم نغيّر العداد.');
     if(matches>0){
      try{onCount(matches)}catch(error){}
      status(running?'listening':'idle','تم احتساب '+matches.toLocaleString('ar')+' تسبيحة.');
     }else if(running){
      status('listening','لم يكتمل الذكر المختار في هذا المقطع.');
     }
    }catch(error){
     status(running?'listening':'idle',error&&error.message?error.message:'تعذر الاتصال بخدمة العد الصوتي.');
    }finally{
     if(form){try{form.delete('audio');form.delete('phrase');form.delete('consent')}catch(error){}}
     form=null;
     if(activeAbortController===abortController)activeAbortController=null;
     heldBlob=null;
     item.blob=null;
    }
   }
   uploading=false;
   if(running&&recorderState)status('listening','قل الذكر بصورة طبيعية؛ سيُحتسب تلقائياً.');
  }

  function startRecorder(){
   if(!running||!stream)return;
   const Recorder=root.MediaRecorder;
   const recorderOptions={audioBitsPerSecond:32000};
   if(mimeType)recorderOptions.mimeType=mimeType;
   const recorder=new Recorder(stream,recorderOptions);
   const state={
    recorder,chunks:[],startedAt:root.performance.now(),speechStartedAt:0,lastSpeechAt:0,
    hasSpeech:false,number:++sessionNumber
   };
   recorderState=state;
   recorder.ondataavailable=event=>{
    if(event&&event.data&&event.data.size>0)state.chunks.push(event.data);
   };
   recorder.onerror=()=>{
    if(!running)return;
    status('error','حدث خلل في التقاط الصوت؛ أوقف العد الصوتي ثم أعد المحاولة.');
    stop();
   };
   recorder.onstop=()=>{
    const blob=state.chunks.length?new root.Blob(state.chunks,{type:recorder.mimeType||mimeType||'audio/webm'}):null;
    state.chunks.length=0;
    if(recorderState===state)recorderState=null;
    const speechLength=state.hasSpeech?Math.max(0,state.lastSpeechAt-state.speechStartedAt):0;
    if(state.hasSpeech&&speechLength>=MIN_SPEECH_MS&&!state.discard)enqueue(blob,state.number);
    if(running){
     try{startRecorder()}catch(error){
      status('error','تعذر استئناف التقاط الصوت. أوقف العد الصوتي وأعد المحاولة.');
      stop();
     }
    }else{
     cleanup();
    }
   };
   recorder.start();
  }

  function monitor(){
   if(!running||!analyser)return;
   const values=new Float32Array(analyser.fftSize);
   analyser.getFloatTimeDomainData(values);
   let sum=0;
   for(let i=0;i<values.length;i++)sum+=values[i]*values[i];
   const rms=Math.sqrt(sum/values.length);
   const now=root.performance.now();
   const current=recorderState;
   if(current&&current.recorder.state==='recording'){
    if(rms>=RMS_THRESHOLD){
     if(!current.hasSpeech){current.hasSpeech=true;current.speechStartedAt=now}
     current.lastSpeechAt=now;
    }
    if(current.hasSpeech&&now-current.lastSpeechAt>=SILENCE_MS){
     flushRecorder();
    }else if(current.hasSpeech&&now-current.startedAt>=MAX_SEGMENT_MS){
     flushRecorder();
    }else if(!current.hasSpeech&&now-current.startedAt>=MAX_IDLE_RECORDING_MS){
     flushRecorder();
    }
   }
   if(running)frameId=root.requestAnimationFrame(monitor);
  }

  function flushRecorder(){
   const current=recorderState;
   if(!current||current.recorder.state!=='recording')return;
   recorderState=null;
   try{current.recorder.stop()}catch(error){
    current.chunks.length=0;
    if(running)status('error','تعذر إنهاء مقطع الصوت المؤقت.');
   }
  }

  async function start(){
   if(running)return true;
   endpoint();
   const nav=root.navigator;
   if(!nav||!nav.mediaDevices||typeof nav.mediaDevices.getUserMedia!=='function'){
    throw new Error('التقاط الصوت غير متاح في هذا المتصفح.');
   }
   if(typeof root.AudioContext!=='function'&&typeof root.webkitAudioContext!=='function'){
    throw new Error('مراقبة فترات الصمت غير متاحة في هذا المتصفح.');
   }
   mimeType=chooseMimeType();
   if(!mimeType)throw new Error('لا تتوفر صيغة صوتية مناسبة للعد الصوتي.');
   status('starting','نطلب إذن الميكروفون لبدء العد الصوتي.');
   try{
    stream=await nav.mediaDevices.getUserMedia({
     audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},
     video:false
    });
    const AudioContextClass=root.AudioContext||root.webkitAudioContext;
    audioContext=new AudioContextClass();
    if(audioContext.state==='suspended')await audioContext.resume();
    analyser=audioContext.createAnalyser();
    analyser.fftSize=1024;
    source=audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    running=true;
    startRecorder();
    status('listening','قل الذكر بصورة طبيعية؛ سيُحتسب تلقائياً بعد وقفة قصيرة.');
    frameId=root.requestAnimationFrame(monitor);
    return true;
   }catch(error){
    running=false;
    cleanup();
    throw error;
   }
  }

  function stop(discardPending){
   if(!running&&!stream)return;
   running=false;
   if(discardPending){
    uploadQueue.length=0;
    if(activeAbortController){try{activeAbortController.abort()}catch(error){}}
   }
   if(frameId!==null){root.cancelAnimationFrame(frameId);frameId=null}
   const current=recorderState;
   recorderState=null;
   if(current&&discardPending)current.discard=true;
   if(current&&current.recorder.state==='recording'){
    try{current.recorder.stop()}catch(error){current.chunks.length=0;cleanup()}
   }else{
    cleanup();
   }
  }

  return Object.freeze({
   start,stop,
   isRunning(){return running},
   getQueuedSegments(){return uploadQueue.length+(uploading?1:0)}
  });
 }

 root.AnwarTasbihCloudSpeech=Object.freeze({
  create,
  supported(){
   return !!(root.navigator&&root.navigator.mediaDevices&&
    typeof root.navigator.mediaDevices.getUserMedia==='function'&&
    typeof root.MediaRecorder==='function'&&
    (typeof root.AudioContext==='function'||typeof root.webkitAudioContext==='function')&&
    typeof root.fetch==='function');
  }
 });
})(typeof window!=='undefined'?window:globalThis);
