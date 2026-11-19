/* Standalone tasbih controller.
 * It deliberately does not depend on the notebook's delayed initializer.
 * Private preferences continue to flow through the encrypted vault adapter.
 */
(function installAnwarTasbihController(){
 'use strict';
 function init(){
  if(window.__ANWAR_TASBIH_CONTROLLER_READY__)return;
  const $=id=>document.getElementById(id);
  const panel=$('tasbihPanel'),toggleButton=$('adhkarTasbihToggle'),closeButton=$('tasbihClose');
  const ownerDialog=$('ownerDialog'),ownerPanel=$('ownerPanel'),adhkarPanel=$('adhkarPanel'),sharePanel=$('sharePanel');
  const ownerTab=$('ownerTab'),adhkarTab=$('adhkarTab'),shareTab=$('shareTab');
  const countNode=$('tasbihCount'),phraseNode=$('tasbihPhrase'),select=$('tasbihDhikr');
  const tap=$('tasbihTap'),minus=$('tasbihMinus'),reset=$('tasbihReset');
  const cards=$('tasbihDhikrCards'),customInput=$('tasbihCustomDhikrInput');
  const customAdd=$('tasbihAddCustomDhikr'),customStatus=$('tasbihCustomDhikrStatus');
  const removeButton=$('tasbihRemoveDhikr'),restoreButton=$('tasbihRestoreOfficial');
  const voicePanel=$('tasbihVoicePanel'),voiceButton=$('tasbihVoice');
  const voiceState=$('tasbihVoiceState'),voiceStatus=$('tasbihVoiceStatus');
  const voiceButtonLabel=$('tasbihVoiceButtonLabel'),voiceTranscript=$('tasbihVoiceTranscript');
  const required={panel,toggleButton,closeButton,ownerDialog,adhkarPanel,select,countNode,phraseNode,tap,minus,reset,cards,customInput,customAdd,customStatus,removeButton,restoreButton,voicePanel,voiceButton,voiceState,voiceStatus,voiceButtonLabel,voiceTranscript};
  const missing=Object.keys(required).filter(key=>!required[key]);
  if(missing.length){
   console.error('تعذر تهيئة السبحة؛ عناصر الواجهة الناقصة:',missing);
   if(toggleButton)toggleButton.title='تعذر تشغيل السبحة: واجهة غير مكتملة';
   return;
  }
  const preferences=globalThis.AnwarPrivatePreferences;
  // لا نفترض أن الخزنة تحتوي tasbih؛ قد تكون أول زيارة أو بيانات قديمة.
  const defaultTasbih={count:0,dhikr:select.value,customDhikrs:[],removedOfficialDhikrs:[]};
  let initial=defaultTasbih;
  try{
   const stored=preferences&&typeof preferences.get==='function'?preferences.get():null;
   if(stored&&stored.tasbih&&typeof stored.tasbih==='object')initial=stored.tasbih;
  }catch(error){console.warn('تعذر قراءة إعدادات السبحة؛ سيبدأ العداد بإعداداته الافتراضية.',error)}
  let count=Number.isSafeInteger(initial.count)?Math.max(0,initial.count):0;
  let customDhikrs=Array.isArray(initial.customDhikrs)?initial.customDhikrs.slice():[];
  let removedOfficialDhikrs=Array.isArray(initial.removedOfficialDhikrs)?initial.removedOfficialDhikrs.slice():[];
  let recognition=null,voiceActive=false,writingPreferences=false;
  let processedFinalIndexes=new Set();

  function isCustomOption(option){
   return !!(option&&option.parentElement&&option.parentElement.dataset.anwarCustomDhikrs==='true');
  }
  function visibleOptions(){
   return Array.from(select.options).filter(option=>isCustomOption(option)||!removedOfficialDhikrs.includes(option.value));
  }
  function persist(){
   if(!preferences||typeof preferences.set!=='function')return;
   writingPreferences=true;
   try{
    preferences.set('tasbih',{count:count,dhikr:select.value,customDhikrs:customDhikrs,removedOfficialDhikrs:removedOfficialDhikrs});
   }catch(error){
    console.warn('تعذر حفظ إعدادات السبحة المشفرة',error);
    customStatus.textContent='تعذر حفظ التغيير في الخزنة المشفرة. تحقق من فتح المفكرة ثم أعد المحاولة.';
   }finally{
    writingPreferences=false;
   }
  }
  function renderCustomOptions(){
   const old=select.querySelector('optgroup[data-anwar-custom-dhikrs]');
   if(old)old.remove();
   if(!customDhikrs.length)return;
   const group=document.createElement('optgroup');
   group.label='أذكاري المضافة';
   group.dataset.anwarCustomDhikrs='true';
   customDhikrs.forEach(value=>{
    const option=document.createElement('option');
    option.value=value;
    option.textContent=value;
    group.appendChild(option);
   });
   select.appendChild(group);
  }
  function renderCards(){
   cards.replaceChildren();
   Array.from(select.querySelectorAll('optgroup')).forEach(group=>{
    const options=Array.from(group.options).filter(option=>isCustomOption(option)||!removedOfficialDhikrs.includes(option.value));
    if(!options.length)return;
    const section=document.createElement('section');
    section.className='tasbih-dhikr-group';
    const heading=document.createElement('div');
    heading.className='tasbih-dhikr-category';
    heading.textContent=group.label||'أذكار';
    section.appendChild(heading);
    options.forEach(option=>{
     const button=document.createElement('button');
     button.type='button';
     button.className='tasbih-dhikr-card';
     button.setAttribute('aria-pressed',option.value===select.value?'true':'false');
     button.setAttribute('aria-label','اختيار الذكر: '+option.textContent);
     const flower=document.createElement('span');
     flower.className='tasbih-dhikr-tulip';
     flower.setAttribute('aria-hidden','true');
     const image=document.createElement('img');
     image.src='assets/tulip-cutout.svg';
     image.alt='';
     image.decoding='async';
     flower.appendChild(image);
     const name=document.createElement('span');
     name.className='tasbih-dhikr-card-name';
     name.textContent=option.textContent;
     button.appendChild(flower);
     button.appendChild(name);
     const secondFlower=flower.cloneNode(true);
     button.appendChild(secondFlower);
     button.addEventListener('click',()=>chooseDhikr(option.value,true));
     section.appendChild(button);
    });
    cards.appendChild(section);
   });
   if(!cards.children.length){
    const empty=document.createElement('div');
    empty.className='tasbih-dhikr-empty';
    empty.textContent='لا توجد أذكار ظاهرة في قائمتك. أضف ذكراً جديداً أو استعد الأذكار الرسمية.';
    cards.appendChild(empty);
   }
  }
  function update(){
   countNode.textContent=count.toLocaleString('ar');
   phraseNode.textContent=select.value||'لم يتم اختيار ذكر بعد';
   renderCards();
   const selected=Array.from(select.options).find(option=>option.value===select.value);
   removeButton.disabled=!selected;
   removeButton.textContent=selected&&isCustomOption(selected)?'حذف الذكر المضاف':'إزالة الذكر الرسمي من قائمتي';
   restoreButton.hidden=removedOfficialDhikrs.length===0;
   restoreButton.textContent='استعادة الأذكار الرسمية'+(removedOfficialDhikrs.length?' ('+removedOfficialDhikrs.length+')':'');
  }
  function firstVisible(){
   return visibleOptions()[0]||null;
  }
  function saveAndUpdate(){
   update();
   persist();
  }
  function chooseDhikr(value,resetCount){
   const option=Array.from(select.options).find(item=>item.value===value&&(isCustomOption(item)||!removedOfficialDhikrs.includes(item.value)));
   if(!option)return;
   select.value=option.value;
   if(resetCount)count=0;
   if(voiceTranscript)voiceTranscript.textContent='بانتظار نطق الذكر المختار.';
   saveAndUpdate();
  }
  function add(amount){
   count=Math.max(0,Math.min(1000000000,count+amount));
   saveAndUpdate();
   const counter=panel.querySelector('.anwar-tasbih-counter');
   if(counter&&typeof counter.animate==='function'){
    try{counter.animate([{transform:'scale(1)'},{transform:'scale(1.045)'},{transform:'scale(1)'}],{duration:200,easing:'ease-out'})}catch(error){}
   }
  }
  function setVoiceState(state,message){
   voicePanel.dataset.state=state;
   voiceState.textContent=state==='starting'?'جارٍ تشغيل الميكروفون':state==='listening'?'الميكروفون نشط':state==='error'?'تعذر التسجيل':'جاهز للتسجيل';
   voiceStatus.textContent=message||'';
   const active=state==='starting'||state==='listening';
   voiceButton.setAttribute('aria-pressed',active?'true':'false');
   voiceButtonLabel.textContent=active?'إيقاف التسجيل':state==='error'?'إعادة المحاولة':'ابدأ التسجيل';
  }
  function stopVoice(message){
   const wasActive=voiceActive;
   voiceActive=false;
   if(wasActive&&recognition){try{recognition.stop()}catch(error){}}
   setVoiceState('idle',message||'تم إيقاف التسجيل.');
  }
  function normalizeSpeech(value){
   return String(value||'').toLocaleLowerCase('ar').normalize('NFD')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g,'')
    .replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ـ/g,'')
    .replace(/[^\u0600-\u06FFa-z0-9\s]/gi,' ').replace(/\s+/g,' ').trim();
  }
  function countPhraseMatches(transcript,phrase){
   const heard=normalizeSpeech(transcript).split(' ').filter(Boolean);
   const target=normalizeSpeech(phrase).split(' ').filter(Boolean);
   if(!target.length||heard.length<target.length)return 0;
   let matches=0;
   for(let i=0;i<=heard.length-target.length;i++){
    let same=true;
    for(let j=0;j<target.length;j++){if(heard[i+j]!==target[j]){same=false;break}}
    if(same){matches++;i+=target.length-1}
   }
   return matches;
  }
  function addCustomDhikr(){
   const value=String(customInput.value||'').replace(/\s+/g,' ').trim();
   if(!value){customStatus.textContent='اكتب الذكر أولاً ثم اضغط إضافة.';customInput.focus();return}
   if(value.length>200){customStatus.textContent='الحد الأقصى لطول الذكر هو 200 حرف.';customInput.focus();return}
   if(removedOfficialDhikrs.includes(value)){
    removedOfficialDhikrs=removedOfficialDhikrs.filter(item=>item!==value);
    customInput.value='';
    chooseDhikr(value,true);
    customStatus.textContent='أُعيد الذكر الرسمي إلى قائمتك واختير للسبحة.';
    return;
   }
   const existing=Array.from(select.options).find(option=>option.value===value);
   if(existing){customInput.value='';chooseDhikr(value,true);customStatus.textContent='هذا الذكر موجود في القائمة، وقد تم اختياره.';return}
   if(customDhikrs.length>=30){customStatus.textContent='وصلت إلى الحد الأقصى وهو 30 ذكراً مضافاً.';return}
   customDhikrs.push(value);
   renderCustomOptions();
   customInput.value='';
   chooseDhikr(value,true);
   customStatus.textContent='تمت إضافة الذكر وحفظه ضمن إعداداتك الخاصة.';
  }
  function switchOwnerView(which){
   let usedBridge=false;
   if(typeof window.AnwarShowOwnerPanel==='function'){
    try{usedBridge=window.AnwarShowOwnerPanel(which)===true}catch(error){console.warn('تعذر استخدام جسر لوحة الأذكار',error)}
   }
   if(ownerPanel)ownerPanel.hidden=which!=='owner';
   adhkarPanel.hidden=which!=='adhkar';
   if(sharePanel)sharePanel.hidden=which!=='share';
   if(ownerTab)ownerTab.classList.toggle('active',which==='owner');
   if(adhkarTab)adhkarTab.classList.toggle('active',which==='adhkar');
   if(shareTab)shareTab.classList.toggle('active',which==='share');
   if(which==='adhkar'&&!usedBridge&&typeof window.AnwarRenderAdhkar==='function'){
    try{window.AnwarRenderAdhkar('morning')}catch(error){console.warn('تعذر عرض أذكار الصباح',error)}
   }
  }
  function revealAdhkarView(){
   switchOwnerView('adhkar');
   return !adhkarPanel.hidden;
  }
  function openPanel(){
   if(!panel.hidden){closePanel();return}
   try{
    if(!ownerDialog.open){
     if(typeof ownerDialog.showModal==='function')ownerDialog.showModal();
     else ownerDialog.setAttribute('open','');
    }
    revealAdhkarView();
    panel.hidden=false;
    toggleButton.setAttribute('aria-expanded','true');
    requestAnimationFrame(()=>{
     try{panel.scrollIntoView({behavior:'smooth',block:'nearest'})}catch(error){}
    });
    closeButton.focus();
   }catch(error){
    console.error('تعذر فتح السبحة',error);
    if(typeof window.AnwarShowOwnerPanel!=='function')revealAdhkarView();
    panel.hidden=false;
    toggleButton.setAttribute('aria-expanded','true');
    if(typeof window.toast==='function')window.toast('فُتحت واجهة السبحة مع تعذر بعض تفاصيل العرض.');
   }
  }
  function closePanel(restoreFocus){
   if(voiceActive)stopVoice('توقف الاستماع عند إغلاق السبحة.');
   panel.hidden=true;
   toggleButton.setAttribute('aria-expanded','false');
   if(restoreFocus!==false&&ownerDialog.open)toggleButton.focus();
  }

  renderCustomOptions();
  const savedOption=Array.from(select.options).find(option=>option.value===initial.dhikr&&(isCustomOption(option)||!removedOfficialDhikrs.includes(option.value)));
  if(savedOption)select.value=savedOption.value;
  else if(!visibleOptions().some(option=>option.value===select.value))select.value=firstVisible()?firstVisible().value:'';
  update();

  toggleButton.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();openPanel()});
  closeButton.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();closePanel()});
  tap.addEventListener('click',()=>add(1));
  minus.addEventListener('click',()=>add(-1));
  reset.addEventListener('click',()=>{count=0;saveAndUpdate()});
  customAdd.addEventListener('click',addCustomDhikr);
  customInput.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();addCustomDhikr()}});
  select.addEventListener('change',()=>{count=0;saveAndUpdate();voiceTranscript.textContent='بانتظار نطق الذكر المختار.'});
  removeButton.addEventListener('click',()=>{
   const selected=Array.from(select.options).find(option=>option.value===select.value);
   if(!selected)return;
   const custom=isCustomOption(selected);
   const message=custom?'هل تريد حذف هذا الذكر المضاف من قائمتك على هذا الجهاز؟':'هل تريد إزالة هذا الذكر الرسمي من قائمتك على هذا الجهاز فقط؟ يمكنك استعادته لاحقاً.';
   if(!window.confirm(message))return;
   if(voiceActive)stopVoice('توقف التسجيل بسبب تعديل قائمة الأذكار.');
   if(custom)customDhikrs=customDhikrs.filter(item=>item!==selected.value);
   else if(!removedOfficialDhikrs.includes(selected.value))removedOfficialDhikrs.push(selected.value);
   renderCustomOptions();
   const next=firstVisible();
   select.value=next?next.value:'';
   count=0;
   saveAndUpdate();
   customStatus.textContent=custom?'تم حذف الذكر المضاف من قائمتك.':'تمت إزالة الذكر الرسمي من قائمتك فقط. يمكنك استعادته متى شئت.';
  });
  restoreButton.addEventListener('click',()=>{
   if(!removedOfficialDhikrs.length)return;
   removedOfficialDhikrs=[];
   if(!select.value)select.value=firstVisible()?firstVisible().value:'';
   count=0;
   saveAndUpdate();
   customStatus.textContent='تمت استعادة جميع الأذكار الرسمية إلى قائمتك.';
  });
  if(ownerTab)ownerTab.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();closePanel(false);switchOwnerView('owner')});
  if(adhkarTab)adhkarTab.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();closePanel(false);switchOwnerView('adhkar')});
  if(shareTab)shareTab.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();closePanel(false);switchOwnerView('share')});
  const morningTab=$('morningTab'),eveningTab=$('eveningTab');
  if(morningTab)morningTab.addEventListener('click',event=>{
   if(typeof window.AnwarRenderAdhkar==='function'){event.preventDefault();event.stopPropagation();window.AnwarRenderAdhkar('morning')}
  });
  if(eveningTab)eveningTab.addEventListener('click',event=>{
   if(typeof window.AnwarRenderAdhkar==='function'){event.preventDefault();event.stopPropagation();window.AnwarRenderAdhkar('evening')}
  });
  ownerDialog.addEventListener('close',()=>closePanel(false));
  document.addEventListener('keydown',event=>{
   if(event.key==='Escape'&&!panel.hidden){event.preventDefault();event.stopImmediatePropagation();closePanel(false)}
  },true);

  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SpeechRecognition){
   voiceButton.disabled=true;
   voiceButtonLabel.textContent='غير مدعوم';
   setVoiceState('error','التعرف الصوتي غير متاح في هذا المتصفح. استخدم Chrome واسمح بالميكروفون.');
  }else{
   recognition=new SpeechRecognition();
   recognition.lang='ar-SA';
   recognition.continuous=true;
   recognition.interimResults=true;
   recognition.maxAlternatives=1;
   recognition.onstart=()=>{
    voiceActive=true;
    setVoiceState('listening','أستمع الآن. انطق الذكر المحدد كاملاً وبوضوح.');
    if(voiceTranscript.textContent==='لم يبدأ التسجيل بعد')voiceTranscript.textContent='بانتظار العبارة…';
   };
   recognition.onresult=event=>{
    for(let i=event.resultIndex;i<event.results.length;i++){
     const result=event.results[i];
     const said=result&&result[0]&&result[0].transcript?result[0].transcript.trim():'';
     if(!said)continue;
     voiceTranscript.textContent=said;
     if(!result.isFinal||processedFinalIndexes.has(i))continue;
     processedFinalIndexes.add(i);
     const matches=countPhraseMatches(said,select.value);
     if(matches>0){
      add(matches);
      setVoiceState('listening','تم التعرف على الذكر المختار وإضافة '+matches.toLocaleString('ar')+' إلى العداد.');
     }else setVoiceState('listening','لم تطابق العبارة الذكر المحدد. كرر النص كاملاً: '+select.value);
    }
   };
   recognition.onerror=event=>{
    voiceActive=false;
    const messages={
     'not-allowed':'لم يُسمح بالميكروفون. افتح إعدادات الموقع واسمح باستخدامه.',
     'service-not-allowed':'خدمة التعرف الصوتي محجوبة من المتصفح أو الجهاز.',
     'audio-capture':'لم يتم العثور على ميكروفون صالح.',
     'no-speech':'لم ألتقط كلاماً واضحاً. اضغط إعادة المحاولة وتحدث بوضوح.',
     'network':'تعذر الاتصال بخدمة التعرف الصوتي. تحقق من اتصال الإنترنت.',
     'aborted':'أُوقف التسجيل.'
    };
    setVoiceState('error',messages[event.error]||'حدث خطأ في التعرف الصوتي. حاول التسجيل مرة أخرى.');
   };
   recognition.onend=()=>{
    if(voiceActive){voiceActive=false;setVoiceState('idle','انتهى الاستماع. ابدأ التسجيل مجدداً للمتابعة.')}
   };
   voiceButton.addEventListener('click',()=>{
    if(voiceActive){stopVoice('تم إيقاف التسجيل.');return}
    try{
     processedFinalIndexes=new Set();
     voiceTranscript.textContent='بانتظار العبارة…';
     setVoiceState('starting','جارٍ تفعيل الميكروفون…');
     voiceActive=true;
     recognition.start();
    }catch(error){
     voiceActive=false;
     setVoiceState('error','تعذر بدء التسجيل. انتظر لحظة ثم حاول مرة أخرى.');
    }
   });
  }
  if(preferences&&typeof preferences.subscribe==='function'){
   preferences.subscribe(saved=>{
    if(writingPreferences)return;
    const value=saved&&saved.tasbih?saved.tasbih:{};
    count=Number.isSafeInteger(value.count)?Math.max(0,value.count):0;
    customDhikrs=Array.isArray(value.customDhikrs)?value.customDhikrs.slice():[];
    removedOfficialDhikrs=Array.isArray(value.removedOfficialDhikrs)?value.removedOfficialDhikrs.slice():[];
    renderCustomOptions();
    const option=Array.from(select.options).find(item=>item.value===value.dhikr&&(isCustomOption(item)||!removedOfficialDhikrs.includes(item.value)));
    if(option)select.value=option.value;
    else if(!visibleOptions().some(item=>item.value===select.value))select.value=firstVisible()?firstVisible().value:'';
    update();
   });
  }
  window.__ANWAR_TASBIH_CONTROLLER_READY__=true;
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
})();