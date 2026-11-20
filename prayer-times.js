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
  {key:'aqsa',label:'المسجد الأقصى · ناجي قزاز',url:'https://raw.githubusercontent.com/Kiwifu/adhan-mp3/b9180a2bb769f74cff8e378ef2cc7aaf8db5cd5b/Najee_Qazaz_-_Al_Aqsa_Jerusalem_%28%D9%86%D8%A7%D8%AC%D9%8A_%D9%82%D8%B2%D8%A7%D8%B2_-_%D8%A7%D9%84%D9%85%D8%B3%D8%AC%D8%AF_%D8%A7%D9%84%D8%A3%D9%82%D8%B5%D9%89_%D8%A7%D9%84%D9%82%D8%AF%D8%B3%29.mp3',page:'https://github.com/Kiwifu/adhan-mp3',credit:'ناجي قزاز · المسجد الأقصى',license:'المصدر: مجموعة Kiwifu للأذان',note:'ملف MP3 مباشر · القدس'},
  {key:'haram_makki',label:'الحرم المكي · علي بن أحمد ملا',url:'https://raw.githubusercontent.com/Kiwifu/adhan-mp3/b9180a2bb769f74cff8e378ef2cc7aaf8db5cd5b/Ali_Ibn_Ahmad_Mala_1_-_Al_Haram_Al_Maki_%28%D8%B9%D9%84%D9%8A_%D8%A8%D9%86_%D8%A3%D8%AD%D9%85%D8%AF_%D9%85%D9%84%D8%A7_-_%D8%A7%D9%84%D8%AD%D8%B1%D9%85_%D8%A7%D9%84%D9%85%D9%83%D9%8A%29.mp3',page:'https://github.com/Kiwifu/adhan-mp3',credit:'علي بن أحمد ملا · الحرم المكي',license:'المصدر: مجموعة Kiwifu للأذان',note:'ملف MP3 مباشر · مكة المكرمة'},
  {key:'morocco_kamal',label:'أذان مغربي · كمال محمد المروش',url:'https://raw.githubusercontent.com/Kiwifu/adhan-mp3/b9180a2bb769f74cff8e378ef2cc7aaf8db5cd5b/Kamal_Muhammad_Al_Marush_2_-_Morocco_%28%D9%83%D9%85%D8%A7%D9%84_%D9%85%D8%AD%D9%85%D8%AF_%D8%A7%D9%84%D9%85%D8%B1%D8%B9%D9%88%D8%B4_-_%D8%A7%D9%84%D9%85%D8%BA%D8%B1%D8%A8%29.mp3',page:'https://github.com/Kiwifu/adhan-mp3',credit:'كمال محمد المروش · المغرب',license:'المصدر: مجموعة Kiwifu للأذان',note:'ملف MP3 مباشر · أذان مغربي'},
  {key:'madina',label:'المسجد النبوي · تسجيل ميداني',url:'https://upload.wikimedia.org/wikipedia/commons/7/7c/33937_ejaz215_call-to-prayer-from-the-prophet-s-mo.ogg',page:'https://commons.wikimedia.org/wiki/File:33937_ejaz215_call-to-prayer-from-the-prophet-s-mo.ogg',credit:'ejaz215',license:'CC BY 3.0'}
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
 const COUNTRY_OPTIONS=[
  {code:'MA',api:'Morocco',label:'المغرب',city:'Meknes',method:'21'},
  {code:'DZ',api:'Algeria',label:'الجزائر',city:'Algiers',method:'19'},
  {code:'TN',api:'Tunisia',label:'تونس',city:'Tunis',method:'18'},
  {code:'LY',api:'Libya',label:'ليبيا',city:'Tripoli',method:'auto'},
  {code:'EG',api:'Egypt',label:'مصر',city:'Cairo',method:'5'},
  {code:'SD',api:'Sudan',label:'السودان',city:'Khartoum',method:'auto'},
  {code:'MR',api:'Mauritania',label:'موريتانيا',city:'Nouakchott',method:'auto'},
  {code:'SO',api:'Somalia',label:'الصومال',city:'Mogadishu',method:'auto'},
  {code:'DJ',api:'Djibouti',label:'جيبوتي',city:'Djibouti',method:'auto'},
  {code:'KM',api:'Comoros',label:'جزر القمر',city:'Moroni',method:'auto'},
  {code:'SA',api:'Saudi Arabia',label:'السعودية',city:'Riyadh',method:'4'},
  {code:'YE',api:'Yemen',label:'اليمن',city:'Sanaa',method:'auto'},
  {code:'OM',api:'Oman',label:'عمان',city:'Muscat',method:'8'},
  {code:'AE',api:'United Arab Emirates',label:'الإمارات',city:'Abu Dhabi',method:'8'},
  {code:'QA',api:'Qatar',label:'قطر',city:'Doha',method:'10'},
  {code:'BH',api:'Bahrain',label:'البحرين',city:'Manama',method:'8'},
  {code:'KW',api:'Kuwait',label:'الكويت',city:'Kuwait City',method:'9'},
  {code:'IQ',api:'Iraq',label:'العراق',city:'Baghdad',method:'auto'},
  {code:'SY',api:'Syria',label:'سوريا',city:'Damascus',method:'auto'},
  {code:'LB',api:'Lebanon',label:'لبنان',city:'Beirut',method:'auto'},
  {code:'JO',api:'Jordan',label:'الأردن',city:'Amman',method:'23'},
  {code:'PS',api:'Palestine',label:'فلسطين',city:'Gaza',method:'auto'},
  {code:'TR',api:'Turkey',label:'تركيا',city:'Ankara',method:'13'},
  {code:'FR',api:'France',label:'فرنسا',city:'Paris',method:'12'},
  {code:'DE',api:'Germany',label:'ألمانيا',city:'Berlin',method:'auto'},
  {code:'GB',api:'United Kingdom',label:'بريطانيا',city:'London',method:'auto'},
  {code:'US',api:'United States',label:'الولايات المتحدة',city:'Washington',method:'2'},
  {code:'CA',api:'Canada',label:'كندا',city:'Ottawa',method:'2'},
  {code:'PK',api:'Pakistan',label:'باكستان',city:'Islamabad',method:'1'},
  {code:'IN',api:'India',label:'الهند',city:'New Delhi',method:'auto'},
  {code:'MY',api:'Malaysia',label:'ماليزيا',city:'Kuala Lumpur',method:'17'},
  {code:'ID',api:'Indonesia',label:'إندونيسيا',city:'Jakarta',method:'20'}
 ];
 const COUNTRY_ALIASES={
  'المغرب':'Morocco','المملكة المغربية':'Morocco',
  'الجزائر':'Algeria','تونس':'Tunisia','ليبيا':'Libya','مصر':'Egypt',
  'السودان':'Sudan','موريتانيا':'Mauritania','الصومال':'Somalia',
  'جيبوتي':'Djibouti','جزر القمر':'Comoros',
  'السعودية':'Saudi Arabia','المملكة العربية السعودية':'Saudi Arabia',
  'اليمن':'Yemen','عمان':'Oman','سلطنة عمان':'Oman',
  'الإمارات':'United Arab Emirates','الامارات':'United Arab Emirates',
  'قطر':'Qatar','الكويت':'Kuwait','البحرين':'Bahrain',
  'العراق':'Iraq','سوريا':'Syria','لبنان':'Lebanon','الأردن':'Jordan','فلسطين':'Palestine',
  'تركيا':'Turkey','فرنسا':'France','ألمانيا':'Germany',
  'بريطانيا':'United Kingdom','المملكة المتحدة':'United Kingdom',
  'الولايات المتحدة':'United States','كندا':'Canada',
  'باكستان':'Pakistan','الهند':'India','ماليزيا':'Malaysia',
  'إندونيسيا':'Indonesia'
 };
 const COUNTRY_AR=Object.fromEntries(COUNTRY_OPTIONS.map(item=>[item.api,item.label]));
 const TIME_ZONE_COUNTRY={
  'Africa/Casablanca':'MA','Africa/Algiers':'DZ','Africa/Tunis':'TN',
  'Africa/Tripoli':'LY','Africa/Cairo':'EG','Africa/Khartoum':'SD',
  'Africa/Nouakchott':'MR','Africa/Mogadishu':'SO','Africa/Djibouti':'DJ',
  'Indian/Comoro':'KM','Asia/Riyadh':'SA','Asia/Aden':'YE',
  'Asia/Muscat':'OM','Asia/Dubai':'AE','Asia/Qatar':'QA','Asia/Bahrain':'BH',
  'Asia/Kuwait':'KW','Asia/Baghdad':'IQ','Asia/Damascus':'SY',
  'Asia/Beirut':'LB','Asia/Amman':'JO','Asia/Gaza':'PS','Asia/Hebron':'PS',
  'Europe/Istanbul':'TR','Europe/Paris':'FR','Europe/Berlin':'DE',
  'Europe/London':'GB','America/New_York':'US','America/Chicago':'US',
  'America/Denver':'US','America/Los_Angeles':'US','America/Toronto':'CA',
  'America/Vancouver':'CA','Asia/Karachi':'PK','Asia/Kolkata':'IN',
  'Asia/Kuala_Lumpur':'MY','Asia/Jakarta':'ID'
 };
 function normalizeCountry(value){
  const raw=String(value||'').trim();
  const api=COUNTRY_ALIASES[raw]||raw;
  return COUNTRY_OPTIONS.some(item=>item.api===api)?api:'';
 }
 function detectCountry(){
  let zone='';
  try{zone=Intl.DateTimeFormat().resolvedOptions().timeZone||'';}catch(_e){}
  const zoneCode=TIME_ZONE_COUNTRY[zone];
  if(zoneCode){
   const match=COUNTRY_OPTIONS.find(item=>item.code===zoneCode);
   if(match)return match.api;
  }
  const locales=[];
  try{
   if(Array.isArray(navigator.languages))locales.push(...navigator.languages);
   if(navigator.language)locales.push(navigator.language);
  }catch(_e){}
  for(const locale of locales){
   const match=String(locale).match(/-([A-Za-z]{2})(?:-|$)/);
   if(match){
    const country=COUNTRY_OPTIONS.find(item=>item.code===match[1].toUpperCase());
    if(country)return country.api;
   }
  }
  return 'Morocco';
 }
 function defaultCity(country){
  const match=COUNTRY_OPTIONS.find(item=>item.api===country);
  return match?match.city:'Meknes';
 }
 function methodForCountry(country){
  const match=COUNTRY_OPTIONS.find(item=>item.api===normalizeCountry(country));
  return match?match.method:'auto';
 }
 function readSettings(){
  const defaults={country:detectCountry(),city:'',method:'auto',school:'0',enabled:false,volume:0.9,timezone:'',voice:DEFAULT_VOICE,countrySource:'auto'};
  try{
   const value=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}');
   const storedCountry=normalizeCountry(value.country);
   const manualCountry=value.countrySource==='manual'||(!value.countrySource&&storedCountry&&storedCountry!=='Morocco');
   const country=manualCountry&&storedCountry?storedCountry:defaults.country;
   const changedFromSaved=!!storedCountry&&storedCountry!==country;
   const storedCity=typeof value.city==='string'?value.city.trim().slice(0,90):'';
   return {
    country:country,
    city:changedFromSaved||!storedCity?defaultCity(country):storedCity,
    method:methodForCountry(country),
    countrySource:manualCountry?'manual':'auto',
    school:'0',
    enabled:value.enabled===true,
    volume:Number.isFinite(Number(value.volume))?Math.max(0,Math.min(1,Number(value.volume))):defaults.volume,
    timezone:changedFromSaved?'':(typeof value.timezone==='string'?value.timezone.slice(0,90):''),
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
  '.anwar-prayer-next[hidden]{display:none!important}',
  '.anwar-prayer-status:empty{display:none!important}'
 ].join('');
 document.head.append(style);

 const card=el('section','anwar-prayer-card');
 card.id='anwarPrayerCard';
 card.setAttribute('aria-label','مواقيت الصلاة والأذان');
 const head=el('div','anwar-prayer-head');
 const locationLabel=el('small','','المغرب · مكناس');
 head.append(locationLabel);
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
 const privacyLine=el('small','anwar-prayer-note','نحدد الدولة تلقائيًا من المنطقة الزمنية وإعدادات لغة الجهاز دون طلب GPS أو الموقع الدقيق. تُرسل المدينة والدولة إلى خدمة المواقيت لحساب الصلاة، ويمكنك تغييرهما متى شئت.');
 const infoDetails=el('details','anwar-prayer-info');
 const infoSummary=el('summary','','معلومات المواقيت وخصوصية الموقع');
 infoDetails.append(infoSummary,privacyLine);
 const details=el('details','anwar-prayer-settings');
 const summary=el('summary','','إعدادات المواقيت والأذان');
 const fields=el('div','anwar-prayer-fields');
 const countrySelect=el('select');countrySelect.id='anwarPrayerCountry';countrySelect.setAttribute('aria-label','الدولة');
 COUNTRY_OPTIONS.forEach(item=>{const option=el('option','',item.label);option.value=item.api;countrySelect.append(option)});
 countrySelect.value=settings.country;
 const cityInput=el('input');cityInput.id='anwarPrayerCity';cityInput.type='text';cityInput.setAttribute('aria-label','المدينة');cityInput.autocomplete='address-level2';cityInput.maxLength=90;cityInput.value=settings.city;cityInput.placeholder='المدينة';
 const voiceSelect=el('select');voiceSelect.id='anwarPrayerVoice';voiceSelect.setAttribute('aria-label','صوت الأذان');
 VOICES.forEach(voice=>{const option=el('option','',voice.label);option.value=voice.key;voiceSelect.append(option)});
 voiceSelect.value=settings.voice;
 fields.append(countrySelect,cityInput,voiceSelect);
 const refreshButton=el('button','primary','تحديث');
 refreshButton.type='button';refreshButton.setAttribute('aria-label','تحديث مواقيت الصلاة');
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
 const status=el('div','anwar-prayer-status','');
 status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 details.append(summary,fields,actions,toggleLabel,volumeWrap,status);
 details.addEventListener('toggle',()=>{
  const launcher=document.querySelector('[data-anwar-service="adhan"]');
  if(launcher)launcher.setAttribute('aria-expanded',String(details.open));
 });
 const audio=document.createElement('audio');
 audio.id='anwarPrayerAdhanAudio';audio.preload='none';audio.hidden=true;audio.controls=false;audio.setAttribute('playsinline','');audio.setAttribute('aria-label','صوت الأذان');
 const initialVoice=VOICES.find(item=>item.key===settings.voice)||VOICES[0];
 audio.src=initialVoice.url;
 audio.volume=settings.volume;
 card.append(head,nextBox,timesGrid,dateLine,infoDetails,details,audio);
 const prayerMount=document.getElementById('anwarPrayerMount');
 if(prayerMount)prayerMount.append(card);
 else{const insertBefore=panel.querySelector('.radio-section-title');if(insertBefore)panel.insertBefore(card,insertBefore);else panel.append(card);}

 function persist(){
  try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings))}catch(_e){}
 }
 testButton.textContent='تجربة الأذان';
 function syncNativeBackground(){
  const bridge=window.AnwarAdhanBridge;
  if(!bridge||typeof bridge.postMessage!=='function')return false;
  const payload={
   enabled:settings.enabled,
   city:settings.city,
   country:settings.country,
   method:settings.method,
   school:settings.school,
   timezone:timeZone,
   voice:currentVoice().key,
   volume:settings.volume
  };
  try{bridge.postMessage(JSON.stringify(payload));return true}catch(_e){return false}
 }
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
   const nativeBridgeReady=syncNativeBackground();
   if(!silent){
    if(settings.enabled&&nativeBridgeReady)setStatus('أُرسلت إعدادات الأذان إلى تطبيق أنوار المرافق؛ أكمل أذونات الهاتف لتشغيله في الخلفية.');
    else if(settings.enabled)setStatus('للتشغيل بعد إغلاق المفكرة، افتحها من تطبيق أندرويد المرافق.');
    else setStatus('تم تحديث مواقيت الصلاة. يمكنك تجربة الأذان ثم تفعيل التنبيه.');
   }
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
  settings.country=normalizeCountry(countrySelect.value)||detectCountry();
  settings.method=methodForCountry(settings.country);
  settings.city=cityInput.value.trim();settings.school='0';
  persist();todayData=null;tomorrowData=null;lastDateCheck='';
  timesGrid.replaceChildren(...PRAYERS.map(prayer=>{const item=el('div','anwar-prayer-time');item.append(el('b','',prayer.name),el('strong','','—'));return item;}));
  nextBox.hidden=true;nextName.textContent='';nextWhen.textContent='';countdown.textContent='';
  dateLine.textContent='جارٍ تحميل مواقيت الصلاة…';dateLine.dataset.state='loading';
  lastTick=Date.now();refreshTimes(false);
 });
 countrySelect.addEventListener('change',()=>{
  const selected=normalizeCountry(countrySelect.value);
  if(!selected)return;
  settings.country=selected;
  settings.countrySource='manual';
  settings.method=methodForCountry(selected);
  settings.city=defaultCity(selected);
  settings.timezone='';
  cityInput.value=settings.city;
  settings.timezone='';
  persist();updateHeader();
  todayData=null;tomorrowData=null;lastDateCheck='';
  nextBox.hidden=true;
  timesGrid.replaceChildren(...PRAYERS.map(prayer=>{const item=el('div','anwar-prayer-time');item.append(el('b','',prayer.name),el('strong','','—'));return item;}));
  dateLine.textContent='جارٍ تحميل المواقيت…';dateLine.dataset.state='loading';
  lastTick=Date.now();refreshTimes(false);
 });
 enabledInput.addEventListener('change',()=>{
  settings.enabled=enabledInput.checked;persist();
  const nativeBridgeReady=syncNativeBackground();
  if(settings.enabled){
   if(nativeBridgeReady)setStatus('أُرسلت إعدادات الأذان إلى تطبيق أنوار المرافق؛ أكمل أذونات الهاتف.');
   else setStatus('فُعّل الأذان داخل المفكرة. للتشغيل بعد إغلاقها استخدم تطبيق أندرويد المرافق.');
  }else{
   if(!audio.paused)audio.pause();
   setStatus('تم إيقاف الأذان التلقائي وإرسال أمر الإيقاف إلى التطبيق المرافق.');
  }
 });
 volumeInput.addEventListener('input',()=>{
  settings.volume=Math.max(0,Math.min(1,Number(volumeInput.value)||0));audio.volume=settings.volume;persist();
 });
 volumeInput.addEventListener('change',syncNativeBackground);
 voiceSelect.addEventListener('change',()=>{
  const next=VOICES.find(item=>item.key===voiceSelect.value);
  if(!next)return;
  settings.voice=next.key;audio.pause();
  audio.src=next.url;
  audio.load();persist();syncNativeBackground();
  setStatus('تم اختيار '+next.label+'.');
 });
 testButton.addEventListener('click',()=>playAdhan('اختبار',true));
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