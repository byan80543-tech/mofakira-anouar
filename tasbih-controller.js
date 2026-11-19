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
  const counterControl=panel&&panel.querySelector('.anwar-tasbih-counter');
  const themeToggle=$('tasbihThemeToggle'),themePicker=$('tasbihThemePicker');
  const themeIds=['emerald','dark','pink','night','heritage','glass'];
  const themeButtons=themeIds.map(name=>({name,button:$('tasbihTheme'+name[0].toUpperCase()+name.slice(1))}));
  const tap=$('tasbihTap'),minus=$('tasbihMinus'),reset=$('tasbihReset');
  const cards=$('tasbihDhikrCards'),customInput=$('tasbihCustomDhikrInput');
  const customAdd=$('tasbihAddCustomDhikr'),customStatus=$('tasbihCustomDhikrStatus');
  const removeButton=$('tasbihRemoveDhikr'),restoreButton=$('tasbihRestoreOfficial');
  const voicePanel=$('tasbihVoicePanel'),voiceButton=$('tasbihVoice');
  const voiceState=$('tasbihVoiceState'),voiceStatus=$('tasbihVoiceStatus');
  const voiceButtonLabel=$('tasbihVoiceButtonLabel'),voiceTranscript=$('tasbihVoiceTranscript');
  const required={panel,toggleButton,closeButton,ownerDialog,adhkarPanel,select,countNode,phraseNode,counterControl,tap,minus,reset,cards,customInput,customAdd,customStatus,removeButton,restoreButton,voicePanel,voiceButton,voiceState,voiceStatus,voiceButtonLabel,voiceTranscript,themeToggle,themePicker,...Object.fromEntries(themeButtons.map(item=>['theme'+item.name,item.button]))};
  const missing=Object.keys(required).filter(key=>!required[key]);
  if(missing.length){
   console.error('تعذر تهيئة السبحة؛ عناصر الواجهة الناقصة:',missing);
   if(toggleButton)toggleButton.title='تعذر تشغيل السبحة: واجهة غير مكتملة';
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
  let recognition=null,voiceActive=false,writingPreferences=false,voiceTargetPhrase='';
  let voiceMatchCount=0,speechLanguage='ar-MA';

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
      repeat.textContent='التكرار: '+repeatValue+repeatSuffix;
      const source=document.createElement('span');
      source.textContent='المصدر: '+(option.dataset.source||'حصن المسلم');
      if(option.dataset.occasion){
       const occasion=document.createElement('span');
       occasion.textContent='الوقت: '+option.dataset.occasion;
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
    empty.textContent='لا توجد أذكار ظاهرة في قائمتك. أضف ذكراً جديداً أو استعد الأذكار الرسمية.';
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
  function chooseTheme(nextTheme){
   if(!allowedThemes.has(nextTheme))return;
   theme=nextTheme;
   themePicker.hidden=true;
   themeToggle.setAttribute('aria-expanded','false');
   saveAndUpdate();
  }
  function chooseDhikr(value,resetCount){
   const option=Array.from(select.options).find(item=>item.value===value&&(isCustomOption(item)||!isRemovedOfficial(item)));
   if(!option)return;
   if(voiceActive)stopVoice('توقف التسجيل لأن الذكر المختار تغيّر.');
   select.value=option.value;
   voiceTargetPhrase=optionText(option);
   voiceMatchCount=0;
   if(resetCount)count=0;
   if(voiceTranscript)voiceTranscript.textContent='بانتظار نطق الذكر المختار.';
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
   voiceState.textContent=state==='starting'?'جارٍ تشغيل الميكروفون':state==='listening'?'الميكروفون نشط':state==='error'?'تعذر التسجيل':'جاهز للتسجيل';
   voiceStatus.textContent=message||'';
   const active=state==='starting'||state==='listening';
   voiceButton.setAttribute('aria-pressed',active?'true':'false');
   voiceButtonLabel.textContent=active?'إيقاف التسجيل':state==='error'?'إعادة المحاولة':'ابدأ التسجيل';
  }
  function stopVoice(message){
   const wasActive=voiceActive;
   voiceActive=false;
   voiceTargetPhrase='';
   voiceMatchCount=0;
   if(wasActive&&recognition){try{recognition.stop()}catch(error){}}
   setVoiceState('idle',message||'تم إيقاف التسجيل.');
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
   if(!value){customStatus.textContent='اكتب الذكر أولاً ثم اضغط إضافة.';customInput.focus();return}
   if(value.length>200){customStatus.textContent='الحد الأقصى لطول الذكر هو 200 حرف.';customInput.focus();return}
   const removedOfficial=Array.from(select.options).find(option=>!isCustomOption(option)&&optionText(option)===value&&isRemovedOfficial(option));
   if(removedOfficial){
    const removalKey=removedOfficial.dataset.anwarOfficialId||removedOfficial.value;
    removedOfficialDhikrs=removedOfficialDhikrs.filter(item=>item!==removalKey);
    customInput.value='';
    chooseDhikr(removedOfficial.value,true);
    customStatus.textContent='أُعيد الذكر الرسمي إلى قائمتك واختير للسبحة.';
    return;
   }
   const existing=Array.from(select.options).find(option=>optionText(option)===value&&(isCustomOption(option)||!isRemovedOfficial(option)));
   if(existing){customInput.value='';chooseDhikr(existing.value,true);customStatus.textContent='هذا الذكر موجود في القائمة، وقد تم اختياره.';return}
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
   // Open the dialog first, but never let a navigation bridge or rendering
   // error keep the actual tasbih panel hidden inside its parent section.
   try{
    if(!ownerDialog.open){
     if(typeof ownerDialog.showModal==='function')ownerDialog.showModal();
     else ownerDialog.setAttribute('open','');
    }
   }catch(error){
    console.error('تعذر فتح نافذة الأذكار بالطريقة الحوارية؛ ستتم محاولة عرضها مباشرة.',error);
    try{if(!ownerDialog.open)ownerDialog.setAttribute('open','')}catch(fallbackError){}
   }
   if(ownerPanel)ownerPanel.hidden=true;
   adhkarPanel.hidden=false;
   if(sharePanel)sharePanel.hidden=true;
   if(ownerTab)ownerTab.classList.toggle('active',false);
   if(adhkarTab)adhkarTab.classList.toggle('active',true);
   if(shareTab)shareTab.classList.toggle('active',false);
   if(typeof window.AnwarRenderAdhkar==='function'){
    try{window.AnwarRenderAdhkar('morning')}
    catch(error){console.warn('تعذر تحديث قائمة أذكار الصباح؛ بقيت السبحة قابلة للفتح.',error)}
   }
   panel.hidden=false;
   toggleButton.setAttribute('aria-expanded','true');
   requestAnimationFrame(()=>{
    try{panel.scrollIntoView({behavior:'smooth',block:'nearest'})}catch(error){}
   });
   closeButton.focus()
  }
  function closePanel(restoreFocus){
   themePicker.hidden=true;
   themeToggle.setAttribute('aria-expanded','false');
   if(voiceActive)stopVoice('توقف الاستماع عند إغلاق السبحة.');
   panel.hidden=true;
   toggleButton.setAttribute('aria-expanded','false');
   if(restoreFocus!==false&&ownerDialog.open)toggleButton.focus();
  }

  renderOfficialOptions();
  renderCustomOptions();
  const savedOption=Array.from(select.options).find(option=>option.value===initial.dhikr&&(isCustomOption(option)||!isRemovedOfficial(option)));
  if(savedOption)select.value=savedOption.value;
  else if(!visibleOptions().some(option=>option.value===select.value))select.value=firstVisible()?firstVisible().value:'';
  update();

  // The launch click is delegated by app-core.js, alongside the other dialog tabs.
  // Keep the counter controller independent, but expose one explicit toggle API.

  closeButton.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();closePanel()});
  themeToggle.addEventListener('click',()=>{
   themePicker.hidden=!themePicker.hidden;
   themeToggle.setAttribute('aria-expanded',themePicker.hidden?'false':'true');
  });
  themeButtons.forEach(item=>item.button.addEventListener('click',()=>chooseTheme(item.name)));
  // The circular number itself is an accessible tap target as well as the dedicated button.
  counterControl.setAttribute('role','button');
  counterControl.setAttribute('tabindex','0');
  counterControl.setAttribute('aria-label','اضغط هنا لتسجيل تسبيحة واحدة');
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
   voiceTranscript.textContent='بانتظار نطق الذكر المختار.';
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
   customStatus.textContent=custom?'تم حذف الذكر المضاف من قائمتك.':'تمت إزالة الذكر الرسمي من قائمتك فقط. يمكنك استعادته متى شئت.';
  });
  restoreButton.addEventListener('click',()=>{
   if(!removedOfficialDhikrs.length)return;
   if(voiceActive)stopVoice('توقف التسجيل بسبب استعادة قائمة الأذكار.');
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
     voiceActive=true;
     setVoiceState('listening','الميكروفون يعمل الآن؛ انطق الذكر المختار بوضوح.');
     if(!voiceTranscript.textContent||voiceTranscript.textContent==='لم يبدأ التسجيل بعد')voiceTranscript.textContent='بانتظار العبارة…';
    };
    recognition.onspeechstart=()=>{
     if(voiceActive)setVoiceState('listening','تم رصد صوتك؛ تابع نطق الذكر المختار.');
    };
    recognition.onresult=event=>{
     // بعض المتصفحات تقسّم الجملة إلى نتائج نهائية متعددة؛ نجمعها قبل المطابقة.
     if(!voiceActive||!event||!event.results)return;
     const results=event.results;
     const finalParts=[],interimParts=[];
     for(let i=0;i<results.length;i++){
      const result=results[i];
      const said=bestSpeechText(result,voiceTargetPhrase);
      if(!said)continue;
      if(result.isFinal)finalParts.push(said);
      else interimParts.push(said);
     }
     const finalText=finalParts.join(' ').trim();
     const interimText=interimParts.join(' ').trim();
     const displayText=[finalText,interimText].filter(Boolean).join(' ').trim();
     if(displayText)voiceTranscript.textContent=displayText;
     if(!finalText)return;
     const totalMatches=countPhraseMatches(finalText,voiceTargetPhrase);
     const newMatches=Math.max(0,totalMatches-voiceMatchCount);
     if(newMatches>0){
      voiceMatchCount=totalMatches;
      add(newMatches);
      setVoiceState('listening','تم التعرف على الذكر وإضافة '+newMatches.toLocaleString('ar')+' إلى العداد.');
     }else if(totalMatches===0&&finalText){
      setVoiceState('listening','التقطت العبارة، لكنها لا تطابق الذكر المختار كاملاً. النص الملتقط: '+finalText);
     }
    };
    recognition.onnomatch=()=>{
     if(voiceActive)setVoiceState('listening','سمعت صوتاً، لكن تعذر تمييز الكلمات. حاول النطق بوضوح وبسرعة أهدأ.');
    };
    recognition.onerror=event=>{
     const code=event&&event.error;
     if(code==='language-not-supported'&&speechLanguage!=='ar-SA'){
      speechLanguage='ar-SA';
      recognition.lang=speechLanguage;
     }
     voiceActive=false;
     voiceTargetPhrase='';
     const messages={
      'not-allowed':'لم يُسمح بالميكروفون. افتح إعدادات الموقع واسمح باستخدامه.',
      'service-not-allowed':'خدمة التعرف الصوتي محجوبة من المتصفح أو الجهاز.',
      'audio-capture':'لم يتم العثور على ميكروفون صالح.',
      'no-speech':'لم يلتقط المتصفح كلاماً. تأكد من إذن الميكروفون وحاول التحدث فور بدء التسجيل.',
      'network':'تعذر الاتصال بخدمة التعرف الصوتي. تحقق من اتصال الإنترنت.',
      'aborted':'أُوقف التسجيل.',
      'language-not-supported':'لغة التعرف غير مدعومة على هذا الجهاز. تم اختيار العربية العامة؛ ابدأ التسجيل مجدداً.',
      'bad-grammar':'تعذر تحليل العبارة المنطوقة؛ حاول مرة أخرى.'
     };
     if(code==='no-speech'&&!voiceTranscript.textContent.includes('لم يبدأ'))voiceTranscript.textContent='لم يلتقط المتصفح كلاماً واضحاً.';
     setVoiceState('error',messages[code]||'حدث خطأ في التعرف الصوتي. حاول التسجيل مرة أخرى.');
    };
    recognition.onend=()=>{
     if(voiceActive){
      voiceActive=false;
      voiceTargetPhrase='';
      setVoiceState('idle','انتهى الاستماع. ابدأ التسجيل مجدداً للمتابعة.');
     }
    };
    voiceButton.addEventListener('click',()=>{
     if(voiceActive){stopVoice('تم إيقاف التسجيل.');return}
     try{
      voiceMatchCount=0;
      voiceTargetPhrase=String(optionText(Array.from(select.options).find(option=>option.value===select.value))||'').trim();
      if(!voiceTargetPhrase){
       setVoiceState('error','اختر ذكراً قبل بدء التسجيل.');
       return;
      }
      voiceTranscript.textContent='بانتظار العبارة…';
      setVoiceState('starting','جارٍ تفعيل الميكروفون…');
      voiceActive=true;
      recognition.start();
     }catch(error){
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