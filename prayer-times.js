/* Prayer times and adhan for Anwar notebook.
 * Prayer data: AlAdhan API. Default adhan recording: Wikimedia Commons, CC0 1.0.
 * No GPS permission is requested; the chosen city, country and calculation settings are sent to the timings API.
 */
(function(){
 'use strict';
 if(window.__anwarPrayerTimesReady)return;
 const panel=document.getElementById('rd');
 if(!panel)return;
 window.__anwarPrayerTimesReady=true;

 const API='https://api.aladhan.com/v1';
 const VOICES=[
  {key:'calm',label:'أذان هادئ · الافتراضي',url:'https://upload.wikimedia.org/wikipedia/commons/b/b0/Beautiful_adhan.ogg',page:'https://commons.wikimedia.org/wiki/File:Beautiful_adhan.ogg',credit:'Adam-synagda',license:'CC0 1.0'},
  {key:'morocco',label:'المغرب · مسجد الحسن الثاني',url:'https://upload.wikimedia.org/wikipedia/commons/transcoded/9/9c/Llamada_a_oraci%C3%B3n_Mezquita_Hassan_II.wav/Llamada_a_oraci%C3%B3n_Mezquita_Hassan_II.wav.mp3',page:'https://commons.wikimedia.org/wiki/File:Llamada_a_oraci%C3%B3n_Mezquita_Hassan_II.wav',credit:'Fraguando',license:'CC BY-SA 4.0',note:'تسجيل ميداني مع أجواء المسجد والمحيط'},
  {key:'madina',label:'المسجد النبوي · تسجيل ميداني',url:'https://upload.wikimedia.org/wikipedia/commons/7/7c/33937_ejaz215_call-to-prayer-from-the-prophet-s-mo.ogg',page:'https://commons.wikimedia.org/wiki/File:33937_ejaz215_call-to-prayer-from-the-prophet-s-mo.ogg',credit:'ejaz215',license:'CC BY 3.0'},
  {key:'maahur',label:'أذان فارسي · مقام ماهور',url:'https://upload.wikimedia.org/wikipedia/commons/a/ae/AzaanMaahur.ogg',page:'https://commons.wikimedia.org/wiki/File:AzaanMaahur.ogg',credit:'Saeed Hatamzadeh-Varmazyar',license:'CC BY-SA 4.0'}
 ];
 const DEFAULT_VOICE='calm';
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
  'إندونيسيا':'Indonesia'
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
  const defaults={country:'Morocco',city:'Meknes',method:'21',school:'0',enabled:false,volume:0.9,timezone:'',voice:DEFAULT_VOICE};
  try{
   const value=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}');
   return {
    country:typeof value.country==='string'&&value.country.trim()?value.country.trim().slice(0,90):defaults.country,
    city:typeof value.city==='string'&&value.city.trim()?value.city.trim().slice(0,90):defaults.city,
    method:METHOD_OPTIONS.some(item=>item[0]===String(value.method))?String(value.method):defaults.method,
    school:value.school==='1'?'1':'0',
    enabled:value.enabled===true,
    volume:Number.isFinite(Number(value.volume))?Math.max(0,Math.min(1,Number(value.volume))):defaults.volume,
    timezone:typeof value.timezone==='string'?value.timezone.slice(0,90):'',
    voice:VOICES.some(item=>item.key===value.voice)?value.voice:DEFAULT_VOICE
   };
  }catch(_e){return defaults;}
 }
 let settings=readSettings();
 function validTimeZone(value){try{new Intl.DateTimeFormat('en',{timeZone:value}).format();return value;}catch(_e){return Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';}}
 let todayData=null,tomorrowData=null,timeZone=validTimeZone(settings.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC');
 let loading=false,loadToken=0,lastTick=Date.now(),lastDateCheck='';
 let pendingAdhanKey='',lastAutoAttemptAt=0;
 const el=(tag,className,text)=>{
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(text!==undefined)node.textContent=text;
  return node;
 };
 const style=el('style');
 style.textContent=[
  '.anwar-prayer-card{display:grid;gap:10px;padding:12px;border:1px solid #c9a96a;border-radius:14px;background:linear-gradient(145deg,var(--sf),var(--bg));color:var(--tx);box-shadow:0 3px 12px rgba(8,38,77,.07)}',
  '.anwar-prayer-head{display:flex;align-items:center;justify-content:space-between;gap:8px}',
  '.anwar-prayer-head strong{font-family:"Aref Ruqaa",Amiri,serif;font-size:18px;color:var(--ac)}',
  '.anwar-prayer-head small,.anwar-prayer-date,.anwar-prayer-note{font-size:10px;color:var(--mu);line-height:1.7}',
  '.anwar-prayer-next{display:grid;grid-template-columns:1fr auto;align-items:center;gap:4px 10px;padding:10px 12px;border-radius:11px;background:linear-gradient(115deg,#0b3159,#1c6077);color:#fff}',
  '.anwar-prayer-next small{font-size:11px;color:#f1dca9;line-height:1.6}.anwar-prayer-next strong{font-size:17px;color:#fff2c5}.anwar-prayer-next-copy,.anwar-prayer-countdown{display:grid;gap:3px;min-width:0}.anwar-prayer-next-when{color:#fff!important}.anwar-prayer-countdown{justify-items:end;text-align:right}.anwar-prayer-next span{font-size:18px;font-weight:700;color:#fff;direction:ltr;text-align:left;font-variant-numeric:tabular-nums;white-space:nowrap}',
  '.anwar-prayer-times{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px}',
  '.anwar-prayer-time{display:grid;gap:3px;min-width:0;padding:8px 3px;text-align:center;border:1px solid var(--bd);border-radius:9px;background:var(--sf)}',
  '.anwar-prayer-time b{font-size:10px;color:var(--mu);white-space:nowrap}.anwar-prayer-time strong{font-size:12px;color:var(--ac);direction:ltr;font-variant-numeric:tabular-nums}',
  '.anwar-prayer-time.is-next{border-color:#c9a96a;background:var(--ac2);box-shadow:inset 0 0 0 1px #e1c77f}',
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
  ''
 ].join('');
 style.textContent += [
  '.anwar-prayer-card{gap:7px;padding:10px 11px}',
  '.anwar-prayer-head strong{font-size:17px}',
  '.anwar-prayer-next{padding:8px 10px;gap:3px 8px}',
  '.anwar-prayer-next small{font-size:10px}',
  '.anwar-prayer-next strong{font-size:16px}',
  '.anwar-prayer-next span{font-size:16px}',
  '.anwar-prayer-time{gap:2px;padding:6px 2px}',
  '.anwar-prayer-time b{font-size:9px}',
  '.anwar-prayer-time strong{font-size:11px}',
  '.anwar-prayer-date{padding:2px 1px;min-height:16px}',
  '.anwar-prayer-info{border-top:1px solid #d9c99e;padding-top:4px}',
  '.anwar-prayer-info summary{cursor:pointer;list-style-position:inside;color:var(--mu);font-size:10px;line-height:1.6;padding:2px 0}',
  '.anwar-prayer-info .anwar-prayer-note{display:block;margin:0;padding:6px 2px 2px;font-size:10px;line-height:1.75}',
  '.anwar-prayer-settings{padding-top:6px}',
  '.anwar-prayer-settings summary{padding:2px 0}',
  '.anwar-prayer-next[hidden]{display:none!important}',
  '@media(max-width:420px){.anwar-prayer-card{gap:6px;padding:9px}.anwar-prayer-next{padding:7px 9px}.anwar-prayer-time{padding:6px 1px}.anwar-prayer-time b{font-size:9px}.anwar-prayer-time strong{font-size:10px}}',
  ''
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
 const nextCopy=el('div','anwar-prayer-next-copy');
 const nextLabel=el('small','','الصلاة القادمة');
 const nextName=el('strong','','');
 const nextWhen=el('small','anwar-prayer-next-when','');
 nextCopy.append(nextLabel,nextName,nextWhen);
 const countdownCopy=el('div','anwar-prayer-countdown');
 const countdownLabel=el('small','','الوقت المتبقي حتى دخول الصلاة');
 const countdown=el('span','','');
 countdownCopy.append(countdownLabel,countdown);
 nextBox.append(nextCopy,countdownCopy);
 nextBox.hidden=true;
 const timesGrid=el('div','anwar-prayer-times');
 const dateLine=el('div','anwar-prayer-date','جارٍ تحميل مواقيت المدينة…');
 const privacyLine=el('small','anwar-prayer-note','لا نطلب موقعك الجغرافي؛ نرسل المدينة والدولة وتاريخ المواقيت وطريقة الحساب واختيار العصر إلى خدمة المواقيت. وقد تختلف الدقائق عن توقيت مسجدك المحلي.');
 const infoDetails=el('details','anwar-prayer-info');
 const infoSummary=el('summary','','معلومات المواقيت وخصوصية الموقع');
 infoDetails.append(infoSummary,privacyLine);
 const details=el('details','anwar-prayer-settings');
 const summary=el('summary','','إعدادات المواقيت والأذان');
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
 const voiceSelect=el('select');voiceSelect.id='anwarPrayerVoice';
 VOICES.forEach(voice=>{const option=el('option','',voice.label);option.value=voice.key;voiceSelect.append(option)});
 voiceSelect.value=settings.voice;
 fields.append(
  makeField('الدولة',countryInput),
  makeField('المدينة',cityInput),
  makeField('طريقة حساب المواقيت',methodSelect),
  makeField('طريقة حساب العصر',schoolSelect),
  makeField('صوت الأذان',voiceSelect)
 );
 const refreshButton=el('button','primary','تحديث مواقيت الصلاة');
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
 const status=el('div','anwar-prayer-status','اختر مدينتك، ثم جرّب الأذان واسمح للمتصفح بتشغيل الصوت قبل تفعيل التنبيه التلقائي.');
 status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const links=el('div','anwar-prayer-links');
 const apiLink=el('a','','مصدر المواقيت');
 apiLink.href='https://aladhan.com/prayer-times-api';apiLink.target='_blank';apiLink.rel='noopener noreferrer';
 const audioLink=el('a','','مصدر التسجيل');
 audioLink.target='_blank';audioLink.rel='noopener noreferrer';
 const qarawiyyinLink=el('a','','أذان القرويين');
 qarawiyyinLink.href='https://www.youtube.com/watch?v=jd69M_K9DTI';qarawiyyinLink.target='_blank';qarawiyyinLink.rel='noopener noreferrer';
 qarawiyyinLink.title='استماع خارجي إلى أذان جامع القرويين بصوت الحاج محمد السلاوي';
 const kurdLink=el('a','','مقام الكرد');
 kurdLink.href='https://www.youtube.com/watch?v=7G6XTZQ_D5U';kurdLink.target='_blank';kurdLink.rel='noopener noreferrer';
 kurdLink.title='نموذج أذان بمقام الكرد للاستماع الخارجي';
 const voiceCredit=el('small','anwar-prayer-note','');
 links.append(apiLink,audioLink,qarawiyyinLink,kurdLink);
 details.append(summary,fields,actions,toggleLabel,volumeWrap,status,links,voiceCredit);
 details.addEventListener('toggle',()=>{
  const launcher=document.querySelector('[data-anwar-service="adhan"]');
  if(launcher)launcher.setAttribute('aria-expanded',String(details.open));
 });
 const audio=document.createElement('audio');
 audio.id='anwarPrayerAdhanAudio';audio.preload='none';audio.hidden=true;audio.controls=false;audio.setAttribute('playsinline','');audio.setAttribute('aria-label','صوت الأذان');
 audio.src=(VOICES.find(item=>item.key===settings.voice)||VOICES[0]).url;audio.volume=settings.volume;
 card.append(head,nextBox,timesGrid,dateLine,infoDetails,details,audio);
 const prayerMount=document.getElementById('anwarPrayerMount');
 if(prayerMount)prayerMount.append(card);
 else{const insertBefore=panel.querySelector('.radio-section-title');if(insertBefore)panel.insertBefore(card,insertBefore);else panel.append(card);}

 function persist(){
  try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings))}catch(_e){}
 }
 function currentVoice(){
  return VOICES.find(item=>item.key===settings.voice)||VOICES[0];
 }
 function updateVoiceSource(){
  const voice=currentVoice();
  audioLink.href=voice.page;
  audioLink.textContent='مصدر التسجيل';
  audioLink.title=voice.credit+' · '+voice.license;
  voiceCredit.textContent=voice.credit+' · '+voice.license+(voice.note?' · '+voice.note:'');
 }
 updateVoiceSource();
 function countryForApi(value){
  const trimmed=String(value||'').trim();
  return COUNTRY_ALIASES[trimmed]||trimmed;
 }
 function countryForDisplay(value){
  const api=countryForApi(value);
  return COUNTRY_AR[api]||trimmedCountry(value);
 }
 const CITY_AR={
  meknes:'مكناس',mequinez:'مكناس',fes:'فاس',fez:'فاس',
  casablanca:'الدار البيضاء',rabat:'الرباط',
  tangier:'طنجة',tanger:'طنجة',marrakech:'مراكش',marrakesh:'مراكش',
  agadir:'أكادير',oujda:'وجدة',tetouan:'تطوان',kenitra:'القنيطرة',
  safi:'آسفي',taza:'تازة','al hoceima':'الحسيمة',nador:'الناظور',
  'beni mellal':'بني ملال',khouribga:'خريبكة',settat:'سطات',
  berkane:'بركان',larache:'العرائش',essaouira:'الصويرة',
  taroudant:'تارودانت',guelmim:'كلميم',dakhla:'الداخلة'
 };
 function cityForDisplay(value){
  const city=trimmedCountry(value);
  const key=city.toLowerCase().replace(/[éèê]/g,'e').replace(/[àâ]/g,'a').replace(/[îï]/g,'i').replace(/[ô]/g,'o').replace(/[ùû]/g,'u').replace(/\s+/g,' ').trim();
  return CITY_AR[key]||city;
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
  const match=String(value||'').match(/(\d{1,2}):(\d{2})/);
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
  locationLabel.textContent=cityForDisplay(settings.city)+' · '+countryForDisplay(settings.country);
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
  dateLine.textContent=(greg?'ميلادي '+greg:'')+(hijri?' · هجري '+hijri:'');
  dateLine.dataset.state='ready';
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
  if(!isTest&&!settings.enabled)return false;
  if(!audio.paused&&!audio.ended){if(isTest)setStatus('الأذان يعمل الآن بالفعل.');return false;}
  audio.volume=settings.volume;
  try{audio.currentTime=0}catch(_e){}
  try{
   const attempt=audio.play();
   if(attempt&&typeof attempt.then==='function')await attempt;
   setStatus(isTest?'بدأ اختبار الأذان.':'حان وقت صلاة '+prayer+'؛ بدأ الأذان وخُفّض صوت الإذاعة مؤقتًا.');
   return true;
  }catch(error){
   const blocked=error&&error.name==='NotAllowedError';
   setStatus(blocked?'منع المتصفح التشغيل التلقائي. اضغط «تجربة الأذان» واسمح بتشغيل الصوت.':'تعذّر تحميل الأذان؛ تحقق من اتصال الإنترنت ثم أعد التجربة.');
   return false;
  }
 }
 audio.addEventListener('ended',()=>setStatus('انتهى الأذان؛ عاد صوت إذاعة القرآن إلى مستواه السابق.'));
 audio.addEventListener('error',()=>setStatus('تعذّر تحميل تسجيل الأذان من المصدر الصوتي.'));
 function tick(){
  const now=Date.now(),events=eventList();
  if(settings.enabled){
   events.forEach(event=>{
    const key=event.date+'|'+event.key+'|'+settings.city+'|'+settings.country;
    if(lastTick<event.at&&now>=event.at&&now-event.at<=180000&&!alreadyPlayed(key)){
     if(pendingAdhanKey!==key&&now-lastAutoAttemptAt>=15000){
      pendingAdhanKey=key;lastAutoAttemptAt=now;
      playAdhan(event.name,false).then(played=>{if(played)markPlayed(key)}).finally(()=>{if(pendingAdhanKey===key)pendingAdhanKey=''});
     }
    }
   });
  }
  if(todayData)lastTick=now;
  const next=events.find(event=>event.at>now);
  if(next){
   nextBox.hidden=false;
   nextName.textContent=next.name;
   countdown.textContent=formatCountdown(next.at-now);
   nextLabel.textContent='الصلاة القادمة';
   const todayDate=todayData&&todayData.date&&todayData.date.gregorian&&todayData.date.gregorian.date;
   nextWhen.textContent=(next.date===todayDate?'اليوم':'غدًا')+' · '+timeLabel(next.at);
   timesGrid.querySelectorAll('.anwar-prayer-time').forEach(item=>item.classList.toggle('is-next',item.dataset.prayer===next.key&&next.date===(todayData&&todayData.date&&todayData.date.gregorian&&todayData.date.gregorian.date)));
  }else{
   nextBox.hidden=true;
   nextName.textContent='';nextWhen.textContent='';countdown.textContent='';
  }
  if(todayData&&timeZone){
   const todayHere=dateString(new Date(now),timeZone);
   if(todayHere!==lastDateCheck&&!loading)refreshTimes(true);
  }
 }
 async function refreshTimes(silent){
  const token=++loadToken;
  loading=true;
  if(!silent){
   setStatus('جارٍ تحديث مواقيت الصلاة…');
   dateLine.textContent='جارٍ تحميل مواقيت الصلاة…';dateLine.dataset.state='loading';
   nextBox.hidden=true;
  }
  refreshButton.disabled=true;
  try{
   if(!settings.city.trim()||!settings.country.trim())throw new Error('أدخل اسم الدولة والمدينة أولًا.');
   const initialZone=validTimeZone(settings.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC');
   let requestedDate=dateString(new Date(),initialZone);
   let data=await fetchDay(requestedDate,token);
   if(token!==loadToken)return;
   const zone=data.meta&&data.meta.timezone?String(data.meta.timezone):initialZone;
   const cityDate=dateString(new Date(),zone);
   if(data.date&&data.date.gregorian&&data.date.gregorian.date!==cityDate){
    data=await fetchDay(cityDate,token);
    if(token!==loadToken)return;
   }
   timeZone=validTimeZone(zone);settings.timezone=timeZone;
   todayData=data;
   const todayText=data.date.gregorian.date;
   lastDateCheck=todayText;
   renderTimes();
   const tomorrowText=addDay(todayText);
   tomorrowData=await fetchDay(tomorrowText,token);
   if(token!==loadToken)return;
   persist();renderTimes();lastDateCheck=todayText;
   if(!silent)setStatus('تم تحديث مواقيت الصلاة. جرّب الأذان واسمح للمتصفح بتشغيل الصوت تلقائيًا.');
   tick();
  }catch(error){
   if(token===loadToken){
    if(!todayData){
     dateLine.textContent='تعذّر تحميل المواقيت؛ تحقق من اسم المدينة أو الاتصال.';
     dateLine.dataset.state='error';nextBox.hidden=true;
    }
    setStatus(error&&error.message?error.message:'تعذّر تحديث المواقيت.');
   }
  }finally{
   if(token===loadToken){loading=false;refreshButton.disabled=false;}
  }
 }
 refreshButton.addEventListener('click',()=>{
  settings.country=countryInput.value.trim();settings.city=cityInput.value.trim();
  settings.method=methodSelect.value;settings.school=schoolSelect.value;
  persist();todayData=null;tomorrowData=null;lastDateCheck='';
  timesGrid.replaceChildren(...PRAYERS.map(prayer=>{const item=el('div','anwar-prayer-time');item.append(el('b','',prayer.name),el('strong','','—'));return item;}));
  nextBox.hidden=true;nextName.textContent='';nextWhen.textContent='';countdown.textContent='';
  dateLine.textContent='جارٍ تحميل مواقيت الصلاة…';dateLine.dataset.state='loading';
  lastTick=Date.now();refreshTimes(false);
 });
 enabledInput.addEventListener('change',()=>{
  settings.enabled=enabledInput.checked;persist();
  if(settings.enabled)setStatus('تم تفعيل الأذان التلقائي. جرّب الأذان أولًا واسمح للمتصفح بتشغيل الصوت.');
  else{if(!audio.paused)audio.pause();setStatus('تم إيقاف الأذان التلقائي وإيقاف الصوت الجاري.');}
 });
 volumeInput.addEventListener('input',()=>{
  settings.volume=Math.max(0,Math.min(1,Number(volumeInput.value)||0));audio.volume=settings.volume;persist();
 });
 voiceSelect.addEventListener('change',()=>{
  const next=VOICES.find(item=>item.key===voiceSelect.value);
  if(!next)return;
  settings.voice=next.key;audio.pause();audio.src=next.url;audio.load();
  persist();updateVoiceSource();setStatus('تم اختيار '+next.label+'.');
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