(function installAnwarPoetryDictation(root){
 'use strict';

 const LANGUAGES=['ar-MA','ar-SA','ar'];

 function create(options){
  const config=options&&typeof options==='object'?options:{};
  const onText=typeof config.onText==='function'?config.onText:()=>{};
  const onStatus=typeof config.onStatus==='function'?config.onStatus:()=>{};
  const timers={
   set:typeof config.setTimeout==='function'?config.setTimeout:(fn,delay)=>root.setTimeout(fn,delay),
   clear:typeof config.clearTimeout==='function'?config.clearTimeout:id=>root.clearTimeout(id)
  };
  const Recognition=root.SpeechRecognition||root.webkitSpeechRecognition;
  let recognition=null,requested=false,active=false;
  let languageIndex=0,restarts=0,restartTimer=null,generation=0;
  let committed=[];
  const seenEvents=typeof WeakSet==='function'?new WeakSet():null;

  function status(state,detail){
   try{onStatus(state,detail||'')}catch(error){/* A UI callback must not break recognition. */}
  }
  function clearRestart(){
   if(restartTimer!==null){timers.clear(restartTimer);restartTimer=null;}
  }
  function stopSession(session){
   if(!session)return;
   try{session.stop()}catch(error){try{session.abort()}catch(ignored){}}
  }
  function fail(message){
   requested=false;active=false;clearRestart();
   const old=recognition;recognition=null;generation++;
   stopSession(old);
   status('error',message||'تعذّر تشغيل التعرف الصوتي.');
  }
  function scheduleRestart(){
   if(!requested||restartTimer!==null)return;
   if(restarts>=4){
    fail('انقطع التعرف الصوتي عدة مرات. اضغط «إلقاء» للمحاولة من جديد.');
    return;
   }
   restarts++;
   status('restarting','انقطع الاتصال الصوتي مؤقتًا؛ نحاول استعادته.');
   const delay=Math.min(1200,300*restarts);
   restartTimer=timers.set(()=>{
    restartTimer=null;
    if(requested)startSession();
   },delay);
  }
  function switchLanguage(){
   if(languageIndex>=LANGUAGES.length-1){
    fail('خدمة التعرف الصوتي لا تدعم العربية على هذا الجهاز.');
    return;
   }
   languageIndex++;
   const old=recognition;
   recognition=null;
   generation++;
   stopSession(old);
   clearRestart();
   status('language-fallback','نجرب إعدادًا عربيًا بديلًا للتعرف على الكلام.');
   restartTimer=timers.set(()=>{
    restartTimer=null;
    if(requested)startSession();
   },120);
  }
  function handleResults(event){
   if(!event||!event.results)return;
   if(seenEvents){
    if(seenEvents.has(event))return;
    seenEvents.add(event);
   }
   const results=Array.from(event.results);
   const transcripts=results.map(result=>String(result&&result[0]&&result[0].transcript||'').trim());
   const added=[];
   const hasCommittedPrefix=committed.length>0&&
    results.length>committed.length&&
    committed.every((value,index)=>transcripts[index]===value);

   if(hasCommittedPrefix){
    for(let index=committed.length;index<results.length;index++){
     if(results[index]&&results[index].isFinal&&transcripts[index]){
      committed.push(transcripts[index]);added.push(transcripts[index]);
     }
    }
   }else if(results.length===1){
    // Some Android speech services send a fresh one-result list for each phrase.
    // Do not mistake a repeated phrase for a duplicate cumulative result.
    if(results[0]&&results[0].isFinal&&transcripts[0]){
     committed.push(transcripts[0]);added.push(transcripts[0]);
    }
   }else{
    const resultIndex=Number.isInteger(event.resultIndex)?Math.max(0,event.resultIndex):0;
    for(let index=resultIndex;index<results.length;index++){
     if(results[index]&&results[index].isFinal&&transcripts[index]){
      committed.push(transcripts[index]);added.push(transcripts[index]);
     }
    }
   }

   if(added.length){
    restarts=0;
    try{onText(added.join(' '),added.slice())}
    catch(error){status('error','تعذّر إدراج النص في المفكرة. أوقف الإلقاء وحاول مجددًا.')}
   }
  }
  function startSession(){
   if(!requested||!Recognition)return;
   clearRestart();
   committed=[];
   const currentGeneration=++generation;
   let session;
   try{session=new Recognition()}
   catch(error){fail('تعذّر تهيئة خدمة التعرف الصوتي في هذا المتصفح.');return;}
   recognition=session;
   try{
    session.lang=LANGUAGES[languageIndex];
    session.continuous=true;
    session.interimResults=true;
    session.maxAlternatives=1;
   }catch(error){fail('تعذّر إعداد اللغة العربية للتعرف الصوتي.');return;}

   session.onstart=()=>{
    if(!requested||recognition!==session||generation!==currentGeneration)return;
    active=true;status('listening','الميكروفون يعمل؛ ألقِ أبياتك بوضوح.');
   };
   session.onresult=event=>{
    if(!requested||recognition!==session||generation!==currentGeneration)return;
    handleResults(event);
   };
   session.onerror=event=>{
    if(!requested||recognition!==session||generation!==currentGeneration)return;
    const reason=String(event&&event.error||'');
    if(reason==='language-not-supported'){
     switchLanguage();return;
    }
    if(reason==='not-allowed'||reason==='service-not-allowed'){
     fail('لم يُسمح باستخدام الميكروفون. راجع إذن الميكروفون في المتصفح.');
     return;
    }
    if(reason==='audio-capture'){
     fail('تعذّر الوصول إلى الميكروفون. تحقق من أنه غير مستخدم من تطبيق آخر.');
     return;
    }
    if(reason==='network'){
     status('restarting','تعذّر الاتصال بخدمة التعرف الصوتي؛ نحاول إعادة الاتصال.');
    }else if(reason!=='no-speech'&&reason!=='aborted'){
     status('warning','حدث انقطاع في التعرف الصوتي؛ سنحاول المتابعة.');
    }
   };
   session.onend=()=>{
    if(!requested||recognition!==session||generation!==currentGeneration)return;
    active=false;
    scheduleRestart();
   };
   try{session.start()}
   catch(error){
    const reason=String(error&&error.name||'');
    if(reason==='InvalidStateError')scheduleRestart();
    else fail('لم يبدأ التعرف الصوتي. تحقق من إذن الميكروفون وحاول مرة أخرى.');
   }
  }

  function start(){
   if(requested)return true;
   if(!Recognition){status('error','هذا المتصفح لا يدعم التعرف الصوتي. جرّب Chrome محدّثًا.');return false;}
   requested=true;active=false;languageIndex=0;restarts=0;committed=[];
   status('requesting','نطلب تشغيل الميكروفون من المتصفح.');
   startSession();
   return requested;
  }
  function stop(){
   const wasRequested=requested;
   requested=false;active=false;clearRestart();
   const old=recognition;recognition=null;generation++;
   stopSession(old);
   status('stopped','توقف الإلقاء الصوتي.');
   return wasRequested;
  }
  function isRequested(){return requested}
  function isActive(){return active}
  function getLanguage(){return LANGUAGES[languageIndex]}

  return Object.freeze({start,stop,isRequested,isActive,getLanguage});
 }

 root.AnwarPoetryDictation=Object.freeze({create,LANGUAGES:Object.freeze(LANGUAGES.slice())});
})(typeof window!=='undefined'?window:globalThis);
