/* Local prayer times and locally stored adhan for Anwar notebook.
 * Prayer times are calculated on-device from a bundled city-coordinate table.
 * The adhan recording is imported by the user and stored in this origin's IndexedDB.
 * No prayer API, remote audio host, GPS permission, or location upload is used.
 * Chrome/PWA background playback and closed-app alarms are not guaranteed.
 */
(function(){
 'use strict';
 if(window.__anwarPrayerTimesReady)return;
 const panel=document.getElementById('rd');
 if(!panel)return;
 window.__anwarPrayerTimesReady=true;

 const VOICES=[{key:'calm',label:'ملف الأذان المحلي'}];
 const DEFAULT_VOICE='calm';
 let localAudioObjectUrl='';
 let localAdhanBlob=null;
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
 function normalizeSavedSettings(value){
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const defaults={country:detectCountry(),city:'',method:'auto',school:'0',enabled:false,volume:0.9,timezone:'',voice:DEFAULT_VOICE,countrySource:'auto',lastPlayedKey:''};
  const storedCountry=normalizeCountry(source.country);
  const manualCountry=source.countrySource==='manual'||(!source.countrySource&&storedCountry&&storedCountry!=='Morocco');
  const country=manualCountry&&storedCountry?storedCountry:defaults.country;
  const changedFromSaved=!!storedCountry&&storedCountry!==country;
  const storedCity=typeof source.city==='string'?source.city.trim().slice(0,90):'';
  return {
   country:country,
   city:changedFromSaved||!storedCity?defaultCity(country):storedCity,
   method:methodForCountry(country),
   countrySource:manualCountry?'manual':'auto',
   school:source.school==='1'?'1':'0',
   enabled:source.enabled===true,
   volume:Number.isFinite(Number(source.volume))?Math.max(0,Math.min(1,Number(source.volume))):defaults.volume,
   timezone:changedFromSaved?'':(typeof source.timezone==='string'?source.timezone.slice(0,90):''),
   voice:VOICES.some(item=>item.key===source.voice)?source.voice:DEFAULT_VOICE,
   lastPlayedKey:typeof source.lastPlayedKey==='string'?source.lastPlayedKey.slice(0,180):''
  };
 }
 function readSettings(){
  try{
   const privatePrefs=window.AnwarPrivatePreferences;
   const saved=privatePrefs&&typeof privatePrefs.get==='function'?privatePrefs.get():null;
   return normalizeSavedSettings(saved&&saved.prayer);
  }catch(_e){return normalizeSavedSettings({})}
 }
 let settings=readSettings();
 function validTimeZone(value){try{new Intl.DateTimeFormat('en',{timeZone:value}).format();return value;}catch(_e){return Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';}}
 let todayData=null,tomorrowData=null,timeZone=validTimeZone((window.AnwarPrayerEngine&&window.AnwarPrayerEngine.timezoneForCountry(settings.country))||settings.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC');
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
  '.anwar-prayer-head small,.anwar-prayer-date{font-size:10px;color:var(--mu);line-height:1.7}',
  '.anwar-prayer-local-note{display:block;margin-top:-5px;color:var(--mu);font-size:10px;line-height:1.7}',
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
  '.anwar-prayer-permission-wrap{display:grid;gap:4px;margin:2px 0 8px}',
  '.anwar-prayer-background-access{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;min-height:42px;padding:8px 12px;border:1px solid #c9a96a;border-radius:9px;background:linear-gradient(130deg,#fff8e6,#f1e4c7);color:#173d5c;font-size:12px;font-weight:800;touch-action:manipulation}',
  '.anwar-prayer-background-access:active{filter:brightness(.97)}',
  '.anwar-prayer-background-access:focus-visible{outline:2px solid var(--ac);outline-offset:2px}',
  '.anwar-prayer-access-icon{display:inline-grid;place-items:center;flex:none;width:25px;height:25px;border:1px solid #c9a96a;border-radius:7px;background:#fffdf6;color:#173d5c}',
  '.anwar-prayer-access-icon svg{display:block;width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}',
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
  '.anwar-prayer-status:empty{display:none!important}',
  '.anwar-prayer-status:not(:empty){display:block;margin:7px 0 0;padding:8px 10px;border:1px solid #c9a96a;border-radius:9px;background:linear-gradient(135deg,#fff9ea,#f4ecd9);color:#173d5c;font-size:11px;line-height:1.8;white-space:pre-line}',
  '.anwar-prayer-status[data-state="error"]{border-color:#d49a83;background:#fff3ee;color:#843a2a}',
  '.anwar-prayer-status[data-state="success"]{border-color:#a9cbb1;background:#f0f8f0;color:#285b36}'
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
 const countdownLabel=el('small','','المتبقي للصلاة');
 const countdown=el('span','','');
 countdownCopy.append(countdownLabel,countdown);
 nextBox.append(nextCopy,countdownCopy);
 showNextPrayerPlaceholder('بانتظار المواقيت');
 const timesGrid=el('div','anwar-prayer-times');
 const dateLine=el('div','anwar-prayer-date','جارٍ تحميل مواقيت الصلاة…');
 const localAccuracyNote=el('small','anwar-prayer-local-note');
 function updateLocalAccuracyNote(){
  localAccuracyNote.textContent=settings.country==='Morocco'
   ?'مواقيت المغرب حساب محلي تقديري، وليست جدولاً رسمياً؛ راجع توقيت المسجد المحلي قبل الاعتماد على التنبيه.'
   :'المواقيت تقديرات حسابية محلية وقد تختلف باختلاف المدينة وطريقة الحساب؛ راجع توقيت مسجدك قبل اعتماد التنبيه.';
 }
 updateLocalAccuracyNote();
 const infoDetails=el('details','anwar-prayer-info');
 const infoSummary=el('summary');
 const privacyIcon=el('span','anwar-prayer-privacy-icon');
 privacyIcon.setAttribute('aria-hidden','true');
 privacyIcon.innerHTML='<svg viewBox="0 0 24 24" focusable="false"><path d="M12 2.5 20 5.7v5.1c0 4.7-3.1 8.4-8 10.6-4.9-2.2-8-5.9-8-10.6V5.7Z"></path><rect x="8" y="10.5" width="8" height="6.3" rx="1.3"></rect><path d="M9.8 10.5V8.7a2.2 2.2 0 0 1 4.4 0v1.8"></path></svg>';
 infoSummary.append(privacyIcon,el('span','','الخصوصية'));
 const privacyList=el('div','anwar-prayer-privacy-list');
 function addPrivacyFact(title,description,label,kind){
  const row=el('div','anwar-prayer-privacy-row');
  const copy=el('div','anwar-prayer-privacy-copy');
  copy.append(el('strong','',title),el('small','',description));
  const state=el('span','anwar-prayer-privacy-state '+kind,label);
  row.append(copy,state);
  privacyList.append(row);
  return {row:row,description:copy.lastChild};
 }
 addPrivacyFact('الموقع الدقيق','لا نستخدم GPS ولا نطلب إذن الموقع.','لا يُستخدم','local');
 addPrivacyFact('مواقيت الصلاة','تُحسب داخل الجهاز من إحداثيات المدينة المحفوظة، دون إرسال المدينة أو التاريخ إلى خادم.','حساب محلي','local');
 const audioPrivacyFact=addPrivacyFact('صوت الأذان','','ملف محلي','local');
 function updatePrivacyAudioDisclosure(){
  audioPrivacyFact.description.textContent=localAudioObjectUrl
   ?'ملف الأذان محفوظ على هذا الجهاز داخل مساحة تخزين المفكرة. لا يُحمّل من مضيف صوتي خارجي.'
   :'لم يُستورد ملف أذان بعد. اختر ملف MP3 أو OGG من جهازك ليُحفظ محلياً.';
  const state=audioPrivacyFact.row.querySelector('.anwar-prayer-privacy-state');
  if(state){
   state.textContent=localAudioObjectUrl?'محفوظ محلياً':'بانتظار ملف محلي';
   state.className='anwar-prayer-privacy-state local';
  }
 }
 updatePrivacyAudioDisclosure();
 addPrivacyFact('الإعدادات','تُحفظ ضمن تفضيلات مفكرة أنوار المشفرة على هذا الجهاز.','داخل الخزنة المشفرة','secure');
 addPrivacyFact('الحساب','لا يلزم حساب أو بريد إلكتروني.','دون حساب','local');
 addPrivacyFact('الاتصال','HTTPS يشفّر الاتصال أثناء النقل فقط.','تشفير أثناء النقل','secure');
 const privacyFootnote=el('small','anwar-prayer-privacy-footnote','بيان موجز عن النسخة الحالية، وليس تدقيقًا أمنيًا مستقلًا.');
 infoDetails.append(infoSummary,privacyList,privacyFootnote);
 const details=el('details','anwar-prayer-settings');
 const summary=el('summary','','الإعدادات');
 const fields=el('div','anwar-prayer-fields');
 const countrySelect=el('select');countrySelect.id='anwarPrayerCountry';countrySelect.setAttribute('aria-label','الدولة');
 COUNTRY_OPTIONS.forEach(item=>{const option=el('option','',item.label);option.value=item.api;countrySelect.append(option)});
 countrySelect.value=settings.country;
 const cityInput=el('input');cityInput.id='anwarPrayerCity';cityInput.type='text';cityInput.setAttribute('aria-label','المدينة');cityInput.autocomplete='address-level2';cityInput.maxLength=90;cityInput.value=settings.city;cityInput.placeholder='المدينة';
 const audioFileField=el('label','anwar-prayer-field');
 audioFileField.append(el('span','','ملف الأذان من جهازك'));
 const audioFileInput=el('input');
 audioFileInput.type='file';
 audioFileInput.accept='.mp3,.ogg,.oga,.wav,.m4a,.aac,audio/*';
 audioFileInput.setAttribute('aria-label','استيراد ملف الأذان محلياً');
 audioFileField.append(audioFileInput);
 fields.append(countrySelect,cityInput,audioFileField);
 const refreshButton=el('button','primary','تحديث');
 refreshButton.type='button';refreshButton.setAttribute('aria-label','تحديث مواقيت الصلاة');
 const testButton=el('button','','تجربة الأذان');
 testButton.type='button';
 const actions=el('div','anwar-prayer-actions');actions.append(refreshButton,testButton);
 const toggleLabel=el('label','anwar-prayer-toggle');
 const enabledInput=el('input');enabledInput.type='checkbox';enabledInput.checked=settings.enabled;
 const enabledText=el('span','','تشغيل الأذان تلقائيًا');
 toggleLabel.append(enabledInput,enabledText);
 const backgroundPermissionWrap=el('div','anwar-prayer-permission-wrap');
 const backgroundPermissionButton=el('button','anwar-prayer-background-access');
 backgroundPermissionButton.type='button';
 backgroundPermissionButton.setAttribute('aria-label','تفعيل الأذان بالخلفية');
 backgroundPermissionButton.title='تشغيل الأذان بعد إغلاق المفكرة';
  backgroundPermissionButton.setAttribute('data-anwar-prayer-permission','true');
 const backgroundPermissionIcon=el('span','anwar-prayer-access-icon');
 backgroundPermissionIcon.setAttribute('aria-hidden','true');
 backgroundPermissionIcon.innerHTML='<svg viewBox="0 0 24 24"><circle cx="12" cy="14" r="7.5"></circle><path d="M12 10v4l2.5 1.5M5 3 2.5 5.5M19 3l2.5 2.5M8 21l-1 1.5M16 21l1 1.5"></path></svg>';
 const backgroundPermissionText=el('span','','تفعيل الأذان بالخلفية');
 backgroundPermissionButton.append(backgroundPermissionIcon,backgroundPermissionText);
 backgroundPermissionWrap.append(backgroundPermissionButton);
 const volumeWrap=el('label','anwar-prayer-volume');
 const volumeLabel=el('span','','مستوى الصوت');
 const volumeInput=el('input');volumeInput.type='range';volumeInput.min='0';volumeInput.max='1';volumeInput.step='0.05';volumeInput.value=String(settings.volume);
 volumeWrap.append(volumeLabel,volumeInput);
 const status=el('div','anwar-prayer-status','');
 status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 details.append(summary,fields,actions,toggleLabel,volumeWrap);
 details.addEventListener('toggle',()=>{
  const launcher=document.querySelector('[data-anwar-service="adhan"]');
  if(launcher)launcher.setAttribute('aria-expanded',String(details.open));
 });
 const audio=document.createElement('audio');
 audio.id='anwarPrayerAdhanAudio';audio.preload='none';audio.hidden=true;audio.controls=false;audio.setAttribute('playsinline','');audio.setAttribute('aria-label','صوت الأذان');
 audio.volume=settings.volume;
 card.append(head,nextBox,timesGrid,dateLine,localAccuracyNote,infoDetails,backgroundPermissionWrap,status,details,audio);
 const prayerMount=document.getElementById('anwarPrayerMount');
 if(prayerMount)prayerMount.append(card);
 else{const insertBefore=panel.querySelector('.radio-section-title');if(insertBefore)panel.insertBefore(card,insertBefore);else panel.append(card);}

 const LOCAL_AUDIO_DB='anwar-prayer-audio-v1';
 function openLocalAudioDatabase(){
  return new Promise((resolve,reject)=>{
   if(!('indexedDB' in window)){reject(new Error('التخزين المحلي للملف الصوتي غير متاح في هذا المتصفح.'));return;}
   const request=indexedDB.open(LOCAL_AUDIO_DB,1);
   request.onupgradeneeded=()=>{
    const db=request.result;
    if(!db.objectStoreNames.contains('files'))db.createObjectStore('files');
   };
   request.onsuccess=()=>resolve(request.result);
   request.onerror=()=>reject(request.error||new Error('تعذّر فتح تخزين الأذان المحلي.'));
   request.onblocked=()=>reject(new Error('تخزين الأذان مشغول بتبويب آخر. أغلق النسخ الأخرى ثم أعد المحاولة.'));
  });
 }
 function applyLocalAdhan(blob){
  if(!(blob instanceof Blob)||!blob.size)throw new Error('ملف الأذان المحلي غير صالح.');
  if(localAudioObjectUrl)URL.revokeObjectURL(localAudioObjectUrl);
  localAdhanBlob=blob;
  localAudioObjectUrl=URL.createObjectURL(blob);
  audio.pause();
  audio.src=localAudioObjectUrl;
  audio.load();
  updatePrivacyAudioDisclosure();
 }
 async function saveLocalAdhan(file){
  const db=await openLocalAudioDatabase();
  try{
   await new Promise((resolve,reject)=>{
    const transaction=db.transaction('files','readwrite');
    transaction.objectStore('files').put({
     blob:file,
     name:String(file.name||'adhan-audio').slice(0,180),
     type:String(file.type||'').slice(0,100),
     savedAt:Date.now()
    },'adhan');
    transaction.oncomplete=resolve;
    transaction.onerror=()=>reject(transaction.error||new Error('تعذّر حفظ ملف الأذان.'));
    transaction.onabort=()=>reject(transaction.error||new Error('أُلغِي حفظ ملف الأذان.'));
   });
  }finally{db.close();}
 }
 async function loadLocalAdhan(){
  const db=await openLocalAudioDatabase();
  let record;
  try{
   record=await new Promise((resolve,reject)=>{
    const transaction=db.transaction('files','readonly');
    const request=transaction.objectStore('files').get('adhan');
    request.onsuccess=()=>resolve(request.result||null);
    request.onerror=()=>reject(request.error||new Error('تعذّرت قراءة ملف الأذان المحلي.'));
   });
  }finally{db.close();}
  if(record&&record.blob instanceof Blob&&record.blob.size){
   applyLocalAdhan(record.blob);
   return true;
  }
  updatePrivacyAudioDisclosure();
  return false;
 }
 audioFileInput.addEventListener('change',async()=>{
  const file=audioFileInput.files&&audioFileInput.files[0];
  if(!file)return;
  const extension=(String(file.name||'').split('.').pop()||'').toLowerCase();
  const accepted=['mp3','ogg','oga','wav','m4a','aac','mp4'].includes(extension)||String(file.type||'').toLowerCase().startsWith('audio/');
  if(!accepted){setStatus('اختر ملفاً صوتياً بصيغة MP3 أو OGG أو WAV أو M4A أو AAC.');audioFileInput.value='';return;}
  if(file.size>20*1024*1024){setStatus('حجم ملف الأذان يتجاوز الحد المحلي البالغ 20 ميغابايت.');audioFileInput.value='';return;}
  try{
   await saveLocalAdhan(file);
   applyLocalAdhan(file);
   settings.voice=DEFAULT_VOICE;
   persist();
   syncNativeBackground();
   setStatus('حُفظ ملف الأذان على هذا الجهاز، وسيعمل دون تحميل من الإنترنت.');
  }catch(error){
   setStatus(error&&error.message?error.message:'تعذّر حفظ ملف الأذان محلياً.');
  }finally{audioFileInput.value='';}
 });
 loadLocalAdhan().catch(error=>{
  updatePrivacyAudioDisclosure();
  setStatus(error&&error.message?error.message:'تعذّرت قراءة ملف الأذان المحلي.');
 });

 function persist(){
  const privatePrefs=window.AnwarPrivatePreferences;
  if(!privatePrefs||typeof privatePrefs.set!=='function'){
   setStatus('التفضيلات المشفرة غير متاحة. لم تُحفظ إعدادات الأذان.');
   return false;
  }
  try{privatePrefs.set('prayer',settings);return true}
  catch(error){setStatus('تعذّر حفظ إعدادات الأذان داخل الخزنة المشفرة.');return false}
 }
 testButton.textContent='تجربة الأذان';
 function currentVoice(){return VOICES[0];}
 function syncNativeBackground(requestPermissions){
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
  if(requestPermissions===true)payload.requestPermissions=true;
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
  if(token!==loadToken)return null;
  const engine=window.AnwarPrayerEngine;
  if(!engine||typeof engine.calculate!=='function'){
   throw new Error('محرك المواقيت المحلي غير جاهز. حدّث المفكرة وأعد فتحها.');
  }
  const data=engine.calculate({
   date:dateText,
   city:settings.city,
   country:settings.country,
   timezone:engine.timezoneForCountry(settings.country)||settings.timezone||timeZone,
   school:settings.school
  });
  if(token!==loadToken)return null;
  return data;
 }
 function updateHeader(){
  locationLabel.textContent=cityForDisplay(settings.city)+' · '+countryForDisplay(settings.country);
 }
 function fallbackDateLabel(){
  const now=new Date();
  const gregorian=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const part=(parts,type)=>parts.find(item=>item.type===type)?.value||'';
  const greg=[part(gregorian,'year'),part(gregorian,'month'),part(gregorian,'day')].join('-');
  let hijri='';
  try{
   const parts=new Intl.DateTimeFormat('en-u-ca-islamic-umalqura',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
   const year=(part(parts,'year').match(/\\d+/)||[])[0]||'';
   const month=part(parts,'month').replace(/\\D/g,'').padStart(2,'0');
   const day=part(parts,'day').replace(/\\D/g,'').padStart(2,'0');
   if(year&&month&&day)hijri=[year,month,day].join('-');
  }catch(_e){}
  return (greg?'ميلادي '+greg:'')+(hijri?' · هجري '+hijri:'');
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
 function setStatus(message){
   status.textContent=String(message||'');
   if(!status.textContent)status.removeAttribute('data-state');
   else if(/تعذّر|لا يمكن|يتطلب|لم يُمنح|منع المتصفح|غير متاح/i.test(status.textContent))status.dataset.state='error';
   else if(/تم|بدأ|أُرسل|وصلت|مفعّل|مفعلة/i.test(status.textContent))status.dataset.state='success';
   else status.removeAttribute('data-state');
  }
 function showNextPrayerPlaceholder(message){
  nextBox.hidden=false;
  nextLabel.textContent='الصلاة القادمة';
  nextName.textContent='—';
  nextWhen.textContent=message||'بانتظار المواقيت';
  countdown.textContent='--:--:--';
 }
 function alreadyPlayed(key){return settings.lastPlayedKey===key}
 function markPlayed(key){settings.lastPlayedKey=String(key||'').slice(0,180);persist()}
 async function playAdhan(prayer,isTest){
  if(!isTest&&!settings.enabled)return false;
  if(!localAudioObjectUrl){
   setStatus('استورد ملف الأذان المحلي من إعدادات الأذان أولاً.');
   return false;
  }
  if(!audio.paused&&!audio.ended){if(isTest)setStatus('الأذان يعمل بالفعل.');return false;}
  audio.volume=settings.volume;
  try{audio.currentTime=0}catch(_e){}
  try{
   const attempt=audio.play();
   if(attempt&&typeof attempt.then==='function')await attempt;
   setStatus(isTest?'بدأ اختبار الأذان.':'بدأ أذان صلاة '+prayer+'.');
   return true;
  }catch(error){
   const blocked=error&&error.name==='NotAllowedError';
   setStatus(blocked?'اسمح بتشغيل الصوت من زر «تجربة الأذان».':'تعذّر تحميل الأذان. تحقّق من الاتصال.');
   return false;
  }
 }
 audio.addEventListener('ended',()=>setStatus('انتهى الأذان؛ عاد صوت الإذاعة.'));
 audio.addEventListener('error',()=>setStatus('تعذّر تحميل صوت الأذان.'));
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
   showNextPrayerPlaceholder(todayData&&tomorrowData?'لا يوجد موعد متاح الآن':'بانتظار المواقيت');
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
   dateLine.textContent='جارٍ تحميل المواقيت…';dateLine.dataset.state='loading';
   showNextPrayerPlaceholder('جارٍ التحديث…');
  }
  refreshButton.disabled=true;
  try{
   if(!settings.city.trim()||!settings.country.trim())throw new Error('أدخل الدولة والمدينة.');
   const initialZone=validTimeZone((window.AnwarPrayerEngine&&window.AnwarPrayerEngine.timezoneForCountry(settings.country))||settings.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC');
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
    if(settings.enabled&&nativeBridgeReady)setStatus('تم تحديث المواقيت ومزامنة الأذان.');
    else if(settings.enabled)setStatus('تم تحديث المواقيت.');
    else setStatus('تم تحديث المواقيت.');
   }
   tick();
  }catch(error){
   if(token===loadToken){
    if(!todayData){
     dateLine.textContent=fallbackDateLabel()||'التاريخ المحلي';
     dateLine.dataset.state='fallback';
     showNextPrayerPlaceholder('تعذّر الحساب المحلي؛ تحقق من المدينة المدعومة ثم اضغط تحديث');
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
  settings.timezone=(window.AnwarPrayerEngine&&window.AnwarPrayerEngine.timezoneForCountry(settings.country))||settings.timezone;
  timeZone=validTimeZone(settings.timezone||timeZone);
  persist();todayData=null;tomorrowData=null;lastDateCheck='';
  timesGrid.replaceChildren(...PRAYERS.map(prayer=>{const item=el('div','anwar-prayer-time');item.append(el('b','',prayer.name),el('strong','','—'));return item;}));
  showNextPrayerPlaceholder('بانتظار المواقيت');
  dateLine.textContent='جارٍ تحميل المواقيت…';dateLine.dataset.state='loading';
  lastTick=Date.now();refreshTimes(false);
 });
 countrySelect.addEventListener('change',()=>{
  const selected=normalizeCountry(countrySelect.value);
  if(!selected)return;
  settings.country=selected;
  settings.countrySource='manual';
  settings.method=methodForCountry(selected);
  settings.city=defaultCity(selected);
  settings.timezone=(window.AnwarPrayerEngine&&window.AnwarPrayerEngine.timezoneForCountry(selected))||'';
  timeZone=validTimeZone(settings.timezone||timeZone);
  cityInput.value=settings.city;
  persist();updateHeader();updateLocalAccuracyNote();
  todayData=null;tomorrowData=null;lastDateCheck='';
  showNextPrayerPlaceholder('بانتظار المواقيت');
  timesGrid.replaceChildren(...PRAYERS.map(prayer=>{const item=el('div','anwar-prayer-time');item.append(el('b','',prayer.name),el('strong','','—'));return item;}));
  dateLine.textContent='جارٍ تحميل المواقيت…';dateLine.dataset.state='loading';
  lastTick=Date.now();refreshTimes(false);
 });
 backgroundPermissionButton.addEventListener('click',()=>{
  const bridge=window.AnwarAdhanBridge;
  if(!bridge||typeof bridge.postMessage!=='function'){
   setStatus('افتح مفكرة أنوار في تطبيق Android لتفعيل الأذان بالخلفية.');
   return;
  }
  settings.enabled=true;
  enabledInput.checked=true;
  persist();
  if(syncNativeBackground(true)){
   setStatus('أُرسل طلب الإذن إلى Android.');
  }else{
   setStatus('تعذّر إرسال الطلب. أعد فتح المفكرة في تطبيق Android.');
  }
 });
 enabledInput.addEventListener('change',()=>{
  settings.enabled=enabledInput.checked;persist();
  const nativeBridgeReady=syncNativeBackground();
  if(settings.enabled){
   if(nativeBridgeReady)setStatus('تمت مزامنة إعدادات الأذان مع التطبيق.');
   else setStatus('الأذان يعمل في الصفحة المفتوحة فقط.');
  }else{
   if(!audio.paused)audio.pause();
   setStatus('تم إيقاف الأذان التلقائي.');
  }
 });
 volumeInput.addEventListener('input',()=>{
  settings.volume=Math.max(0,Math.min(1,Number(volumeInput.value)||0));audio.volume=settings.volume;persist();
 });
 volumeInput.addEventListener('change',syncNativeBackground);
 testButton.addEventListener('click',()=>playAdhan('اختبار',true));
 if(todayData)renderTimes();else timesGrid.replaceChildren(...PRAYERS.map(prayer=>{
  const item=el('div','anwar-prayer-time');item.append(el('b','',prayer.name),el('strong','','—'));return item;
 }));
 updateHeader();
 // Apply settings only after the encrypted vault loads them. A fresh or locked
 // notebook exposes defaults here; unlock notifications restore the user's
 // encrypted prayer preferences without consulting plaintext browser storage.
 let lastAppliedPrayerSignature=JSON.stringify(settings);
 function applyVaultPrayerPreferences(snapshot){
  const next=normalizeSavedSettings(snapshot&&snapshot.prayer);
  const signature=JSON.stringify(next);
  if(signature===lastAppliedPrayerSignature)return;
  lastAppliedPrayerSignature=signature;
  const changed=signature!==JSON.stringify(settings);
  settings=next;
  if(!changed)return;
  timeZone=validTimeZone((window.AnwarPrayerEngine&&window.AnwarPrayerEngine.timezoneForCountry(settings.country))||settings.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC');
  countrySelect.value=settings.country;
  cityInput.value=settings.city;
  enabledInput.checked=settings.enabled;
  volumeInput.value=String(settings.volume);
  audio.volume=settings.volume;
  todayData=null;tomorrowData=null;lastDateCheck='';
  updateHeader();updatePrivacyAudioDisclosure();updateLocalAccuracyNote();
  showNextPrayerPlaceholder('بانتظار المواقيت المحفوظة');
  refreshTimes(false);
  if(settings.enabled)syncNativeBackground();
 }
 const privatePrefs=window.AnwarPrivatePreferences;
 if(privatePrefs&&typeof privatePrefs.subscribe==='function')privatePrefs.subscribe(applyVaultPrayerPreferences);
 lastTick=Date.now();
 refreshTimes(false);
 window.setInterval(tick,1000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){tick();}});
 window.addEventListener('focus',tick);
})();