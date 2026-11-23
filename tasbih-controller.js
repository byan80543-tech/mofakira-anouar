/* Standalone tasbih controller.
 * It deliberately does not depend on the notebook's delayed initializer.
 * Private preferences continue to flow through the encrypted vault adapter.
 */
(function installAnwarTasbihController(){
 'use strict';
 function init(){
  if(window.__ANWAR_TASBIH_CONTROLLER_READY__)return;
  const $=id=>document.getElementById(id);
  const panel=$('tasbihPanel');
  const countNode=$('tasbihCount'),phraseNode=$('tasbihPhrase'),select=$('tasbihDhikr');
  const beadTrack=$('tasbihBeads');
  const counterControl=panel&&panel.querySelector('.anwar-tasbih-counter');
  const counterTap=$('tasbihCounterControl');
  const clockDial=$('tasbihClockDial'),clockTicks=$('tasbihClockTicks'),clockNumbers=$('tasbihClockNumbers'),hourHand=$('tasbihHourHand'),minuteHand=$('tasbihMinuteHand'),secondHand=$('tasbihSecondHand'),elapsedNode=$('tasbihElapsedTime');
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
  const voiceButtonLabel=$('tasbihVoiceButtonLabel');
  const required={panel,select,countNode,phraseNode,beadTrack,counterControl,counterTap,tap,minus,reset,cards,dhikrToggle,dhikrList,customInput,customAdd,customStatus,removeButton,restoreButton,voicePanel,voiceButton,voiceState,voiceStatus,voiceButtonLabel,themeToggle,themePicker,clockDial,clockTicks,clockNumbers,hourHand,minuteHand,secondHand,elapsedNode,...Object.fromEntries(themeButtons.map(item=>['theme'+item.name,item.button]))};
  const missing=Object.keys(required).filter(key=>!required[key]);
  if(missing.length){
   console.error('تعذر تهيئة السبحة؛ عناصر الواجهة الناقصة:',missing);
   return;
  }
  const preferences=globalThis.AnwarPrivatePreferences;
  // لا نفترض أن الخزنة تحتوي tasbih؛ قد تكون أول زيارة أو بيانات قديمة.
  const DESIGN_VERSION='royal-reference-1';
  const defaultTasbih={count:0,dhikr:select.value,customDhikrs:[],removedOfficialDhikrs:[],theme:'emerald',designVersion:DESIGN_VERSION};
  let initial=defaultTasbih;
  try{
   const stored=preferences&&typeof preferences.get==='function'?preferences.get():null;
   if(stored&&stored.tasbih&&typeof stored.tasbih==='object')initial=stored.tasbih;
  }catch(error){console.warn('تعذر قراءة إعدادات السبحة؛ سيبدأ العداد بإعداداته الافتراضية.',error)}
  if(initial.designVersion!==DESIGN_VERSION&&initial.dhikr==='أستغفر الله العظيم وأتوب إليه')initial={...initial,dhikr:select.value};
  const MAX_COUNT=1000000000;
  const cleanDhikrList=(items,limit,maxLength=200)=>Array.isArray(items)
   ?[...new Set(items.filter(item=>typeof item==='string').map(item=>item.trim().slice(0,maxLength)).filter(Boolean))].slice(0,limit)
   :[];
  let count=Number.isSafeInteger(initial.count)?Math.max(0,Math.min(MAX_COUNT,initial.count)):0;
  const MAX_ELAPSED_MS=10*365*24*60*60*1000;
  let elapsedMs=Number.isFinite(initial.elapsedMs)?Math.max(0,Math.min(MAX_ELAPSED_MS,initial.elapsedMs)):0;
  let sessionStartedAt=null,lastPersistedElapsed=elapsedMs;
  const allowedThemes=new Set(themeIds);
  let theme=initial.designVersion===DESIGN_VERSION&&allowedThemes.has(initial.theme)?initial.theme:'emerald';
  let customDhikrs=cleanDhikrList(initial.customDhikrs,30,200);
  let removedOfficialDhikrs=cleanDhikrList(initial.removedOfficialDhikrs,60,4000);
  let recognition=null,voiceActive=false,voiceRequested=false,writingPreferences=false,voiceTargetPhrase='';

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
  function normalizeDhikrKey(value){
   return String(value||'').normalize('NFD')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\uFE00-\uFE0F]/g,'')
    .replace(/ٱ/g,'ا').replace(/ـ/g,'')
    .replace(/[^\u0600-\u06FFa-z0-9\s]/gi,' ')
    .replace(/\s+/g,' ').trim();
  }
  function isRemovedOfficial(option){
   if(!option)return false;
   const officialId=option.dataset&&option.dataset.anwarOfficialId;
   return removedOfficialDhikrs.includes(option.value)||(officialId&&removedOfficialDhikrs.includes(officialId));
  }
  function isCustomOption(option){
   return !!(option&&option.parentElement&&option.parentElement.dataset.anwarCustomDhikrs==='true');
  }
  function visibleOptions(){
   const options=Array.from(select.options);
   const officialKeys=new Set(options
    .filter(option=>option.dataset.anwarOfficialDhikr==='true')
    .map(option=>normalizeDhikrKey(optionText(option)))
    .filter(Boolean));
   return options.filter(option=>{
    if(isRemovedOfficial(option))return false;
    if(option.dataset.anwarOfficialDhikr!=='true'&&officialKeys.has(normalizeDhikrKey(optionText(option))))return false;
    return true;
   });
  }
  function currentElapsedMs(now){
   const stamp=Number.isFinite(now)?now:Date.now();
   return Math.max(0,Math.min(MAX_ELAPSED_MS,elapsedMs+(sessionStartedAt===null?0:Math.max(0,stamp-sessionStartedAt))));
  }
  function arabicDigits(value){return String(value).replace(/[0-9]/g,d=>'٠١٢٣٤٥٦٧٨٩'[Number(d)]);}
  function formatDuration(milliseconds){
   const totalSeconds=Math.floor(Math.max(0,milliseconds)/1000);
   const hours=Math.floor(totalSeconds/3600),minutes=Math.floor((totalSeconds%3600)/60),seconds=totalSeconds%60;
   return arabicDigits([hours,minutes,seconds].map(part=>String(part).padStart(2,'0')).join(':'));
  }
  function renderClockNumbers(){
   clockNumbers.replaceChildren();
   for(let i=1;i<=12;i++){
    const angle=i*30;
    const wrapper=document.createElement('div');
    wrapper.className='tasbih-number-wrapper';
    wrapper.style.transform='rotate('+angle+'deg)';
    const numText=document.createElement('div');
    numText.className='tasbih-number-text';
    numText.textContent=String(i);
    numText.style.transform='translateX(-50%) rotate(-'+angle+'deg)';
    wrapper.appendChild(numText);
    clockNumbers.appendChild(wrapper);
   }
  }
  function renderClockTicks(){
   clockTicks.replaceChildren();
   for(let i=0;i<60;i++){
    const tick=document.createElement('div');
    tick.className='tasbih-clock-tick'+(i%5===0?' major':'');
    tick.style.transform='rotate('+i*6+'deg)';
    clockTicks.appendChild(tick);
   }
  }
  function updateClockUi(now){
   const stamp=Number.isFinite(now)?now:Date.now();
   const date=new Date(stamp);
   const seconds=date.getSeconds()+date.getMilliseconds()/1000;
   const minutes=date.getMinutes()+seconds/60;
   const hours=(date.getHours()%12)+minutes/60;
   const hourDeg=hours*30;
   const minuteDeg=minutes*6;
   const secondDeg=seconds*6;
   hourHand.style.transform='translateX(-50%) rotate('+hourDeg+'deg)';
   minuteHand.style.transform='translateX(-50%) rotate('+minuteDeg+'deg)';
   secondHand.style.transform='translateX(-50%) rotate('+secondDeg+'deg)';
   elapsedNode.textContent=formatDuration(currentElapsedMs(stamp));
   clockDial.setAttribute('aria-label','الساعة الآن '+arabicDigits(String(date.getHours()).padStart(2,'0'))+':'+arabicDigits(String(date.getMinutes()).padStart(2,'0')));
  }
  function startSessionClock(){if(sessionStartedAt===null)sessionStartedAt=Date.now()}
  function pauseSessionClock(){
   if(sessionStartedAt===null)return;
   elapsedMs=currentElapsedMs();sessionStartedAt=null;lastPersistedElapsed=elapsedMs;
   updateClockUi();persist();
  }
  function resetSessionClock(){elapsedMs=0;sessionStartedAt=null;lastPersistedElapsed=0;updateClockUi()}
  function persist(){
   if(!preferences||typeof preferences.set!=='function')return;
   writingPreferences=true;
   try{
    preferences.set('tasbih',{count:count,dhikr:select.value,customDhikrs:customDhikrs,removedOfficialDhikrs:removedOfficialDhikrs,theme:theme,elapsedMs:currentElapsedMs(),designVersion:DESIGN_VERSION});
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
   const visible=new Set(visibleOptions());
   const selectedOption=Array.from(select.options).find(option=>option.value===select.value);
   const selectedKey=normalizeDhikrKey(optionText(selectedOption));
   const seenLocalKeys=new Set();
   const groupPriority=group=>{
    const period=group.dataset&&group.dataset.anwarOfficialPeriod;
    if(period==='tasbih')return 0;
    if(period==='morning')return 1;
    if(period==='evening')return 2;
    if(period==='daily')return 3;
    if(group.dataset&&group.dataset.anwarCustomDhikrs==='true')return 4;
    return 5;
   };
   Array.from(select.querySelectorAll('optgroup'))
    .sort((a,b)=>groupPriority(a)-groupPriority(b))
    .forEach(group=>{
     const options=Array.from(group.children).filter(option=>option.tagName==='OPTION'&&visible.has(option));
     if(!options.length)return;
     const section=document.createElement('section');
     section.className='tasbih-dhikr-group';
     const heading=document.createElement('div');
     heading.className='tasbih-dhikr-category';
     heading.textContent=group.label||'أذكار';
     section.appendChild(heading);
     options.forEach(option=>{
      const key=normalizeDhikrKey(optionText(option));
      const isOfficial=option.dataset.anwarOfficialDhikr==='true';
      const isCustom=isCustomOption(option);
      const duplicateKey=isOfficial
       ?'official:'+(option.dataset.anwarOfficialId||option.value)
       :(isCustom?'custom:':'legacy:')+key;
      if(!key||seenLocalKeys.has(duplicateKey))return;
      seenLocalKeys.add(duplicateKey);
      const button=document.createElement('button');
      button.type='button';
      button.className='tasbih-dhikr-card';
      if(option.dataset.anwarOfficialId)button.dataset.anwarOfficialId=option.dataset.anwarOfficialId;
      const selectedMatches=!!selectedOption&&(option.value===selectedOption.value||
       (selectedOption.dataset.anwarOfficialDhikr!=='true'&&isOfficial&&key===selectedKey));
      button.setAttribute('aria-pressed',selectedMatches?'true':'false');
      button.setAttribute('aria-label','اختيار الذكر: '+option.textContent);
      const name=document.createElement('span');
      name.className='tasbih-dhikr-card-name';
      name.textContent=option.textContent;
      button.appendChild(name);
      if(isOfficial&&option.dataset.repeat){
       const repeatValue=option.dataset.repeat;
       const repeatNumber=Number(repeatValue);
       const meta=document.createElement('span');
       meta.className='tasbih-dhikr-card-meta';
       meta.textContent=Number.isFinite(repeatNumber)
        ?repeatValue+(repeatNumber===1?' مرة':' مرات')
        :'';
       if(meta.textContent)button.appendChild(meta);
      }
      button.addEventListener('click',()=>chooseDhikr(option.value,true));
      section.appendChild(button);
     });
     if(section.children.length>1)cards.appendChild(section);
    });
   if(!cards.children.length){
    const empty=document.createElement('div');
    empty.className='tasbih-dhikr-empty';
    empty.textContent='القائمة فارغة.';
    cards.appendChild(empty);
   }
  }
  function renderBeads(){
   const completed=count>0?(count%33||33):0;
   Array.from(beadTrack.children).forEach((bead,index)=>{
    const counted=index<completed;
    bead.classList.toggle('is-counted',counted);
    bead.classList.toggle('is-current',counted&&index===completed-1);
   });
  }
  function update(){
   panel.dataset.tasbihTheme=theme;
   themeButtons.forEach(item=>item.button.setAttribute('aria-pressed',item.name===theme?'true':'false'));
   countNode.textContent=count.toLocaleString('ar');
   updateClockUi();
   renderBeads();
   const selectedOption=Array.from(select.options).find(option=>option.value===select.value);
   phraseNode.textContent=selectedOption?optionText(selectedOption):'لم يتم اختيار ذكر بعد';
   if(document.activeElement!==customInput)customInput.value=selectedOption?optionText(selectedOption):'';
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
   panel.classList.toggle('tasbih-choosing-dhikr',expanded);
   dhikrToggle.setAttribute('aria-expanded',expanded?'true':'false');
  }
  function chooseDhikr(value,resetCount){
   const option=Array.from(select.options).find(item=>item.value===value&&(isCustomOption(item)||!isRemovedOfficial(item)));
   if(!option)return;
   if(voiceRequested)stopVoice('توقف العد الصوتي لأن الذكر المختار تغيّر.');
   select.value=option.value;
   voiceTargetPhrase=optionText(option);
   voiceMatchCount=0;
   voiceResultSegments=[];lastRecognitionEvent=null;
   if(resetCount){count=0;resetSessionClock()}
   setDhikrListOpen(false);

   saveAndUpdate();
  }
  function add(amount){
   const nextCount=Math.max(0,Math.min(MAX_COUNT,count+amount));
   if(nextCount>count)startSessionClock();
   count=nextCount;
   saveAndUpdate();
   const counter=panel.querySelector('.anwar-tasbih-counter');
   if(counter&&typeof counter.animate==='function'){
    try{counter.animate([{scale:'1'},{scale:'1.045'},{scale:'1'}],{duration:200,easing:'ease-out'})}catch(error){}
   }
  }
  function setVoiceState(state,message){
   voicePanel.dataset.state=state;
   voiceState.textContent=state==='starting'?'جارٍ تشغيل الميكروفون':state==='listening'?'الميكروفون نشط':state==='error'?'تعذر تشغيل الميكروفون':'';
   voiceStatus.textContent=message||'';
   const active=state==='starting'||state==='listening';
   voiceButton.setAttribute('aria-pressed',active?'true':'false');
   voiceButtonLabel.textContent=active?'إيقاف العد الصوتي':state==='error'?'إعادة المحاولة':'ابدأ العد الصوتي';
  }
  function stopVoice(message){
   const wasActive=voiceActive;
   voiceRequested=false;
   voiceActive=false;
   voiceFallbackPending=false;
   if(voiceRestartTimer!==null){window.clearTimeout(voiceRestartTimer);voiceRestartTimer=null}
   voiceTargetPhrase='';
   voiceMatchCount=0;
   voiceResultSegments=[];lastRecognitionEvent=null;voiceRestartCount=0;
   if(wasActive&&recognition){try{recognition.stop()}catch(error){}}

   setVoiceState('idle',message||'تم إيقاف العد الصوتي.');
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
   const normalizedValue=normalizeDhikrKey(value);
   const removedOfficial=Array.from(select.options).find(option=>!isCustomOption(option)&&normalizeDhikrKey(optionText(option))===normalizedValue&&isRemovedOfficial(option));
   if(removedOfficial){
    const removalKey=removedOfficial.dataset.anwarOfficialId||removedOfficial.value;
    removedOfficialDhikrs=removedOfficialDhikrs.filter(item=>item!==removalKey);
    customInput.value='';
    chooseDhikr(removedOfficial.value,true);
    customStatus.textContent='أُعيد الذكر.';
    return;
   }
   const existing=visibleOptions().find(option=>normalizeDhikrKey(optionText(option))===normalizedValue);
   if(existing){
    const current=Array.from(select.options).find(option=>option.value===select.value);
    const sameSelectedText=!!current&&normalizeDhikrKey(optionText(current))===normalizedValue;
    chooseDhikr(existing.value,!sameSelectedText);
    customStatus.textContent='الذكر موجود.';
    return;
   }
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
   counterTap.focus();
   return true;
  }
  function closePanel(restoreFocus){
   themePicker.hidden=true;
   themeToggle.setAttribute('aria-expanded','false');
   setDhikrListOpen(false);
   if(voiceActive)stopVoice('توقف الاستماع عند إغلاق السبحة.');
   pauseSessionClock();
   panel.hidden=true;
   if(restoreFocus!==false){
    const backButton=$('anwarTasbihBack');
    if(backButton)backButton.focus();
   }
  }

  beadTrack.replaceChildren();
  for(let index=0;index<33;index++){
   const bead=document.createElement('span');
   bead.className='anwar-tasbih-bead';
   bead.style.setProperty('--bead-index',String(index));
   const progress=index/32;
   const angle=(240-(progress*120))*Math.PI/180;
   bead.style.left=(64+44*Math.cos(angle)).toFixed(3)+'%';
   bead.style.top=(42+45*Math.sin(angle)).toFixed(3)+'%';
   beadTrack.appendChild(bead);
  }
  renderOfficialOptions();
  renderCustomOptions();
  const savedOption=Array.from(select.options).find(option=>option.value===initial.dhikr&&(isCustomOption(option)||!isRemovedOfficial(option)));
  if(savedOption)select.value=savedOption.value;
  else if(!visibleOptions().some(option=>option.value===select.value))select.value=firstVisible()?firstVisible().value:'';
  renderClockNumbers();
  renderClockTicks();
  update();
  // Migrate old preferences to the approved emerald style once; future color choices remain saved.
  if(initial.designVersion!==DESIGN_VERSION)persist();

  // The service dashboard opens this standalone panel directly; its counter and preferences remain independent.

  themeToggle.addEventListener('click',()=>{
   themePicker.hidden=!themePicker.hidden;
   themeToggle.setAttribute('aria-expanded',themePicker.hidden?'false':'true');
  });
  themeButtons.forEach(item=>item.button.addEventListener('click',()=>chooseTheme(item.name)));
  dhikrToggle.addEventListener('click',()=>setDhikrListOpen(dhikrList.hidden));
  setDhikrListOpen(false);
  // The oval number itself is an accessible tap target as well as the dedicated button.
  counterTap.setAttribute('aria-label','زيادة التسبيح');
  counterTap.addEventListener('click',()=>add(1));
  counterTap.addEventListener('keydown',event=>{
   if(event.key==='Enter'||event.key===' '){
    event.preventDefault();
    add(1);
   }
  });
  tap.addEventListener('click',()=>add(1));
  minus.addEventListener('click',()=>add(-1));
  reset.addEventListener('click',()=>{count=0;resetSessionClock();saveAndUpdate()});
  customAdd.addEventListener('click',event=>{event.stopPropagation();addCustomDhikr()});
  customInput.addEventListener('click',event=>event.stopPropagation());
  customInput.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();event.stopPropagation();addCustomDhikr()}});
  select.addEventListener('change',()=>{
   if(voiceActive)stopVoice('توقف التسجيل لأن الذكر المختار تغيّر.');
   voiceTargetPhrase=optionText(Array.from(select.options).find(option=>option.value===select.value))||'';
   voiceMatchCount=0;
   count=0;
   resetSessionClock();
   saveAndUpdate();

   setDhikrListOpen(false);
  });
  removeButton.addEventListener('click',()=>{
   const selected=Array.from(select.options).find(option=>option.value===select.value);
   if(!selected)return;
   const custom=isCustomOption(selected);
   const message=custom?'هل تريد حذف هذا الذكر المضاف من قائمتك على هذا الجهاز؟':'هل تريد إزالة هذا الذكر الرسمي من قائمتك على هذا الجهاز فقط؟ يمكنك استعادته لاحقاً.';
   if(!window.confirm(message))return;
   if(voiceActive)stopVoice('توقف العد الصوتي بسبب تعديل قائمة الأذكار.');
   if(custom)customDhikrs=customDhikrs.filter(item=>item!==selected.value);
   else {
    const removalKeys=new Set([selected.dataset&&selected.dataset.anwarOfficialId||selected.value]);
    if(!(selected.dataset&&selected.dataset.anwarOfficialId)){
     const selectedKey=normalizeDhikrKey(optionText(selected));
     Array.from(select.options)
      .filter(option=>option.dataset.anwarOfficialDhikr==='true'&&normalizeDhikrKey(optionText(option))===selectedKey)
      .forEach(option=>removalKeys.add(option.dataset.anwarOfficialId||option.value));
    }
    removalKeys.forEach(key=>{if(!removedOfficialDhikrs.includes(key))removedOfficialDhikrs.push(key)});
   }
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
     setVoiceState('listening','انطق الذكر المختار كاملاً.');
    };
    recognition.onspeechstart=()=>{
     if(!voiceActive)return;
     voiceRestartCount=0;
     setVoiceState('listening','');
    };
    recognition.onspeechend=()=>{
     if(voiceActive)setVoiceState('listening','جارٍ التحقق من الذكر...');
    };
    recognition.onresult=event=>{
     if(!voiceActive||!event||!event.results||event===lastRecognitionEvent)return;
     lastRecognitionEvent=event;
     const results=event.results,incoming=[];
     const resultStart=Number.isInteger(event.resultIndex)?Math.max(0,Math.min(results.length,event.resultIndex)):Math.max(0,results.length-1);
     for(let i=0;i<results.length;i++){
      const result=results[i];
      incoming.push({text:bestSpeechText(result,voiceTargetPhrase),isFinal:!!result.isFinal,source:result});
     }
     const previousAllFinal=voiceResultSegments.length>0&&voiceResultSegments.every(item=>item&&item.isFinal);
     const matchingPrefix=incoming.length>=voiceResultSegments.length&&voiceResultSegments.every((old,index)=>
      old&&incoming[index]&&old.isFinal&&incoming[index].isFinal&&normalizeSpeech(old.text)===normalizeSpeech(incoming[index].text)
     );
     const repeatedSingleBatch=resultStart===0&&previousAllFinal&&incoming.length===1&&voiceResultSegments.length===1&&
      incoming[0].isFinal&&incoming[0].source!==voiceResultSegments[0].source;
     const freshBatch=resultStart===0&&previousAllFinal&&incoming.length>0&&
      (incoming.length<voiceResultSegments.length||(!matchingPrefix&&incoming.length>=voiceResultSegments.length)||repeatedSingleBatch);
     if(freshBatch)voiceResultSegments.push(...incoming);
     else{
      for(let i=resultStart;i<incoming.length;i++)voiceResultSegments[i]=incoming[i];
      voiceResultSegments.length=incoming.length;
     }
     const finalText=voiceResultSegments.filter(item=>item&&item.isFinal&&item.text).map(item=>item.text).join(' ').trim();
     const interimText=voiceResultSegments.filter(item=>item&&!item.isFinal&&item.text).map(item=>item.text).join(' ').trim();
     const liveText=[finalText,interimText].filter(Boolean).join(' ').trim();
     if(!liveText)return;
     const totalMatches=countPhraseMatches(liveText,voiceTargetPhrase);
     const newMatches=Math.max(0,totalMatches-voiceMatchCount);
     if(newMatches>0){
      voiceMatchCount=totalMatches;
      add(newMatches);
      setVoiceState('listening','تم احتساب '+newMatches.toLocaleString('ar')+' تسبيحة.');
     }else if(totalMatches===0&&finalText){
      setVoiceState('listening','لم يكتمل الذكر المختار بعد.');
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
      voiceFallbackPending=true;
      setVoiceState('starting','لغة التعرف الأولى غير متاحة؛ نجرب إعداداً عربياً آخر.');
      return;
     }
     voiceActive=false;
     if(code==='no-speech'){
      setVoiceState('starting','لم نلتقط الذكر بعد؛ سنعيد الاستماع تلقائياً.');
      return;
     }
     if(code==='network'){
      setVoiceState('starting','انقطع اتصال خدمة التعرف الصوتي؛ سنحاول مجدداً.');
      return;
     }
     voiceRequested=false;
     voiceTargetPhrase='';
     const messages={
      'not-allowed':'لم يُسمح بالميكروفون. افتح إعدادات الموقع واسمح باستخدامه.',
      'service-not-allowed':'خدمة التعرف الصوتي محجوبة من المتصفح أو الجهاز.',
      'audio-capture':'لم يتم العثور على ميكروفون صالح.',
      'no-speech':'لم نلتقط الذكر. تحقق من إذن الميكروفون ثم حاول مجدداً.',
      'network':'تعذر الاتصال بخدمة التعرف الصوتي. تحقق من اتصال الإنترنت.',
      'aborted':'أُوقف العد الصوتي.',
      'language-not-supported':'العربية غير مدعومة من خدمة التعرف الصوتي على هذا الجهاز.',
      'bad-grammar':'تعذر تحليل الذكر المنطوق؛ حاول مرة أخرى.'
     };
     setVoiceState('error',messages[code]||'حدث خطأ في العد الصوتي. حاول مرة أخرى.');
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
      setVoiceState('idle','انتهى العد الصوتي.');
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
  updateClockUi();
  window.setInterval(()=>{
   const now=Date.now();
   if(document.visibilityState==='hidden'){
    pauseSessionClock();updateClockUi(now);return;
   }
   updateClockUi(now);
   if(sessionStartedAt!==null){
    const liveElapsed=currentElapsedMs(now);
    if(liveElapsed-lastPersistedElapsed>=5000){
     elapsedMs=liveElapsed;sessionStartedAt=now;lastPersistedElapsed=elapsedMs;persist();
    }
   }
  },250);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')pauseSessionClock()});
  window.addEventListener('pagehide',pauseSessionClock);

  if(preferences&&typeof preferences.subscribe==='function'){
   preferences.subscribe(saved=>{
    if(writingPreferences)return;
    const value=saved&&saved.tasbih?saved.tasbih:{};
    count=Number.isSafeInteger(value.count)?Math.max(0,value.count):0;
    elapsedMs=Number.isFinite(value.elapsedMs)?Math.max(0,Math.min(MAX_ELAPSED_MS,value.elapsedMs)):0;
    sessionStartedAt=null;lastPersistedElapsed=elapsedMs;
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