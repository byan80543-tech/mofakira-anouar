/* Prayer times and adhan for Anwar notebook.
 * Prayer data: AlAdhan API. Default adhan recording: Wikimedia Commons, CC0 1.0.
 * No GPS permission is requested; only the user-entered city/country are sent to the API.
 */
(function(){
 'use strict';
 if(window.__anwarPrayerTimesReady)return;
 const panel=document.getElementById('rd');
 if(!panel)return;
 window.__anwarPrayerTimesReady=true;

 const API='https://api.aladhan.com/v1';
 const ADHAN_URL='https://upload.wikimedia.org/wikipedia/commons/e/e7/Adhan.ogg';
 const SETTINGS_KEY='anwar_prayer_settings_v1';
 const PLAYED_KEY='anwar_prayer_last_adhan_v1';
 const PRAYERS=[
  {key:'Fajr',name:'الفجر'},
  {key:'Dhuhr',name:'الظهر'},
  {key:'Asr',name:'العصر'},
  {key:'Maghrib',name:'المغرب'},
  {key:'Isha',name:'العشاء'}
 ];
 const COUNTRY_ALIASES={
  'المغرب':'Morocco','المملكة المغربية':'Morocco',
  'الجزائر':'Algeria','تونس':'Tunisia','مصر':'Egypt',
  'السعودية':'Saudi Arabia','المملكة العربية السعودية':'Saudi Arabia',
  'الإمارات':'United Arab Emirates','الامارات':'United Arab Emirates',
  'قطر':'Qatar','الكويت':'Kuwait','البحرين':'Bahrain',
  'عمان':'Oman','سلطنة عمان':'Oman','الأردن':'Jordan',
  'تركيا':'Turkey','فرنسا':'France','ألمانيا':'Germany',
  'بريطانيا':'United Kingdom','المملكة المتحدة':'United Kingdom',
  'الولايات المتحدة':'United States','كندا':'Canada',
  'باكستان':'Pakistan','الهند':'India','ماليزيا':'Malaysia',
  'إندونيسيا':'Indonesia','إندونيسيا':'Indonesia'
 };
 const COUNTRY_AR={
  Morocco:'المغرب',Algeria:'الجزائر',Tunisia:'تونس',Egypt:'مصر',
  'Saudi Arabia':'السعودية','United Arab Emirates':'الإمارات',
  Qatar:'قطر',Kuwait:'الكويت',Bahrain:'البحرين',Oman:'عمان',
  Jordan:'الأردن',Turkey:'تركيا',France:'فرنسا',Germany:'ألمانيا',
  'United Kingdom':'بريطانيا','United States':'الولايات المتحدة',
  Canada:'كندا',Pakistan:'باكستان',India:'الهند',Malaysia:'ماليزيا',
  Indonesia:'إندونيسيا'
 };
 const METHOD_OPTIONS=[
  ['auto','تلقائي حسب البلد'],
  ['21','المغرب — وزارة الأوقاف'],
  ['19','الجزائر'],
  ['18','تونس'],
  ['4','أم القرى — مكة'],
  ['5','الهيئة المصرية العامة للمساحة'],
  ['3','رابطة العالم الإسلامي'],
  ['2','الجمعية الإسلامية لأمريكا الشمالية'],
  ['1','جامعة العلوم الإسلامية — كراتشي'],
  ['13','الشؤون الدينية — تركيا'],
  ['12','اتحاد المنظمات الإسلامية — فرنسا']
 ];
 function readSettings(){
  const defaults={country:'Morocco',city:'Meknes',method:'21',school:'0',enabled:false,volume:0.9,timezone:''};
  try{
   const value=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}');
   return {
    country:typeof value.country==='string'&&value.country.trim()?value.country.trim().slice(0,90):defaults.country,
    city:typeof value.city==='string'&&value.city.trim()?value.city.trim().slice(0,90):defaults.city,
    method:METHOD_OPTIONS.some(item=>item[0]===String(value.method))?String(value.method):defaults.method,
    school:value.school==='1'?'1':'0',
    enabled:value.enabled===true,
    volume:Number.isFinite(Number(value.volume))?Math.max(0,Math.min(1,Number(value.volume))):defaults.volume,
    timezone:typeof value.timezone==='string'?value.timezone.slice(0,90):''
   };
  }catch(_e){return defaults;}
 }
 let settings=readSettings();
 let todayData=null,tomorrowData=null,timeZone=settings.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
 let loading=false,loadToken=0,lastTick=Date.now(),lastShownKey='',lastDateCheck='';
 let refreshTimer=null;
 const el=(tag,className,text)=>{
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(text!==undefined)node.textContent=text;
  return node;
 };
 const style=el('style');
 style.textContent=[
  '.anwar-prayer-card{display:grid;gap:10px;padding:12px;border:1px solid #c9a96a;border-radius:14px;background:linear-gradient(145deg,#fff9e9,var(--bg));color:var(--tx);box-shadow:0 3px 12px rgba(8,38,77,.07)}',
  '.anwar-prayer-head{display:flex;align-items:center;justify-content:space-between;gap:8px}',
  '.anwar-prayer-head strong{font-family:"Aref Ruqaa",Amiri,serif;font-size:18px;color:#173d5c}',
  '.anwar-prayer-head small,.anwar-prayer-date,.anwar-prayer-note{font-size:10px;color:var(--mu);line-height:1.7}',
  '.anwar-prayer-next{display:grid;grid-template-columns:1fr auto;align-items:center;gap:4px 10px;padding:10px 12px;border-radius:11px;background:linear-gradient(115deg,#0b3159,#1c6077);color:#fff}',
  '.anwar-prayer-next small{font-size:11px;color:#f1dca9}.anwar-prayer-next strong{font-size:17px;color:#fff2c5}.anwar-prayer-next span{font-size:12px;color:#fff;direction:ltr;text-align:left;font-variant-numeric:tabular-nums}',
  '.anwar-prayer-times{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px}',
  '.anwar-prayer-time{display:grid;gap:3px;min-width:0;padding:8px 3px;text-align:center;border:1px solid var(--bd);border-radius:9px;background:var(--sf)}',
  '.anwar-prayer-time b{font-size:10px;color:var(--mu);white-space:nowrap}.anwar-prayer-time strong{font-size:12px;color:var(--ac);direction:ltr;font-variant-numeric:tabular-nums}',
  '.anwar-prayer-time.is-next{border-color:#c9a96a;background:#fff1c8;box-shadow:inset 0 0 0 1px #e1c77f}',
  '.anwar-prayer-settings{border-top:1px solid #d9c99e;padding-top:8px}',
  '.anwar-prayer-settings summary{cursor:pointer;color:var(--ac);font-size:12px;font-weight:700;padding:3px 0}',
  '.anwar-prayer-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding-top:9px}',
  '.anwar-prayer-field{display:grid;gap:4px;min-width:0;font-size:11px;color:var(--mu)}',
  '.anwar-prayer-field input,.anwar-prayer-field select{width:100%;min-width:0;min-height:38px;padding:7px 9px;border:1px solid var(--bd);border-radius:8px;background:var(--sf);color:var(--tx)}',
  '.anwar-prayer-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}',
  '.anwar-prayer-actions button{min-height:36px;padding:7px 11px;border:1px solid var(--bd);border-radius:8px;background:var(--sf);color:var(--tx);font-size:11px;font-weight:700}',
  '.anwar-prayer-actions .primary{border-color:#173d5c;background:#173d5c;color:#fff}',
  '.anwar-prayer-toggle{display:flex;align-items:center;gap:8px;margin-top:9px;padding:9px;border:1px solid var(--bd);border-radius:9px;background:var(--sf);font-size:12px;color:var(--tx)}',
  '.anwar-prayer-toggle input{width:18px;height:18px;accent-color:var(--ac)}',
  '.anwar-prayer-volume{display:grid;grid-template-columns:auto 1fr;gap:8px;align-items:center;margin-top:8px;font-size:11px;color:var(--mu)}',
  '.anwar-prayer-volume input{width:100%;accent-color:var(--ac)}',
  '.anwar-prayer-status{font-size:11px;line-height:1.7;color:var(--ac);min-height:18px}',
  '.anwar-prayer-links{display:flex;gap:12px;flex-wrap:wrap;font-size:10px}',
  '.anwar-prayer-links a{color:var(--ac);text-decoration:none}',
  '@media(max-width:420px){.anwar-prayer-card{padding:10px}.anwar-prayer-times{gap:3px}.anwar-prayer-time{padding:7px 1px}.anwar-prayer-time b{font-size:9px}.anwar-prayer-time strong{font-size:11px}.anwar-prayer-fields{grid-template-columns:1fr 1fr}}',
  '@media(prefers-color-scheme:dark){.anwar-prayer-card{background:linear-gradient(145deg,#2f3029,var(--bg))}.anwar-prayer-time.is-next{background:#55472b;color:#fff}}'
 ].join('');
 document.head.append(style);

 const card=el('section','anwar-prayer-card');
 card.id='anwarPrayerCard';
 card.setAttribute('aria-label','مواقيت الصلاة والأذان');
 const head=el('div','anwar-prayer-head');
 const title=el('strong','','مواقيت الصلاة');
 const locationLabel=el('small','','المغرب · مكناس');
 head.append(title,locationLabel);
 const nextBox=el('div','anwar-prayer-next');
 const nextCopy=el('div');
 const nextLabel=el('small','','الصلاة القادمة');
 const nextName=el('strong','','—');
 nextCopy.append(nextLabel,nextName);
 const countdown=el('span','','--:--:--');
 nextBox.append(nextCopy,countdown);
 const timesGrid=el('div','anwar-prayer-times');
 const dateLine=el('div','anwar-prayer-date','جارٍ تحميل مواقيت المدينة…');
 const details=el('details','anwar-prayer-settings');
 const summary=el('summary','','إعداد المدينة والتنبيه الصوتي');
 const fields=el('div','anwar-prayer-fields');
 function makeField(label,control){
  const wrap=el('label','anwar-prayer-field',label);wrap.append(control);return wrap;
 }
 const countryInput=el('input');countryInput.id='anwarPrayerCountry';countryInput.type='text';countryInput.autocomplete='country-name';countryInput.maxLength=90;countryInput.value=settings.country;
 const cityInput=el('input');cityInput.id='anwarPrayerCity';cityInput.type='text';cityInput.autocomplete='address-level2';cityInput.maxLength=90;cityInput.value=settings.city;
 const methodSelect=el('select');methodSelect.id='anwarPrayerMethod';
 METHOD_OPTIONS.forEach(item=>{const op=el('option','',item[1]);op.value=item[0];methodSelect.append(op)});
 methodSelect.value=settings.method;
 const schoolSelect=el('select');schoolSelect.id='anwarPrayerSchool';
 [['0','العصر القياسي (شافعي / مالكي)'],['1','العصر الحنفي']].forEach(item=>{const op=el('option','',item[1]);op.value=item[0];schoolSelect.append(op)});
 schoolSelect.value=settings.school;
 fields.append(
  makeField('الدولة',countryInput),
  makeField('المدينة',cityInput),
  makeField('طريقة حساب المواقيت',methodSelect),
  makeField('حساب وقت العصر',schoolSelect)
 );
 const refreshButton=el('button','primary','تحديث المواقيت');
 refreshButton.type='button';
 const testButton=el('button','','تجربة الأذان');
 testButton.type='button';
 const actions=el('div','anwar-prayer-actions');actions.append(refreshButton,testButton);
 const toggleLabel=el('label','anwar-prayer-toggle');
 const enabledInput=el('input');enabledInput.type='checkbox';enabledInput.checked=settings.enabled;
 const enabledText=el('span','','تشغيل الأذان تلقائيًا عند دخول وقت الصلاة');
 toggleLabel.append(enabledInput,enabledText);
 const volumeWrap=el('label','anwar-prayer-volume');
 const volumeLabel=el('span','','مستوى صوت الأذان');
 const volumeInput=el('input');volumeInput.type='range';volumeInput.min='0';volumeInput.max='1';volumeInput.step='0.05';volumeInput.value=String(settings.volume);
 volumeWrap.append(volumeLabel,volumeInput);
 const status=el('div','anwar-prayer-status','اختر مدينتك ثم فعّل الأذان بعد اختبار الصوت.');
 status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const links=el('div','anwar-prayer-links');
 const apiLink=el('a','','مصدر المواقيت');
 apiLink.href='https://aladhan.com/prayer-times-api';apiLink.target='_blank';apiLink.rel='noopener noreferrer';
 const audioLink=el('a','','مصدر تسجيل الأذان · CC0');
 audioLink.href='https://commons.wikimedia.org/wiki/File:Adhan.ogg';audioLink.target='_blank';audioLink.rel='noopener noreferrer';
 links.append(apiLink,audioLink);
 details.append(summary,fields,actions,toggleLabel,volumeWrap,status,links);
 const audio=document.createElement('audio');
 audio.id='anwarPrayerAdhanAudio';audio.preload='none';audio.hidden=true;audio.controls=false;audio.setAttribute('playsinline','');audio.setAttribute('aria-label','صوت الأذان');
 audio.src=ADHAN_URL;audio.volume=settings.volume;
 card.append(head,nextBox,timesGrid,dateLine,details,audio);
 const insertBefore=panel.querySelector('.radio-section-title');
 if(insertBefore)panel.insertBefore(card,insertBefore);else panel.append(card);

 function persist(){
  try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings))}catch(_e){}
 }
 function countryForApi(value){
  const trimmed=String(value||'').trim();
  return COUNTRY_ALIASES[trimmed]||trimmed;
 }
 function countryForDisplay(value){
  const api=countryForApi(value);
  return COUNTRY_AR[api]||trimmedCountry(value);
 }
 function trimmedCountry(value){return String(value||'').trim()}
 function dateParts(date,timeZone){
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const values={};parts.forEach(part=>{values[part.type]=part.value});
  return {day:values.day,month:values.month,year:values.year};
 }
 function dateString(date,timeZone){
  const p=dateParts(date,timeZone);return p.day+'-'+p.month+'-'+p.year;
 }
 function addDay(dateText){
  const p=String(dateText).split('-').map(Number);
  if(p.length!==3||p.some(v=>!Number.isFinite(v)))throw new Error('تاريخ المواقيت غير صالح.');
  const d=new Date(Date.UTC(p[2],p[1]-1,p[0]+1));
  return String(d.getUTCDate()).padStart(2,'0')+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+d.getUTCFullYear();
 }
 function safeTime(value){
  const match=String(value||'').match(/(?:^|\\s)(\\d{1,2}):(\\d{2})/);
  if(!match)return null;
  const hour=Number(match[1]),minute=Number(match[2]);
  if(hour>23||minute>59)return null;
  return String(hour).padStart(2,'0')+':'+String(minute).padStart(2,'0');
 }
 function timeInZone(dateText,timeText,zone){
  const time=safeTime(timeText);if(!time)return NaN;
  const date=dateText.split('-').map(Number),clock=time.split(':').map(Number);
  const target=Date.UTC(date[2],date[1]-1,date[0],clock[0],clock[1],0);
  let guess=target;
  for(let i=0;i<3;i++){
   const parts=new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(guess));
   const values={};parts.forEach(part=>{values[part.type]=part.value});
   const represented=Date.UTC(Number(values.year),Number(values.month)-1,Number(values.day),Number(values.hour),Number(values.minute),Number(values.second));
   guess=target-(represented-guess);
  }
  return guess;
 }
 async function fetchDay(dateText,token){
  const url=new URL(API+'/timingsByCity/'+dateText);
  url.searchParams.set('city',settings.city.trim());
  url.searchParams.set('country',countryForApi(settings.country));
  if(settings.method!=='auto')url.searchParams.set('method',settings.method);
  url.searchParams.set('school',settings.school);
  const response=await fetch(url.href,{method:'GET',headers:{'Accept':'application/json'},cache:'no-store'});
  if(!response.ok)throw new Error('تعذّر جلب المواقيت (HTTP '+response.status+').');
  const json=await response.json();
  if(token!==loadToken)return null;
  if(!json||json.code!==200||!json.data||!json.data.timings)throw new Error('لم يتعرف مصدر المواقيت على هذه المدينة. تحقق من كتابة المدينة والدولة.');
  return json.data;
 }
 function updateHeader(){
  locationLabel.textContent=countryForDisplay(settings.country)+' · '+settings.city;
 }
 function renderTimes(){
  if(!todayData)return;
  timesGrid.replaceChildren();
  PRAYERS.forEach(prayer=>{
   const time=safeTime(todayData.timings[prayer.key]);
   const item=el('div','anwar-prayer-time');
   item.dataset.prayer=prayer.key;
   item.append(el('b','',prayer.name),el('strong','',time||'—'));
   timesGrid.append(item);
  });
  const greg=todayData.date&&todayData.date.gregorian?todayData.date.gregorian.date:'';
  const hijri=todayData.date&&todayData.date.hijri?todayData.date.hijri.date:'';
  dateLine.textContent=(greg?'التاريخ الميلادي: '+greg:'')+(hijri?' · الهجري: '+hijri:'')+' · '+timeZone;
  updateHeader();
 }
 function eventList(){
  const result=[];
  [[todayData,false],[tomorrowData,true]].forEach(entry=>{
   const data=entry[0];if(!data||!data.timings||!data.date||!data.date.gregorian)return;
   const day=data.date.gregorian.date;
   PRAYERS.forEach(prayer=>{
    const at=timeInZone(day,data.timings[prayer.key],timeZone);
    if(Number.isFinite(at))result.push({key:prayer.key,name:prayer.name,at:at,date:day});
   });
  });
  return result.sort((a,b)=>a.at-b.at);
 }
 function timeLabel(timestamp){
  try{return new Intl.DateTimeFormat('ar-MA',{timeZone:timeZone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(timestamp))}
  catch(_e){return new Date(timestamp).toLocaleTimeString('ar-MA',{hour:'2-digit',minute:'2-digit'})}
 }
 function formatCountdown(milliseconds){
  const total=Math.max(0,Math.floor(milliseconds/1000));
  const hours=Math.floor(total/3600),minutes=Math.floor((total%3600)/60),seconds=total%60;
  return [hours,minutes,seconds].map(n=>String(n).padStart(2,'0')).join(':');
 }
 function setStatus(message){status.textContent=message}
 function alreadyPlayed(key){
  try{return localStorage.getItem(PLAYED_KEY)===key}catch(_e){return false}
 }
 function markPlayed(key){
  try{localStorage.setItem(PLAYED_KEY,key)}catch(_e){}
 }
 async function playAdhan(prayer,isTest){
  if(!isTest&&!settings.enabled)return;
  if(!audio.paused&&!audio.ended){if(isTest)setStatus('الأذان يعمل الآن بالفعل.');return;}
  audio.volume=settings.volume;
  try{audio.currentTime=0}catch(_e){}
  try{
   const attempt=audio.play();
   if(attempt&&typeof attempt.then==='function')await attempt;
   setStatus(isTest?'بدأ اختبار صوت الأذان.':'دخل وقت صلاة '+prayer+'؛ بدأ الأذان وخُفّض صوت إذاعة القرآن مؤقتًا.');
  }catch(error){
   const blocked=error&&error.name==='NotAllowedError';
   setStatus(blocked?'المتصفح منع التشغيل التلقائي. اضغط «تجربة الأذان» مرة واحدة للسماح بالصوت.':'تعذّر تشغيل الأذان. تحقق من اتصال الإنترنت ثم جرّب الصوت يدويًا.');
  }
 }
 audio.addEventListener('ended',()=>setStatus('انتهى الأذان؛ عاد صوت الإذاعة إلى مستواه السابق.'));
 audio.addEventListener('error',()=>setStatus('تعذّر تحميل تسجيل الأذان من المصدر الصوتي.'));
 function tick(){
  const now=Date.now(),events=eventList();
  if(settings.enabled){
   events.forEach(event=>{
    const key=event.date+'|'+event.key+'|'+settings.city+'|'+settings.country;
    if(lastTick<event.at&&now>=event.at&&now-event.at<=180000&&!alreadyPlayed(key)){
     markPlayed(key);playAdhan(event.name,false);
    }
   });
  }
  lastTick=now;
  const next=events.find(event=>event.at>now);
  if(next){
   nextName.textContent=next.name;
   countdown.textContent=formatCountdown(next.at-now);
   nextLabel.textContent='الصلاة القادمة · '+timeLabel(next.at);
   timesGrid.querySelectorAll('.anwar-prayer-time').forEach(item=>item.classList.toggle('is-next',item.dataset.prayer===next.key&&next.date===(todayData&&todayData.date&&todayData.date.gregorian&&todayData.date.gregorian.date)));
  }else{
   nextName.textContent='—';countdown.textContent='--:--:--';
  }
  if(todayData&&timeZone){
   const todayHere=dateString(new Date(now),timeZone);
   if(todayHere!==lastDateCheck&&!loading){lastDateCheck=todayHere;refreshTimes(true);}
  }
 }
 async function refreshTimes(silent){
  const token=++loadToken;
  loading=true;
  if(!silent)setStatus('جارٍ تحديث مواقيت المدينة…');
  refreshButton.disabled=true;
  try{
   if(!settings.city.trim()||!settings.country.trim())throw new Error('أدخل اسم الدولة والمدينة أولًا.');
   const initialZone=settings.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
   let requestedDate=dateString(new Date(),initialZone);
   let data=await fetchDay(requestedDate,token);
   if(token!==loadToken)return;
   const zone=data.meta&&data.meta.timezone?String(data.meta.timezone):initialZone;
   const cityDate=dateString(new Date(),zone);
   if(data.date&&data.date.gregorian&&data.date.gregorian.date!==cityDate){
    data=await fetchDay(cityDate,token);
    if(token!==loadToken)return;
   }
   timeZone=zone;settings.timezone=zone;
   todayData=data;
   const todayText=data.date.gregorian.date;
   const tomorrowText=addDay(todayText);
   tomorrowData=await fetchDay(tomorrowText,token);
   if(token!==loadToken)return;
   persist();renderTimes();lastDateCheck=todayText;
   if(!silent)setStatus('تم تحديث المواقيت. فعّل الأذان واختبر الصوت مرة للسماح بالتشغيل التلقائي.');
   tick();
  }catch(error){
   if(token===loadToken){
    if(!todayData)dateLine.textContent='لم تُحمّل المواقيت بعد.';
    setStatus(error&&error.message?error.message:'تعذّر تحديث المواقيت. تحقق من الاتصال والمدينة.');
   }
  }finally{
   if(token===loadToken){loading=false;refreshButton.disabled=false;}
  }
 }
 refreshButton.addEventListener('click',()=>{
  settings.country=countryInput.value.trim();settings.city=cityInput.value.trim();
  settings.method=methodSelect.value;settings.school=schoolSelect.value;
  persist();lastTick=Date.now();refreshTimes(false);
 });
 enabledInput.addEventListener('change',()=>{
  settings.enabled=enabledInput.checked;persist();
  if(settings.enabled)setStatus('تم تفعيل التنبيه. اختبر الصوت الآن؛ التشغيل التلقائي يظل خاضعًا لسماح المتصفح.');
  else{if(!audio.paused)audio.pause();setStatus('تم إيقاف الأذان التلقائي.');}
 });
 volumeInput.addEventListener('input',()=>{
  settings.volume=Math.max(0,Math.min(1,Number(volumeInput.value)||0));audio.volume=settings.volume;persist();
 });
 testButton.addEventListener('click',()=>playAdhan('اختبار',true));
 countryInput.addEventListener('change',()=>{
  if(settings.country==='Morocco'&&countryInput.value.trim()!=='Morocco'&&methodSelect.value==='21')methodSelect.value='auto';
 });
 if(todayData)renderTimes();else timesGrid.replaceChildren(...PRAYERS.map(prayer=>{
  const item=el('div','anwar-prayer-time');item.append(el('b','',prayer.name),el('strong','','—'));return item;
 }));
 updateHeader();
 lastTick=Date.now();
 refreshTimes(false);
 window.setInterval(tick,1000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){tick();}});
 window.addEventListener('focus',tick);
})();