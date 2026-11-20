/* Standalone tasbih controller.
 * It deliberately does not depend on the notebook's delayed initializer.
 * Private preferences continue to flow through the encrypted vault adapter.
 */
(function installAnwarTasbihController(){
 'use strict';
 function init(){
  if(window.__ANWAR_TASBIH_CONTROLLER_READY__)return;
  const $=id=>document.getElementById(id);
  const panel=$('tasbihPanel'),closeButton=$('tasbihClose');
  const countNode=$('tasbihCount'),phraseNode=$('tasbihPhrase'),select=$('tasbihDhikr');
  const counterControl=panel&&panel.querySelector('.anwar-tasbih-counter');
  const themeToggle=$('tasbihThemeToggle'),themePicker=$('tasbihThemePicker');
  const themeIds=['emerald','dark','pink','night','heritage','glass'];
  const themeButtons=themeIds.map(name=>({name,button:$('tasbihTheme'+name[0].toUpperCase()+name.slice(1))}));
  const tap=$('tasbihTap'),minus=$('tasbihMinus'),reset=$('tasbihReset');
  const cards=$('tasbihDhikrCards'),customInput=$('tasbihCustomDhikrInput');
  const dhikrToggle=$('tasbihDhikrToggle'),dhikrList=$('tasbihDhikrListPanel');
  const customAdd=$('tasbihAddCustomDhikr'),customStatus=$('tasbihCustomDhikrStatus');
  const removeButton=$('tasbihRemoveDhikr'),restoreButton=$('tasbihRestoreOfficial');
  const voicePanel=$('tasbihVoicePanel'),voiceButton=$('tasbihVoice');
  const voiceState=$('tasbihVoiceState'),voiceStatus=$('tasbihVoiceStatus');
  const voiceButtonLabel=$('tasbihVoiceButtonLabel'),voiceTranscript=$('tasbihVoiceTranscript');
  const required={panel,closeButton,select,countNode,phraseNode,counterControl,tap,minus,reset,cards,dhikrToggle,dhikrList,customInput,customAdd,customStatus,removeButton,restoreButton,voicePanel,voiceButton,voiceState,voiceStatus,voiceButtonLabel,voiceTranscript,themeToggle,themePicker,...Object.fromEntries(themeButtons.map(item=>['theme'+item.name,item.button]))};
  const missing=Object.keys(required).filter(key=>!required[key]);
  if(missing.length){
   console.error('تعذر تهيئة السبحة؛ عناصر الواجهة الناقصة:',missing);
   return;
  }
  const preferences=globalThis.AnwarPrivatePreferences;
  // لا نفترض أن الخزنة تحتوي tasbih؛ قد تكون أول زيارة أو بيانات قديمة.
  const defaultTasbih={count:0,dhikr:select.value,customDhikrs:[],removedOfficialDhikrs:[],theme:'emerald'};
  let initial=defaultTasbih;
  try{
   const stored=preferences&&typeof preferences.get==='function'?preferences.get():null;
   if(stored&&stored.tasbih&&typeof stored.tasbih==='object')initial=stored.tasbih;
  }catch(error){console.warn('تعذر قراءة إعدادات السبحة؛ سيبدأ العداد بإعداداته الافتراضية.',error)}
  const MAX_COUNT=1000000000;
  const cleanDhikrList=(items,limit,maxLength=200)=>Array.isArray(items)
   ?[...new Set(items.filter(item=>typeof item==='string').map(item=>item.trim().slice(0,maxLength)).filter(Boolean))].slice(0,limit)
   :[];
  let count=Number.isSafeInteger(initial.count)?Math.max(0,Math.min(MAX_COUNT,initial.count)):0;
  const allowedThemes=new Set(themeIds);
  let theme=allowedThemes.has(initial.theme)?initial.theme:'emerald';
  let customDhikrs=cleanDhikrList(initial.customDhikrs,30,200);
  let removedOfficialDhikrs=cleanDhikrList(initial.removedOfficialDhikrs,60,4000);
  let recognition=null,voiceActive=false,voiceRequested=false,writingPreferences=false,voiceTargetPhrase='';
  let voiceTranscriptTimer=null,voiceSpeechInProgress=false,voicePausePending=false;
  let voiceMatchCount=0,voiceResultSegments=[],lastRecognitionEvent=null,voiceFallbackPending=false;
  let voiceRestartTimer=null,voiceRestartCount=0;
  const speechLanguages=['ar-MA','ar-SA','ar'];
  let speechLanguageIndex=0,speechLanguage=speechLanguages[speechLanguageIndex];

  const officialAdhkar=Array.isArray(window.ANWAR_OFFICIAL_ADHKAR)?window.ANWAR_OFFICIAL_ADHKAR:[];
  function renderOfficialOptions(){
   const existing=Array.from(select.querySelectorAll('optgroup')).filter(group=>group.dataset.anwarOfficialDhikrs==='true');
   existing.forEach(group=>group.remove());
   ['tasbih','morning','evening','daily'].forEach(period=>{
    const items=officialAdhkar.filter(item=>item&&item.period===period&&typeof item.text==='string'&&item.text.trim());
    if(!items.length)return;
    const group=document.createElement('optgroup');
    group.label=period==='tasbih'?'أذكار السبحة الرسمية':period==='morning'?'أذكار الصباح الرسمية':period==='evening'?'أذكار المساء الرسمية':'أذكار يومية';
    group.dataset.anwarOfficialDhikrs='true';
    group.dataset.anwarOfficialPeriod=period;
    items.forEach(item=>{
     const option=document.createElement('option');
     option.value='official:'+item.id;
     option.dataset.dhikrText=item.text;
     option.textContent=item.title;
     option.dataset.anwarOfficialDhikr='true';
     option.dataset.anwarOfficialId=item.id;
     option.dataset.repeat=item.count==null?'غير محدد':String(item.count||1);
     option.dataset.occasion=item.occasion||'';
     option.dataset.source=item.source||'حصن المسلم';
     option.dataset.period=period;
     group.appendChild(option);
    });
    select.appendChild(group);
   });
  }
  function optionText(option){return option&&option.dataset&&option.dataset.dhikrText?option.dataset.dhikrText:(option?option.value:'')}
  function isRemovedOfficial(option){
   if(!option)return false;
   const officialId=option.dataset&&option.dataset.anwarOfficialId;
   return removedOfficialDhikrs.includes(option.value)||(officialId&&removedOfficialDhikrs.includes(officialId));
  }
  function isCustomOption(option){
   return !!(option&&option.parentElement&&option.parentElement.dataset.anwarCustomDhikrs==='true');
  }
  function visibleOptions(){
   return Array.from(select.options).filter(option=>isCustomOption(option)||!isRemovedOfficial(option));
  }
  function persist(){
   if(!preferences||typeof preferences.set!=='function')return;
   writingPreferences=true;
   try{
    preferences.set('tasbih',{count:count,dhikr:select.value,customDhikrs:customDhikrs,removedOfficialDhikrs:removedOfficialDhikrs,theme:theme});
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
   const groupPriority=group=>{
    const period=group.dataset&&group.dataset.anwarOfficialPeriod;
    if(period==='tasbih')return 0;
    if(period==='morning')return 2;
    if(period==='evening')return 3;
    if(period==='daily')return 4;
    if(group.dataset&&group.dataset.anwarCustomDhikrs==='true')return 5;
    return 1;
   };
   Array.from(select.querySelectorAll('optgroup'))
    .sort((a,b)=>groupPriority(a)-groupPriority(b))
    .forEach(group=>{
    const options=Array.from(group.children).filter(option=>option.tagName==='OPTION'&&(isCustomOption(option)||!isRemovedOfficial(option)));
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
     if(option.dataset.anwarOfficialId)button.dataset.anwarOfficialId=option.dataset.anwarOfficialId;
     button.setAttribute('aria-pressed',option.value===select.value?'true':'false');
     button.setAttribute('aria-label','اختيار الذكر: '+option.textContent);
     const name=document.createElement('span');
     name.className='tasbih-dhikr-card-name';
     name.textContent=option.textContent;
     button.appendChild(name);
     if(option.dataset.anwarOfficialDhikr==='true'){
      const fullText=document.createElement('span');
      fullText.className='tasbih-dhikr-card-text';
      fullText.textContent=optionText(option);
      button.appendChild(fullText);
      const meta=document.createElement('span');
      meta.className='tasbih-dhikr-card-meta';
      const repeat=document.createElement('span');
      const repeatValue=option.dataset.repeat||'1';
      const repeatNumber=Number(repeatValue);
      const repeatSuffix=Number.isFinite(repeatNumber)?(repeatNumber===1?' مرة':' مرات'):'';
      repeat.textContent=repeatValue+repeatSuffix;
      const source=document.createElement('span');
      source.textContent=option.dataset.source||'حصن المسلم';
      if(option.dataset.occasion){
       const occasion=document.createElement('span');
       occasion.textContent=option.dataset.occasion;
       meta.appendChild(occasion);
      }
      meta.appendChild(repeat);
      meta.appendChild(source);
      button.appendChild(meta);
     }
     button.addEventListener('click',()=>chooseDhikr(option.value,true));
     section.appendChild(button);
    });
    cards.appendChild(section);
   });
   if(!cards.children.length){
    const empty=document.createElement('div');
    empty.className='tasbih-dhikr-empty';
    empty.textContent='القائمة فارغة.';
    cards.appendChild(empty);
   }
  }
  function update(){
   panel.dataset.tasbihTheme=theme;
   themeButtons.forEach(item=>item.button.setAttribute('aria-pressed',item.name===theme?'true':'false'));
   countNode.textContent=count.toLocaleString('ar');
   const selectedOption=Array.from(select.options).find(option=>option.value===select.value);
   phraseNode.textContent=selectedOption?optionText(selectedOption):'لم يتم اختيار ذكر بعد';
   renderCards();
   const selected=Array.from(select.options).find(option=>option.value===select.value);
   removeButton.disabled=!selected;
   removeButton.textContent='إزالة الذكر';
   restoreButton.hidden=removedOfficialDhikrs.length===0;
   restoreButton.textContent='استعادة القائمة'+(removedOfficialDhikrs.length?' ('+removedOfficialDhikrs.length+')':'');
  }
  function firstVisible(){
   return visibleOptions()[0]||null;
  }
  function saveAndUpdate(){
   update();
   persist();
  }
  function chooseTheme(nextTheme){
   if(!allowedThemes.has(nextTheme))return;
   theme=nextTheme;
   themePicker.hidden=true;
   themeToggle.setAttribute('aria-expanded','false');
   saveAndUpdate();
  }
  function setDhikrListOpen(open){
   const expanded=Boolean(open);
   dhikrList.hidden=!expanded;
   dhikrToggle.setAttribute('aria-expanded',expanded?'true':'false');
  }
  function chooseDhikr(value,resetCount){
   const option=Array.from(select.options).find(item=>item.value===value&&(isCustomOption(item)||!isRemovedOfficial(item)));
   if(!option)return;
   if(voiceRequested)stopVoice('توقف التسجيل لأن الذكر المختار تغيّر.');
   select.value=option.value;
   voiceTargetPhrase=optionText(option);
   voiceMatchCount=0;
   voiceResultSegments=[];lastRecognitionEvent=null;
   if(resetCount)count=0;
   setDhikrListOpen(false);
   setVoiceTranscript('');
   saveAndUpdate();
  }
  function add(amount){
   count=Math.max(0,Math.min(MAX_COUNT,count+amount));
   saveAndUpdate();
   const counter=panel.querySelector('.anwar-tasbih-counter');
   if(counter&&typeof counter.animate==='function'){
    try{counter.animate([{transform:'scale(1)'},{transform:'scale(1.045)'},{transform:'scale(1)'}],{duration:200,easing:'ease-out'})}catch(error){}
   }
  }
  function setVoiceState(state,message){
   voicePanel.dataset.state=state;
   voiceState.textContent=state==='starting'?'جارٍ تشغيل الميكروفون':state==='listening'?'الميكروفون نشط':state==='error'?'تعذر التسجيل':'';
   voiceStatus.textContent=message||'';
   const active=state==='starting'||state==='listening';
   voiceButton.setAttribute('aria-pressed',active?'true':'false');
   voiceButtonLabel.textContent=active?'إيقاف التسجيل':state==='error'?'إعادة المحاولة':'ابدأ التسجيل';
  }
  function stopVoice(message){
   const wasActive=voiceActive;
   voiceRequested=false;
   voiceActive=false;
   voiceSpeechInProgress=false;
   voicePausePending=true;
   voiceFallbackPending=false;
   if(voiceRestartTimer!==null){window.clearTimeout(voiceRestartTimer);voiceRestartTimer=null}
   voiceTargetPhrase='';
   voiceMatchCount=0;
   voiceResultSegments=[];lastRecognitionEvent=null;voiceRestartCount=0;
   if(wasActive&&recognition){try{recognition.stop()}catch(error){}}
   scheduleVoiceTranscriptFade(500);
   setVoiceState('idle',message||'تم إيقاف التسجيل.');
  }
  function clearVoiceTranscriptTimer(){
   if(voiceTranscriptTimer!==null){
    try{window.clearTimeout(voiceTranscriptTimer)}catch(error){}
    voiceTranscriptTimer=null;
   }
  }
  function setVoiceTranscript(text){
   if(!voiceTranscript)return;
   clearVoiceTranscriptTimer();
   voiceTranscript.classList.remove('is-temporary');
   voiceTranscript.classList.remove('is-fading');
   const value=String(text||'');
   const transcriptCard=voiceTranscript.parentElement;
   if(transcriptCard)transcriptCard.hidden=!value.trim();
   voiceTranscript.textContent=value;
  }
  function scheduleVoiceTranscriptFade(delay){
   if(!voiceTranscript||!voiceTranscript.textContent)return;
   clearVoiceTranscriptTimer();
   voiceTranscript.classList.add('is-temporary');
   voiceTranscriptTimer=window.setTimeout(()=>{
    voiceTranscript.classList.add('is-fading');
    voiceTranscriptTimer=window.setTimeout(()=>{
     voiceTranscript.textContent='';
     const transcriptCard=voiceTranscript.parentElement;
     if(transcriptCard)transcriptCard.hidden=true;
     voiceTranscript.classList.remove('is-fading');
     voiceTranscript.classList.remove('is-temporary');
     voiceTranscriptTimer=null;
    },650);
   },delay);
  }
  function showVoiceTranscript(text){
   const value=String(text||'').trim();
   if(!value)return;
   setVoiceTranscript(value);
   voiceTranscript.classList.add('is-temporary');
   // Keep the preview visible while speech is continuous. The browser's
   // speech-end event starts the short pause timer; result updates during a
   // pause preserve that shorter timer rather than extending it.
   if(voiceSpeechInProgress)return;
   scheduleVoiceTranscriptFade(voicePausePending?650:1150);
  }
  function normalizeSpeech(value){
   return String(value||'').toLocaleLowerCase('ar').normalize('NFD')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\uFE00-\uFE0F]/g,'')
    .replace(/[،؛؟٪٫٬۔,:;.!؟]+/g,' ')
    .replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/ـ/g,'')
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
  function lastMatchedPhraseText(transcript,phrase){
   const words=String(transcript||'').trim().split(/\s+/).filter(Boolean);
   const target=normalizeSpeech(phrase).split(' ').filter(Boolean);
   if(!target.length||words.length<target.length)return '';
   const normalized=words.map(normalizeSpeech);
   for(let i=words.length-target.length;i>=0;i--){
    let matched=true;
    for(let j=0;j<target.length;j++){
     if(normalized[i+j]!==target[j]){matched=false;break}
    }
    if(matched)return words.slice(i,i+target.length).join(' ');
   }
   return '';
  }
  function bestSpeechText(result,phrase){
   if(!result)return '';
   const alternatives=Number.isInteger(result.length)&&result.length>0?result.length:1;
   const target=normalizeSpeech(phrase).split(' ').filter(Boolean);
   let best='',bestScore=-Infinity;
   for(let i=0;i<alternatives;i++){
    const candidate=result[i]&&typeof result[i].transcript==='string'?result[i].transcript.trim():'';
    if(!candidate)continue;
    const heard=normalizeSpeech(candidate).split(' ').filter(Boolean);
    const overlap=target.reduce((sum,word)=>sum+(heard.includes(word)?1:0),0);
    const exact=countPhraseMatches(candidate,phrase);
    const score=exact*10000+overlap*100-Math.abs(target.length-heard.length)+heard.length*0.01;
    if(score>bestScore){best=candidate;bestScore=score}
   }
   return best;
  }
  function addCustomDhikr(){
   const value=String(customInput.value||'').replace(/\s+/g,' ').trim();
   if(!value){customStatus.textContent='اكتب الذكر.';customInput.focus();return}
   if(value.length>200){customStatus.textContent='الحد الأقصى لطول الذكر هو 200 حرف.';customInput.focus();return}
   const removedOfficial=Array.from(select.options).find(option=>!isCustomOption(option)&&optionText(option)===value&&isRemovedOfficial(option));
   if(removedOfficial){
    const removalKey=removedOfficial.dataset.anwarOfficialId||removedOfficial.value;
    removedOfficialDhikrs=removedOfficialDhikrs.filter(item=>item!==removalKey);
    customInput.value='';
    chooseDhikr(removedOfficial.value,true);
    customStatus.textContent='أُعيد الذكر.';
    return;
   }
   const existing=Array.from(select.options).find(option=>optionText(option)===value&&(isCustomOption(option)||!isRemovedOfficial(option)));
   if(existing){customInput.value='';chooseDhikr(existing.value,true);customStatus.textContent='الذكر موجود.';return}
   if(customDhikrs.length>=30){customStatus.textContent='وصلت إلى الحد الأقصى وهو 30 ذكراً مضافاً.';return}
   customDhikrs.push(value);
   renderCustomOptions();
   customInput.value='';
   chooseDhikr(value,true);
   customStatus.textContent='تمت الإضافة.';
  }
  function openPanel(){
   if(!panel.hidden)return true;
   panel.hidden=false;
   requestAnimationFrame(()=>{
    try{panel.scrollIntoView({behavior:'smooth',block:'nearest'})}catch(error){}
   });
   closeButton.focus();
   return true;
  }
  function closePanel(restoreFocus){
   themePicker.hidden=true;
   themeToggle.setAttribute('aria-expanded','false');
   setDhikrListOpen(false);
   if(voiceActive)stopVoice('توقف الاستماع عند إغلاق السبحة.');
   panel.hidden=true;
   if(restoreFocus!==false){
    const backButton=$('anwarTasbihBack');
    if(backButton)backButton.focus();
   }
  }

  renderOfficialOptions();
  renderCustomOptions();
  const savedOption=Array.from(select.options).find(option=>option.value===initial.dhikr&&(isCustomOption(option)||!isRemovedOfficial(option)));
  if(savedOption)select.value=savedOption.value;
  else if(!visibleOptions().some(option=>option.value===select.value))select.value=firstVisible()?firstVisible().value:'';
  update();

  // The service dashboard opens this standalone panel directly; its counter and preferences remain independent.

  closeButton.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();closePanel()});
  themeToggle.addEventListener('click',()=>{
   themePicker.hidden=!themePicker.hidden;
   themeToggle.setAttribute('aria-expanded',themePicker.hidden?'false':'true');
  });
  themeButtons.forEach(item=>item.button.addEventListener('click',()=>chooseTheme(item.name)));
  dhikrToggle.addEventListener('click',()=>setDhikrListOpen(dhikrList.hidden));
  setDhikrListOpen(false);
  // The circular number itself is an accessible tap target as well as the dedicated button.
  counterControl.setAttribute('role','button');
  counterControl.setAttribute('tabindex','0');
  counterControl.setAttribute('aria-label','عداد التسبيح');
  counterControl.addEventListener('click',()=>add(1));
  counterControl.addEventListener('keydown',event=>{
   if(event.key==='Enter'||event.key===' '){
    event.preventDefault();
    add(1);
   }
  });
  tap.addEventListener('click',()=>add(1));
  minus.addEventListener('click',()=>add(-1));
  reset.addEventListener('click',()=>{count=0;saveAndUpdate()});
  customAdd.addEventListener('click',addCustomDhikr);
  customInput.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();addCustomDhikr()}});
  select.addEventListener('change',()=>{
   if(voiceActive)stopVoice('توقف التسجيل لأن الذكر المختار تغيّر.');
   voiceTargetPhrase=optionText(Array.from(select.options).find(option=>option.value===select.value))||'';
   voiceMatchCount=0;
   count=0;
   saveAndUpdate();
   setVoiceTranscript('');
   setDhikrListOpen(false);
  });
  removeButton.addEventListener('click',()=>{
   const selected=Array.from(select.options).find(option=>option.value===select.value);
   if(!selected)return;
   const custom=isCustomOption(selected);
   const message=custom?'هل تريد حذف هذا الذكر المضاف من قائمتك على هذا الجهاز؟':'هل تريد إزالة هذا الذكر الرسمي من قائمتك على هذا الجهاز فقط؟ يمكنك استعادته لاحقاً.';
   if(!window.confirm(message))return;
   if(voiceActive)stopVoice('توقف التسجيل بسبب تعديل قائمة الأذكار.');
   if(custom)customDhikrs=customDhikrs.filter(item=>item!==selected.value);
   else {const officialId=selected.dataset&&selected.dataset.anwarOfficialId;const removalKey=officialId||selected.value;if(!removedOfficialDhikrs.includes(removalKey))removedOfficialDhikrs.push(removalKey)}
   renderCustomOptions();
   const next=firstVisible();
   select.value=next?next.value:'';
   count=0;
   saveAndUpdate();
   customStatus.textContent=custom?'تم الحذف.':'تمت الإزالة.';
  });
  restoreButton.addEventListener('click',()=>{
   if(!removedOfficialDhikrs.length)return;
   if(voiceActive)stopVoice('توقف التسجيل بسبب استعادة قائمة الأذكار.');
   removedOfficialDhikrs=[];
   if(!select.value)select.value=firstVisible()?firstVisible().value:'';
   count=0;
   saveAndUpdate();
   customStatus.textContent='تمت الاستعادة.';
  });
  const morningTab=$('morningTab'),eveningTab=$('eveningTab');
  if(morningTab)morningTab.addEventListener('click',event=>{
   if(typeof window.AnwarRenderAdhkar==='function'){event.preventDefault();event.stopPropagation();window.AnwarRenderAdhkar('morning')}
  });
  if(eveningTab)eveningTab.addEventListener('click',event=>{
   if(typeof window.AnwarRenderAdhkar==='function'){event.preventDefault();event.stopPropagation();window.AnwarRenderAdhkar('evening')}
  });
  document.addEventListener('keydown',event=>{
   if(event.key==='Escape'&&!panel.hidden){event.preventDefault();event.stopImmediatePropagation();closePanel(false)}
  },true);

  function scheduleVoiceRestart(message,delay){
   if(!voiceRequested||voiceRestartTimer!==null)return;
   if(voiceRestartCount>=4){
    voiceRequested=false;voiceActive=false;voiceTargetPhrase='';
    setVoiceState('error','انقطع التعرف الصوتي عدة مرات. اضغط إعادة المحاولة لبدء جلسة جديدة.');
    return;
   }
   voiceRestartCount++;
   voiceActive=false;
   setVoiceState('starting',message);
   voiceRestartTimer=window.setTimeout(()=>{
    voiceRestartTimer=null;
    if(!voiceRequested)return;
    try{
     voiceActive=true;
     recognition.start();
    }catch(error){
     voiceActive=false;voiceRequested=false;voiceTargetPhrase='';
     setVoiceState('error','تعذر استئناف التعرف الصوتي. أوقف التسجيل واسمح بالميكروفون ثم أعد المحاولة.');
    }
   },delay);
  }

  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(typeof SpeechRecognition!=='function'){
   voiceButton.disabled=true;
   voiceButtonLabel.textContent='غير مدعوم';
   setVoiceState('error','التعرف الصوتي غير متاح في هذا المتصفح. استخدم Chrome واسمح بالميكروفون.');
  }else{
   try{
    recognition=new SpeechRecognition();
    if(!recognition||typeof recognition.start!=='function'||typeof recognition.stop!=='function'){
     throw new Error('واجهة التعرف الصوتي غير مكتملة.');
    }
    recognition.lang=speechLanguage;
    recognition.continuous=true;
    recognition.interimResults=true;
    recognition.maxAlternatives=3;
    recognition.onstart=()=>{
     if(!voiceRequested)return;
     voiceActive=true;
     voiceSpeechInProgress=false;
     voicePausePending=false;
     setVoiceState('listening','');

    };
    recognition.onspeechstart=()=>{
     if(!voiceActive)return;
     voiceRestartCount=0;
     voiceSpeechInProgress=true;
     voicePausePending=false;
     clearVoiceTranscriptTimer();
     voiceTranscript.classList.remove('is-fading');
     if(voiceTranscript.textContent)voiceTranscript.classList.add('is-temporary');
     setVoiceState('listening','');
    };
    recognition.onspeechend=()=>{
     if(!voiceActive)return;
     voiceSpeechInProgress=false;
     voicePausePending=true;
     scheduleVoiceTranscriptFade(650);
    };
    recognition.onresult=event=>{
     // تختلف بعض خدمات أندرويد في إعادة قائمة النتائج كاملة أو إرسال دفعة جديدة تبدأ من الصفر.
     if(!voiceActive||!event||!event.results||event===lastRecognitionEvent)return;
     lastRecognitionEvent=event;
     const results=event.results,incoming=[],latestParts=[];
     const resultStart=Number.isInteger(event.resultIndex)?Math.max(0,Math.min(results.length,event.resultIndex)):Math.max(0,results.length-1);
     for(let i=0;i<results.length;i++){
      const result=results[i];
      incoming.push({text:bestSpeechText(result,voiceTargetPhrase),isFinal:!!result.isFinal,source:result});
      if(i>=resultStart&&incoming[i].text)latestParts.push(incoming[i].text);
     }
     const previousAllFinal=voiceResultSegments.length>0&&voiceResultSegments.every(item=>item&&item.isFinal);
     const matchingPrefix=incoming.length>=voiceResultSegments.length&&voiceResultSegments.every((old,index)=>
      old&&incoming[index]&&old.isFinal&&incoming[index].isFinal&&normalizeSpeech(old.text)===normalizeSpeech(incoming[index].text)
     );
     const repeatedSingleBatch=resultStart===0&&previousAllFinal&&incoming.length===1&&voiceResultSegments.length===1&&
      incoming[0].isFinal&&incoming[0].source!==voiceResultSegments[0].source;
     const freshBatch=resultStart===0&&previousAllFinal&&incoming.length>0&&
      (incoming.length<voiceResultSegments.length||(!matchingPrefix&&incoming.length>=voiceResultSegments.length)||repeatedSingleBatch);
     if(freshBatch){
      voiceResultSegments.push(...incoming);
     }else{
      for(let i=resultStart;i<incoming.length;i++)voiceResultSegments[i]=incoming[i];
      voiceResultSegments.length=incoming.length;
     }
     const finalText=voiceResultSegments.filter(item=>item&&item.isFinal&&item.text).map(item=>item.text).join(' ').trim();
     const interimText=voiceResultSegments.filter(item=>item&&!item.isFinal&&item.text).map(item=>item.text).join(' ').trim();
     const liveText=[finalText,interimText].filter(Boolean).join(' ').trim();
     const latestText=latestParts.length?latestParts[latestParts.length-1]:'';
     if(latestText)showVoiceTranscript(latestText);
     if(!liveText)return;
     const totalMatches=countPhraseMatches(liveText,voiceTargetPhrase);
     const newMatches=Math.max(0,totalMatches-voiceMatchCount);
     if(newMatches>0){
      voiceMatchCount=totalMatches;
      add(newMatches);
      showVoiceTranscript(lastMatchedPhraseText(liveText,voiceTargetPhrase)||latestText||voiceTargetPhrase);
      setVoiceState('listening','تم الاحتساب: '+newMatches.toLocaleString('ar'));
     }else if(totalMatches===0&&finalText){
      setVoiceState('listening','سمع المتصفح الكلام، لكنه لم يطابق الذكر المختار. راجع النص الظاهر.');
     }
    };
    recognition.onnomatch=()=>{
     if(voiceActive)setVoiceState('listening','لم يتضح الكلام.');
    };
    recognition.onerror=event=>{
     const code=event&&event.error;
     if(code==='language-not-supported'&&speechLanguageIndex<speechLanguages.length-1){
      speechLanguageIndex++;
      speechLanguage=speechLanguages[speechLanguageIndex];
      recognition.lang=speechLanguage;
      voiceActive=false;
      voiceSpeechInProgress=false;
      voicePausePending=true;
      voiceFallbackPending=true;
      setVoiceState('starting','لغة التعرف الأولى غير متاحة على هذا الجهاز؛ نجرب إعداداً عربياً آخر تلقائياً.');
      return;
     }
     voiceActive=false;
     voiceSpeechInProgress=false;
     voicePausePending=true;
     scheduleVoiceTranscriptFade(400);
     if(code==='no-speech'){
      setVoiceState('starting','لم يلتقط المتصفح كلاماً واضحاً؛ سنعيد الاستماع تلقائياً.');
      return;
     }
     if(code==='network'){
      setVoiceState('starting','انقطع اتصال خدمة التعرف الصوتي؛ سنحاول الاتصال مجدداً.');
      return;
     }
     voiceRequested=false;
     voiceTargetPhrase='';
     const messages={
      'not-allowed':'لم يُسمح بالميكروفون. افتح إعدادات الموقع واسمح باستخدامه.',
      'service-not-allowed':'خدمة التعرف الصوتي محجوبة من المتصفح أو الجهاز.',
      'audio-capture':'لم يتم العثور على ميكروفون صالح.',
      'no-speech':'لم يلتقط المتصفح كلاماً. تأكد من إذن الميكروفون وحاول التحدث فور بدء التسجيل.',
      'network':'تعذر الاتصال بخدمة التعرف الصوتي. تحقق من اتصال الإنترنت.',
      'aborted':'أُوقف التسجيل.',
      'language-not-supported':'العربية غير مدعومة من خدمة التعرف الصوتي على هذا الجهاز.',
      'bad-grammar':'تعذر تحليل العبارة المنطوقة؛ حاول مرة أخرى.'
     };
     if(code==='no-speech'&&!voiceTranscript.textContent.includes('لم يبدأ'))setVoiceTranscript('لم يلتقط المتصفح كلاماً واضحاً.');
     setVoiceState('error',messages[code]||'حدث خطأ في التعرف الصوتي. حاول التسجيل مرة أخرى.');
    };
    recognition.onend=()=>{
     if(voiceFallbackPending){
      voiceFallbackPending=false;
      scheduleVoiceRestart('تم تبديل لغة التعرف؛ جار إعادة تشغيل الميكروفون.',250);
      return;
     }
     if(voiceRequested){
      scheduleVoiceRestart('انتهت جلسة الاستماع المؤقتة؛ جار إعادة تشغيلها تلقائياً.',350);
      return;
     }
     if(voiceActive){
      voiceActive=false;
      voiceTargetPhrase='';
      setVoiceState('idle','انتهى التسجيل.');
     }
    };
    voiceButton.addEventListener('click',()=>{
     if(voiceRequested){stopVoice('تم إيقاف التسجيل.');return}
     try{
      voiceMatchCount=0;
      voiceResultSegments=[];lastRecognitionEvent=null;voiceFallbackPending=false;voiceRestartCount=0;
      speechLanguageIndex=0;speechLanguage=speechLanguages[speechLanguageIndex];recognition.lang=speechLanguage;
      voiceTargetPhrase=String(optionText(Array.from(select.options).find(option=>option.value===select.value))||'').trim();
      if(!voiceTargetPhrase){
       setVoiceState('error','اختر ذكراً قبل بدء التسجيل.');
       return;
      }
      setVoiceTranscript('');
      setVoiceState('starting','');
      voiceRequested=true;
      voiceActive=true;
      recognition.start();
     }catch(error){
      voiceRequested=false;
      voiceActive=false;
      voiceTargetPhrase='';
      setVoiceState('error','تعذر بدء التسجيل. تحقق من إذن الميكروفون ثم حاول مرة أخرى.');
      console.warn('تعذر بدء التعرف الصوتي للسبحة',error);
     }
    });
   }catch(error){
    recognition=null;
    voiceButton.disabled=true;
    setVoiceState('error','تعذر تهيئة التعرف الصوتي في هذا المتصفح. يمكنك متابعة استخدام العداد يدوياً.');
    console.warn('تعذر تهيئة خدمة التعرف الصوتي للسبحة',error);
   }
  }
  if(preferences&&typeof preferences.subscribe==='function'){
   preferences.subscribe(saved=>{
    if(writingPreferences)return;
    const value=saved&&saved.tasbih?saved.tasbih:{};
    count=Number.isSafeInteger(value.count)?Math.max(0,value.count):0;
    customDhikrs=cleanDhikrList(value.customDhikrs,30,200);
    removedOfficialDhikrs=cleanDhikrList(value.removedOfficialDhikrs,60,4000);
    theme=allowedThemes.has(value.theme)?value.theme:'emerald';
    renderCustomOptions();
    const option=Array.from(select.options).find(item=>item.value===value.dhikr&&(isCustomOption(item)||!isRemovedOfficial(item)));
    if(option)select.value=option.value;
    else if(!visibleOptions().some(item=>item.value===select.value))select.value=firstVisible()?firstVisible().value:'';
    update();
   });
  }
  window.AnwarTasbihController=Object.freeze({
   toggle(){
    if(!window.__ANWAR_TASBIH_CONTROLLER_READY__)return false;
    if(panel.hidden)openPanel();
    else closePanel();
    return true;
   },
   open(){
    if(!window.__ANWAR_TASBIH_CONTROLLER_READY__)return false;
    if(panel.hidden)openPanel();
    return !panel.hidden;
   },
   close(){closePanel(false);return panel.hidden}
  });
  window.__ANWAR_TASBIH_CONTROLLER_READY__=true;
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
})();