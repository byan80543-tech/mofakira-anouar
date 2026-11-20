
/* Encrypted private settings shared by the notebook modules. */
(function installAnwarPrivatePreferences(root){
 'use strict';
 const DEFAULT_DHIKR='أستغفر الله العظيم وأتوب إليه';
 function normalize(value){
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const radio=source.radio&&typeof source.radio==='object'&&!Array.isArray(source.radio)?source.radio:{};
  const tasbih=source.tasbih&&typeof source.tasbih==='object'&&!Array.isArray(source.tasbih)?source.tasbih:{};
  const count=Number(tasbih.count),surah=Number(radio.surah);
  return {
   radio:{
    reciter:typeof radio.reciter==='string'?radio.reciter.trim().slice(0,120):'',
    surah:Number.isSafeInteger(surah)&&surah>=1&&surah<=114?surah:1
   },
   readerAdvance:source.readerAdvance==='s'?'s':'c',
   tasbih:{
    count:Number.isSafeInteger(count)?Math.max(0,Math.min(1000000000,count)):0,
    dhikr:typeof tasbih.dhikr==='string'&&tasbih.dhikr.trim()?tasbih.dhikr.trim().slice(0,200):DEFAULT_DHIKR,
    customDhikrs:Array.isArray(tasbih.customDhikrs)?[...new Set(tasbih.customDhikrs.filter(item=>typeof item==='string').map(item=>item.trim().replace(/\s+/g,' ').slice(0,200)).filter(Boolean))].slice(0,30):[],
    removedOfficialDhikrs:Array.isArray(tasbih.removedOfficialDhikrs)?[...new Set(tasbih.removedOfficialDhikrs.filter(item=>typeof item==='string').map(item=>item.trim().replace(/\s+/g,' ').slice(0,200)).filter(Boolean))].slice(0,60):[]
   }
  };
 }
 let state=normalize({});
 const listeners=new Set();
 let persistHandler=null;
 const copy=()=>normalize(state);
 function notify(){
  const snapshot=copy();
  for(const listener of listeners){
   try{listener(snapshot)}
   catch(error){console.warn('تعذّر تحديث إعداد خاص في مفكرة أنوار',error)}
  }
 }
 function load(value){state=normalize(value);notify();return copy()}
 function set(section,value){
  if(!['radio','readerAdvance','tasbih'].includes(section))throw new Error('إعداد خاص غير معروف.');
  const next=copy();next[section]=value;state=normalize(next);
  const snapshot=copy();
  if(persistHandler){
   try{persistHandler(snapshot)}
   catch(error){console.warn('تعذّر حفظ الإعداد الخاص في مفكرة أنوار',error)}
  }
  notify();return copy();
 }
 function subscribe(listener){
  if(typeof listener!=='function')throw new TypeError('A preference listener must be a function.');
  listeners.add(listener);
  try{listener(copy())}catch(error){console.warn('تعذّر تحديث الإعداد الخاص',error)}
  return ()=>listeners.delete(listener);
 }
 function setPersistHandler(handler){persistHandler=typeof handler==='function'?handler:null}
 root.AnwarPrivatePreferences=Object.freeze({normalize,load,get:copy,set,subscribe,setPersistHandler});
})(globalThis);
requestAnimationFrame(()=>setTimeout(()=>{

const TYPES={poem:'قصيدة',text:'نص',idea:'فكرة'},IC={poem:'🪶',text:'📜',idea:'💡'};
const FONTS=['Amiri','Amiri Quran','Aref Ruqaa','Aref Ruqaa Ink','Scheherazade New','Lateef','Harmattan','Noto Naskh Arabic','Markazi Text','Mirza','Katibeh','Gulzar','Cairo','Tajawal','Almarai','Alexandria','Changa','Mada','Readex Pro','IBM Plex Sans Arabic','Noto Sans Arabic','Noto Kufi Arabic','Vazirmatn','Rubik','Baloo Bhaijaan 2','Lemonada','Reem Kufi','Reem Kufi Fun','Reem Kufi Ink','El Messiri','Kufam','Lalezar','Rakkas','Jomhuria','Marhey','Vibes','Blaka','Qahiri','Playpen Sans Arabic','Noto Nastaliq Urdu','Traditional Arabic','Simplified Arabic','Sakkal Majalla','Segoe UI','Tahoma','Arial','Times New Roman','Courier New'];
const PROMPTS=['اكتب عن رائحة المطر على أول تراب بعد غياب طويل','قصيدة عن ضوء مصباح وحيد في آخر الليل','ماذا يقول القمر لمن ينتظر؟','صف وجهًا لا تنساه دون أن تذكر ملامحه','اكتب رسالة إلى نفسك بعد عشر سنوات','قصيدة عن وطن يسكن حقيبة سفر','ما الذي تعلّمته من الصمت؟','اكتب عن قهوة الصباح كأنها صديق قديم','بيت شعر يبدأ بكلمة «لولا»','اكتب عن بابٍ لم تجرؤ على فتحه','قصيدة عن الحنين بثلاث صور فقط'];
let S={notes:[],theme:'',palette:'blue',wallColor:'mist',paperColor:'white',days:[],preferences:globalThis.AnwarPrivatePreferences.normalize({})},cur=null,draftNote=null,flt='all',tm,speaking=false,poetryDictationController=null,poetryDictationRange=null,poetryDictationNeedsSpace=false,saved=null,storageRecoveryBlocked=false,storageRecoveryRaw=null,storageRecoveryExported=false,storageRecoveryMode='none',storageRecoveryBackupAvailable=false;
const $=id=>document.getElementById(id),pg=$('pg');
const VAULT_STORAGE_KEY='anwar_vault_v1',VAULT_BACKUP_KEY='anwar_vault_backup_v1',VAULT_MODE_KEY='anwar_vault_mode_v1';
let vaultKey=null,vaultTemplate=null,vaultUnlocked=false,vaultGateMode='setup',vaultReady=false,vaultDisableAfterUnlock=false;
let vaultSaveQueue=Promise.resolve(),vaultLastWriteError=null,vaultBackupWarningShown=false,vaultLegacyCleanupWarningShown=false;
const VAULT_IDLE_LOCK_MS=0; // القفل التلقائي معطّل؛ القفل يدوي باختيار صاحب المفكرة.
let vaultIdleTimer=null,vaultLastActivityAt=0;
const hasOwn=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
const esc=s=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
function trustedAnwarGatewayBase(){
 const raw=String(globalThis.ANWAR_API_GATEWAY_BASE||'').trim();
 if(!raw)return '';
 try{
  const base=new URL(raw);
  const labels=base.hostname.toLowerCase().split('.');
  const account=labels[1]||'';
  let validAccount=account.length>0&&account.length<=63&&account[0]!=='-'&&account[account.length-1]!=='-';
  for(let i=0;validAccount&&i<account.length;i++){
   const code=account.charCodeAt(i);
   validAccount=(code>=48&&code<=57)||(code>=97&&code<=122)||code===45;
  }
  if(base.protocol!=='https:'||labels.length!==4||labels[0]!=='anwar-api-gateway'||
     labels[2]!=='workers'||labels[3]!=='dev'||!validAccount||
     base.username||base.password||base.port||base.pathname!=='/'||base.search||base.hash){
   return '';
  }
  return base.origin;
 }catch(_error){return ''}
}
function safeHttpsURL(value){try{const u=new URL(String(value));return u.protocol==='https:'?u.href:''}catch(e){return ''}}
function safeFontName(value){return typeof value==='string'&&FONTS.includes(value)?value:'Amiri'}
function san(h){
 const t=document.createElement('template');t.innerHTML=String(h||'');
 const allowed=new Set(['DIV','P','BR','SPAN','B','STRONG','I','EM','U','UL','OL','LI','BLOCKQUOTE','FONT','H1','H2','H3','H4','HR']);
 const safeStyle=new Set(['color','background-color','font-size','font-family','font-weight','font-style','text-decoration','text-align','line-height']);
 [...t.content.querySelectorAll('*')].forEach(el=>{
  if(!allowed.has(el.tagName)){el.replaceWith(...el.childNodes);return}
  [...el.attributes].forEach(a=>{
   if(a.name==='class'&&el.tagName==='DIV'&&a.value==='v')return;
   if(a.name==='style'){
    const kept=[];a.value.split(';').forEach(rule=>{const i=rule.indexOf(':');if(i<1)return;const k=rule.slice(0,i).trim().toLowerCase(),v=rule.slice(i+1).trim();if(safeStyle.has(k)&&!/(url\s*\(|expression|javascript:|@import)/i.test(v))kept.push(k+':'+v)});
    if(kept.length)el.setAttribute('style',kept.join(';'));else el.removeAttribute('style');
   }else if(a.name==='color'&&el.tagName==='FONT')return;
   else if(a.name==='face'&&el.tagName==='FONT')return;
   else if(a.name==='size'&&el.tagName==='FONT'&&/^[1-7]$/.test(a.value))return;
   else if(a.name==='class'&&el.tagName==='DIV'&&a.value==='v')return;
   else el.removeAttribute(a.name);
  });
 });
 return t.innerHTML;
}
function cleanNote(n){
 if(!n||typeof n!=='object'||Array.isArray(n))return null;
 try{
  const type=hasOwn(TYPES,n.type)?n.type:'text';
  const raw=typeof n.html==='string'?n.html:(typeof n.text==='string'?n.text.split('\n').map(l=>'<div>'+(esc(l)||'<br>')+'</div>').join(''):'');
  const size=Number(n.size),stamp=Number(n.ts);
  const safeTime=Number.isFinite(stamp)&&Math.abs(stamp)<=8640000000000000?stamp:Date.now();
  const history=Array.isArray(n.history)?n.history.slice(-15).map(v=>{
   try{
    if(!v||typeof v!=='object'||Array.isArray(v))return null;
    const hs=Number(v.size),ht=Number(v.ts);
    return {title:String(v.title||'').slice(0,300),type:hasOwn(TYPES,v.type)?v.type:'text',html:san(v.html||''),ts:Number.isFinite(ht)&&Math.abs(ht)<=8640000000000000?ht:Date.now(),font:safeFontName(v.font),size:Number.isFinite(hs)?Math.max(14,Math.min(56,hs)):20,paper:['plain','ruled','poetry','framed'].includes(v.paper)?v.paper:'plain'};
   }catch(error){console.warn('تم تجاوز إصدار سابق غير صالح',error);return null}
  }).filter(Boolean):[];
  return {id:String(n.id??Date.now().toString(36)).slice(0,80),title:String(n.title??'').slice(0,300),type,html:san(raw),pin:n.pin===true,ts:safeTime,font:safeFontName(n.font),size:Number.isFinite(size)?Math.max(14,Math.min(56,size)):20,paper:['plain','ruled','poetry','framed'].includes(n.paper)?n.paper:'plain',history};
 }catch(error){
  console.warn('تم تجاوز سجل غير صالح في مفكرة أنوار',error);
  return null;
 }
}
function normalizeState(data){
 const d=data&&typeof data==='object'&&!Array.isArray(data)?data:{},usedIds=new Set(),notes=[];
 if(d.notes!==undefined&&!Array.isArray(d.notes))throw new Error('قائمة الأعمال المحفوظة ليست بصيغة قائمة');
 if(Array.isArray(d.notes)&&d.notes.length>2500)throw new Error('عدد الأعمال المحفوظة يتجاوز الحد الآمن');
 (Array.isArray(d.notes)?d.notes:[]).forEach((raw,index)=>{
  try{
   const note=cleanNote(raw);if(!note)return;
   const base=String(note.id||('note-'+(index+1))).slice(0,80);
   let id=base,suffix=2;
   while(usedIds.has(id)){const tail='-'+suffix++;id=base.slice(0,80-tail.length)+tail}
   note.id=id;usedIds.add(id);notes.push(note);
  }catch(error){console.warn('تم تجاهل سجل تعذّر تطبيعه',error)}
 });
 return {notes,theme:d.theme==='dark'?'dark':d.theme==='light'?'light':'',palette:['blue','green','purple','rose','amber','slate'].includes(d.palette)?d.palette:'blue',wallColor:['mist','cream','sky','mint','lavender','blush','slate','night'].includes(d.wallColor)?d.wallColor:'mist',paperColor:['white','cream','sky','mint','lavender','blush','gray','night'].includes(d.paperColor)?d.paperColor:'white',days:Array.isArray(d.days)?d.days.filter(x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)).slice(-400):[],preferences:globalThis.AnwarPrivatePreferences.normalize(d.preferences)};
}
function emptyStorageState(){return {notes:[],theme:'',palette:'blue',wallColor:'mist',paperColor:'white',days:[],preferences:globalThis.AnwarPrivatePreferences.normalize({})}}
function createNoteId(){
 const base=Date.now().toString(36),used=new Set(S.notes.map(n=>String(n.id)));
 let id=base,suffix=2;
 while(used.has(id))id=base+'-'+suffix++;
 return id;
}
function showStorageRecoveryNotice(title,message,raw){
 storageRecoveryBlocked=true;
 storageRecoveryMode=raw===null?'unavailable':'corrupt';
 storageRecoveryRaw=typeof raw==='string'?raw:null;
 storageRecoveryExported=false;
 storageRecoveryBackupAvailable=false;
 S=emptyStorageState();
 const panel=$('storageRecoveryNotice'),heading=$('storageRecoveryTitle'),description=$('storageRecoveryMessage');
 if(heading)heading.textContent=title;
 if(description)description.textContent=message;
 if(panel)panel.hidden=false;
 updateStorageRecoveryNotice();
}
function readStoredState(raw){
 const parsed=JSON.parse(raw);
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||!Array.isArray(parsed.notes))throw new Error('بنية سجل التخزين غير معروفة');
 if(parsed.notes.length>2500||parsed.notes.some(n=>n&&typeof n==='object'&&!Array.isArray(n)&&(typeof n.html==='string'?n.html:n.text).length>450000))throw new Error('سجل التخزين يتجاوز حدود السلامة');
 const normalized=normalizeState(parsed);
 if(parsed.notes.length>0&&normalized.notes.length===0)throw new Error('لم يبق أي سجل صالح بعد فحص البيانات');
 return normalized;
}

function clearVaultIdleTimer(){
 if(vaultIdleTimer!==null){clearTimeout(vaultIdleTimer);vaultIdleTimer=null}
}
function armVaultIdleTimer(){
 clearVaultIdleTimer();
 if(!VAULT_IDLE_LOCK_MS||!vaultUnlocked)return;
 const remaining=VAULT_IDLE_LOCK_MS-(Date.now()-vaultLastActivityAt);
 vaultIdleTimer=setTimeout(()=>{
  vaultIdleTimer=null;
  if(!vaultUnlocked)return;
  if(Date.now()-vaultLastActivityAt>=VAULT_IDLE_LOCK_MS)lockVault();
  else armVaultIdleTimer();
 },Math.max(1,remaining));
}
function recordVaultActivity(event){
 if(!vaultUnlocked||(event&&event.isTrusted===false))return;
 vaultLastActivityAt=Date.now();
 armVaultIdleTimer();
}
function enforceVaultIdleLock(){
 if(!VAULT_IDLE_LOCK_MS||!vaultUnlocked)return;
 if(Date.now()-vaultLastActivityAt>=VAULT_IDLE_LOCK_MS){lockVault();return}
 armVaultIdleTimer();
}
function showVaultGate(mode,message){
 vaultGateMode=mode;
 if(mode!=='unlock')vaultDisableAfterUnlock=false;
 const gate=$('vaultGate'),title=$('vaultTitle'),description=$('vaultDescription');
 const confirmRow=$('vaultConfirmRow'),confirmInput=$('vaultPasswordConfirm');
 const passwordInput=$('vaultPassword'),submit=$('vaultSubmit');
 const passwordFields=$('vaultPasswordFields'),deviceUnlock=$('vaultDeviceUnlock');
 const fallbackToggle=$('vaultPasswordFallbackToggle'),deviceManage=$('vaultDeviceManage');
 const disableEncryption=$('vaultDisableEncryptionBtn'),cancelSetup=$('vaultCancelSetupBtn');
 if(!gate)return;
 gate.hidden=false;
 title.textContent=mode==='unlock'?'افتح خزنة مفكرة أنوار':'أنشئ خزنة مفكرة أنوار';
 description.textContent=message||(mode==='unlock'
  ?'أدخل عبارة المرور لفك تشفير أعمالك المحفوظة على هذا الجهاز.'
  :'اختر عبارة مرور قوية. سنشفّر أعمالك الحالية قبل إزالة نسختها المحلية غير المشفرة.');
 confirmRow.hidden=mode!=='setup';
 confirmInput.hidden=mode!=='setup';
 confirmInput.disabled=mode!=='setup';
 confirmInput.required=mode==='setup';
 passwordInput.value='';
 confirmInput.value='';
 passwordInput.autocomplete=mode==='unlock'?'current-password':'new-password';
 passwordInput.placeholder=mode==='unlock'?'عبارة المرور التي اخترتها':'12 محرفًا على الأقل';
 submit.textContent=mode==='unlock'?'فتح الخزنة':'تشفير المفكرة وفتحها';
 const deviceApi=globalThis.AnwarDeviceUnlock;
 const deviceConfigured=mode==='unlock'&&!!(deviceApi&&deviceApi.isConfigured());
 deviceUnlock.hidden=!deviceConfigured;
 fallbackToggle.hidden=!deviceConfigured;
 passwordFields.hidden=deviceConfigured;
 deviceManage.hidden=mode!=='unlock'||!deviceApi;
 deviceManage.textContent=deviceConfigured?'إدارة فتح الهاتف':'إعداد فتح الهاتف';
 if(disableEncryption)disableEncryption.hidden=mode!=='unlock';
 if(cancelSetup)cancelSetup.hidden=mode!=='setup';
 $('vaultError').textContent='';
 submit.disabled=false;
 passwordInput.disabled=false;
 requestAnimationFrame(()=>{
  if(deviceConfigured)deviceUnlock.focus();
  else if(!passwordFields.hidden)passwordInput.focus();
 });
}
async function continueVaultAfterRecovery(){
 if(vaultUnlocked)return;
 let mode=null,stored=null,backup=null;
 try{
  mode=localStorage.getItem(VAULT_MODE_KEY);
  if(mode!=='plain'){
   stored=await AnwarVaultStorage.get(VAULT_STORAGE_KEY);
   if(stored===null)backup=await AnwarVaultStorage.get(VAULT_BACKUP_KEY);
  }
 }catch(error){
  showStorageRecoveryNotice('تعذّر الوصول إلى مخزن الخزنة الآمن','تعذّر فتح مخزن المفكرة الآمن. لا تمسح بيانات الموقع؛ أعد المحاولة بعد السماح بالتخزين في المتصفح.',null);
  return;
 }
 if(mode==='encrypted'&&stored===null&&backup===null){
  showStorageRecoveryNotice('تعذّر العثور على الخزنة المشفّرة','علامة التشفير موجودة لكن ملفات الخزنة غير متاحة. لم نفتح المفكرة دون تحقق، ولم نحذف أي بيانات.',null);
  return;
 }
 if(stored!==null||backup!==null){
  S=emptyStorageState();
  showVaultGate('unlock',stored!==null
   ?'أدخل عبارة المرور لفك تشفير أعمالك المحفوظة.'
   :'تعذّر العثور على السجل الأساسي، لكن توجد نسخة احتياطية مشفرة. أدخل عبارة المرور لاستعادتها.');
  return;
 }
 if(!prepareLegacyStateForVault())return;
 try{S.preferences=importLegacyPrivatePreferences(S.preferences)}
 catch(error){showStorageRecoveryNotice('تعذّر استعادة الإعدادات الخاصة','لم نتمكن من قراءة إعداداتك القديمة بأمان. لم نحذفها؛ أعد المحاولة بعد إتاحة تخزين الموقع.',null);return}
 finishVaultOpen();
}
function prepareLegacyStateForVault(){
 let primary=null,backup=null;
 try{
  primary=localStorage.getItem('anwar_v1');
  backup=localStorage.getItem('anwar_v1_backup_v2');
 }catch(error){
  showStorageRecoveryNotice('المتصفح لا يتيح الوصول إلى التخزين','تعذّر الوصول إلى بيانات المفكرة القديمة. لا تمسح بيانات الموقع؛ أعد المحاولة بعد السماح بالتخزين المحلي.',null);
  return false;
 }
 if(primary!==null){
  try{S=readStoredState(primary);return true}
  catch(error){
   let backupAvailable=false;
   try{if(backup!==null){readStoredState(backup);backupAvailable=true}}catch(backupError){}
   showStorageRecoveryNotice('تعذّر فتح بيانات المفكرة القديمة','احتفظنا بالسجل الخام دون تغييره. ملف الاسترداد الخام غير مشفر؛ احفظه في مكان خاص ثم استعد نسخة سليمة قبل متابعة التشفير.',primary);
   storageRecoveryBackupAvailable=backupAvailable;
   updateStorageRecoveryNotice();
   return false;
  }
 }
 if(backup!==null){
  try{S=readStoredState(backup);return true}
  catch(error){
   showStorageRecoveryNotice('تعذّر فتح النسخة الاحتياطية القديمة','النسخة القديمة غير قابلة للتحليل. احتفظنا بنصها الخام؛ هذا الملف غير مشفر.',backup);
   return false;
  }
 }
 S=emptyStorageState();
 return true;
}
function clearLegacyPlaintext(){
 let cleared=true;
 for(const key of ['anwar_v1','anwar_v1_backup_v2']){
  try{localStorage.removeItem(key);if(localStorage.getItem(key)!==null)cleared=false}
  catch(error){cleared=false;console.warn('تعذّر حذف مفتاح تخزين قديم غير مشفر',key,error)}
 }
 return cleared;
}
function importLegacyPrivatePreferences(base){
 const preferences=globalThis.AnwarPrivatePreferences.normalize(base);
 try{
  const savedRadio=localStorage.getItem('anwar_rd');
  if(savedRadio){
   const parsed=JSON.parse(savedRadio);
   if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed)){
    preferences.radio={
     reciter:typeof parsed.r==='string'?parsed.r.slice(0,120):preferences.radio.reciter,
     surah:Number.isSafeInteger(Number(parsed.n))&&Number(parsed.n)>=1&&Number(parsed.n)<=114?Number(parsed.n):preferences.radio.surah
    };
   }
  }
  const advance=localStorage.getItem('anwar_reader_advance');
  if(advance==='c'||advance==='s')preferences.readerAdvance=advance;
  const count=localStorage.getItem('anwar_tasbih_count_v1');
  if(count!==null&&/^\d{1,10}$/.test(count))preferences.tasbih.count=Math.min(1000000000,Number(count));
  const dhikr=localStorage.getItem('anwar_tasbih_dhikr_v1');
  if(typeof dhikr==='string'&&dhikr.trim())preferences.tasbih.dhikr=dhikr.slice(0,200);
 }catch(error){
  throw new Error('تعذّرت قراءة إعداداتك القديمة. لم نحذفها؛ أعد المحاولة بعد التأكد من إتاحة تخزين الموقع.');
 }
 return globalThis.AnwarPrivatePreferences.normalize(preferences);
}
function clearLegacyPrivatePreferences(){
 let cleared=true;
 for(const key of ['anwar_rd','anwar_reader_advance','anwar_tasbih_count_v1','anwar_tasbih_dhikr_v1']){
  try{localStorage.removeItem(key);if(localStorage.getItem(key)!==null)cleared=false}
  catch(error){cleared=false;console.warn('تعذّر حذف إعداد خاص قديم',key,error)}
 }
 return cleared;
}
async function persistVaultSnapshot(plaintext){
 if(!vaultUnlocked||!vaultKey||!vaultTemplate)throw new Error('خزنة المفكرة مقفلة.');
 const snapshot=JSON.parse(plaintext);
 if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot)||!Array.isArray(snapshot.notes))throw new Error('بنية بيانات المفكرة غير صالحة؛ لم نغيّر الخزنة المحفوظة.');
 if(snapshot.notes.length>2500)throw new Error('بلغت المفكرة الحد الأقصى وهو 2500 عمل. صدّر نسخة احتياطية قبل إنشاء أعمال إضافية.');
 if(snapshot.notes.some(note=>note&&typeof note==='object'&&!Array.isArray(note)&&(typeof note.html==='string'?note.html:note.text).length>450000))throw new Error('أحد الأعمال تجاوز الحد الآمن وهو 450 ألف حرف. قسّمه إلى أعمال أصغر قبل الحفظ.');
 const mainEnvelope=await AnwarVaultCrypto.encryptWithKey(vaultKey,vaultTemplate,plaintext);
 const mainText=JSON.stringify(mainEnvelope);
 await AnwarVaultStorage.set(VAULT_STORAGE_KEY,mainText);
 const storedMain=JSON.parse(await AnwarVaultStorage.get(VAULT_STORAGE_KEY)||'null');
 const verifiedMain=await AnwarVaultCrypto.decryptWithKey(vaultKey,storedMain);
 if(verifiedMain!==plaintext)throw new Error('لم تتطابق مراجعة التخزين المشفر مع البيانات الأصلية.');
 vaultTemplate=mainEnvelope;
 const settingsRemoved=clearLegacyPrivatePreferences();
 if(!settingsRemoved&&!vaultLegacyCleanupWarningShown){
  toast('حُفظت المفكرة مشفرة، لكن بقيت بعض إعدادات الخصوصية القديمة. تحقق من إتاحة التخزين المحلي ثم أعد المحاولة.',7000);
  vaultLegacyCleanupWarningShown=true;
 }else if(settingsRemoved)vaultLegacyCleanupWarningShown=false;
 try{
  const backupEnvelope=await AnwarVaultCrypto.encryptWithKey(vaultKey,vaultTemplate,plaintext);
  await AnwarVaultStorage.set(VAULT_BACKUP_KEY,JSON.stringify(backupEnvelope));
  const storedBackup=JSON.parse(await AnwarVaultStorage.get(VAULT_BACKUP_KEY)||'null');
  const verifiedBackup=await AnwarVaultCrypto.decryptWithKey(vaultKey,storedBackup);
  if(verifiedBackup!==plaintext)throw new Error('تعذّر التحقق من النسخة الاحتياطية المشفرة.');
  vaultBackupWarningShown=false;
 }catch(backupError){
  console.warn('تعذّر تحديث النسخة الاحتياطية المشفرة؛ بقي الحفظ الأساسي مشفرًا',backupError);
  if(!vaultBackupWarningShown){
   toast('حُفظت المفكرة مشفرة، لكن تعذّر تحديث النسخة الاحتياطية. نزّل نسخة مشفرة من زر النسخ الاحتياطي.',6500);
   vaultBackupWarningShown=true;
  }
 }
 return mainEnvelope;
}
function finishVaultOpen(){
 globalThis.AnwarPrivatePreferences.load(S.preferences);
 vaultUnlocked=true;
 vaultReady=true;
 vaultLastWriteError=null;
 recordVaultActivity();
 $('vaultGate').hidden=true;
 const lockButton=$('vaultLockBtn');
 lockButton.hidden=false;
 lockButton.title=vaultKey?'قفل المفكرة الآن؛ ستحتاج إلى كلمة المرور أو قفل الهاتف لفتحها مجددًا.':'تفعيل التشفير والقفل الاختياري للمفكرة؛ تبقى المفكرة الآن في وضع الاستخدام الحر.';
 lockButton.setAttribute('aria-label',vaultKey?'قفل المفكرة المشفّرة':'تفعيل قفل المفكرة وتشفيرها');
 theme();
 chips();
 if(!matchMedia('(max-width:800px)').matches&&S.notes.length){
  openNote(S.notes.slice().sort((a,b)=>b.ts-a.ts)[0]);
 }else openNote(null);
 renderList();
}
async function bootVault(){
 let mode=null,savedVault=null,savedBackup=null;
 try{
  mode=localStorage.getItem(VAULT_MODE_KEY);
  if(mode!=='plain'){
   savedVault=await AnwarVaultStorage.get(VAULT_STORAGE_KEY);
   if(savedVault===null)savedBackup=await AnwarVaultStorage.get(VAULT_BACKUP_KEY);
  }
 }catch(error){
  showStorageRecoveryNotice('المتصفح لا يتيح الوصول إلى الخزنة','تعذّر الوصول إلى مخزن المفكرة الآمن. لا تحذف بيانات الموقع؛ أعد المحاولة بعد السماح بالتخزين.',null);
  theme();chips();openNote(null);return;
 }
 if(mode==='encrypted'&&savedVault===null&&savedBackup===null){
  showStorageRecoveryNotice('تعذّر العثور على الخزنة المشفّرة','علامة التشفير موجودة لكن ملفات الخزنة غير متاحة. لم نفتح المفكرة دون تحقق، ولم نحذف أي بيانات.',null);
  theme();chips();openNote(null);return;
 }
 if(savedVault!==null||savedBackup!==null){
  S=emptyStorageState();
  showVaultGate('unlock',savedVault!==null
   ?'أدخل عبارة المرور لفك تشفير أعمالك. لا تُحفظ كلمة المرور على الجهاز.'
   :'تعذّر العثور على السجل الأساسي، لكن توجد نسخة احتياطية مشفرة. أدخل عبارة المرور لاستعادتها.');
  theme();chips();openNote(null);return;
 }
 if(!prepareLegacyStateForVault()){theme();chips();openNote(null);return}
 try{S.preferences=importLegacyPrivatePreferences(S.preferences)}
 catch(error){
  showStorageRecoveryNotice('تعذّر استعادة الإعدادات الخاصة','لم نتمكن من قراءة إعداداتك القديمة بأمان. لم نحذفها؛ أعد المحاولة بعد إتاحة تخزين الموقع.',null);
  theme();chips();openNote(null);return;
 }
 finishVaultOpen();
}
async function submitVaultForm(event,suppliedPassword){
 if(event&&typeof event.preventDefault==='function')event.preventDefault();
 const password=typeof suppliedPassword==='string'?suppliedPassword:$('vaultPassword').value;
 const confirmation=$('vaultPasswordConfirm').value;
 const submit=$('vaultSubmit');
 const showError=message=>{$('vaultError').textContent=message};
 const passwordLength=Array.from(password).length;
 if(vaultGateMode==='setup'){
  if(passwordLength<12){showError('عبارة المرور قصيرة. استخدم 12 محرفًا على الأقل.');return}
  if(password.length>2048){showError('عبارة المرور طويلة جدًا. الحد الأقصى 2048 محرفًا.');return}
  if(password!==confirmation){showError('عبارتا المرور غير متطابقتين.');return}
 }else if(!password){showError('أدخل عبارة المرور أولًا.');return}
 else if(password.length>2048){showError('عبارة المرور تتجاوز الحد الأقصى وهو 2048 محرفًا.');return}
 submit.disabled=true;
 $('vaultPassword').disabled=true;$('vaultPasswordConfirm').disabled=true;
 showError('يجري تجهيز التشفير والتحقق من سلامة البيانات…');
 let setupPrimaryText=null,setupPrimaryWritten=false,setupBackupText=null,setupBackupWritten=false,setupPreviousMode=null,setupModeLoaded=false;
 try{
  if(vaultGateMode==='setup'){
   setupPreviousMode=localStorage.getItem(VAULT_MODE_KEY);setupModeLoaded=true;
   S.preferences=importLegacyPrivatePreferences(S.preferences);
   const plaintext=JSON.stringify(S);
   const created=await AnwarVaultCrypto.createVault(password,plaintext);
   setupPrimaryText=JSON.stringify(created.envelope);setupPrimaryWritten=true;
   await AnwarVaultStorage.set(VAULT_STORAGE_KEY,setupPrimaryText);
   const readBack=JSON.parse(await AnwarVaultStorage.get(VAULT_STORAGE_KEY)||'null');
   const verified=await AnwarVaultCrypto.decryptWithKey(created.key,readBack);
   const verifiedState=readStoredState(verified);
   if(JSON.stringify(verifiedState)!==JSON.stringify(S))throw new Error('لم تتطابق البيانات بعد اختبار فك التشفير. لم نحذف النسخة القديمة.');
   vaultKey=created.key;vaultTemplate=readBack;vaultUnlocked=true;
   try{
    const backup=await AnwarVaultCrypto.encryptWithKey(vaultKey,vaultTemplate,plaintext);
    setupBackupText=JSON.stringify(backup);setupBackupWritten=true;
    await AnwarVaultStorage.set(VAULT_BACKUP_KEY,setupBackupText);
    const backupRead=JSON.parse(await AnwarVaultStorage.get(VAULT_BACKUP_KEY)||'null');
    if(await AnwarVaultCrypto.decryptWithKey(vaultKey,backupRead)!==plaintext)throw new Error('تعذّر التحقق من النسخة المشفرة الإضافية.');
    vaultBackupWarningShown=false;
   }catch(backupError){console.warn('تعذّر إنشاء النسخة المشفرة الإضافية أثناء الإعداد',backupError);vaultBackupWarningShown=true}
   localStorage.setItem(VAULT_MODE_KEY,'encrypted');
   if(localStorage.getItem(VAULT_MODE_KEY)!=='encrypted')throw new Error('تعذّر تثبيت وضع التشفير على هذا الجهاز. بقيت بياناتك السابقة كما هي.');
   const removed=clearLegacyPlaintext(),removedPreferences=clearLegacyPrivatePreferences();
   $('vaultPassword').value='';$('vaultPasswordConfirm').value='';finishVaultOpen();
   if(!removed||!removedPreferences)toast('شُفّرت المفكرة، لكن تعذّر حذف بعض النسخ النصية القديمة أو إعداداتها. لا تمسح بيانات الموقع؛ أعد المحاولة بعد إتاحة التخزين.',7500);
   else if(vaultBackupWarningShown)toast('تم تشفير أعمالك والتحقق منها. نزّل نسخة احتياطية مشفرة إضافية الآن.',6500);
   else toast('اكتمل تشفير مفكرة أنوار والتحقق من النسخة الاحتياطية.',4500);
   return;
  }

  let envelope=null,unlocked=null,restoredState=null,recoveredFromBackup=false,hasEncryptedPreferences=false,candidateError=null;
  for(const candidate of [{key:VAULT_STORAGE_KEY,backup:false},{key:VAULT_BACKUP_KEY,backup:true}]){
   const raw=await AnwarVaultStorage.get(candidate.key);
   if(raw===null)continue;
   try{
    const candidateEnvelope=JSON.parse(raw);
    const candidateUnlocked=await AnwarVaultCrypto.decryptEnvelope(password,candidateEnvelope);
    const candidateDecoded=JSON.parse(candidateUnlocked.plaintext);
    const candidateHasPreferences=!!(candidateDecoded&&typeof candidateDecoded==='object'&&!Array.isArray(candidateDecoded)&&hasOwn(candidateDecoded,'preferences')&&candidateDecoded.preferences&&typeof candidateDecoded.preferences==='object'&&!Array.isArray(candidateDecoded.preferences));
    const candidateState=readStoredState(candidateUnlocked.plaintext);
    envelope=candidateEnvelope;unlocked=candidateUnlocked;restoredState=candidateState;
    hasEncryptedPreferences=candidateHasPreferences;recoveredFromBackup=candidate.backup;break;
   }catch(error){candidateError=error;console.warn('تجاوزنا سجل خزنة لم يجتز التحقق الكامل',candidate.key,error)}
  }
  if(!unlocked)throw new Error(candidateError
   ?'لم تُفتح الخزنة. تعذّر التحقق من السجل الأساسي والنسخة الاحتياطية؛ احتفظ بملفاتك ولا تمسح بيانات الموقع.'
   :'لم يُعثر على خزنة مشفرة قابلة للتحقق. احتفظ ببيانات الموقع ولا تمسحها.');

  vaultKey=unlocked.key;vaultTemplate=envelope;S=restoredState;vaultUnlocked=true;
  if(vaultDisableAfterUnlock){
   if(!hasEncryptedPreferences)S.preferences=importLegacyPrivatePreferences(S.preferences);
   await persistPlainSnapshot(JSON.stringify(S));
   vaultKey=null;vaultTemplate=null;
   let encryptedCopiesRemoved=true;
   try{await AnwarVaultStorage.remove(VAULT_STORAGE_KEY)}catch(error){encryptedCopiesRemoved=false}
   try{await AnwarVaultStorage.remove(VAULT_BACKUP_KEY)}catch(error){encryptedCopiesRemoved=false}
   try{if(globalThis.AnwarDeviceUnlock)AnwarDeviceUnlock.disable()}catch(error){console.warn('تعذّر إزالة ربط فتح الهاتف القديم بعد إيقاف التشفير',error)}
   vaultDisableAfterUnlock=false;$('vaultPassword').value='';$('vaultPasswordConfirm').value='';finishVaultOpen();
   toast(encryptedCopiesRemoved?'أُوقف التشفير بنجاح. أصبحت المفكرة تفتح دون رمز، ويمكنك تفعيل القفل يدويًا في أي وقت.':'تم إيقاف التشفير وحُفظت المفكرة دون قفل. بقيت نسخة مشفرة قديمة غير مستخدمة في التخزين.',6500);
   return;
  }

  let migratedPreferences=false;
  if(!hasEncryptedPreferences){
   S.preferences=importLegacyPrivatePreferences(S.preferences);
   try{await persistVaultSnapshot(JSON.stringify(S));migratedPreferences=true}
   catch(migrationError){vaultUnlocked=false;vaultKey=null;vaultTemplate=null;S=emptyStorageState();throw new Error('تم التحقق من كلمة المرور، لكن تعذّر حفظ إعداداتك القديمة داخل الخزنة. احتفظنا بنسخها القديمة؛ أعد المحاولة بعد إتاحة التخزين.')}
  }
  let primaryRepairSucceeded=true;
  if(recoveredFromBackup&&!migratedPreferences){
   try{await AnwarVaultStorage.set(VAULT_STORAGE_KEY,JSON.stringify(envelope))}
   catch(repairError){primaryRepairSucceeded=false;console.warn('فُتحت النسخة الاحتياطية المتحقق منها، لكن تعذّر إصلاح السجل الأساسي.',repairError)}
  }
  const removedLegacy=clearLegacyPlaintext(),removedPreferences=clearLegacyPrivatePreferences();
  $('vaultPassword').value='';finishVaultOpen();
  if(recoveredFromBackup&&!primaryRepairSucceeded)toast('استعدنا النسخة الاحتياطية وفتحت المفكرة، لكن تعذّر إصلاح السجل الأساسي. لا تمسح بيانات الموقع وأنشئ نسخة احتياطية مشفرة.',7500);
  else if(recoveredFromBackup)toast('تعذّر التحقق من السجل الأساسي، فاستعدنا النسخة الاحتياطية المشفرة السليمة.',6000);
  else toast('فُتحت الخزنة بنجاح.',2500);
  if(!removedLegacy||!removedPreferences)toast('تنبيه خصوصية: بقيت بيانات نصية قديمة في التخزين المحلي. لا تمسح بيانات الموقع؛ أعد المحاولة بعد إتاحة التخزين.',7500);
 }catch(error){
  if(vaultGateMode==='setup'&&setupPrimaryWritten&&!vaultReady){
   vaultUnlocked=false;vaultKey=null;vaultTemplate=null;
   try{
    if(await AnwarVaultStorage.get(VAULT_STORAGE_KEY)===setupPrimaryText)await AnwarVaultStorage.remove(VAULT_STORAGE_KEY);
    if(setupBackupWritten&&await AnwarVaultStorage.get(VAULT_BACKUP_KEY)===setupBackupText)await AnwarVaultStorage.remove(VAULT_BACKUP_KEY);
    if(setupModeLoaded){if(setupPreviousMode===null)localStorage.removeItem(VAULT_MODE_KEY);else localStorage.setItem(VAULT_MODE_KEY,setupPreviousMode)}
   }catch(cleanupError){console.warn('تعذّر التراجع عن إعداد التشفير غير المكتمل؛ لم تُحذف النسخة القديمة.',cleanupError)}
  }
  console.warn('تعذّر إعداد خزنة مفكرة أنوار أو فتحها',error);
  showError(error&&error.message?error.message:'تعذّر إتمام العملية. لم نحذف البيانات القديمة.');
  submit.disabled=false;$('vaultPassword').disabled=false;$('vaultPasswordConfirm').disabled=vaultGateMode!=='setup';
 }
}
function beginVaultDisableEncryption(){
 if(vaultGateMode!=='unlock')return;
 if(!confirm('سيُفك تشفير أعمالك وتُحفظ كنص عادي على هذا الجهاز. لن يطلب الموقع رمزًا عند فتح المفكرة لاحقًا، ويمكنك إعادة تفعيل التشفير من زر القفل. هل تتابع؟'))return;
 vaultDisableAfterUnlock=true;
 $('vaultDeviceUnlock').hidden=true;$('vaultPasswordFallbackToggle').hidden=true;$('vaultDeviceManage').hidden=true;
 $('vaultPasswordFields').hidden=false;$('vaultPassword').value='';$('vaultPassword').disabled=false;$('vaultPassword').focus();
 $('vaultPasswordConfirm').value='';
 $('vaultSubmit').textContent='فتح المفكرة وإيقاف التشفير';
 $('vaultDescription').textContent='أدخل عبارة المرور الحالية للتحقق من ملكيتك. سنحفظ نسخة محلية قابلة للقراءة ونتحقق منها قبل إزالة الخزنة المشفّرة.';
 $('vaultError').textContent='لن يحدث أي تغيير قبل نجاح التحقق من كلمة المرور والحفظ المحلي.';
 $('vaultDisableEncryptionBtn').hidden=true;
}
async function cancelVaultSetup(){
 if(vaultGateMode!=='setup'||vaultKey)return;
 const button=$('vaultCancelSetupBtn');
 if(button)button.disabled=true;
 try{
  vaultUnlocked=true;
  flushPrivatePreferenceSave();
  if(tm){clearTimeout(tm);tm=null}
  if(typeof flushPendingEdit==='function')flushPendingEdit(false);
  await vaultSaveQueue;
  if(vaultLastWriteError)throw new Error('لم يكتمل آخر حفظ. أعد المحاولة قبل متابعة الاستخدام الحر.');
  await persistPlainSnapshot(JSON.stringify(S));
  $('vaultPassword').value='';$('vaultPasswordConfirm').value='';
  if(button)button.disabled=false;
  finishVaultOpen();toast('استمر وضع الاستخدام الحر. حُفظت البيانات دون تفعيل التشفير.',4000);
 }catch(error){
  vaultUnlocked=false;
  if(button)button.disabled=false;
  $('vaultError').textContent=error&&error.message?error.message:'تعذّر التحقق من حفظ البيانات. لم نغلق نافذة الحماية.';
 }
}
async function unlockVaultWithDevice(){
 const button=$('vaultDeviceUnlock');
 if(!globalThis.AnwarDeviceUnlock||!AnwarDeviceUnlock.isConfigured()){
  $('vaultError').textContent='لم يُعثر على إعداد صالح لفتح الهاتف. استخدم كلمة المرور الأساسية.';
  showVaultGate('unlock','استخدم كلمة المرور الأساسية لفتح الخزنة.');
  return;
 }
 button.disabled=true;
 $('vaultError').textContent='تحقق من قفل الهاتف في نافذة النظام…';
 let password='';
 try{
  password=await AnwarDeviceUnlock.unlockPassword();
  await submitVaultForm({preventDefault(){}},password);
 }catch(error){
  $('vaultError').textContent=error&&error.message?error.message:'تعذّر فتح الخزنة بقفل الهاتف. استخدم كلمة المرور الأساسية.';
 }finally{
  password='';
  button.disabled=false;
 }
}
function openVaultDeviceSetupDialog(){
 const dialog=$('vaultDeviceSetupDialog');
 const configured=AnwarDeviceUnlock.isConfigured();
 const supported=AnwarDeviceUnlock.supported();
 $('vaultDeviceSetupPassword').value='';
 $('vaultDeviceSetupForm').hidden=configured||!supported;
 $('vaultDeviceDisableBtn').hidden=!configured;
 $('vaultDeviceSetupStatus').textContent=configured
  ?'الفتح السريع مفعّل لهذا المتصفح. يمكنك تعطيله من هنا.'
  :supported
   ?'عند التفعيل سيُطلب تحقق الهاتف الآمن. ستبقى كلمة المرور الأساسية وسيلة الاسترداد.'
   :'هذا المتصفح أو الجهاز لا يدعم ميزة الاعتماد الآمن المطلوبة. يمكنك متابعة استخدام كلمة المرور الأساسية.';
 if(dialog&&!dialog.open)dialog.showModal();
}
async function submitVaultDeviceSetup(event){
 event.preventDefault();
 const button=$('vaultDeviceSetupSubmit');
 const input=$('vaultDeviceSetupPassword');
 const password=input.value;
 if(Array.from(password).length<12){$('vaultDeviceSetupStatus').textContent='أدخل كلمة المرور الأساسية كاملة.';return}
 button.disabled=true;
 $('vaultDeviceSetupStatus').textContent='يجري التحقق من كلمة المرور وتجهيز قفل الهاتف…';
 const wasLocked=!vaultUnlocked;
 try{
  let verified=null;
  if(vaultUnlocked){
   if(tm){clearTimeout(tm);tm=null;flushPendingEdit(false)}
   flushPrivatePreferenceSave();
   await vaultSaveQueue;
   if(vaultLastWriteError)throw new Error('لم يكتمل آخر حفظ. أصلح الحفظ قبل تفعيل قفل الهاتف.');
   if(!vaultTemplate)throw new Error('تعذّر العثور على إعداد الخزنة الحالي.');
   verified=await AnwarVaultCrypto.decryptEnvelope(password,vaultTemplate);
   if(verified.plaintext!==JSON.stringify(S))throw new Error('تغيّرت بيانات المفكرة أثناء التحقق. أعد المحاولة بعد اكتمال الحفظ.');
  }else{
   let primary=null,backup=null;
   try{
    primary=await AnwarVaultStorage.get(VAULT_STORAGE_KEY);
    backup=await AnwarVaultStorage.get(VAULT_BACKUP_KEY);
   }catch(error){throw new Error('تعذّر الوصول إلى الخزنة. لم تتغير أي بيانات.')}
   const candidates=[primary,backup].filter(Boolean);
   let lastError=null;
   for(const raw of candidates){
    try{
     verified=await AnwarVaultCrypto.decryptEnvelope(password,JSON.parse(raw));
     readStoredState(verified.plaintext);
     break;
    }catch(error){lastError=error}
   }
   if(!verified)throw new Error(candidates.length?'لم تطابق كلمة المرور الخزنة أو نسختها الاحتياطية.':'لم يُعثر على خزنة مشفرة يمكن التحقق منها.');
  }
  await AnwarDeviceUnlock.protectPassword(password);
  input.value='';
  $('vaultDeviceSetupStatus').textContent='تم تفعيل الفتح بقفل الهاتف. ستظل كلمة المرور الأساسية لازمة للاسترداد.';
  $('vaultDeviceSetupForm').hidden=true;
  $('vaultDeviceDisableBtn').hidden=false;
  $('vaultDeviceSetupDialog').close();
  if(wasLocked)showVaultGate('unlock','يمكنك الآن فتح الخزنة بقفل الهاتف، أو استخدام كلمة المرور الأساسية.');
  toast('تم تفعيل الفتح بقفل الهاتف.',3500);
 }catch(error){
  input.value='';
  $('vaultDeviceSetupStatus').textContent=error&&error.message?error.message:'تعذّر التفعيل. بقيت الخزنة وكلمة المرور الأساسية دون تغيير.';
 }finally{
  button.disabled=false;
 }
}
function disableVaultDeviceUnlock(){
 if(!AnwarDeviceUnlock.isConfigured()){$('vaultDeviceSetupStatus').textContent='لا يوجد فتح سريع مفعّل.';return}
 if(!confirm('سيُعطّل فتح المفكرة بقفل الهاتف على هذا المتصفح. لن تتأثر الخزنة أو كلمة المرور الأساسية. هل تتابع؟'))return;
 try{
  AnwarDeviceUnlock.disable();
  $('vaultDeviceDisableBtn').hidden=true;
  $('vaultDeviceSetupForm').hidden=!AnwarDeviceUnlock.supported();
  $('vaultDeviceSetupStatus').textContent='تم تعطيل الفتح السريع لهذه المفكرة. قد يبقى اعتمادها ظاهرًا في مدير كلمات المرور بالنظام، لكنه لم يعد مرتبطًا بالخزنة هنا.';
  $('vaultDeviceSetupDialog').close();
  if(!vaultUnlocked)showVaultGate('unlock','استخدم كلمة المرور الأساسية لفتح الخزنة.');
  toast('تم تعطيل الفتح السريع. كلمة المرور الأساسية ما زالت تعمل.',4500);
 }catch(error){$('vaultDeviceSetupStatus').textContent=error.message||'تعذّر تعطيل الفتح السريع.'}
}
async function lockVault(){
 if(!vaultUnlocked)return;
 if(!vaultKey||!vaultTemplate){
  try{
   flushPrivatePreferenceSave();
   if(tm){clearTimeout(tm);tm=null}
   if(typeof flushPendingEdit==='function')flushPendingEdit(false);
   await vaultSaveQueue;
   if(vaultLastWriteError)throw new Error('لم يكتمل آخر حفظ. أبقينا المفكرة مفتوحة لحماية تعديلاتك.');
   clearVaultIdleTimer();vaultUnlocked=false;vaultReady=false;
   showVaultGate('setup','فعّل القفل الاختياري بإنشاء عبارة مرور قوية. حفظنا تعديلاتك أولًا، وستُشفّر أعمالك وتُتحقق النسخة قبل إزالة أي نسخة نصية قديمة.');
  }catch(error){
   toast(error&&error.message?error.message:'تعذّر حفظ المفكرة قبل إعداد القفل. بقيت مفتوحة دون تغيير.',6000);
  }
  return;
 }
 clearVaultIdleTimer();
 try{
  flushPrivatePreferenceSave();
  if(tm){clearTimeout(tm);tm=null}
  if(typeof flushPendingEdit==='function')flushPendingEdit(false);
  await vaultSaveQueue;
  if(vaultLastWriteError)throw new Error('لم يكتمل آخر حفظ مشفر. أبقينا المفكرة مفتوحة لحماية تعديلاتك.');
  vaultUnlocked=false;
  vaultKey=null;
  S=emptyStorageState();
  globalThis.AnwarPrivatePreferences.load(S.preferences);
  cur=null;draftNote=null;
  pg.innerHTML='';
  $('t').value='';
  $('bt').value='';
  $('backupPassword').value='';
  $('historyItems').innerHTML='';
  $('archiveItems').innerHTML='';
  renderList();
  vaultReady=false;
  showVaultGate('unlock',globalThis.AnwarDeviceUnlock&&AnwarDeviceUnlock.isConfigured()?'الخزنة مقفلة. اضغط «فتح بقفل الهاتف» للتحقق بقفل جهازك، أو اختر كلمة المرور الأساسية عند الحاجة.':'الخزنة مقفلة. افتحها بكلمة المرور الأساسية، أو أعد إعداد الفتح بقفل الهاتف من خيار «إعداد فتح الهاتف».');
  toast('قُفلت المفكرة. بقيت البيانات محفوظة بالتشفير.',3500);
 }catch(error){
  toast(error.message||'تعذّر قفل المفكرة قبل إتمام الحفظ.',6000);
  if(vaultUnlocked){vaultLastActivityAt=Date.now();armVaultIdleTimer()}
 }
}
async function openEncryptedBackupDialog(){
 flushPrivatePreferenceSave();
 if(!vaultUnlocked||!vaultKey){toast('افتح الخزنة أولًا لإنشاء نسخة احتياطية.',4000);return}
 try{
  await vaultSaveQueue;
  const snapshot=JSON.stringify(S);
  const envelope=await AnwarVaultCrypto.encryptWithKey(vaultKey,vaultTemplate,snapshot);
  $('bt').value=JSON.stringify(envelope,null,2);
  $('backupPassword').value='';
  $('dg').showModal();
 }catch(error){
  console.warn('تعذّر تجهيز النسخة الاحتياطية المشفرة',error);
  toast('تعذّر إنشاء نسخة احتياطية مشفرة. لم نعرض البيانات بصيغة مكشوفة.',6000);
 }
}
function readEncryptedBackupText(){
 const textValue=$('bt').value.trim();
 if(!textValue)throw new Error('لا توجد نسخة احتياطية في الحقل.');
 const envelope=JSON.parse(textValue);
 AnwarVaultCrypto.validateEnvelope(envelope);
 return textValue;
}
function copyEncryptedBackup(){
 try{
  const textValue=readEncryptedBackupText();
  if(!navigator.clipboard||!navigator.clipboard.writeText){$('bt').select();toast('النسخة مشفرة. حدد النص لنسخه يدويًا.',4500);return}
  navigator.clipboard.writeText(textValue).then(()=>toast('تم نسخ النسخة الاحتياطية المشفرة.',3500),()=>toast('تعذّر النسخ؛ يمكنك تحديد النص يدويًا.',4500));
 }catch(error){toast('النسخ متاح للنسخ الاحتياطية المشفرة فقط.',4500)}
}
function downloadEncryptedBackup(){
 let textValue='';
 try{textValue=readEncryptedBackupText()}catch(error){toast('التنزيل متاح لملف خزنة مشفر صالح فقط.',4500);return}
 try{
  const blob=new Blob([textValue],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob),anchor=document.createElement('a');
  anchor.href=url;anchor.download='mofakira-anouar-encrypted-backup.json';anchor.rel='noopener';
  document.body.append(anchor);anchor.click();anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
  toast('تم تنزيل النسخة الاحتياطية المشفرة.',3500);
 }catch(error){toast('تعذّر تنزيل النسخة الاحتياطية.',4500)}
}
async function restoreEncryptedBackup(){
 if(!vaultUnlocked||!vaultKey){toast('افتح الخزنة أولًا.',3500);return}
 const backupText=$('bt').value.trim();
 if(!backupText){toast('الصق محتوى النسخة الاحتياطية أولًا.',4000);return}
 if(backupText.length>12000000){toast('حجم النسخة الاحتياطية يتجاوز الحد الآمن.',5000);return}
 try{
  const parsed=JSON.parse(backupText);
  let next;
  if(parsed&&parsed.format===AnwarVaultCrypto.format){
   const backupPassword=$('backupPassword').value;
   if(!backupPassword){toast('أدخل كلمة مرور النسخة الاحتياطية لفك تشفيرها.',5000);return}
   const decrypted=await AnwarVaultCrypto.decryptEnvelope(backupPassword,parsed);
   next=readStoredState(decrypted.plaintext);
  }else if(parsed&&typeof parsed==='object'&&Array.isArray(parsed.notes)){
   next=normalizeState(parsed);
  }else throw new Error('ليست نسخة مفكرة مدعومة أو نسخة مشفرة صالحة.');
  if(!confirm('سيُستبدل محتوى المفكرة الحالي بمحتوى النسخة بعد التحقق منها وتشفيرها. هل تتابع؟'))return;
  await vaultSaveQueue;
  const plaintext=JSON.stringify(next);
  await persistVaultSnapshot(plaintext);
  S=next;
  openNote(null);theme();chips();renderList();
  $('backupPassword').value='';
  $('dg').close();
  toast('تمت استعادة النسخة وتخزينها مشفرة.',4500);
 }catch(error){
  console.warn('تعذّرت استعادة النسخة الاحتياطية المشفرة',error);
  toast(error&&error.message?error.message:'النسخة غير صالحة أو كلمة المرور غير صحيحة. لم نستبدل بيانات المفكرة.',6500);
 }
}

function updateStorageRecoveryNotice(){
 const panel=$('storageRecoveryNotice'),title=$('storageRecoveryTitle'),message=$('storageRecoveryMessage'),exportButton=$('exportRecovery'),freshButton=$('startFresh'),restoreButton=$('restoreBackup'),retryButton=$('retryStorageAccess');
 if(!panel)return;
 panel.hidden=false;
 if(storageRecoveryMode==='unavailable'){
  if(title)title.textContent='المتصفح لا يتيح الوصول إلى التخزين';
  if(message)message.textContent='تعذّر على المتصفح فتح مخزن مفكرة أنوار. لا يمكن الجزم بوجود بيانات سابقة أو بفسادها؛ لا تمسح بيانات الموقع، وأعد المحاولة في متصفح يسمح بالتخزين المحلي.';
 }else{
  if(title)title.textContent='توقّف الحفظ حمايةً لبياناتك';
  if(message)message.textContent='تعذّر تحليل سجل مفكرة أنوار المحفوظ. نزّل الملف الخام أولاً، ثم استعد نسخة احتياطية صالحة أو ابدأ مفكرة جديدة.';
 }
 if(exportButton)exportButton.disabled=storageRecoveryRaw===null;
 if(freshButton)freshButton.hidden=storageRecoveryMode!=='corrupt';
 if(restoreButton)restoreButton.hidden=!(storageRecoveryMode==='corrupt'&&storageRecoveryBackupAvailable);
 if(retryButton)retryButton.hidden=false;
}
function clearStorageRecovery(){
 storageRecoveryBlocked=false;storageRecoveryRaw=null;storageRecoveryExported=false;storageRecoveryMode='none';storageRecoveryBackupAvailable=false;
 const panel=$('storageRecoveryNotice');if(panel)panel.hidden=true;
}
function load(){
 let raw;
 try{raw=localStorage.getItem('anwar_v1')}
 catch(error){
  showStorageRecoveryNotice('المتصفح لا يتيح الوصول إلى التخزين','تعذّر على المتصفح الوصول إلى بيانات المفكرة. أعد المحاولة دون مسح بيانات الموقع.',null);
  console.warn('تعذّرت قراءة التخزين المحلي لمفكرة أنوار',error);
  return;
 }
 if(raw!==null){
  try{S=readStoredState(raw);return}
  catch(primaryError){console.warn('تعذّرت قراءة الحالة الأساسية لمفكرة أنوار',primaryError)}
  let backupAvailable=false;
  try{
   const backupRaw=localStorage.getItem('anwar_v1_backup_v2');
   if(backupRaw){readStoredState(backupRaw);backupAvailable=true}
  }catch(backupError){console.warn('لم تتوفر نسخة احتياطية صالحة للقراءة',backupError)}
  showStorageRecoveryNotice('تعذّر فتح بيانات المفكرة','احتفظنا بالسجل الخام دون تغييره. نزّله أولاً قبل استعادة النسخة الاحتياطية أو بدء مفكرة جديدة.',raw);
  storageRecoveryBackupAvailable=backupAvailable;
  updateStorageRecoveryNotice();
  return;
 }
 if(raw===null){
  let backupRaw=null;
  try{backupRaw=localStorage.getItem('anwar_v1_backup_v2')}
  catch(backupError){
   showStorageRecoveryNotice('المتصفح لا يتيح الوصول إلى التخزين','تعذّر فحص النسخة الاحتياطية. أعد المحاولة دون مسح بيانات الموقع.',null);
   console.warn('تعذّرت قراءة النسخة الاحتياطية',backupError);
   return;
  }
  if(backupRaw!==null){
   try{
    S=readStoredState(backupRaw);
    try{localStorage.setItem('anwar_v1',JSON.stringify(S))}catch(repairError){console.warn('تعذّر إنشاء السجل الأساسي من النسخة الاحتياطية',repairError)}
    toast('استعدنا نسخة سليمة من الحفظ الاحتياطي.',4500);
    return;
   }catch(backupError){
    showStorageRecoveryNotice('تعذّر فتح النسخة الاحتياطية','النسخة الاحتياطية غير قابلة للتحليل. نزّل سجلها الخام قبل بدء مفكرة جديدة.',backupRaw);
    console.warn('النسخة الاحتياطية غير صالحة',backupError);
    return;
   }
  }
  S=emptyStorageState();
 }
}
async function retryStorageAccess(){
 if(!storageRecoveryBlocked)return false;
 let mode=null,existingVault=null,existingBackup=null;
 try{
  mode=localStorage.getItem(VAULT_MODE_KEY);
  if(mode!=='plain'){
   existingVault=await AnwarVaultStorage.get(VAULT_STORAGE_KEY);
   if(existingVault===null)existingBackup=await AnwarVaultStorage.get(VAULT_BACKUP_KEY);
  }
 }catch(error){toast('لا يزال المتصفح يمنع الوصول إلى مخزن الخزنة الآمن؛ لم تتغير أي بيانات.',5000);return false}
 if(mode==='encrypted'&&existingVault===null&&existingBackup===null){toast('لا تزال ملفات الخزنة المشفّرة غير متاحة؛ لم نفتح المفكرة دون تحقق.',5000);return false}
 clearStorageRecovery();
 await continueVaultAfterRecovery();
 if(storageRecoveryBlocked)return false;
 if(vaultGateMode==='unlock'||vaultUnlocked){
  theme();chips();openNote(null);renderList();
  toast(vaultGateMode==='unlock'?'عاد الوصول. أدخل عبارة المرور لفتح الخزنة.':'عاد الوصول إلى المفكرة بنجاح.',4000);
  return true;
 }
 return false;
}
async function restoreStorageBackup(){
 if(!storageRecoveryBlocked||storageRecoveryMode!=='corrupt'||storageRecoveryRaw===null)return;
 if(!storageRecoveryExported){toast('نزّل ملف الاسترداد الخام أولاً قبل استبدال البيانات التالفة.',6000);return}
 try{
  const backupRaw=localStorage.getItem('anwar_v1_backup_v2');
  if(!backupRaw)throw new Error('لا توجد نسخة احتياطية');
  const restored=readStoredState(backupRaw),serialized=JSON.stringify(restored);
  localStorage.setItem('anwar_v1',serialized);
  try{localStorage.setItem('anwar_v1_backup_v2',serialized)}catch(backupError){console.warn('تعذّر تحديث النسخة الاحتياطية الثانوية',backupError)}
  S=restored;clearStorageRecovery();openNote(null);theme();chips();renderList();
  await continueVaultAfterRecovery();toast('تمت استعادة النسخة الاحتياطية بعد حفظ السجل الخام.',4500);
 }catch(error){toast('تعذّرت استعادة النسخة الاحتياطية؛ بقي السجل الخام دون تغيير.',5000);console.warn('تعذّرت استعادة النسخة الاحتياطية',error)}
}
async function startFreshNotebook(){
 if(!storageRecoveryBlocked)return;
 if(storageRecoveryMode==='corrupt'&&storageRecoveryRaw!==null&&!storageRecoveryExported){toast('نزّل ملف الاسترداد الخام أولاً قبل بدء مفكرة جديدة.',6000);return}
 if(!confirm('سيتم استبدال بيانات المفكرة التجريبية فقط والبدء بصفحة فارغة. لن تتأثر المكتبة أو الإذاعة. هل تتابع؟'))return;
 const fresh=emptyStorageState();
 try{
  const serialized=JSON.stringify(fresh);
  localStorage.setItem('anwar_v1',serialized);
  try{localStorage.setItem('anwar_v1_backup_v2',serialized)}catch(backupError){console.warn('تعذّر إنشاء نسخة احتياطية أولية',backupError)}
  S=fresh;cur=null;clearStorageRecovery();openNote(null);theme();chips();
  await continueVaultAfterRecovery();toast('بدأت مفكرة أنوار ببيانات نظيفة.',3500);
 }catch(error){console.warn('تعذّر بدء مفكرة نظيفة',error);toast('تعذّر تهيئة المفكرة؛ لم يتم تغيير بيانات المكتبة أو الإذاعة.',5000)}
}
function exportStorageRecovery(){if(storageRecoveryMode!=='corrupt'||storageRecoveryRaw===null){toast('لا تتوفر قيمة خام قابلة للتنزيل. أعد فحص وصول المتصفح إلى التخزين أولاً.',5000);return}try{const blob=new Blob([storageRecoveryRaw],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='anwar-storage-recovery-raw.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);storageRecoveryExported=true;toast('تم تجهيز ملف الاسترداد الخام. احتفظ به قبل الاستعادة.',5000)}catch(e){toast('تعذّر تنزيل ملف الاسترداد الخام؛ لا تحذف بيانات المتصفح.',5000)}}
async function persistPlainSnapshot(plaintext){
 if(!vaultUnlocked)throw new Error('المفكرة غير مفتوحة؛ لم نغيّر التخزين.');
 const normalized=readStoredState(plaintext),serialized=JSON.stringify(normalized);
 const oldPrimary=localStorage.getItem('anwar_v1'),oldBackup=localStorage.getItem('anwar_v1_backup_v2');
 if(oldPrimary!==null){
  readStoredState(oldPrimary);
  localStorage.setItem('anwar_v1_backup_v2',oldPrimary);
  const preserved=localStorage.getItem('anwar_v1_backup_v2');
  if(preserved!==oldPrimary)throw new Error('تعذّر التحقق من النسخة السابقة قبل تحديث المفكرة.');
  readStoredState(preserved);
 }else if(oldBackup!==null)readStoredState(oldBackup);
 localStorage.setItem('anwar_v1',serialized);
 const primaryRead=localStorage.getItem('anwar_v1');
 if(primaryRead===null||JSON.stringify(readStoredState(primaryRead))!==JSON.stringify(normalized))throw new Error('لم تتطابق مراجعة الحفظ المحلي مع محتوى المفكرة.');
 localStorage.setItem(VAULT_MODE_KEY,'plain');
 if(localStorage.getItem(VAULT_MODE_KEY)!=='plain')throw new Error('تعذّر تثبيت وضع الاستخدام الحر. بقيت الخزنة المشفّرة الأصلية كما هي.');
 let backupWritten=false;
 try{
  localStorage.setItem('anwar_v1_backup_v2',serialized);
  const backupRead=localStorage.getItem('anwar_v1_backup_v2');
  if(backupRead===null||JSON.stringify(readStoredState(backupRead))!==JSON.stringify(normalized))throw new Error('لم تتطابق مراجعة النسخة الاحتياطية.');
  backupWritten=true;vaultBackupWarningShown=false;
 }catch(error){
  console.warn('تعذّر تحديث النسخة الاحتياطية في وضع الاستخدام الحر؛ بقي السجل الأساسي متحققًا منه.',error);
  if(!vaultBackupWarningShown){toast('حُفظت المفكرة، لكن تعذّر تحديث النسخة الاحتياطية. تجنّب مسح بيانات الموقع قبل إنشاء نسخة يدوية.',6500);vaultBackupWarningShown=true}
 }
 if(!clearLegacyPrivatePreferences())console.warn('بقيت بعض مفاتيح الإعدادات القديمة في التخزين المحلي.');
 return {state:normalized,backupWritten};
}
function save(){
 if(storageRecoveryBlocked){toast('الحفظ متوقف حمايةً للبيانات القديمة. عالج الاسترداد أولًا.',5000);return false}
 if(!vaultUnlocked){toast('المفكرة مقفلة؛ افتحها قبل التعديل.',4500);return false}
 const snapshot=JSON.stringify(S);
 vaultSaveQueue=vaultSaveQueue.then(async()=>{
  if(vaultKey&&vaultTemplate)await persistVaultSnapshot(snapshot);else await persistPlainSnapshot(snapshot);
  vaultLastWriteError=null;
 }).catch(error=>{
  vaultLastWriteError=error;
  console.warn('تعذّر حفظ بيانات مفكرة أنوار',error);
  toast('تعذّر إتمام الحفظ والتحقق منه. لا تمسح بيانات الموقع قبل معالجة المشكلة.',6500);
 });
 return true;
}
function toast(m,d){const t=$('toast');t.textContent=m;t.classList.add('s');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('s'),d||2000)}
let privatePreferenceSaveTimer=null;
globalThis.AnwarPrivatePreferences.setPersistHandler(preferences=>{
 if(!vaultUnlocked)return;
 S.preferences=globalThis.AnwarPrivatePreferences.normalize(preferences);
 if(privatePreferenceSaveTimer!==null)clearTimeout(privatePreferenceSaveTimer);
 privatePreferenceSaveTimer=setTimeout(()=>{
  privatePreferenceSaveTimer=null;
  if(vaultUnlocked)save();
 },250);
});
function flushPrivatePreferenceSave(){
 if(privatePreferenceSaveTimer!==null){
  clearTimeout(privatePreferenceSaveTimer);
  privatePreferenceSaveTimer=null;
  if(vaultUnlocked)save();
 }
}
const iso=d=>d.toISOString().slice(0,10);
function streak(){const d=new Set(S.days);let n=0,c=new Date();if(!d.has(iso(c)))c.setDate(c.getDate()-1);while(d.has(iso(c))){n++;c.setDate(c.getDate()-1)}return n}
const fmt=ts=>new Date(ts).toLocaleDateString('ar',{day:'numeric',month:'long',year:'numeric'});
function theme(){
 document.documentElement.setAttribute('data-theme',S.theme||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'));
 document.documentElement.setAttribute('data-palette',S.palette||'blue');
 const walls={mist:['#e9ecf1','#222'],cream:['#f3eee2','#382f20'],sky:['#e1edf8','#263746'],mint:['#e2eee6','#24372c'],lavender:['#eee7f5','#342a40'],blush:['#f5e7eb','#432d35'],slate:['#dfe5e9','#26313a'],night:['#30343b','#f0f2f4']};
 const papers={white:['#ffffff','#222'],cream:['#fff8e9','#382f20'],sky:['#edf5fc','#263746'],mint:['#edf7f0','#24372c'],lavender:['#f5effb','#342a40'],blush:['#fff0f3','#432d35'],gray:['#f0f2f4','#26313a'],night:['#30343b','#f0f2f4']};
 const w=walls[S.wallColor]||walls.mist,p=papers[S.paperColor]||papers.white;
 document.documentElement.style.setProperty('--wall-color',w[0]);
 document.documentElement.style.setProperty('--paper-color',p[0]);
 document.documentElement.style.setProperty('--paper-text',p[1]);
}
function chips(){$('chips').innerHTML=[['all','الكل'],['poem','قصائد'],['text','نصوص'],['idea','أفكار'],['pin','⭐ المثبّتة']].map(([k,v])=>`<button class="chip ${flt===k?'on':''}" data-k="${k}">${v}</button>`).join('')}
function htmlToPlainText(value){
 const source=String(value??'').slice(0,500000);
 const lower=source.toLowerCase();
 const entities={
  amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',copy:'©',reg:'®',trade:'™',
  hellip:'…',ndash:'–',mdash:'—',lsquo:'‘',rsquo:'’',ldquo:'“',rdquo:'”',
  laquo:'«',raquo:'»',bull:'•',middot:'·',cent:'¢',pound:'£',euro:'€',
  yen:'¥',deg:'°',times:'×',divide:'÷',plusmn:'±',sect:'§',para:'¶',
  lrm:'\u200e',rlm:'\u200f',zwnj:'\u200c',zwj:'\u200d'
 };
 const blockTags=new Set([
  'address','article','aside','blockquote','br','dd','div','dl','dt','fieldset',
  'figcaption','figure','footer','form','h1','h2','h3','h4','header','hr','li',
  'main','nav','ol','p','pre','section','table','tr','ul'
 ]);
 const output=[];
 let index=0,rawTag='';
 const appendBreak=()=>{
  if(output.length&&output[output.length-1]!=='\n')output.push('\n');
 };
 const decodeEntityAt=position=>{
  const end=source.indexOf(';',position+1);
  if(end<0||end-position>18)return null;
  const token=source.slice(position+1,end);
  let decoded;
  if(token[0]==='#'){
   const hex=token[1]==='x'||token[1]==='X';
   const digits=token.slice(hex?2:1);
   if(!digits||digits.length>(hex?6:7))return null;
   for(let i=0;i<digits.length;i++){
    const code=digits.charCodeAt(i);
    const valid=hex
     ?(code>=48&&code<=57)||(code>=65&&code<=70)||(code>=97&&code<=102)
     :(code>=48&&code<=57);
    if(!valid)return null;
   }
   const point=Number.parseInt(digits,hex?16:10);
   if(!Number.isInteger(point)||point<1||point>0x10ffff||(point>=0xd800&&point<=0xdfff))return null;
   decoded=String.fromCodePoint(point);
  }else if(Object.prototype.hasOwnProperty.call(entities,token)){
   decoded=entities[token];
  }else{
   return null;
  }
  return {value:decoded,next:end+1};
 };
 while(index<source.length){
  if(rawTag){
   const marker='</'+rawTag;
   const close=lower.indexOf(marker,index);
   if(close<0)break;
   const closeEnd=source.indexOf('>',close+marker.length);
   index=closeEnd<0?source.length:closeEnd+1;
   rawTag='';
   appendBreak();
   continue;
  }
  if(source.startsWith('<!--',index)){
   const end=source.indexOf('-->',index+4);
   index=end<0?source.length:end+3;
   continue;
  }
  if(source[index]==='<'){
   const next=source[index+1];
   if(next==='!'||next==='?'){
    const end=source.indexOf('>',index+2);
    index=end<0?source.length:end+1;
    continue;
   }
   let cursor=index+1,closing=false;
   if(source[cursor]==='/'){closing=true;cursor++}
   const first=source.charCodeAt(cursor);
   if((first>=65&&first<=90)||(first>=97&&first<=122)){
    const tagStart=cursor++;
    while(cursor<source.length){
     const code=source.charCodeAt(cursor);
     if((code>=65&&code<=90)||(code>=97&&code<=122)||(code>=48&&code<=57)||code===45||code===58)cursor++;
     else break;
    }
    const name=lower.slice(tagStart,cursor);
    let quote='',closed=false;
    while(cursor<source.length){
     const ch=source[cursor];
     if(quote){if(ch===quote)quote=''}
     else if(ch==='"'||ch==="'")quote=ch;
     else if(ch==='>'){closed=true;cursor++;break}
     cursor++;
    }
    if(closed){
     if(!closing&&['head','script','style','template','noscript'].includes(name)){
      rawTag=name;
      index=cursor;
      continue;
     }
     if(blockTags.has(name))appendBreak();
     index=cursor;
     continue;
    }
   }
  }
  if(source[index]==='&'){
   const entity=decodeEntityAt(index);
   if(entity){output.push(entity.value);index=entity.next;continue}
  }
  if(source[index]==='\r'){
   if(source[index+1]==='\n')index++;
   output.push('\n');
   index++;
   continue;
  }
  output.push(source[index]);
  index++;
 }
 return output.join('').replace(/\u00a0/g,' ').replace(/[ \t]+\n/g,'\n').replace(/\n[ \t]+\n/g,'\n\n').replace(/\n{3,}/g,'\n\n').trim();
}
function plain(h){return htmlToPlainText(h)}
const notePlainTextCache=new WeakMap();
function plainNote(n){
 const html=String(n.html||''),cached=notePlainTextCache.get(n);
 if(cached&&cached.html===html)return cached.text;
 const value=plain(html);notePlainTextCache.set(n,{html,text:value});return value;
}
const LIST_PAGE_SIZE=50;
let listRenderLimit=LIST_PAGE_SIZE;
function renderList(resetLimit=false){
 if(resetLimit)listRenderLimit=LIST_PAGE_SIZE;
 const q=$('q').value.trim().toLocaleLowerCase();
 const candidates=S.notes.filter(n=>flt==='all'||(flt==='pin'?!!n.pin:n.type===flt));
 candidates.sort((a,b)=>(b.pin?1:0)-(a.pin?1:0)||b.ts-a.ts);
 const matching=q?candidates.filter(n=>(String(n.title||'')+' '+plainNote(n)).toLocaleLowerCase().includes(q)):candidates;
 const items=matching.slice(0,listRenderLimit).map(note=>({note,body:plainNote(note)}));
 $('cards').innerHTML=items.length?items.map(({note:n,body})=>`<div class="card ${cur&&cur.id===n.id?'sel':''}" data-id="${esc(n.id)}"><b>${n.pin?'⭐ ':''}${IC[n.type]||'📝'} ${esc(n.title||'بلا عنوان')}</b><small>${TYPES[n.type]||'عمل'} · ${fmt(n.ts)}</small><p>${esc(body.trim().split('\n')[0]||'…')}</p></div>`).join(''):'<div class="empty" style="padding:20px">لا شيء هنا بعد</div>';
 const more=$('listMore');
 more.hidden=matching.length<=listRenderLimit;
 more.textContent='عرض 50 عملاً آخر · المتبقي '+Math.max(0,matching.length-listRenderLimit);
 const k=streak(),u=k===1?'يوم':k===2?'يومان':k<=10?'أيام':'يومًا';
 $('sk').innerHTML=k?`🔥 تكتب منذ <b>${k}</b> ${u} متتالية`:'اكتب اليوم لتبدأ سلسلتك';
}
let archiveFilter='all',archiveRenderLimit=LIST_PAGE_SIZE;
function renderArchive(resetLimit=false){
 if(resetLimit)archiveRenderLimit=LIST_PAGE_SIZE;
 const query=$('archiveSearch').value.trim().toLocaleLowerCase();
 const all=S.notes.slice().sort((a,b)=>b.ts-a.ts);
 const filtered=all.filter(n=>{
  if(archiveFilter==='pin'&&!n.pin)return false;
  if(['poem','text','idea'].includes(archiveFilter)&&n.type!==archiveFilter)return false;
  const haystack=String(n.title||'')+(query?' '+plainNote(n):'');
  return !query||haystack.toLocaleLowerCase().includes(query);
 });
 $('archiveCount').textContent=filtered.length+' من '+all.length+' عمل';
 $('archiveDialog').querySelectorAll('[data-archive-filter]').forEach(b=>b.classList.toggle('active',b.dataset.archiveFilter===archiveFilter));
 const visible=filtered.slice(0,archiveRenderLimit);
 $('archiveItems').innerHTML=visible.length?visible.map(n=>{
  const preview=plainNote(n).trim().replace(/\s+/g,' ').slice(0,220)||'لا يوجد نص للمعاينة';
  return '<button type="button" class="archive-card" data-archive-id="'+esc(n.id)+'"><span class="archive-card-top"><strong class="archive-card-title">'+(n.pin?'⭐ ':'')+esc(n.title||'بلا عنوان')+'</strong><span class="archive-card-type">'+esc(TYPES[n.type]||'عمل')+'</span></span><span class="archive-card-preview">'+esc(preview)+'</span><span class="archive-card-meta"><span>آخر تعديل: '+esc(fmt(n.ts))+'</span><span>فتح العمل ←</span></span></button>';
 }).join(''):'<div class="archive-empty"><div><div style="font-size:34px;margin-bottom:8px">▤</div><strong>'+(query?'لا توجد نتائج مطابقة':'لا توجد أعمال محفوظة في هذا القسم بعد')+'</strong><div>ستظهر هنا أعمالك المحفوظة تلقائياً، دون إنشاء نسخ مكررة.</div></div></div>';
 const more=$('archiveMore');
 more.hidden=filtered.length<=archiveRenderLimit;
 more.textContent='عرض 50 عملاً آخر · المتبقي '+Math.max(0,filtered.length-archiveRenderLimit);
}
function openArchive(){
 if(cur)flushPendingEdit(false);
 archiveFilter='all';$('archiveSearch').value='';renderArchive(true);
 if(!$('archiveDialog').open)$('archiveDialog').showModal();
}
function openNote(n){
 if(cur&&cur!==n)flushPendingEdit(false);
 if(draftNote&&draftNote!==n)draftNote=null;
 cur=n;const on=!!n;
 pg.style.display=on?'':'none';$('em').style.display=on?'none':'';
 if(on){pg.innerHTML=san(n.html);pg.style.fontFamily=n.font?`'${n.font}',Amiri,serif`:'';pg.style.fontSize=(n.size||20)+'px';applyPaperClass(n.paper);$('t').value=n.title;$('ty').value=n.type;$('pn').textContent=n.pin?'⭐ تثبيت':'☆ تثبيت';$('sz').value=n.size||20;$('app').classList.add('ed')}
 else {$('app').classList.remove('ed');$('paperStylePanel').hidden=true;$('paperStyleBtn').setAttribute('aria-expanded','false')}
 renderList();info();
}
function newNote(){
 if(storageRecoveryBlocked){toast('أنزل ملف الاسترداد أولاً، ثم استعد نسخة سليمة قبل إنشاء أعمال جديدة.',6000);return}
 if(cur)flushPendingEdit(false);
 if(S.notes.length>=2500){toast('بلغت المفكرة الحد الأقصى وهو 2500 عمل. صدّر نسخة احتياطية قبل إنشاء أعمال إضافية.',6500);return}
 if(draftNote===cur)draftNote=null;
 cur=null;
 const n={id:createNoteId(),title:'',type:'poem',html:'',pin:false,ts:Date.now(),font:'Amiri',size:20,paper:'plain'};
 draftNote=n;
 openNote(n);
 pg.focus();
}
function applyPaperClass(style){
 const allowed=['plain','ruled','poetry','framed'];
 const paper=allowed.includes(style)?style:'plain';
 pg.classList.remove('paper-plain','paper-ruled','paper-poetry','paper-framed');
 pg.classList.add('paper-'+paper);
 const panel=$('paperStylePanel');
 if(panel)panel.querySelectorAll('[data-paper]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.paper===paper)));
}
function setPaperStyle(style){
 if(!cur||storageRecoveryBlocked){toast('افتح عملاً أولاً لاختيار شكل الورقة.');return}
 if(!['plain','ruled','poetry','framed'].includes(style))return;
 if(cur.paper===style){$('paperStylePanel').hidden=true;$('paperStyleBtn').setAttribute('aria-expanded','false');return}
 capturePendingBefore();
 cur.paper=style;cur.ts=Date.now();applyPaperClass(style);
 const ok=flushPendingEdit(false);
 $('paperStylePanel').hidden=true;$('paperStyleBtn').setAttribute('aria-expanded','false');
 if(ok)toast(({plain:'تم اختيار الورقة البيضاء',ruled:'تم اختيار الورقة المخططة',poetry:'تم اختيار صفحة الشعر العمودي',framed:'تم اختيار الورقة المؤطرة'})[style],2200);
}
function focusVerseCell(cell){
 if(!cell)return;
 pg.focus();
 const range=document.createRange(),selection=window.getSelection();
 range.selectNodeContents(cell);range.collapse(false);
 selection.removeAllRanges();selection.addRange(range);saved=range.cloneRange();
}
function insertPoetryVerse(afterRow=null){
 if(!cur)return;
 capturePendingBefore();
 if(cur.paper!=='poetry'){cur.paper='poetry';applyPaperClass('poetry')}
 const row=document.createElement('div');row.className='v';
 for(let i=0;i<2;i++)row.appendChild(document.createElement('span'));
 if(afterRow&&pg.contains(afterRow))afterRow.after(row);
 else{
  restore();
  const selection=window.getSelection();
  const anchor=selection&&selection.rangeCount?selection.anchorNode:null;
  let block=anchor?(anchor.nodeType===1?anchor:anchor.parentElement):null;
  while(block&&block.parentElement!==pg)block=block.parentElement;
  if(block&&block!==pg)block.after(row);
  else pg.appendChild(row);
 }
 focusVerseCell(row.children[0]);touch();
}
function lines(){const L=[];pg.querySelectorAll(':scope>*').forEach(e=>{const t=e.classList.contains('v')?(e.children[1]||e).textContent:e.textContent;if(t.replace(/[\u200b\s]/g,''))L.push(t)});if(!L.length&&pg.textContent.trim())L.push(pg.textContent);return L}
function info(){
 if(!cur){$('info').textContent='';return}
 const t=pg.innerText||'',w=(t.match(/\S+/g)||[]).length;
 let h=`${w} كلمة · قراءة ≈ ${Math.max(1,Math.round(w/180))} د`;
 if(cur.type==='poem'){
  const L=lines();
  if(L.length){
   const cl=s=>s.replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/[^\u0621-\u064A]/g,'');
   const E=L.map(l=>cl(l).slice(-1).replace('ة','ه').replace('ى','ي')),c={};
   E.forEach(x=>c[x]=(c[x]||0)+1);
   const top=Object.entries(c).sort((a,b)=>b[1]-a[1])[0],bad=E.map((x,i)=>x!==top[0]?i+1:0).filter(Boolean);
   h+=` · ${L.length} بيتًا · القافية: ${top[0]||'؟'}`;
   if(L.length>2)h+=bad.length?` · تخالف في: ${bad.join('، ')}`:' · منتظمة ✓';
  }
 }
 $('info').textContent=h;
}
let pendingBefore=null;
function capturePendingBefore(){
 if(!cur||pendingBefore!==null)return;
 pendingBefore={title:cur.title,type:cur.type,html:cur.html,ts:cur.ts,font:cur.font,size:cur.size,paper:cur.paper||'plain'};
}
function commitDraftIfReady(){
 if(!cur||cur!==draftNote)return true;
 const body=plain(cur.html).replace(/\u200b/g,'').trim();
 if(!body)return false;
 if(!S.notes.some(note=>note.id===cur.id))S.notes.push(cur);
 const today=iso(new Date());if(!S.days.includes(today))S.days.push(today);
 draftNote=null;
 return true;
}
function flushPendingEdit(updateList=true){
 if(tm){clearTimeout(tm);tm=null}
 if(!cur||storageRecoveryBlocked){pendingBefore=null;return false}
 const wasDraft=cur===draftNote;
 const nextHtml=san(pg.innerHTML);
 const nextTitle=titleFromEditor();
 if(!wasDraft&&pendingBefore===null){
  // A navigation-only flush must not rewrite an untouched note or rename a
  // legacy title merely because the editor can derive a title from its body.
  if(nextHtml===cur.html)return true;
  capturePendingBefore();
 }
 cur.html=nextHtml;
 cur.title=nextTitle;
 $('t').value=cur.title;
 if(wasDraft){
  pendingBefore=null;
  if(!commitDraftIfReady())return true;
 }else{
  if(!pendingBefore)return true;
  const previous=pendingBefore;
  const changed=previous.html!==cur.html||previous.title!==cur.title||previous.type!==cur.type||previous.font!==cur.font||previous.size!==cur.size||previous.paper!==(cur.paper||'plain');
  pendingBefore=null;
  if(!changed)return true;
  cur.history=cur.history||[];
  cur.history.push(previous);
  cur.history=cur.history.slice(-15);
 }
 pendingBefore=null;
 const ok=save();
 if(ok&&updateList)renderList();
 return ok;
}
function titleFromEditor(){
 const blocks=Array.from(pg.children||[]);
 const firstBlock=blocks.find(block=>(block.innerText||block.textContent||'').replace(/\u200b/g,'').trim());
 let raw='';
 if(firstBlock&&firstBlock.classList.contains('v')){
  raw=Array.from(firstBlock.children||[]).slice(0,2).map(cell=>(cell.innerText||cell.textContent||'').trim()).filter(Boolean).join(' — ');
 }else{
  const source=firstBlock?(firstBlock.innerText||firstBlock.textContent||''):(pg.innerText||pg.textContent||plain(pg.innerHTML||''));
  raw=source.split(/\r?\n/).map(line=>line.replace(/\u200b/g,'').trim()).find(Boolean)||'';
 }
 return raw.replace(/\s+/g,' ').trim().slice(0,80);
}
function touch(){
 if(!cur||storageRecoveryBlocked)return;
 if(cur===draftNote){
  cur.html=san(pg.innerHTML);cur.title=titleFromEditor();$('t').value=cur.title;cur.ts=Date.now();pendingBefore=null;
  if(!plain(cur.html).replace(/\u200b/g,'').trim()){
   if(tm){clearTimeout(tm);tm=null}
   info();return;
  }
  info();if(tm)clearTimeout(tm);
  tm=setTimeout(()=>flushPendingEdit(true),650);
  return;
 }
 capturePendingBefore();
 cur.html=san(pg.innerHTML);cur.title=titleFromEditor();$('t').value=cur.title;cur.ts=Date.now();
 const d=iso(new Date());if(!S.days.includes(d))S.days.push(d);
 info();if(tm)clearTimeout(tm);
 tm=setTimeout(()=>flushPendingEdit(true),650);
}
function saveSel(){const s=getSelection();if(s.rangeCount&&pg.contains(s.anchorNode))saved=s.getRangeAt(0).cloneRange()}
function restore(){pg.focus();if(saved){const s=getSelection();s.removeAllRanges();s.addRange(saved)}}
document.addEventListener('selectionchange',saveSel);
function cmd(c,v){restore();document.execCommand(c,false,v);touch()}
function applySize(px){
 if(!cur)return;restore();
 if(!saved||saved.collapsed){cur.size=px;pg.style.fontSize=px+'px';save();return}
 document.execCommand('fontSize',false,7);
 pg.querySelectorAll('font[size="7"]').forEach(f=>{const s=document.createElement('span');s.style.fontSize=px+'px';s.append(...Array.from(f.childNodes));f.replaceWith(s)});touch();
}
function applyFont(f){
 if(!cur)return;restore();
 if(!saved||saved.collapsed){cur.font=f;pg.style.fontFamily=`'${f}',Amiri,serif`;save()}
 else{document.execCommand('fontName',false,f);touch()}
 $('fm').classList.remove('o');
}
const ANWAR_FONT_STYLESHEETS=["https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Aref+Ruqaa:wght@400;700&family=Cairo:wght@400;700&display=swap","https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Amiri+Quran&family=Aref+Ruqaa&family=Aref+Ruqaa+Ink&family=Scheherazade+New&family=Lateef&family=Harmattan&family=Noto+Naskh+Arabic&family=Markazi+Text&family=Mirza&family=Katibeh&family=Gulzar&display=swap","https://fonts.googleapis.com/css2?family=Cairo&family=Tajawal&family=Almarai&family=Alexandria&family=Changa&family=Mada&family=Readex+Pro&family=IBM+Plex+Sans+Arabic&family=Noto+Sans+Arabic&family=Noto+Kufi+Arabic&family=Vazirmatn&family=Rubik&family=Baloo+Bhaijaan+2&family=Lemonada&display=swap","https://fonts.googleapis.com/css2?family=Reem+Kufi&family=Reem+Kufi+Fun&family=Reem+Kufi+Ink&family=El+Messiri&family=Kufam&family=Lalezar&family=Rakkas&family=Jomhuria&family=Marhey&family=Vibes&family=Blaka&family=Qahiri&family=Playpen+Sans+Arabic&family=Noto+Nastaliq+Urdu&display=swap"];
const loadedFontStylesheets=new Set();
function loadFontStylesheets(includeExtended=false){
 const urls=includeExtended?ANWAR_FONT_STYLESHEETS:ANWAR_FONT_STYLESHEETS.slice(0,1);
 return Promise.all(urls.map(href=>{
  if(loadedFontStylesheets.has(href))return Promise.resolve();
  return new Promise((resolve,reject)=>{
   const link=document.createElement('link');link.rel='stylesheet';link.href=href;
   link.onload=()=>{loadedFontStylesheets.add(href);resolve()};
   link.onerror=()=>{link.remove();reject(new Error('تعذّر تحميل حزمة الخطوط'))};
   document.head.append(link);
  });
 }));
}
function scheduleBaseFonts(){
 const start=()=>{const loadFonts=()=>loadFontStylesheets(false).catch(error=>console.warn(error));
  if('requestIdleCallback' in window)window.requestIdleCallback(loadFonts,{timeout:2600});
  else setTimeout(loadFonts,1400);
 };
 if(document.readyState==='complete')start();
 else window.addEventListener('load',start,{once:true});
}
scheduleBaseFonts();
function fontList(q){$('fl').innerHTML=FONTS.filter(f=>!q||f.toLowerCase().includes(q.toLowerCase())).map(f=>`<div data-f="${f}"><span style="font-family:'${f}',serif;font-size:18px">أنوار الكلمة</span><em>${f}</em></div>`).join('')}
function buildPA(){
 const p=$('pa'),ff=cur.font?`'${cur.font}',Amiri,serif`:'Amiri,serif';
 p.style.fontFamily=ff;p.style.fontSize=(cur.size||20)+'px';
 p.innerHTML=`<h1>${esc(cur.title||'بلا عنوان')}</h1><div class="m">${TYPES[cur.type]} · ${fmt(cur.ts)}</div><hr><div class="paper-export paper-${cur.paper||'plain'}">${san(pg.innerHTML)}</div><div class="f">مفكرة أنوار · © 2026 Anouar Oumlili · جميع الحقوق محفوظة</div>`;
}
async function printFile(){
 const dl=window.claude&&await window.claude.use('downloads');
 if(!dl){toast('الطباعة المباشرة غير متاحة في هذا العرض');return}
 const f=cur.font||'Amiri',h=`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(cur.title||'أنوار')}</title><link href="https://fonts.googleapis.com/css2?family=${f.replace(/ /g,'+')}&display=swap" rel="stylesheet"><style>@page{margin:16mm}body{margin:0 auto;max-width:794px;padding:24px;font-family:'${f}',Amiri,serif;font-size:${cur.size||20}px;line-height:2;color:#000}h1{text-align:center;font-size:34px;margin:0 0 4px;font-weight:400}.m{text-align:center;color:#777;font-size:13px;font-family:Tahoma,sans-serif}hr{border:0;border-top:1px solid #c9a24a;width:120px;margin:12px auto 24px}.v{display:flex;gap:48px;justify-content:center;text-align:center}.v span{flex:1}.f{margin-top:36px;color:#aaa;font-size:11px;text-align:center;font-family:Tahoma,sans-serif}



/* تحسين تموضع بطاقات القراء: زر التشغيل في الطرف المقابل للزهرة */
.reciter-grid{width:100%;box-sizing:border-box}
.reciter-card{
 display:grid!important;
 grid-template-columns:40px minmax(0,1fr) 46px;
 grid-template-areas:"seal body play";
 align-items:center;
 direction:rtl;
 width:100%;
 min-width:0;
 min-height:78px;
 box-sizing:border-box;
 padding:12px 15px!important;
 gap:12px!important;
}
.reciter-seal{grid-area:seal;justify-self:center}
.reciter-body{grid-area:body;width:100%;min-width:0}
.reciter-play{grid-area:play;justify-self:center;align-self:center;width:43px;height:43px}
.reciter-variants-menu{width:21px;height:21px;min-width:21px}
@media(max-width:520px){
 .reciter-card{grid-template-columns:40px minmax(0,1fr) 46px;min-height:80px;padding:12px 15px!important;gap:12px!important}
 .reciter-play{width:43px;height:43px}
}


/* طبقة حماية الاسترداد */
#storageRecoveryNotice{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;border-bottom:1px solid #d2a45d;background:linear-gradient(110deg,#fff4d9,#f8e5b9);color:#47371c}
#storageRecoveryNotice[hidden]{display:none!important}
#storageRecoveryNotice>div{display:grid;gap:3px;min-width:0}
#storageRecoveryNotice strong{font-size:13px}
#storageRecoveryNotice span{font-size:11px;line-height:1.6}
#storageRecoveryNotice button{flex:none;border:1px solid #a97b33;border-radius:9px;padding:8px 11px;background:#fffaf0;color:#513b19;font-size:11px;font-weight:700}
#storageRecoveryNotice button:disabled{opacity:.45;cursor:not-allowed}
#storageRecoveryNotice .storage-recovery-actions{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
#storageRecoveryNotice #retryStorageAccess{border-color:#8ca4bd;background:#fff;color:#173d5c}
#storageRecoveryNotice #restoreBackup{border-color:#8b9c70;background:#f5f8ee;color:#354525}
#storageRecoveryNotice #startFresh{background:#f4e5c9;border-color:#8f6a2e;color:#493515}
/* تحسين هادئ لسطوح الكتابة وقائمة الأعمال */
.card{border-radius:11px;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease}
.card:hover{border-color:var(--ac);box-shadow:0 4px 12px rgba(20,45,75,.08);transform:translateY(-1px)}
.card.sel{box-shadow:inset 3px 0 0 var(--ac),0 3px 10px rgba(20,45,75,.07)}
#pg{border:1px solid rgba(40,65,95,.08);border-radius:14px;box-shadow:0 8px 26px rgba(20,35,55,.12);line-height:2.05}
#area{scrollbar-gutter:stable}
:focus-visible{outline:2px solid var(--ac);outline-offset:2px}
button:focus:not(:focus-visible){outline:none}
@media(max-width:520px){
 #storageRecoveryNotice{align-items:stretch;flex-direction:column;gap:7px;padding:9px 11px}
 #storageRecoveryNotice .storage-recovery-actions{display:flex;flex-direction:column;gap:7px}
 #storageRecoveryNotice .storage-recovery-actions button{width:100%;min-height:38px}
 #pg{border-radius:11px;box-shadow:0 4px 16px rgba(20,35,55,.10)}
}
@media(prefers-reduced-motion:reduce){.card{transition:none}}


/* إصلاح عرض مكتبة أنوار على الهواتف وإزالة المساحة العلوية الزائدة */
#libraryPage,
#libraryPage *{box-sizing:border-box}
#libraryPage{overflow-x:hidden!important}
#libraryPage .library-shell{
 width:100%!important;max-width:1320px!important;min-width:0!important;
 margin-inline:auto!important;box-sizing:border-box!important
}
#libraryPage .library-top,
#libraryPage .library-search,
#libraryPage #libraryHome,
#libraryPage .library-categories,
#libraryPage .library-panel,
#libraryPage .library-resource-list{
 width:100%;max-width:100%;min-width:0;box-sizing:border-box
}
#libraryPage .library-categories{grid-template-columns:repeat(2,minmax(0,1fr))}
#libraryPage .library-category{width:100%;min-width:0;max-width:100%;box-sizing:border-box}
#libraryPage .library-category-copy{min-width:0;overflow-wrap:anywhere}
@media(max-width:380px){
 #libraryPage .library-categories{grid-template-columns:minmax(0,1fr)}
}

/* مكتبة الكتب: واجهة بيضاء مركزة بلمسات ذهبية */
#libraryPage{
 --lib-bg:#fffefa;--lib-card:#ffffff;--lib-text:#3b3123;--lib-muted:#947b52;
 --lib-line:#eadbb9;--lib-gold:#b58b45;--lib-gold-soft:#fff8e9;--lib-shadow:0 4px 13px rgba(111,82,34,.08);
 background:var(--lib-bg)!important;color:var(--lib-text)!important;
}
#libraryPage[data-library-theme="cream"]{
 --lib-bg:#faf6ed;--lib-card:#fffdf8;--lib-text:#3d3326;--lib-muted:#8e754e;
 --lib-line:#e6d5b0;--lib-gold:#ad8240;--lib-gold-soft:#f8efdc;--lib-shadow:0 4px 13px rgba(111,82,34,.07)
}
#libraryPage[data-library-theme="pearl"]{
 --lib-bg:#f7f8f7;--lib-card:#ffffff;--lib-text:#343b39;--lib-muted:#827d6b;
 --lib-line:#e5dfcd;--lib-gold:#b29257;--lib-gold-soft:#fbf7ed;--lib-shadow:0 4px 13px rgba(67,73,62,.07)
}
#libraryPage .library-shell{
 width:min(100%,920px)!important;max-width:920px!important;min-height:100dvh!important;
 margin-inline:auto!important;padding:calc(10px + env(safe-area-inset-top,0px)) 12px calc(16px + env(safe-area-inset-bottom,0px))!important;
 gap:12px!important
}
#libraryPage .library-top{
 position:sticky;top:0;z-index:5;width:100%!important;max-width:none!important;
 margin:calc(-1 * (10px + env(safe-area-inset-top,0px))) -12px 0!important;
 padding:calc(10px + env(safe-area-inset-top,0px)) 12px 9px!important;
 justify-content:flex-start!important;background:var(--lib-bg)!important;
 border-bottom:1px solid var(--lib-line)!important;box-shadow:0 3px 9px rgba(111,82,34,.035)!important;
 backdrop-filter:blur(10px)
}
#libraryPage .library-top-actions{display:flex;align-items:center;gap:8px}
#libraryPage .library-top-actions button{
 display:inline-flex;align-items:center;justify-content:center;gap:5px;min-height:37px;
 padding:7px 11px;border:1px solid var(--lib-line)!important;border-radius:11px;
 background:var(--lib-card)!important;color:var(--lib-text)!important;
 box-shadow:none!important;font:700 11px Cairo,Tahoma,sans-serif
}
#libraryPage #libraryTheme,#libraryPage #libraryClose{
 width:38px;min-width:38px;padding:0;font-size:18px;color:var(--lib-gold)!important
}
#libraryPage #libraryClose{font-size:16px}
#libraryPage #librarySaved[aria-pressed="true"]{background:var(--lib-gold-soft)!important;border-color:var(--lib-gold)!important}
#libraryPage .library-search{
 width:100%;max-width:none;min-height:43px;margin:0;padding:0 12px;
 background:var(--lib-card)!important;border:1px solid var(--lib-line)!important;
 border-radius:12px;box-shadow:var(--lib-shadow)!important
}
#libraryPage .library-search span{color:var(--lib-gold)!important}
#libraryPage .library-search input{color:var(--lib-text)!important;font-size:12px}
#libraryPage .library-search input::placeholder{color:var(--lib-muted)}
#libraryPage #libraryHome{width:100%;max-width:none;margin:0;display:block}
#libraryPage .library-columns{
 display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;direction:rtl;align-items:start
}
#libraryPage .library-column{min-width:0;display:flex;flex-direction:column;gap:9px}
#libraryPage .library-column-heading{
 margin:0;padding:3px 2px 8px;border-bottom:1px solid var(--lib-line);
 color:var(--lib-gold)!important;font:700 17px 'Aref Ruqaa',Amiri,serif;text-align:center
}
#libraryPage .library-categories{
 width:100%;display:grid;grid-template-columns:minmax(0,1fr);gap:9px;margin:0
}
#libraryPage .library-category{
 display:grid!important;grid-template-columns:30px minmax(0,1fr) 10px;
 grid-template-areas:"icon title arrow";align-items:center;justify-content:stretch;
 width:100%;min-width:0;min-height:68px;padding:9px 8px;gap:7px;
 text-align:right;direction:rtl;border:1px solid var(--lib-line)!important;border-radius:13px;
 background:var(--lib-card)!important;color:var(--lib-text)!important;
 box-shadow:var(--lib-shadow)!important;transition:transform .15s,border-color .15s,box-shadow .15s
}
#libraryPage .library-category:hover{border-color:var(--lib-gold)!important;box-shadow:0 5px 15px rgba(181,139,69,.12)!important}
#libraryPage .library-category:active{transform:scale(.985)}
#libraryPage .library-category-icon{
 grid-area:icon;width:28px;height:28px;display:grid;place-items:center;
 border:1px solid var(--lib-line)!important;border-radius:9px;
 background:var(--lib-gold-soft)!important;color:var(--lib-gold)!important;font-size:16px
}
#libraryPage .library-category-title{
 grid-area:title;min-width:0;color:var(--lib-text)!important;
 font:700 12px/1.45 Cairo,Tahoma,sans-serif;text-align:right;overflow-wrap:anywhere
}
#libraryPage .library-category-arrow{grid-area:arrow;position:static;margin:0;color:var(--lib-gold)!important;font-size:17px}
#libraryPage .library-panel,#libraryPage #librarySearchView,#libraryPage #librarySavedView{
 width:100%;max-width:none;margin:0
}
#libraryPage .library-panel{gap:12px}
#libraryPage .library-panel-head{
 display:flex;align-items:center;justify-content:flex-start;flex-wrap:nowrap;gap:9px;padding:2px 0 9px;
 border-bottom:1px solid var(--lib-line)
}
#libraryPage .library-back{
 order:0;min-height:34px;padding:6px 10px;border:1px solid var(--lib-line)!important;
 border-radius:9px;background:var(--lib-card)!important;color:var(--lib-gold)!important
}
#libraryPage .library-panel-head .library-mark{
 width:34px;height:34px;flex:none;border-radius:10px;
 background:var(--lib-gold-soft)!important;color:var(--lib-gold)!important;border:1px solid var(--lib-line)!important;box-shadow:none
}
#libraryPage .library-panel-title{flex:1;min-width:0}
#libraryPage .library-panel-title strong{color:var(--lib-text)!important;font-size:17px}
#libraryPage .library-resource-list{
 width:100%;max-width:none;margin:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px
}
#libraryPage .library-resource{
 display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0;min-height:59px;
 padding:9px 10px;background:var(--lib-card)!important;border:1px solid var(--lib-line)!important;
 border-radius:11px;box-shadow:var(--lib-shadow)!important
}
#libraryPage .library-resource-copy{min-width:0;display:flex;align-items:center}
#libraryPage .library-resource-icon{
 width:30px;height:30px;min-width:30px;display:grid;place-items:center;margin-inline-end:8px;
 border:1px solid var(--lib-line);border-radius:9px;background:var(--lib-gold-soft);
 color:var(--lib-gold);font-size:17px;line-height:1
}
#libraryPage .library-resource-copy strong{color:var(--lib-text)!important;font:700 11px/1.5 Cairo,Tahoma,sans-serif;overflow-wrap:anywhere}
#libraryPage .library-resource-copy p,#libraryPage .library-resource-copy small{display:none!important}
#libraryPage .library-resource-actions{display:flex;flex-direction:row;align-items:center;gap:5px;flex:none}
#libraryPage .library-resource-actions a,#libraryPage .library-resource-actions button{
 min-width:32px;min-height:31px;padding:5px 8px;border:1px solid var(--lib-line)!important;
 border-radius:8px;background:var(--lib-gold-soft)!important;color:var(--lib-gold)!important;
 box-shadow:none!important;font:700 10px Cairo,Tahoma,sans-serif
}
#libraryPage .library-resource-actions button{min-width:30px;width:30px;padding:0;font-size:14px}
#libraryPage .library-resource-actions button[aria-pressed="true"]{background:#f1e4c7!important;border-color:var(--lib-gold)!important;color:#8a6426!important}
#libraryPage .library-section-heading{display:flex;justify-content:space-between;align-items:center}
#libraryPage .library-section-heading strong{color:var(--lib-gold)!important;font-size:17px}
#libraryPage .library-section-heading small{color:var(--lib-muted)!important;font-size:10px}
#libraryPage .library-empty{
 padding:18px 10px;text-align:center;border:1px dashed var(--lib-line)!important;
 border-radius:12px;background:var(--lib-card)!important;color:var(--lib-muted)!important;font-size:12px
}
#libraryPage .library-footnote{display:none!important}
#libraryPage button:focus-visible,#libraryPage a:focus-visible,#libraryPage input:focus-visible{outline:2px solid var(--lib-gold)!important;outline-offset:2px}
@media(max-width:390px){
 #libraryPage .library-shell{padding-inline:9px!important}
 #libraryPage .library-top{margin-inline:-9px!important;padding-inline:9px!important}
 #libraryPage .library-columns{gap:8px}
 #libraryPage .library-column{gap:8px}
 #libraryPage .library-column-heading{font-size:15px;padding-bottom:6px}
 #libraryPage .library-category{grid-template-columns:25px minmax(0,1fr) 8px;min-height:64px;padding:8px 6px;gap:5px}
 #libraryPage .library-category-icon{width:24px;height:24px;font-size:14px}
 #libraryPage .library-category-title{font-size:10.5px}
 #libraryPage .library-resource-list{grid-template-columns:minmax(0,1fr)}
 #libraryPage .library-resource{min-height:55px}
}
@media(min-width:760px){
 #libraryPage .library-shell{padding-inline:22px!important}
 #libraryPage .library-columns{gap:22px}
 #libraryPage .library-category{min-height:76px;padding-inline:13px}
 #libraryPage .library-category-title{font-size:14px}
 #libraryPage .library-resource-list{grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}
}


#libraryReaderView{height:100%;min-height:0;display:flex;flex-direction:column;gap:12px}
#libraryReaderView[hidden]{display:none!important}
#libraryReaderView .reader-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
#libraryReaderView .reader-toolbar button,#libraryReaderView .reader-controls button{border:1px solid var(--lib-line);border-radius:10px;padding:8px 12px;background:var(--lib-card);color:var(--lib-text);font:700 12px Cairo,Tahoma,sans-serif}
#libraryReaderView .reader-title{font:700 21px Amiri,serif;color:var(--lib-text);margin:4px 0}
#libraryReaderView .reader-meta,#libraryReaderView .reader-status{font-size:11px;color:var(--lib-muted)}
#libraryReaderView .reader-paper{overflow:auto;flex:1;min-height:180px;background:var(--lib-card);border:1px solid var(--lib-line);border-radius:16px;padding:clamp(18px,5vw,34px);box-shadow:var(--lib-shadow);color:var(--lib-text);font:18px/2.1 Amiri,'Noto Naskh Arabic',serif}
#libraryReaderView .reader-paper p{margin:0 0 1em}
#libraryReaderView .reader-paper h2,#libraryReaderView .reader-paper h3{font-family:Amiri,serif;margin:1em 0 .5em}
#libraryReaderView .reader-controls{display:flex;justify-content:space-between;align-items:center;gap:8px}
#libraryReaderView .reader-controls button:disabled{opacity:.4}
#libraryReaderView .reader-loading{padding:28px;text-align:center;color:var(--lib-muted);font:14px Cairo,Tahoma,sans-serif}





/* مكتبة أنوار الجديدة: المصحف والسبحة فقط */
#libraryPage #libraryBooks{
 grid-template-columns:repeat(2,minmax(0,1fr))!important;
 gap:14px!important;max-width:720px!important;margin:10px auto 0!important
}
#libraryPage .library-book-card{min-width:0!important}
#libraryPage .library-book-save{display:none!important}
#libraryPage .library-tasbih-card .tasbih-book-cover{
 background:linear-gradient(145deg,#1b7890 0%,#15516f 52%,#092b4c 100%)!important;
 border-color:#d8bd7c!important;
}
#libraryPage .library-tasbih-card .tasbih-cover-beads{
 display:flex!important;align-items:center!important;justify-content:center!important;
 gap:5px!important;margin:0 auto 5px!important;direction:ltr!important
}
#libraryPage .library-tasbih-card .tasbih-cover-beads i{
 display:block!important;width:13px!important;height:13px!important;border-radius:50%!important;
 border:1px solid #e7d39b!important;
 background:radial-gradient(circle at 30% 25%,#b6e6f2 0%,#5ba5c6 30%,#174c75 78%)!important;
 box-shadow:0 2px 4px #061b2b88!important
}
#libraryPage .tasbih-view[hidden]{display:none!important}
#libraryPage .tasbih-view{
 width:100%;max-width:760px;margin:0 auto;padding:7px 12px 22px;
}
#libraryPage .tasbih-screen-head{
 display:flex;align-items:center;justify-content:space-between;gap:10px;
 min-height:42px;padding:3px 2px 10px;color:var(--lib-text)
}
#libraryPage .tasbih-screen-head strong{
 font:700 17px 'Aref Ruqaa',Amiri,serif;color:var(--lib-text)
}
#libraryPage .tasbih-screen-head>span{color:var(--lib-gold);font-size:21px}
#libraryPage .tasbih-screen-head button{
 border:1px solid var(--lib-line);border-radius:9px;background:var(--lib-card);
 color:var(--lib-text);padding:7px 12px;font:600 11px Cairo,Tahoma,sans-serif
}
#libraryPage .anwar-tasbih{
 width:min(100%,590px)!important;min-height:390px!important;margin:8px auto 12px!important;
 padding:22px 17px 19px!important;border:1px solid #d8c18c!important;border-radius:20px!important;
 background:linear-gradient(155deg,#fffdf7 0%,#f5efdf 65%,#ece2ca 100%)!important;
 color:#183c58!important;box-shadow:0 8px 24px rgba(23,46,65,.12)!important;text-align:center!important
}
#libraryPage .tasbih-heading{
 display:flex!important;align-items:center!important;justify-content:center!important;gap:10px!important;
 color:#173e5b!important
}
#libraryPage .tasbih-mark{
 width:42px!important;height:42px!important;border:1px solid #c6a96b!important;
 color:#98743d!important;background:#fffaf0!important
}
#libraryPage .tasbih-heading strong{color:#173e5b!important;font-size:20px!important}
#libraryPage .tasbih-heading small{color:#8a7654!important}
#libraryPage .tasbih-body{
 display:grid!important;grid-template-columns:58px minmax(0,1fr)!important;
 align-items:center!important;gap:12px!important;width:min(100%,420px)!important;
 margin:10px auto 0!important;direction:rtl!important
}
#libraryPage .tasbih-bead-strand{
 position:relative!important;display:flex!important;flex-direction:column!important;
 align-items:center!important;justify-content:center!important;gap:8px!important;
 min-height:260px!important;padding:10px 0!important
}
#libraryPage .tasbih-bead-strand:before{
 content:""!important;position:absolute!important;top:12px!important;bottom:12px!important;
 left:50%!important;width:2px!important;transform:translateX(-50%)!important;
 background:linear-gradient(#cbb47f,#8a7045,#cbb47f)!important;z-index:0!important
}
#libraryPage .tasbih-bead-strand i{
 position:relative!important;z-index:1!important;display:block!important;width:21px!important;height:21px!important;
 border-radius:50%!important;border:1px solid #c5a66c!important;
 background:radial-gradient(circle at 30% 25%,#c6edf4 0%,#68b5d0 25%,#276e96 67%,#12456b 100%)!important;
 box-shadow:inset 0 1px 2px #ffffffa8,0 2px 4px #173e5b30!important
}
#libraryPage .tasbih-content{min-width:0!important;text-align:center!important}
#libraryPage .tasbih-phrase{
 margin:10px 0 8px!important;color:#274761!important;font:700 18px/1.8 'Amiri',serif!important
}
#libraryPage .tasbih-count{
 color:#174e72!important;font:700 58px/1.25 Cairo,Tahoma,sans-serif!important;
 font-variant-numeric:tabular-nums!important
}
#libraryPage .tasbih-label{color:#8a7654!important;font:11px Cairo,Tahoma,sans-serif!important}
#libraryPage .tasbih-actions{
 display:flex!important;align-items:center!important;justify-content:center!important;gap:13px!important;margin:18px 0!important
}
#libraryPage .tasbih-actions button{
 width:43px!important;height:43px!important;border:1px solid #d0b77f!important;border-radius:50%!important;
 background:#fff9e9!important;color:#31536b!important;font-size:22px!important
}
#libraryPage .tasbih-actions .tasbih-tap{
 width:82px!important;height:82px!important;border:5px double #d3b775!important;
 background:radial-gradient(circle at 32% 22%,#79bdd0 0%,#246b8d 46%,#123e61 100%)!important;
 color:#fff9e8!important;font:700 18px Cairo,sans-serif!important;
 box-shadow:0 5px 13px #173e5b35,inset 0 2px 4px #ffffff55!important
}
#libraryPage .tasbih-voice-row{display:grid!important;justify-items:center!important;gap:7px!important}
#libraryPage .tasbih-voice-row button{
 width:auto!important;height:auto!important;padding:8px 15px!important;border:1px solid #c8b17e!important;
 border-radius:22px!important;background:#fff9e9!important;color:#244a67!important;font:600 12px Cairo,Tahoma,sans-serif!important
}
#libraryPage .tasbih-voice-row button[aria-pressed="true"]{background:#dceee7!important;color:#23543f!important}
#libraryPage .tasbih-voice-row small{color:#8a7654!important;font:10px/1.8 Cairo,Tahoma,sans-serif!important}
#libraryPage #libraryTheme{z-index:5!important;pointer-events:auto!important}
#libraryReaderView[data-reader-book="mushaf-madinah"] .pdf-reader-toolbar,
#libraryReaderView[data-reader-book="mushaf-madinah"] .pdf-reader-footer{
 background:#123e61!important;color:#fff5dc!important;border-color:#c9a96a!important
}
#libraryReaderView[data-reader-book="mushaf-madinah"] .pdf-reader-toolbar button,
#libraryReaderView[data-reader-book="mushaf-madinah"] .pdf-reader-footer button{
 background:#fff8e8!important;color:#25445d!important;border-color:#d3ba82!important
}
#libraryReaderView[data-reader-book="mushaf-madinah"] .pdf-reader-heading strong,
#libraryReaderView[data-reader-book="mushaf-madinah"] .pdf-reader-heading small,
#libraryReaderView[data-reader-book="mushaf-madinah"] .pdf-reader-footer{color:#fff2d5!important}
#libraryReaderView[data-reader-book="mushaf-madinah"] .pdf-reader-controls{
 background:#164a6b!important;border-color:#c9a96a!important
}
#libraryReaderView[data-reader-book="mushaf-madinah"] .pdf-reader-controls button{
 background:#fff8e8!important;color:#21445f!important;border-color:#d3ba82!important
}
#libraryReaderView[data-reader-book="mushaf-madinah"] .pdf-reader-stage{
 background:#e9e1d2!important;padding:10px 6px 18px!important
}
#libraryReaderView[data-reader-book="mushaf-madinah"] .pdf-reader-sheet{
 border:3px double #c8ad77!important;border-radius:3px!important;
 background:#fffaf0!important;padding:5px!important;box-shadow:0 8px 24px #4d402d38!important
}
@media(max-width:430px){
 #libraryPage .tasbih-view{padding-inline:7px!important}
 #libraryPage .anwar-tasbih{padding:18px 10px 15px!important;min-height:350px!important}
 #libraryPage .tasbih-body{grid-template-columns:43px minmax(0,1fr)!important;gap:7px!important}
 #libraryPage .tasbih-bead-strand{min-height:245px!important;gap:7px!important}
 #libraryPage .tasbih-bead-strand i{width:18px!important;height:18px!important}
 #libraryPage .tasbih-count{font-size:50px!important}
 #libraryPage .tasbih-actions{gap:8px!important}
 #libraryPage .tasbih-actions .tasbih-tap{width:72px!important;height:72px!important}
}
@media(max-width:390px){
 #libraryPage #libraryBooks{gap:11px!important}
 #libraryPage .library-book-cover{min-height:180px!important;padding:11px 7px 9px!important}
 #libraryPage .library-book-caption strong{font-size:12px!important}
}
@media(min-width:620px){
 #libraryPage #libraryBooks{grid-template-columns:repeat(2,minmax(0,1fr))!important}
}
@media(min-width:900px){
 #libraryPage #libraryBooks{grid-template-columns:repeat(2,minmax(0,1fr))!important;max-width:720px!important}
}

#libraryPage #libraryHome[hidden]{display:none!important}
#libraryPage .tasbih-view[hidden]{display:none!important}

#libraryPage .library-book-card.library-tasbih-card .library-book-cover.tasbih-book-cover{background:linear-gradient(145deg,#1b7890 0%,#15516f 52%,#092b4c 100%)!important}


/* المصحف الورقي يفتح مباشرة؛ لا أغلفة كتب أو بطاقات وسيطة */
#libraryPage #libraryHome,#libraryPage #libraryBooks{display:none!important}
#readerTasbih{
 flex:none;min-width:58px!important;min-height:34px!important;padding:5px 12px!important;
 border:1px solid #d8bd7c!important;border-radius:18px!important;
 background:#fff8e8!important;color:#254761!important;
 font:700 11px Cairo,Tahoma,sans-serif!important
}
#libraryReaderView[data-reader-book="mushaf-madinah"] .pdf-reader-toolbar{
 min-height:54px!important;background:#0f6688!important;color:#fff!important;
 border-bottom:2px solid #d7bf87!important
}
#libraryReaderView[data-reader-book="mushaf-madinah"] .pdf-reader-heading strong,
#libraryReaderView[data-reader-book="mushaf-madinah"] .pdf-reader-heading small{color:#fff!important}
#libraryReaderView[data-reader-book="mushaf-madinah"] .pdf-reader-toolbar button{
 background:#f8f4e9!important;color:#19445f!important;border-color:#d8bf84!important
}
#libraryReaderView[data-reader-book="mushaf-madinah"] .pdf-reader-controls{
 background:#e9f2f4!important;border-color:#bed0d5!important
}
#libraryReaderView[data-reader-book="mushaf-madinah"] .pdf-reader-controls button{
 background:#fff!important;color:#15516d!important;border-color:#c3d4d9!important
}
#libraryReaderView[data-reader-book="mushaf-madinah"] .pdf-reader-stage{
 align-items:flex-start!important;justify-content:center!important;
 background:#e6e2d8!important;padding:12px 7px 18px!important
}
#libraryReaderView[data-reader-book="mushaf-madinah"] .pdf-reader-sheet{
 width:max-content!important;max-width:100%!important;min-height:0!important;
 margin:0 auto!important;padding:5px!important;
 border:1px solid #c7b58d!important;border-radius:2px!important;
 background:#fff!important;box-shadow:0 3px 16px rgba(56,49,35,.2)!important
}
#libraryReaderView[data-reader-book="mushaf-madinah"] .pdf-reader-sheet canvas{
 display:block!important;max-width:100%!important;height:auto!important
}
#libraryReaderView[data-reader-book="mushaf-madinah"] .pdf-reader-footer{
 background:#0f6688!important;color:#fff!important;border-color:#d7bf87!important
}
@media(max-width:430px){
 #libraryReaderView[data-reader-book="mushaf-madinah"] .pdf-reader-toolbar{padding-inline:7px!important;gap:8px!important}
 #readerTasbih{min-width:54px!important;padding-inline:9px!important}
 #libraryReaderView[data-reader-book="mushaf-madinah"] .pdf-reader-stage{padding:7px 4px 12px!important}
}

/* سبحة أنوار: واجهة الذكر فقط، دون رفوف أو أغلفة كتب */
#libraryPage .library-shell>header .library-brand-copy strong{font-family:'Aref Ruqaa',Amiri,serif}
#libraryPage #libraryHome{display:none!important}
#libraryPage .tasbih-view{width:100%;max-width:680px;margin:0 auto;padding:clamp(8px,3vw,24px)}
#libraryPage .tasbih-screen-head{justify-content:center;position:relative;min-height:54px}
#libraryPage .tasbih-screen-head>span{display:none}
#libraryPage .tasbih-screen-head strong{font-size:clamp(23px,5vw,32px);letter-spacing:.2px}
#libraryPage #tasbihFloatEnable{
 position:absolute;inset-inline-start:0;top:7px;border:1px solid #c9ad70;border-radius:20px;
 background:#fff8e8;color:#234e6c;padding:8px 13px;font:700 11px Cairo,Tahoma,sans-serif
}
#libraryPage .anwar-tasbih{
 position:relative;overflow:hidden;min-height:420px!important;
 background:radial-gradient(ellipse at 50% 0%,#fff 0%,#f8f1df 54%,#e9dfc8 100%)!important;
 border:1px solid #d7bd7b!important;box-shadow:0 14px 40px rgba(21,55,76,.13),inset 0 0 0 5px #ffffff8c!important
}
#libraryPage .anwar-tasbih:before{
 content:"";position:absolute;inset:10px;border:1px solid #d7c18e;border-radius:14px;pointer-events:none
}
#libraryPage .tasbih-heading{position:relative;z-index:1}
#libraryPage .tasbih-mark{box-shadow:0 0 20px #d4bb7960}
#libraryPage .tasbih-bead-strand i{transition:transform .18s,box-shadow .18s}
#libraryPage .anwar-tasbih.tasbih-pulse .tasbih-bead-strand i{animation:anwarBeadPulse .5s ease}
#libraryPage .anwar-tasbih.tasbih-pulse .tasbih-count{animation:anwarCountPulse .35s ease}
@keyframes anwarBeadPulse{50%{transform:scale(1.22);box-shadow:0 0 16px #62b8d8}}
@keyframes anwarCountPulse{50%{text-shadow:0 0 18px #8cc9df;transform:scale(1.06)}}
.anwar-floating-tasbih{
 position:fixed;z-index:2147483000;right:14px;bottom:calc(18px + env(safe-area-inset-bottom,0px));
 display:flex;align-items:center;gap:7px;min-height:54px;padding:7px 10px;
 border:1px solid #d6bd7c;border-radius:28px;
 background:linear-gradient(135deg,#103c5b,#176b87 62%,#143c5a);
 color:#fff9e9;box-shadow:0 8px 28px #092b4666,0 0 0 3px #d9c48b38;
 direction:rtl;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
 animation:anwarFloatIn .35s cubic-bezier(.2,.8,.2,1)
}
.anwar-floating-tasbih[hidden]{display:none!important}
.anwar-float-glow{position:absolute;inset:-3px;border-radius:inherit;pointer-events:none;box-shadow:0 0 18px #6cc5df66;animation:anwarFloatGlow 2.8s ease-in-out infinite}
.anwar-float-symbol{font-size:20px;color:#f1d994;text-shadow:0 0 10px #fff2b4}
#anwarFloatCount{min-width:34px;text-align:center;font:700 17px Cairo,Tahoma,sans-serif;font-variant-numeric:tabular-nums}
.anwar-floating-tasbih button{position:relative;z-index:1;width:35px;height:35px;border:1px solid #ffffff54;border-radius:50%;background:#ffffff18;color:#fff9e9;font:700 17px Cairo,Tahoma,sans-serif}
#anwarFloatTap{background:#f1d994;color:#173d59;border-color:#fff1c2;font-size:22px}
#anwarFloatVoice[aria-pressed="true"]{background:#c5e8d8;color:#164632;border-color:#d8f6e7}
#anwarFloatHide{width:27px;height:27px;font-size:15px;background:#ffffff0d}
@keyframes anwarFloatIn{from{opacity:0;transform:translateY(14px) scale(.94)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes anwarFloatGlow{50%{opacity:.45;box-shadow:0 0 25px #6cc5dfaa}}
@media(max-width:420px){.anwar-floating-tasbih{right:9px;bottom:calc(12px + env(safe-area-inset-bottom,0px));gap:5px;padding:6px 8px}.anwar-floating-tasbih button{width:32px;height:32px}}
@media(prefers-reduced-motion:reduce){.anwar-floating-tasbih,.anwar-float-glow,#libraryPage .tasbih-bead-strand i,#libraryPage .tasbih-count{animation:none!important;transition:none!important}}

/* زهور التوليب المصوّرة بدل رموز الإيموجي */
.anwar-tulip-img{display:block;max-width:100%;max-height:100%;object-fit:contain;object-position:center;pointer-events:none;filter:drop-shadow(0 1px 2px #442b2530)}
#libraryPage .library-mark{padding:3px!important;overflow:hidden}
#libraryPage .library-mark .anwar-tulip-img{width:29px;height:34px}
#libraryPage .tasbih-mark{overflow:visible!important}
#libraryPage .tasbih-mark .anwar-tulip-img{width:30px;height:42px}
#libraryPage .tasbih-screen-head>.tasbih-head-tulip{display:grid!important;place-items:center;width:30px;height:39px;flex:none}
#libraryPage .tasbih-head-tulip .anwar-tulip-img{width:28px;height:39px}
.anwar-float-symbol{display:grid;place-items:center;width:27px;height:38px;flex:none;line-height:1}
.anwar-float-symbol .anwar-tulip-img{width:25px;height:36px}
.country-reader-seal .anwar-tulip-img{width:23px;height:30px}
</style></head><body>${$('pa').innerHTML}\x3Cscript>onload=function(){setTimeout(function(){print()},900)}<\/script>


<style id="anwar-device-unlock-ui">
#vaultPasswordFields[hidden],#vaultDeviceUnlock[hidden],#vaultPasswordFallbackToggle[hidden],#vaultDeviceManage[hidden],#vaultDeviceDisableBtn[hidden],#vaultDeviceSetupForm[hidden]{display:none!important}
#vaultGate .vault-device-action,#vaultGate .vault-password-fallback,#vaultGate .vault-device-manage{
 width:100%;min-height:45px;margin:0 0 8px;padding:9px 12px;border:1px solid #b7c9df;border-radius:10px;
 background:#edf4fc;color:#183d66;font-weight:800
}
#vaultGate .vault-device-action{border-color:#b58b45;background:linear-gradient(135deg,#fff5da,#ead39c);color:#453315}
#vaultGate .vault-password-fallback{background:#fff;color:#35516e;font-size:12px}
#vaultGate .vault-device-manage{min-height:38px;background:transparent;color:#52677f;font-size:11px}
#vaultGate button:disabled{opacity:.55}
#vaultDeviceSetupDialog{width:min(92vw,430px);padding:20px;border:1px solid #c9a96a;border-radius:16px;background:#fff;color:#1b3049;box-shadow:0 18px 55px #0004}
#vaultDeviceSetupDialog::backdrop{background:#071a31b8;backdrop-filter:blur(5px)}
#vaultDeviceSetupDialog h2{margin:0 0 9px;text-align:center;font:700 22px 'Aref Ruqaa',Amiri,serif;color:#174477}
#vaultDeviceSetupDialog .vault-device-explanation{margin:0 0 14px;color:#5c6b7d;font-size:12px;line-height:1.9;text-align:center}
#vaultDeviceSetupDialog label{display:block;margin:9px 0 5px;font-size:12px;font-weight:800}
#vaultDeviceSetupDialog input{width:100%;min-height:44px;padding:9px 11px;border:1px solid #ccd6e3;border-radius:9px;background:#f8fafc;color:#152943;text-align:left;direction:ltr}
#vaultDeviceSetupDialog form button,#vaultDeviceDisableBtn,#vaultDeviceSetupClose{width:100%;min-height:42px;margin-top:9px;padding:8px 11px;border:1px solid #b9c8d9;border-radius:9px;background:#174477;color:white;font-weight:800}
#vaultDeviceDisableBtn{background:#fff4f1;border-color:#d5a39b;color:#923a32}
#vaultDeviceSetupClose{background:#f3f5f8;color:#43566e}
#vaultDeviceSetupStatus{min-height:22px;margin:10px 0 3px;color:#53677e;font-size:11px;line-height:1.8}
#vaultDeviceSetupDialog button:disabled{opacity:.55}
@media(max-width:520px){#vaultDeviceSetupDialog{padding:17px;border-radius:13px}}
</style>


<style id="anwar-toolbar-spacing-and-palette-cycle-v2">
/* فراغ صغير ومتوازن بين عناصر الشريط بعد نقل النسخة المشفرة */
.tb{gap:4px!important}
@media(max-width:800px){.tb{gap:4px!important}}
/* الألوان تتغير مباشرة من الأيقونة؛ لا تظهر لوحة اختيار */
#palettePanel{display:none!important}
</style>

</body></html>`;
 try{await dl.save({filename:((cur.title||'أنوار').replace(/[\\/:*?"<>|]/g,'-').slice(0,60))+'.html',data:new Blob([h],{type:'text/html'})});toast('افتح الملف المنزَّل وستظهر نافذة الطباعة تلقائيًا',5000)}catch(e){}
}
async function doPrint(){
 if(!cur)return;buildPA();
 try{await document.fonts.ready}catch(e){}
 let fired=false;const f=()=>{fired=true};addEventListener('beforeprint',f,{once:true});
 try{window.print()}catch(e){}
 setTimeout(()=>{removeEventListener('beforeprint',f);if(!fired)printFile()},1200);
}
function safeFileName(value,fallback){
 const cleaned=String(value||fallback||'anwar-book').replace(/[\\/:*?"<>|]/g,'-').replace(/\s+/g,' ').trim().slice(0,80);
 return cleaned||fallback||'anwar-book';
}
// User-selected files are downloaded as inert attachments, never as active HTML/SVG.
async function downloadUntrustedFile(file,filename){
 const inertBlob=new Blob([file],{type:'application/octet-stream'});
 return downloadBlob(inertBlob,safeFileName(filename,'download'));
}
async function downloadBlob(blob,filename,options={}){
 if(!options.direct&&typeof window.showSaveFilePicker==='function'){
  try{
   const handle=await window.showSaveFilePicker({suggestedName:filename});
   const writable=await handle.createWritable();
   await writable.write(blob);await writable.close();
   return true;
  }catch(error){
   if(error&&error.name==='AbortError')return false;
   console.warn('تعذّر فتح نافذة اختيار مكان الحفظ؛ سيُستخدم التنزيل المعتاد.',error);
  }
 }
 try{
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=filename;a.rel='noopener';a.style.display='none';
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
  return true;
 }catch(error){console.warn('تعذّر تنزيل الملف',error);toast('تعذّر تجهيز التنزيل في هذا المتصفح.');return false}
}
function notePlainText(note){
 return plain(note.html||'').replace(/\u00a0/g,' ').trim();
}
function recordsText(records,title){
 const parts=[title||'مختارات من مفكرة أنوار','مفكرة أنوار · Anouar Oumlili',''];
 records.forEach((note,index)=>{
  parts.push((index+1)+'. '+(note.title||'بلا عنوان'));
  parts.push((TYPES[note.type]||'عمل')+' · '+fmt(note.ts));
  parts.push(notePlainText(note),'');
 });
 return parts.join('\n');
}
function recordsHtml(records,title){
 // HTML exports deliberately contain escaped plain text only. Rich editor markup
 // stays inside the app's sanitized rendering path and is never copied into a
 // downloadable HTML document where the browser would parse it again.
 const items=records.map(note=>'<section class="book-item"><h2>'+esc(note.title||'بلا عنوان')+'</h2><p class="meta">'+esc(TYPES[note.type]||'عمل')+' · '+esc(fmt(note.ts))+'</p><div class="paper-export paper-'+(note.paper||'plain')+'" style="white-space:pre-wrap">'+esc(notePlainText(note))+'</div></section>').join('');
 return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+'</title><style>body{max-width:850px;margin:0 auto;padding:28px 22px;color:#222;background:#fff;font:20px/2 Amiri,"Noto Naskh Arabic",serif}h1{text-align:center;color:#173d5c;font-size:34px}h2{text-align:center;font-size:27px}.meta{color:#777;text-align:center;font:12px Tahoma,sans-serif;border-bottom:1px solid #c9a96a;padding-bottom:12px}.book-item{margin:34px 0;page-break-before:always;break-before:page}.paper-export.paper-ruled{background-image:repeating-linear-gradient(to bottom,transparent 0,transparent calc(2.05em - 1px),rgba(104,137,170,.22) calc(2.05em - 1px),rgba(104,137,170,.22) 2.05em);background-size:100% 2.05em}.paper-export.paper-framed{border:5px double #c9b78f;padding:38px 42px}.paper-export.paper-poetry .v{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;text-align:center;margin:7px 0}.paper-export.paper-poetry .v span{display:flex;align-items:center;justify-content:center;min-height:2.35em;padding:3px 9px;border:1px solid #c8b58c;border-radius:6px;overflow-wrap:anywhere}.paper-export.paper-plain{background:#fff;color:#222}.book-item:first-of-type{page-break-before:auto;break-before:auto}@media print{body{padding:0}.book-item{break-before:page;page-break-before:always}}</style></head><body><h1>'+esc(title)+'</h1>'+items+'<footer style="margin-top:40px;text-align:center;color:#999;font:11px Tahoma,sans-serif">مفكرة أنوار · © 2026 Anouar Oumlili</footer></body></html>';
}
function xmlEscape(value){
 return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}
function crc32(bytes){
 let crc=0xffffffff;
 for(let i=0;i<bytes.length;i++){crc^=bytes[i];for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}
 return (crc^0xffffffff)>>>0;
}
function makeStoredZip(entries){
 const encoder=new TextEncoder(),localParts=[],centralParts=[];let offset=0;
 const put16=(view,pos,val)=>view.setUint16(pos,val,true),put32=(view,pos,val)=>view.setUint32(pos,val>>>0,true);
 for(const entry of entries){
  const name=encoder.encode(entry.name),data=encoder.encode(entry.content),crc=crc32(data);
  const local=new Uint8Array(30+name.length+data.length),lv=new DataView(local.buffer);
  put32(lv,0,0x04034b50);put16(lv,4,20);put16(lv,6,0);put16(lv,8,0);put16(lv,10,0);put16(lv,12,0x21);
  put32(lv,14,crc);put32(lv,18,data.length);put32(lv,22,data.length);put16(lv,26,name.length);put16(lv,28,0);
  local.set(name,30);local.set(data,30+name.length);localParts.push(local);
  const central=new Uint8Array(46+name.length),cv=new DataView(central.buffer);
  put32(cv,0,0x02014b50);put16(cv,4,20);put16(cv,6,20);put16(cv,8,0);put16(cv,10,0);put16(cv,12,0);put16(cv,14,0x21);
  put32(cv,16,crc);put32(cv,20,data.length);put32(cv,24,data.length);put16(cv,28,name.length);put16(cv,30,0);put16(cv,32,0);put16(cv,34,0);put16(cv,36,0);
  put32(cv,38,0);put32(cv,42,offset);central.set(name,46);centralParts.push(central);offset+=local.length;
 }
 const centralSize=centralParts.reduce((sum,p)=>sum+p.length,0),end=new Uint8Array(22),ev=new DataView(end.buffer);
 put32(ev,0,0x06054b50);put16(ev,4,0);put16(ev,6,0);put16(ev,8,entries.length);put16(ev,10,entries.length);
 put32(ev,12,centralSize);put32(ev,16,offset);put16(ev,20,0);
 return new Blob([...localParts,...centralParts,end],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
}
function transcriptWordTableXml(rows){
 const widths=[700,4700,3900];
 const border='<w:tblBorders><w:top w:val="single" w:sz="6" w:color="B9AD98"/><w:left w:val="single" w:sz="6" w:color="B9AD98"/><w:bottom w:val="single" w:sz="6" w:color="B9AD98"/><w:right w:val="single" w:sz="6" w:color="B9AD98"/><w:insideH w:val="single" w:sz="4" w:color="D5CCBD"/><w:insideV w:val="single" w:sz="4" w:color="D5CCBD"/></w:tblBorders>';
 const grid='<w:tblGrid>'+widths.map(width=>'<w:gridCol w:w="'+width+'"/>').join('')+'</w:tblGrid>';
 const body=rows.map((row,rowIndex)=>{
  const cells=widths.map((width,index)=>{
   const value=String(row[index]??'');
   const shade=rowIndex===0?'<w:shd w:fill="EEE5D1"/>':'';
   return '<w:tc><w:tcPr><w:tcW w:w="'+width+'" w:type="dxa"/>'+shade+'</w:tcPr><w:p><w:pPr><w:bidi/><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:rtl/><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">'+xmlEscape(value||' ')+'</w:t></w:r></w:p></w:tc>';
  }).join('');
  return '<w:tr>'+cells+'</w:tr>';
 }).join('');
 return '<w:tbl><w:tblPr><w:bidiVisual/><w:tblW w:w="9300" w:type="dxa"/>'+border+'</w:tblPr>'+grid+body+'</w:tbl>';
}
function recordsDocx(records,title){
 const paragraphs=[];
 paragraphs.push('<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>'+xmlEscape(title)+'</w:t></w:r></w:p>');
 records.forEach((note,index)=>{
  paragraphs.push('<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>'+xmlEscape(note.title||'بلا عنوان')+'</w:t></w:r></w:p>');
  paragraphs.push('<w:p><w:r><w:rPr><w:color w:val="777777"/><w:sz w:val="20"/></w:rPr><w:t>'+xmlEscape((TYPES[note.type]||'عمل')+' · '+fmt(note.ts))+'</w:t></w:r></w:p>');
  if(Array.isArray(note.transcriptRows)&&note.transcriptRows.length>1){
   paragraphs.push(transcriptWordTableXml(note.transcriptRows));
  }else{
   notePlainText(note).split(/\n/).forEach(line=>{
    paragraphs.push('<w:p><w:pPr><w:bidi/><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:rtl/><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="30"/></w:rPr><w:t xml:space="preserve">'+xmlEscape(line||' ')+'</w:t></w:r></w:p>');
   });
  }
 });
 paragraphs.push('<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:color w:val="999999"/><w:sz w:val="18"/></w:rPr><w:t>مفكرة أنوار · © 2026 Anouar Oumlili</w:t></w:r></w:p>');
 const documentXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+paragraphs.join('')+'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>';
 const contentTypes='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>';
 const rootRels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
 const docRels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>';
 const styles='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:lang w:val="ar-SA" w:bidi="ar-SA"/><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:pPr><w:jc w:val="center"/><w:bidi/></w:pPr><w:rPr><w:b/><w:sz w:val="40"/><w:color w:val="173D5C"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:jc w:val="center"/><w:bidi/></w:pPr><w:rPr><w:b/><w:sz w:val="34"/></w:rPr></w:style></w:styles>';
 return makeStoredZip([
  {name:'[Content_Types].xml',content:contentTypes},
  {name:'_rels/.rels',content:rootRels},
  {name:'word/document.xml',content:documentXml},
  {name:'word/_rels/document.xml.rels',content:docRels},
  {name:'word/styles.xml',content:styles}
 ]);
}
const anwarLazyScripts=new Map();
function loadScriptOnce(src,integrity){
 if((src.includes('html2canvas')&&window.html2canvas)||(src.includes('jspdf')&&window.jspdf)||(src.includes('qrcode')&&window.QRCode))return Promise.resolve();
 if(anwarLazyScripts.has(src))return anwarLazyScripts.get(src);
 const task=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src=src;
  if(integrity){script.integrity=integrity;script.crossOrigin='anonymous';script.referrerPolicy='no-referrer'}
  script.onload=()=>resolve();
  script.onerror=()=>{script.remove();reject(new Error('Library load failed: '+src))};
  document.head.append(script);
 });
 anwarLazyScripts.set(src,task);task.catch(()=>anwarLazyScripts.delete(src));return task;
}
async function ensurePdfLibraries(){
 await Promise.all([
  loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js','sha512-BNaRQnYJYiPSqHHDb58B0yaPfCu+Wgds8Gp/gU33kqBtgNS4tSPHuGibyoeqMV/TJlSKda6FXzoEyYGjTe+vXA=='),
  loadScriptOnce(new URL('vendor/jspdf.umd.min.js',document.baseURI).href)
 ]);
 if(!window.html2canvas||!window.jspdf)throw new Error('PDF libraries are unavailable');
}
async function renderPaPdf(filename){
 toast('جارٍ تجهيز مكتبات وملف PDF…',5000);
 try{
  await ensurePdfLibraries();await document.fonts.ready;
  const canvas=await window.html2canvas($('pa'),{scale:2,backgroundColor:'#fff',useCORS:true});
  const pdf=new window.jspdf.jsPDF({unit:'pt',format:'a4'});
  const width=pdf.internal.pageSize.getWidth(),height=pdf.internal.pageSize.getHeight();
  const pageHeight=Math.floor(canvas.width*height/width);
  for(let y=0,page=0;y<canvas.height;y+=pageHeight,page++){
   const slice=document.createElement('canvas');slice.width=canvas.width;slice.height=Math.min(pageHeight,canvas.height-y);
   const context=slice.getContext('2d');if(!context)throw new Error('Canvas unavailable');
   context.drawImage(canvas,0,y,canvas.width,slice.height,0,0,canvas.width,slice.height);
   if(page)pdf.addPage();pdf.addImage(slice.toDataURL('image/jpeg',.92),'JPEG',0,0,width,slice.height*width/canvas.width);
  }
  const saved=await downloadBlob(pdf.output('blob'),filename);
  if(saved)toast('تم حفظ ملف PDF على جهازك ✓',3500);return saved;
 }catch(error){console.warn('تعذّر تصدير PDF',error);toast('تعذّر إنشاء PDF. تحقق من الاتصال ثم أعد المحاولة؛ لم يُحذف أي عمل.',5500);return false}
}
function openSafeBlobTab(url){
 const opened=window.open(url,'_blank');
 if(!opened)return false;
 try{opened.opener=null}catch(error){}
 return true;
}
function openDocumentBlob(blob,filename){
 try{
  const url=URL.createObjectURL(blob);
  const opened=openSafeBlobTab(url);
  if(opened){
   toast('فُتح المستند في علامة جديدة. يمكنك قراءته أو حفظه من قائمة المتصفح.',4500);
   setTimeout(()=>URL.revokeObjectURL(url),10*60*1000);
   return true;
  }
  URL.revokeObjectURL(url);
  toast('منع المتصفح فتح علامة جديدة؛ سيتم تنزيل المستند بدلاً من ذلك.',4500);
  return downloadBlob(blob,filename);
 }catch(error){
  console.warn('تعذّر فتح المستند مباشرة',error);
  return downloadBlob(blob,filename);
 }
}
async function exportRecords(records,title,format){
 const base=safeFileName(title,'مختارات-مفكرة-أنوار');
 if(format==='txt')return openDocumentBlob(new Blob([recordsText(records,title)],{type:'text/plain;charset=utf-8'}),base+'.txt');
 if(format==='html')return openDocumentBlob(new Blob([recordsHtml(records,title)],{type:'text/html;charset=utf-8'}),base+'.html');
 if(format==='docx')return downloadBlob(recordsDocx(records,title),base+'.docx');
 if(format==='pdf'){
  $('pa').style.cssText='position:fixed;left:-10000px;top:0;width:794px;padding:48px 58px;background:#fff;color:#111;font-family:Amiri,serif;font-size:20px;line-height:2;direction:rtl';
  $('pa').innerHTML=records.map(note=>'<section class="book-item"><h2>'+esc(note.title||'بلا عنوان')+'</h2><div class="m">'+esc(TYPES[note.type]||'عمل')+' · '+esc(fmt(note.ts))+'</div><hr><div class="paper-export paper-'+(note.paper||'plain')+'">'+san(note.html||'')+'</div></section>').join('')+'<div class="f">مفكرة أنوار · © 2026 Anouar Oumlili · جميع الحقوق محفوظة</div>';
  return await renderPaPdf(base+'.pdf');
 }
 toast('صيغة غير مدعومة',3000);return false;
}
async function doPdf(){
 if(!cur){toast('افتح عملاً أولاً');return}
 flushPendingEdit(false);buildPA();
 await renderPaPdf(safeFileName(cur.title,'anwar-note')+'.pdf');
}
async function doWord(){
 if(!cur){toast('افتح عملاً أولاً');return}
 flushPendingEdit(false);
 try{
  const filename=safeFileName(cur.title,'anwar-note')+'.docx';
  const saved=await downloadBlob(recordsDocx([cur],cur.title||'أنوار'),filename,{direct:true});
  if(saved)toast('تم حفظ مستند Word على جهازك ✓',3500);
 }catch(error){
  console.warn('تعذّر تصدير Word',error);
  toast('تعذّر إنشاء ملف Word. لم يُحذف أي عمل.',5000);
 }
}

function openHistory(){if(!cur){toast('افتح عملًا أولًا');return}clearTimeout(tm);if(pendingBefore){cur.history=cur.history||[];if(pendingBefore.html!==cur.html)cur.history.push(pendingBefore);cur.history=cur.history.slice(-15);pendingBefore=null}const h=(cur.history||[]).slice().reverse();$('historyItems').innerHTML=h.length?h.map((v,i)=>`<button type="button" class="history-item" data-ver="${h.length-1-i}"><span>${esc(v.title||'بلا عنوان')} · ${TYPES[v.type]||'عمل'}</span><small>${fmt(v.ts)}</small></button>`).join(''):'<p class="empty">لا توجد إصدارات سابقة لهذا العمل بعد.</p>';$('historyDialog').showModal()}
function restoreHistory(i){if(!cur)return;const h=cur.history||[],v=h[i];if(!v)return;if(!confirm('استعادة هذا الإصدار؟ سيُحفظ الإصدار الحالي في السجل قبل الاستعادة.'))return;h.push({title:cur.title,type:cur.type,html:cur.html,ts:cur.ts,font:cur.font,size:cur.size,paper:cur.paper||'plain'});cur.history=h.slice(-15);Object.assign(cur,{title:v.title,type:v.type,html:v.html,ts:Date.now(),font:v.font,size:v.size,paper:v.paper||'plain'});pg.innerHTML=san(cur.html);$('t').value=cur.title;$('ty').value=cur.type;save();openNote(cur);$('historyDialog').close();toast('تمت استعادة الإصدار')}
function setBookToolExpanded(open,scroll=false){
 const app=$('app'),panel=$('bookToolPanel'),content=$('bookToolContent'),toggle=$('bookToolToggle');
 if(!panel||!content||!toggle)return;
 panel.open=!!open;
 content.hidden=!open;
 toggle.setAttribute('aria-expanded',String(!!open));
 if(app)app.classList.toggle('book-open',!!open);
 if(open&&scroll)requestAnimationFrame(()=>panel.scrollIntoView({behavior:'smooth',block:'nearest'}));
}
$('bookToolPanel')?.addEventListener('toggle',()=>{
 const panel=$('bookToolPanel'),content=$('bookToolContent'),toggle=$('bookToolToggle');
 if(content)content.hidden=!panel?.open;
 if(toggle)toggle.setAttribute('aria-expanded',String(!!panel?.open));
 $('app')?.classList.toggle('book-open',!!panel?.open);
});
function syncRibbonMenuSpace(){
 const anyOpen=Array.from(document.querySelectorAll('#rib .rib-menu')).some(menu=>menu.open);
 $('app')?.classList.toggle('ribbon-menu-open',anyOpen);
}
document.querySelectorAll('#rib .rib-menu').forEach(menu=>menu.addEventListener('toggle',syncRibbonMenuSpace));


async function createBook(){
 if(cur)flushPendingEdit(false);
 const scope=$('bookScope').value,title=$('bookTitle').value.trim()||'مختارات من مفكرة أنوار';
 let notes;
 if(scope==='current')notes=cur&&cur!==draftNote?[cur]:[];
 else notes=S.notes.filter(n=>scope==='all'||(scope==='poem'?n.type==='poem':n.type==='text'||n.type==='idea')).sort((a,b)=>a.ts-b.ts);
 if(!notes.length){toast(scope==='current'?'افتح عملاً أولاً لتصديره.':'لا توجد أعمال ضمن هذا الاختيار.');return}
 const format=$('bookFormat').value,button=$('createBook');
 button.disabled=true;button.textContent='جارٍ التصدير…';
 try{
  const ok=await exportRecords(notes,title,format);
  if(ok){setBookToolExpanded(false);toast('تم تصدير الأعمال بنجاح ✓',3000)}
 }catch(error){console.warn('تعذّر تصدير الأعمال',error);toast('تعذّر التصدير. بقيت أعمالك محفوظة.',5000)}
 finally{button.disabled=false;button.textContent='تصدير الأعمال'}
}
function insertImportedText(text,filename){
 if(!cur)newNote();
 if(!cur)return;
 const clean=String(text||'').replace(/\u0000/g,'').slice(0,500000);
 if(!clean.trim()){toast('الملف لا يحتوي على نص قابل للإدراج.');return}
 pg.focus();
 let selection=window.getSelection();
 if(saved&&pg.contains(saved.startContainer))restore();
 else if(selection){
  selection.removeAllRanges();
  const endRange=document.createRange();
  endRange.selectNodeContents(pg);
  endRange.collapse(false);
  selection.addRange(endRange);
 }
 selection=window.getSelection();
 let range=null;
 if(selection&&selection.rangeCount){
  const currentRange=selection.getRangeAt(0);
  if(pg.contains(currentRange.commonAncestorContainer))range=currentRange;
 }
 if(!range){
  range=document.createRange();
  range.selectNodeContents(pg);
  range.collapse(false);
 }
 range.deleteContents();
 const fragment=document.createDocumentFragment();
 let lastBlock=null;
 clean.split(/\r?\n/).forEach(line=>{
  const block=document.createElement('div');
  if(line)block.textContent=line;
  else block.append(document.createElement('br'));
  fragment.append(block);
  lastBlock=block;
 });
 range.insertNode(fragment);
 if(lastBlock){
  range.setStartAfter(lastBlock);
  range.collapse(true);
  const nextSelection=window.getSelection();
  if(nextSelection){nextSelection.removeAllRanges();nextSelection.addRange(range)}
 }
 touch();
 $('bookFileStatus').textContent='تم إدراج نص الملف «'+filename+'» في العمل المفتوح.';
 toast('تم استيراد النص إلى المفكرة ✓',3500);
}
async function handleBookFile(file){
 if(!file)return;
 setBookToolExpanded(true,false);
 const name=file.name||'مستند',ext=(name.split('.').pop()||'').toLowerCase();
 $('bookFileStatus').textContent='تم اختيار «'+name+'». جارٍ فحص نوع الملف…';
 if(['txt','md','csv'].includes(ext)){
  try{insertImportedText(await file.text(),name)}catch(error){console.warn(error);toast('تعذّر قراءة هذا الملف النصي.')}
  return;
 }
 if(['html','htm'].includes(ext)){
  try{const source=await file.text();insertImportedText(plain(source),name)}
  catch(error){console.warn(error);toast('تعذّر قراءة صفحة HTML.')}
  return;
 }
 try{
  if(typeof navigator.share==='function'&&typeof navigator.canShare==='function'&&navigator.canShare({files:[file]})){
   await navigator.share({files:[file],title:name});
   $('bookFileStatus').textContent='تم تمرير الملف إلى قائمة المشاركة في الهاتف. اختر التطبيق المناسب لفتحه.';
   return;
  }
 }catch(error){
  if(error&&error.name==='AbortError'){$('bookFileStatus').textContent='أُلغيت المشاركة. لم يتغير أي ملف.';return}
  console.warn('تعذّرت مشاركة الملف من الهاتف',error);
 }
 if(['pdf','png','jpg','jpeg','webp','gif'].includes(ext)){
  const url=URL.createObjectURL(file),opened=openSafeBlobTab(url);
  if(opened){$('bookFileStatus').textContent='فُتح الملف في علامة جديدة للقراءة.';setTimeout(()=>URL.revokeObjectURL(url),120000);return}
 }
 await downloadUntrustedFile(file,name);
 $('bookFileStatus').textContent='تم التعامل مع الملف عبر الحفظ أو التنزيل المتاح في هذا المتصفح.';
}

function showOwnerPanel(which){
 const own=which==='owner',share=which==='share';
 if(!own&&!share)return false;
 $('ownerPanel').hidden=!own;
 $('sharePanel').hidden=!share;
 $('ownerTab').classList.toggle('active',own);
 $('shareTab').classList.toggle('active',share);
 return true;
}
// Ownership and publication remain together; adhkar and tasbih have their own service pages.
window.AnwarShowOwnerPanel=function(which){
 if(which!=='owner'&&which!=='share')return false;
 return showOwnerPanel(which);
};
async function makeQR(){
 const url=$('shareUrl').value.trim();
 let parsedUrl;try{parsedUrl=new URL(url)}catch(error){toast('أدخل رابطًا عامًا يبدأ بـ https:// أو http://');return}
 if(parsedUrl.protocol!=='https:'&&parsedUrl.protocol!=='http:'){toast('يسمح بروابط HTTP وHTTPS فقط');return}
 try{await loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js','sha512-CNgIRecGo7nphbeZ04Sc13ka07paqdeTu0WR1IM4kNcpmBAUSHSQX0FslNhTDadL4O5SAGapGt4FodqL8My0mA==')}
 catch(error){console.warn('تعذّر تحميل مكتبة QR',error);toast('تعذّر تحميل مكتبة رمز QR؛ تحقق من الاتصال وحاول مجددًا.');return}
 if(!window.QRCode){toast('مكتبة QR غير متاحة في هذا المتصفح');return}
 const box=$('qrPreview');box.innerHTML='';
 new window.QRCode(box,{text:url,width:200,height:200,colorDark:'#102b45',colorLight:'#ffffff',correctLevel:window.QRCode.CorrectLevel.H});
 $('downloadQR').disabled=false;toast('تم إنشاء رمز QR للرابط');
}
function downloadAppIcon(){
 const href=new URL('icon-512.svg?v=20261116-4',location.href).href;
 const img=new Image();
 img.onload=()=>{
  const w=img.naturalWidth,h=img.naturalHeight;
  if(!w||!h){toast('ملف الأيقونة غير صالح');return}
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const ctx=c.getContext('2d');
  if(!ctx){toast('تعذّر تجهيز صورة الأيقونة');return}
  ctx.drawImage(img,0,0,w,h);
  const a=document.createElement('a');a.download='أيقونة-مفكرة-أنوار-'+w+'x'+h+'.png';
  a.href=c.toDataURL('image/png');a.click();
  toast('تم تنزيل الأيقونة بدقتها: '+w+'×'+h);
 };
 img.onerror=()=>toast('تعذّر تحميل ملف الأيقونة');
 img.src=href;
}
function downloadQRPoster(){const box=$('qrPreview'),qr=box.querySelector('canvas')||box.querySelector('img');if(!qr){toast('أنشئ رمز QR أولًا');return}const c=document.createElement('canvas');c.width=1080;c.height=1350;const x=c.getContext('2d');x.fillStyle='#f8f3e8';x.fillRect(0,0,c.width,c.height);x.strokeStyle='#b58a43';x.lineWidth=18;x.strokeRect(35,35,1010,1280);x.strokeStyle='#173b58';x.lineWidth=4;x.strokeRect(58,58,964,1234);x.fillStyle='#102f4b';x.textAlign='center';x.direction='rtl';x.font='bold 70px serif';x.fillText('مفكرة أنوار',540,175);x.font='34px serif';x.fillStyle='#76562a';x.fillText('الكلمة والقرآن رفيقان في كل وقت',540,235);x.fillStyle='#fff';x.fillRect(330,310,420,420);x.strokeStyle='#c29a50';x.lineWidth=12;x.strokeRect(320,300,440,440);if(qr.tagName==='CANVAS')x.drawImage(qr,350,330,380,380);else{x.drawImage(qr,350,330,380,380)}x.fillStyle='#173b58';x.font='bold 42px serif';x.fillText('امسح الرمز لزيارة المفكرة',540,825);x.font='34px serif';x.fillText('المطوّر وصاحب المشروع: Anouar Oumlili',540,910);x.fillText('أنوار أومليلي · الحسيمة · المملكة المغربية',540,970);x.font='28px serif';x.fillStyle='#80602f';x.fillText('المملكة المغربية',540,1080);x.font='25px serif';x.fillText('مفكرة أدبية · إذاعة القرآن · الأذكار',540,1150);const a=document.createElement('a');a.download='بطاقة-مفكرة-أنوار.png';a.href=c.toDataURL('image/png');a.click();toast('تم تجهيز بطاقة النشر PNG')}
function capturePoetryDictationRange(){
 const selection=window.getSelection();
 if(selection&&selection.rangeCount&&pg.contains(selection.anchorNode)&&pg.contains(selection.focusNode)){
  return selection.getRangeAt(0).cloneRange();
 }
 const range=document.createRange();
 range.selectNodeContents(pg);
 range.collapse(false);
 return range;
}
function poetryDictationPreviousCharacter(range){
 try{
  const prefix=document.createRange();
  prefix.selectNodeContents(pg);
  prefix.setEnd(range.startContainer,range.startOffset);
  return prefix.toString().slice(-1);
 }catch(error){return ''}
}
function appendPoetryDictationText(value){
 const text=String(value||'').replace(/\u200b/g,' ').replace(/\s+/g,' ').trim();
 if(!text||!cur||storageRecoveryBlocked)return;
 try{
  const range=poetryDictationRange&&pg.contains(poetryDictationRange.startContainer)
   ?poetryDictationRange.cloneRange():capturePoetryDictationRange();
  const punctuation=/^[،؛.!؟:»)]/.test(text);
  const insertion=(poetryDictationNeedsSpace&&!punctuation?' ':'')+text;
  range.deleteContents();
  const node=document.createTextNode(insertion);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  poetryDictationRange=range.cloneRange();
  poetryDictationNeedsSpace=true;
  const selection=window.getSelection();
  if(selection){selection.removeAllRanges();selection.addRange(range);}
  touch();
 }catch(error){
  console.error('تعذّر إدراج النص المملى في صفحة المفكرة',error);
  toast('تعذّر إدراج الكلام في موضع الكتابة. أوقف الإلقاء وحاول مجددًا.');
 }
}
function stopPoetryDictation(showMessage){
 if(!poetryDictationController||!poetryDictationController.isRequested())return false;
 poetryDictationController.stop();
 poetryDictationRange=null;
 if(tm)flushPendingEdit(true);
 if(showMessage)toast('تم إيقاف الإلقاء وحفظ النص في المفكرة.');
 return true;
}
function updatePoetryDictationButton(state){
 const button=$('sp');
 if(!button)return;
 if(state==='listening'){
  button.textContent='⏹️ إيقاف';
  button.title='إيقاف الإلقاء الصوتي وإبقاء النص في المفكرة';
  button.setAttribute('aria-pressed','true');
 }else if(state==='requesting'||state==='restarting'){
  button.textContent='⏳ جارٍ الاستماع';
  button.title='جارٍ تشغيل التعرف الصوتي؛ اضغط لإيقافه';
  button.setAttribute('aria-pressed','true');
 }else{
  button.textContent='🎙️ إلقاء';
  button.title='إلقاء القصيدة صوتيًا وتحويل كلامك إلى كتابة داخل المفكرة';
  button.setAttribute('aria-pressed','false');
 }
}
function togglePoetryDictation(){
 if(poetryDictationController&&poetryDictationController.isRequested()){
  stopPoetryDictation(true);
  return;
 }
 if(!cur){toast('أنشئ عملًا أو افتح قصيدة أولًا قبل الإلقاء الصوتي.');return;}
 if(storageRecoveryBlocked){toast('الحفظ متوقف حمايةً لبياناتك؛ عالج الاسترداد أولًا.');return;}
 const api=window.AnwarPoetryDictation;
 if(!api||typeof api.create!=='function'){
  toast('أداة الإملاء الصوتي غير محمّلة. أعد تحميل المفكرة وحاول مجددًا.');
  return;
 }
 if(speaking){
  speaking=false;speakText.run=(speakText.run||0)+1;
  try{window.speechSynthesis?.cancel()}catch(error){}
  $('speakRead').textContent='🔊 قراءة';
 }
 poetryDictationRange=capturePoetryDictationRange();
 const previous=poetryDictationPreviousCharacter(poetryDictationRange);
 poetryDictationNeedsSpace=Boolean(previous&&!/\s/.test(previous));
 poetryDictationController=api.create({
  onText:text=>appendPoetryDictationText(text),
  onStatus:(state,detail)=>{
   updatePoetryDictationButton(state);
   if(state==='error')toast(detail||'تعذّر تشغيل التعرف الصوتي.',5000);
}
 });
 const started=poetryDictationController.start();
 if(!started){
  poetryDictationRange=null;
  updatePoetryDictationButton('stopped');
  return;
 }
 toast('ألقِ نصك بالعربية؛ سيظهر الكلام المكتمل داخل صفحة المفكرة. قد يعالج المتصفح الصوت عبر خدمة التعرف لديه.',4500);
}
window.addEventListener('pagehide',()=>stopPoetryDictation(false));
function speakText(){
  if(poetryDictationController&&poetryDictationController.isRequested())stopPoetryDictation(false);
  const synth=window.speechSynthesis;
  if(!synth||typeof window.SpeechSynthesisUtterance!=='function'){
   toast('الإلقاء الصوتي غير متاح في هذا المتصفح؛ جرّب Chrome المحدّث');
   return;
  }
  if(speaking){
   speaking=false;speakText.run=(speakText.run||0)+1;
   synth.cancel();$('speakRead').textContent='🔊 قراءة';toast('تم إيقاف الإلقاء');
   return;
  }
  const text=(pg.innerText||pg.textContent||'').replace(/\u200b/g,' ').replace(/[ \t]+\n/g,'\n').trim();
  if(!text){toast('اكتب نصًا أولًا ثم اضغط «قراءة»');return;}
  const voices=typeof synth.getVoices==='function'?synth.getVoices():[];
  const voice=voices.find(v=>/^ar[-_]MA/i.test(v.lang||''))||
   voices.find(v=>/^ar[-_]SA/i.test(v.lang||''))||
   voices.find(v=>/^ar([_-]|$)/i.test(v.lang||''))||null;
  const chunks=[];
  let rest=text;
  while(rest.length>220){
   let cut=-1;
   ['\n','؟','!','،','؛','.',' '].forEach(mark=>{
    const p=rest.lastIndexOf(mark,220);
    if(p>95&&p>cut)cut=p+(mark===' '?0:1);
   });
   if(cut<96)cut=220;
   chunks.push(rest.slice(0,cut).trim());
   rest=rest.slice(cut).trim();
  }
  if(rest)chunks.push(rest);
  let index=0;
  const run=speakText.run=(speakText.run||0)+1;
  speaking=true;$('speakRead').textContent='⏹️ إيقاف';
  toast(voice?'بدأ الإلقاء بالصوت العربي: '+voice.name:'بدأ الإلقاء؛ يستخدم المتصفح صوته الافتراضي إن كان يدعم العربية');
  function finish(message){
   if(run!==speakText.run)return;
   speaking=false;$('speakRead').textContent='🔊 قراءة';
   if(message)toast(message,4000);
  }
  function next(){
   if(run!==speakText.run||!speaking)return;
   if(index>=chunks.length){finish('اكتمل إلقاء النص');return;}
   const utterance=new window.SpeechSynthesisUtterance(chunks[index]);
   utterance.lang=voice?.lang||'ar-SA';
   if(voice)utterance.voice=voice;
   utterance.rate=.85;utterance.pitch=1;utterance.volume=1;
   utterance.onend=()=>{if(run!==speakText.run)return;index++;next();};
   utterance.onerror=e=>{
    if(run!==speakText.run)return;
    const reason=e&&e.error;
    finish(reason==='not-allowed'?
     'منع المتصفح الإلقاء؛ اضغط الزر مجددًا واسمح بخدمة تحويل النص إلى كلام':
     'تعذّر تشغيل الصوت. تحقّق من تثبيت صوت عربي في إعدادات تحويل النص إلى كلام بالهاتف');
   };
   try{synth.speak(utterance);}
   catch(e){finish('تعذّر بدء الإلقاء في هذا المتصفح');}
  }
  synth.cancel();
  if(synth.paused)try{synth.resume();}catch(e){}
  next();
 }
$('rib').addEventListener('mousedown',e=>{if(e.target.closest('button'))e.preventDefault()});

document.addEventListener('click',e=>{
 const t=e.target.closest('button,summary,.card,#fl div,.archive-card');
 if(!e.target.closest('#fm')&&t?.id!=='fb')$('fm').classList.remove('o');
 if(!e.target.closest('#paperStylePanel')&&t?.id!=='paperStyleBtn'){$('paperStylePanel').hidden=true;$('paperStyleBtn').setAttribute('aria-expanded','false')}
 if(!t)return;
 if(t.dataset.archiveFilter!==undefined){archiveFilter=t.dataset.archiveFilter;renderArchive(true);return}
 if(t.dataset.archiveId){stopPoetryDictation(false);const selected=S.notes.find(n=>n.id===t.dataset.archiveId);if(selected){openNote(selected);$('archiveDialog').close()}return}
 if(t.id==='listMore'){listRenderLimit+=LIST_PAGE_SIZE;renderList();return}
 if(t.id==='archiveMore'){archiveRenderLimit+=LIST_PAGE_SIZE;renderArchive();return}
 if(t.id==='archiveBtn'){stopPoetryDictation(false);openArchive();return}
 if(t.id==='closeArchive'){$('archiveDialog').close();return}
 if(t.dataset.f){applyFont(t.dataset.f);return}
 if(t.classList.contains('chip')){flt=t.dataset.k;chips();renderList(true);return}
 if(t.classList.contains('card')){stopPoetryDictation(false);openNote(S.notes.find(n=>n.id===t.dataset.id));return}
 if(t.dataset.c){cmd(t.dataset.c);return}
 const id=t.id;
 if(t.dataset.paper){setPaperStyle(t.dataset.paper);return}
 if(id==='paperStyleBtn'){const panel=$('paperStylePanel'),open=panel.hidden,rect=t.getBoundingClientRect();panel.hidden=!open;t.setAttribute('aria-expanded',String(open));if(open){panel.style.top=Math.min(innerHeight-panel.offsetHeight-10,Math.max(8,rect.bottom+5))+'px';panel.style.left=Math.max(10,Math.min(rect.left,innerWidth-panel.offsetWidth-10))+'px'}return}
 if(id==='bookToolToggle'){e.preventDefault();setBookToolExpanded($('bookToolContent').hidden,true)}
 else if(id==='createBook')createBook();
 else if(id==='addBookFile')$('bookFilePicker').click();
 else if(id==='hist')openHistory();
 else if(id==='closeHistory')$('historyDialog').close();
 else if(t.dataset.ver!==undefined)restoreHistory(+t.dataset.ver);
 else if(id==='makeQR')makeQR();
 else if(id==='downloadQR')downloadQRPoster();
 else if(id==='downloadIcon')downloadAppIcon();
 else if(id==='new'){stopPoetryDictation(false);newNote();}
 else if(id==='bk'){stopPoetryDictation(false);openNote(null);$('app').classList.remove('focus')}
 else if(id==='th'){S.theme=document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';save();theme()}
 else if(id==='prn')doPrint();
 else if(id==='pdf')doPdf();
 else if(id==='word')doWord();
 else if(id==='sp')togglePoetryDictation();
 else if(id==='speakRead')speakText();
 else if(id==='fb'){const r=t.getBoundingClientRect(),m=$('fm');m.style.top=r.bottom+4+'px';m.style.left=Math.max(6,Math.min(r.left,innerWidth-266))+'px';fontList('');$('fq').value='';m.classList.toggle('o');loadFontStylesheets(true).catch(error=>{console.warn(error);toast('بعض الخطوط تحتاج إلى اتصال بالإنترنت',3500)})}
 else if(id==='vs'&&cur)insertPoetryVerse();
 else if(id==='exitFocus'){$('app').classList.remove('focus');requestAnimationFrame(()=>$('fo')?.focus())}
  else if(id==='fo'){$('app').classList.add('focus');toast('اضغط Esc للخروج من التركيز')}
 else if(id==='ip'){toast('💡 '+PROMPTS[Math.floor(Math.random()*PROMPTS.length)],5000)}
 else if(id==='pn'&&cur){cur.pin=!cur.pin;save();$('pn').textContent=cur.pin?'⭐ تثبيت':'☆ تثبيت';renderList()}
 else if(id==='cy'&&cur){navigator.clipboard&&navigator.clipboard.writeText((cur.title?cur.title+'\n\n':'')+pg.innerText).then(()=>toast('تم النسخ'),()=>toast('تعذّر النسخ'))}
 else if(id==='dl'&&cur){if(confirm('حذف هذا العمل نهائيًا؟')){S.notes=S.notes.filter(n=>n!==cur);save();openNote(null)}}
 else if(id==='bkp'){openEncryptedBackupDialog()}
 else if(id==='downloadBackup')downloadEncryptedBackup();
 else if(id==='vaultLockBtn'){lockVault()}
 else if(id==='exportRecovery')exportStorageRecovery();
 else if(id==='retryStorageAccess')retryStorageAccess();
 else if(id==='restoreBackup')restoreStorageBackup();
 else if(id==='startFresh')startFreshNotebook();
 else if(id==='cp'){copyEncryptedBackup()}
 else if(id==='rs'){restoreEncryptedBackup()}
 else if(id==='cl')$('dg').close();
 else if(id==='ownerBtn')$('ownerDialog').showModal();
 else if(id==='closeOwner')$('ownerDialog').close();
 else if(id==='ownerTab')showOwnerPanel('owner');
 else if(id==='shareTab')showOwnerPanel('share');
 else if(id==='morningTab')renderAdhkar('morning');
 else if(id==='eveningTab')renderAdhkar('evening');
});

const ADHKAR={
 morning:[
  ['آية الكرسي','اقرأ آية الكرسي كاملة من سورة البقرة، الآية 255.','مرة واحدة · القرآن الكريم: البقرة 255.'],
  ['سور الإخلاص والفلق والناس','اقرأ سورة الإخلاص وسورة الفلق وسورة الناس.','ثلاث مرات صباحًا · سنن أبي داود، حديث 5082.'],
  ['أصبحنا وأصبح الملك لله','أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ.','يقال صباحًا · صحيح مسلم، حديث 2723.'],
  ['سيد الاستغفار','اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَٰهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَىٰ عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ بِذَنْبِي، فَاغْفِرْ لِي؛ فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ.','مرة واحدة · صحيح البخاري، حديث 6306.'],
  ['رضيت بالله ربًا','رَضِيتُ بِاللَّهِ رَبًّا، وَبِالْإِسْلَامِ دِينًا، وَبِمُحَمَّدٍ ﷺ نَبِيًّا.','ثلاث مرات · جامع الترمذي، حديث 3389.'],
  ['بسم الله الذي لا يضر','بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ، وَهُوَ السَّمِيعُ الْعَلِيمُ.','ثلاث مرات · سنن أبي داود، حديث 5088، وجامع الترمذي، حديث 3388.']
 ],
 evening:[
  ['آية الكرسي','اقرأ آية الكرسي كاملة من سورة البقرة، الآية 255.','مرة واحدة · القرآن الكريم: البقرة 255.'],
  ['سور الإخلاص والفلق والناس','اقرأ سورة الإخلاص وسورة الفلق وسورة الناس.','ثلاث مرات مساءً · سنن أبي داود، حديث 5082.'],
  ['أمسينا وأمسى الملك لله','أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ.','يقال مساءً · صحيح مسلم، حديث 2723.'],
  ['سيد الاستغفار','اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَٰهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَىٰ عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ بِذَنْبِي، فَاغْفِرْ لِي؛ فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ.','مرة واحدة · صحيح البخاري، حديث 6306.'],
  ['رضيت بالله ربًا','رَضِيتُ بِاللَّهِ رَبًّا، وَبِالْإِسْلَامِ دِينًا، وَبِمُحَمَّدٍ ﷺ نَبِيًّا.','ثلاث مرات · جامع الترمذي، حديث 3389.'],
  ['بسم الله الذي لا يضر','بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ، وَهُوَ السَّمِيعُ الْعَلِيمُ.','ثلاث مرات · سنن أبي داود، حديث 5088، وجامع الترمذي، حديث 3388.']
 ]
};
function renderAdhkar(period){const morning=period==='morning';$('morningTab').classList.toggle('active',morning);$('eveningTab').classList.toggle('active',!morning);$('adhkarContent').innerHTML=ADHKAR[period].map(x=>`<article class="dhikr"><strong>${x[0]}</strong><div>${x[1]}</div><small>${x[2]}</small></article>`).join('')}
window.AnwarRenderAdhkar=function(period){if(period!=='morning'&&period!=='evening')return false;renderAdhkar(period);return true;};
pg.addEventListener('keydown',e=>{
 const cell=e.target.closest('#pg .v span');
 if(!cell||!pg.contains(cell))return;
 const row=cell.closest('.v'),cells=[...row.children],index=cells.indexOf(cell);
 if(e.key==='Tab'){
  e.preventDefault();
  if(index===0)focusVerseCell(cells[1]);
  else{
   const next=row.nextElementSibling?.classList.contains('v')?row.nextElementSibling:null;
   if(next)focusVerseCell(next.children[0]);else insertPoetryVerse(row);
  }
 }else if(e.key==='Enter'&&!e.shiftKey){
  e.preventDefault();
  if(index===0)focusVerseCell(cells[1]);else insertPoetryVerse(row);
 }
});
pg.addEventListener('input',touch);
pg.addEventListener('paste',e=>{e.preventDefault();document.execCommand('insertText',false,e.clipboardData.getData('text/plain'))});
pg.addEventListener('dragover',e=>e.preventDefault());
pg.addEventListener('drop',e=>{e.preventDefault();const text=e.dataTransfer?.getData('text/plain')||'';if(text)document.execCommand('insertText',false,text);touch()});
$('t').addEventListener('input',e=>{if(cur&&!storageRecoveryBlocked){capturePendingBefore();cur.title=e.target.value;cur.ts=Date.now();if(tm)clearTimeout(tm);tm=setTimeout(()=>flushPendingEdit(true),500)}});
$('ty').addEventListener('change',e=>{if(cur&&!storageRecoveryBlocked){flushPendingEdit(false);cur.type=e.target.value;save();renderList();info()}});
let listSearchTimer=0,archiveSearchTimer=0;
$('q').addEventListener('input',()=>{
 clearTimeout(listSearchTimer);
 listSearchTimer=setTimeout(()=>renderList(true),90);
});
$('archiveSearch').addEventListener('input',()=>{
 clearTimeout(archiveSearchTimer);
 archiveSearchTimer=setTimeout(()=>renderArchive(true),120);
});
$('shareUrl').addEventListener('keydown',e=>{if(e.key==='Enter')makeQR()});
$('bookFilePicker').addEventListener('change',e=>{
 const file=e.target.files&&e.target.files[0];
 if(file)handleBookFile(file);
 e.target.value='';
});
$('bookFormat').addEventListener('change',e=>{
 const hints={pdf:'ينشئ ملف PDF للقراءة والطباعة.',docx:'ينشئ مستند Word قابلاً للتحرير.',txt:'يحفظ النص العربي في ملف نصي بسيط.',html:'ينشئ صفحة HTML مستقلة من الأعمال.'};
 $('exportFormatHint').textContent=hints[e.target.value]||'اختر صيغة التصدير المناسبة.';
});
$('fq').addEventListener('input',e=>fontList(e.target.value));
$('sz').addEventListener('change',e=>applySize(+e.target.value));
$('fc').addEventListener('input',e=>cmd('foreColor',e.target.value));
$('hc').addEventListener('input',e=>{restore();document.execCommand('styleWithCSS',false,true);document.execCommand('hiliteColor',false,e.target.value);document.execCommand('styleWithCSS',false,false);touch()});
$('zm').addEventListener('input',e=>{pg.style.zoom=e.target.value/100});
document.addEventListener('keydown',e=>{if(e.key==='Escape')$('app').classList.remove('focus')});
for(const eventName of ['pointerdown','keydown','input','touchstart','wheel']){
 document.addEventListener(eventName,recordVaultActivity,true);
}
document.addEventListener('visibilitychange',()=>{
 if(document.visibilityState==='hidden')flushPendingEdit(false);
 else enforceVaultIdleLock();
});
addEventListener('pagehide',()=>flushPendingEdit(false));
addEventListener('beforeunload',()=>flushPendingEdit(false));
(function(){
 const SU='الفاتحة,البقرة,آل عمران,النساء,المائدة,الأنعام,الأعراف,الأنفال,التوبة,يونس,هود,يوسف,الرعد,إبراهيم,الحجر,النحل,الإسراء,الكهف,مريم,طه,الأنبياء,الحج,المؤمنون,النور,الفرقان,الشعراء,النمل,القصص,العنكبوت,الروم,لقمان,السجدة,الأحزاب,سبأ,فاطر,يس,الصافات,ص,الزمر,غافر,فصلت,الشورى,الزخرف,الدخان,الجاثية,الأحقاف,محمد,الفتح,الحجرات,ق,الذاريات,الطور,النجم,القمر,الرحمن,الواقعة,الحديد,المجادلة,الحشر,الممتحنة,الصف,الجمعة,المنافقون,التغابن,الطلاق,التحريم,الملك,القلم,الحاقة,المعارج,نوح,الجن,المزمل,المدثر,القيامة,الإنسان,المرسلات,النبأ,النازعات,عبس,التكوير,الانفطار,المطففين,الانشقاق,البروج,الطارق,الأعلى,الغاشية,الفجر,البلد,الشمس,الليل,الضحى,الشرح,التين,العلق,القدر,البينة,الزلزلة,العاديات,القارعة,التكاثر,العصر,الهمزة,الفيل,قريش,الماعون,الكوثر,الكافرون,النصر,المسد,الإخلاص,الفلق,الناس'.split(',');
 const R=[['عبد الرحمن بنموسى (ورش عن نافع)','https://media.way2quran.com/abdel-rahman-benmoussa/warsh-an-nafi/'],['مشاري العفاسي','https://server8.mp3quran.net/afs/'],['ماهر المعيقلي','https://server12.mp3quran.net/maher/'],['عبدالرحمن السديس','https://server11.mp3quran.net/sds/'],['سعود الشريم','https://server7.mp3quran.net/shur/'],['عبدالباسط عبدالصمد','https://server7.mp3quran.net/basit/'],['سعد الغامدي','https://server7.mp3quran.net/s_gmd/'],['أحمد العجمي','https://server10.mp3quran.net/ajm/'],['ياسر الدوسري','https://server11.mp3quran.net/yasser/'],['أبو بكر الشاطري','https://server11.mp3quran.net/shatri/'],['محمد صديق المنشاوي','https://server10.mp3quran.net/minsh/'],['إبراهيم الأخضر','https://server6.mp3quran.net/akdr/'],['محمد أيوب','https://server8.mp3quran.net/ayyub/']];
 const X='أكرم العلاقمي|9/akrm;محمد الطبلاوي|12/tblawi;محمد اللحيدان|8/lhdan;محمد صالح عالم شاه|12/shah;محمد جبريل|8/jbrl;محمد عبدالكريم|12/m_krm;محمود خليل الحصري|13/husr;الحصري (المصحف المجود)|13/husr/Almusshaf-Al-Mojawwad;الحصري (ورش)|13/husr/Rewayat-Warsh-A-n-Nafi;الحصري (قالون)|13/husr/Rewayat-Qalon-A-n-Nafi;محمود علي البنا|8/bna;محمود علي البنا (المصحف المجود)|8/bna/Almusshaf-Al-Mojawwad;مصطفى إسماعيل|8/mustafa;مصطفى إسماعيل (المصحف المجود)|8/mustafa/Almusshaf-Al-Mojawwad;مصطفى اللاهوني|6/lahoni;مصطفى رعد العزاوي|8/ra3ad;الزين محمد أحمد|9/alzain;ماجد الزامل|9/zaml;ماهر شخاشيرو|10/shaksh;ياسر سلامة|12/salamah/Rewayat-Hafs-A-n-Assem;خالد المهنا|11/mohna;عادل الكلباني|8/a_klb;موسى بلال|11/bilal;حاتم فريد الواعر|11/hatem;إبراهيم الجرمي|11/jormy;محمود الرفاعي|11/mrifai;توفيق الصايغ|6/twfeeq;إبراهيم الدوسري|10/ibrahim_dosri/Rewayat-Hafs-A-n-Assem;إبراهيم الدوسري (ورش)|10/ibrahim_dosri/Rewayat-Warsh-A-n-Nafi;جمال شاكر عبدالله|6/jamal;جمعان العصيمي|6/jaman;يوسف بن نوح أحمد|8/noah;معيض الحارثي|8/harthi;محمد رشاد الشريف|10/rashad;خالد الجليل|10/jleel;أحمد الطرابلسي|10/trabulsi;أحمد الطرابلسي (قالون)|10/trablsi;عبدالله الكندري|10/Abdullahk;أحمد عامر|10/Aamer;محمد عثمان خان|6/khan;وديع اليمني|6/wdee3;بندر بليله|6/balilah;خالد القحطاني|10/qht;خالد عبدالكافي|11/kafi;رامي الدعيس|6/rami;عبدالرحمن العوسي|6/aloosi;عبدالرحمن الماجد|10/a_majed;خليفة الطنيجي|12/tnjy;عبدالله الخلف|14/khalf;منصور السالمي|14/mansor;ناصر الماجد|14/nasser_almajed;أحمد السويلم|14/swlim/Rewayat-Hafs-A-n-Assem;بدر التركي|10/bader/Rewayat-Hafs-A-n-Assem;أحمد خليل شاهين|16/shaheen/Rewayat-Hafs-A-n-Assem;سعد المقرن|16/saad/Rewayat-Hafs-A-n-Assem;أحمد النفيس|16/nufais/Rewayat-Hafs-A-n-Assem;عبدالله كامل|16/kamel/Rewayat-Hafs-A-n-Assem;بيشه وا قادر الكردي|16/peshawa/Rewayat-Hafs-A-n-Assem;نذير المالكي|16/nathier/Rewayat-Hafs-A-n-Assem;عبدالإله بن عون|16/a_binaoun/Rewayat-Hafs-A-n-Assem;محمد برهجي|16/M_Burhaji/Rewayat-Hafs-A-n-Assem;هيثم الدخين|16/h_dukhain/Rewayat-Hafs-A-n-Assem;مفتاح السلطني|14/muftah_sultany/Rewayat-Hafs-A-n-Assem;أحمد ديبان|16/deban/Rewayat-Hafs-A-n-Assem;أحمد ديبان (قالون)|16/deban/Rewayat-Qalon-A-n-Nafi;أحمد ديبان (ورش)|16/deban/Rewayat-Warsh-A-n-Nafi-Men-Tariq-Alazraq;أحمد ديبان (الدوري عن أبي عمرو)|16/deban/Rewayat-Aldori-A-n-Abi-Amr;أحمد ديبان (البزي)|16/deban/Rewayat-Albizi-A-n-Ibn-Katheer;أحمد ديبان (قنبل)|16/deban/Rewayat-Qunbol-A-n-Ibn-Katheer;أحمد ديبان (شعبة)|16/deban/Rewayat-Sho-bah-A-n-Asim;القارئ ياسين (ورش)|11/qari;العيون الكوشي (ورش)|11/koshi;محمد سايد (ورش)|16/m_sayed/Rewayat-Warsh-A-n-Nafi;رشيد بلعالية (ورش)|6/bl3/Rewayat-Warsh-A-n-Nafi;مروان العكري (قالون)|16/m_akri/Rewayat-Qalon-A-n-Nafi;الدوكالي محمد العالم (قالون)|7/dokali;طارق عبدالغني دعوب (قالون)|10/tareq;محمود الشيمي (الدوري عن الكسائي)|10/sheimy;الفاتح محمد الزبير (الدوري عن أبي عمرو)|6/fateh;نورين محمد صديق (الدوري عن أبي عمرو)|16/nourin_siddig/Rewayat-Aldori-A-n-Abi-Amr;محمد عبدالحكيم العبدالله (الدوري عن الكسائي)|9/abdullah/Rewayat-AlDorai-A-n-Al-Kisa-ai;عكاشة كميني (البزي)|16/okasha/Rewayat-Albizi-A-n-Ibn-Katheer;المنشاوي (المصحف المجود)|10/minsh/Almusshaf-Al-Mojawwad;ماهر المعيقلي (المصحف المجود)|12/maher/Almusshaf-Al-Mojawwad'.split(';').map(s=>{const[a,p]=s.split('|'),[v,...r]=p.split('/');return[a,`https://server${v}.mp3quran.net/${r.join('/')}/`]}).sort((a,b)=>a[0].localeCompare(b[0],'ar'));
 X.forEach(x=>{if(!R.some(r=>r[0]===x[0]))R.push(x)});
 const rr=$('rr'),rsu=$('rsu'),st=$('rst'),pp=$('rpp'),rb=$('rb'),au=new Audio();let n=1,started=false,wd,cr=0,sl,playRequestId=0;

 const stationSelect=$('rl'),stationPicker=$('liveStationPicker'),stationPickerChoice=$('liveStationChoice');
 const stationModal=$('liveStationModal');
 stationModal.className='live-station-modal';stationModal.hidden=true;
 stationModal.setAttribute('role','dialog');stationModal.setAttribute('aria-modal','true');stationModal.setAttribute('aria-label','محطات البث المباشر');
 const stationDialog=document.createElement('div');stationDialog.className='live-station-dialog';
 const stationHeader=document.createElement('header');stationHeader.className='live-station-modal-head';
 const stationHeaderCopy=document.createElement('div');
 const stationModalTitle=document.createElement('strong');stationModalTitle.textContent='محطات البث المباشر';
 const stationModalSub=document.createElement('small');stationModalSub.textContent='اختر المحطة التي ترغب في الاستماع إليها';
 stationHeaderCopy.append(stationModalTitle,stationModalSub);
 const stationClose=document.createElement('button');stationClose.type='button';stationClose.className='live-station-modal-close';stationClose.setAttribute('aria-label','إغلاق قائمة المحطات');stationClose.textContent='×';
 stationHeader.append(stationHeaderCopy,stationClose);
 const stationTools=document.createElement('div');stationTools.className='live-station-modal-tools';
 const stationSearch=document.createElement('input');stationSearch.type='search';stationSearch.placeholder='ابحث عن محطة…';stationSearch.setAttribute('aria-label','ابحث عن محطة بث');
 const stationCount=document.createElement('span');stationCount.className='live-station-modal-count';stationTools.append(stationSearch,stationCount);
 const stationHint=document.createElement('small');stationHint.className='live-station-modal-hint';stationHint.textContent='تظهر المحطات في بطاقات مستقلة؛ اختر بطاقة لتعيين المحطة.';
 const stationList=document.createElement('div');stationList.className='live-station-options';stationList.setAttribute('role','listbox');stationList.setAttribute('aria-label','محطات البث المتاحة');
 stationDialog.append(stationHeader,stationTools,stationHint,stationList);stationModal.replaceChildren(stationDialog);
 let stationPreviousOverflow='';
 function renderLiveStationOptions(){
  const query=String(stationSearch.value||'').trim().toLocaleLowerCase('ar');
  const options=Array.from(stationSelect.options).map((option,index)=>({option,index}))
   .filter(item=>item.option.value&&(!query||String(item.option.textContent||'').toLocaleLowerCase('ar').includes(query)));
  stationCount.textContent=new Intl.NumberFormat('ar').format(options.length)+' محطة';
  if(!options.length){
   const empty=document.createElement('div');empty.className='live-station-options-empty';
   empty.textContent=query?'لا توجد محطة بهذا الاسم.':'جارٍ تجهيز قائمة المحطات…';
   stationList.replaceChildren(empty);return;
  }
  const fragment=document.createDocumentFragment();
  options.forEach(({option,index})=>{
   const item=document.createElement('button');item.type='button';
   item.className='reciter-card live-station-option';item.dataset.stationIndex=String(index);
   item.setAttribute('role','option');item.setAttribute('aria-selected',String(index===stationSelect.selectedIndex));
   const seal=document.createElement('span');seal.className='reciter-seal';seal.setAttribute('aria-hidden','true');
   const flower=document.createElement('img');flower.src='assets/tulip-cutout.svg';flower.alt='';flower.loading='lazy';flower.decoding='async';seal.append(flower);
   const name=document.createElement('span');name.className='reciter-name';name.textContent=String(option.textContent||'إذاعة القرآن');
   const mark=document.createElement('span');mark.className='live-station-option-mark';mark.setAttribute('aria-hidden','true');mark.textContent=index===stationSelect.selectedIndex?'✓':'○';
   item.append(seal,name,mark);fragment.append(item);
  });
  stationList.replaceChildren(fragment);
 }
 function syncLiveStationPicker(){
  const selected=stationSelect.selectedOptions&&stationSelect.selectedOptions[0];
  if(stationPickerChoice)stationPickerChoice.textContent=selected&&selected.value?selected.textContent:'اختر محطة البث';
  if(!stationModal.hidden)renderLiveStationOptions();
 }
 function openLiveStationPicker(){
  renderLiveStationOptions();stationModal.hidden=false;
  stationPicker.setAttribute('aria-expanded','true');
  stationPreviousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
  stationSearch.focus();
 }
 function closeLiveStationPicker(){
  if(stationModal.hidden)return;
  stationModal.hidden=true;stationPicker.setAttribute('aria-expanded','false');
  document.body.style.overflow=stationPreviousOverflow;stationPicker.focus();
 }
 stationPicker.addEventListener('click',openLiveStationPicker);
 stationClose.addEventListener('click',closeLiveStationPicker);
 stationSearch.addEventListener('input',renderLiveStationOptions);
 stationModal.addEventListener('click',event=>{if(event.target===stationModal)closeLiveStationPicker()});
 stationList.addEventListener('click',event=>{
  const item=event.target.closest('[data-station-index]');if(!item)return;
  const index=Number(item.dataset.stationIndex);
  if(!Number.isInteger(index)||index<0||index>=stationSelect.options.length)return;
  stationSelect.selectedIndex=index;
  stationSelect.dispatchEvent(new Event('change',{bubbles:true}));
  closeLiveStationPicker();
 });
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!stationModal.hidden)closeLiveStationPicker()});
 syncLiveStationPicker();

 au.preload='metadata';au.volume=.8;$('ro').hidden=true;window.__anwarRadioAudio=au;
 // Keep the radio's requested volume separate from temporary ducking.
 let radioBaseVolume=au.volume,radioShouldPlay=false,radioResumePending=false,radioLastResumeAttempt=0;
 function syncRadioDucking(){
  const anotherAudioIsPlaying=Array.from(document.querySelectorAll('audio,video')).some(element=>
   element!==au&&!element.paused&&!element.ended&&!element.muted&&element.volume>0&&element.readyState>=2
  );
  const nextVolume=radioBaseVolume*(anotherAudioIsPlaying?0.28:1);
  if(Math.abs(au.volume-nextVolume)>.005)au.volume=nextVolume;
 }
 function resumeRadioAfterReturn(){
  if(!radioShouldPlay||!au.src||au.ended||!au.paused||radioResumePending)return;
  const now=Date.now();
  if(now-radioLastResumeAttempt<1200)return;
  radioLastResumeAttempt=now;radioResumePending=true;
  let attempt;
  try{attempt=au.play()}catch(error){
   radioResumePending=false;
   st.textContent='توقفت الإذاعة مؤقتًا؛ اضغط زر التشغيل لاستئنافها.';
   ui();return;
  }
  if(attempt&&typeof attempt.then==='function'){
   attempt.then(()=>{
    radioResumePending=false;syncRadioDucking();ui();
   }).catch(error=>{
    radioResumePending=false;
    if(error?.name==='NotAllowedError')st.textContent='اضغط زر التشغيل لاستئناف الإذاعة بعد المقاطعة.';
    else st.textContent='تعذّر استئناف الإذاعة تلقائيًا؛ اضغط زر التشغيل للمحاولة مجددًا.';
    ui();
   });
  }else{radioResumePending=false;syncRadioDucking();ui()}
 }
 // Capture media events from in-app audio players without pausing the radio.
 ['play','playing','pause','ended','emptied'].forEach(type=>
  document.addEventListener(type,syncRadioDucking,true)
 );
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)resumeRadioAfterReturn()});
 window.addEventListener('focus',resumeRadioAfterReturn);
 window.addEventListener('pageshow',resumeRadioAfterReturn);
 rr.replaceChildren(...R.map((r,i)=>{
  const option=document.createElement('option');
  option.value=String(i);
  option.textContent=String(r[0]??'');
  return option;
 }));
 rsu.replaceChildren(...SU.map((s,i)=>{
  const option=document.createElement('option');
  option.value=String(i+1);
  option.textContent=(i+1)+'. '+String(s??'');
  return option;
 }));
 const surahPicker=$('surahPicker');
 surahPicker.replaceChildren(...Array.from(rsu.options,option=>option.cloneNode(true)));
 surahPicker.value=String(n);
 const surahPickerButton=$('surahPickerButton'),surahPickerCurrent=$('surahPickerCurrent');
 const surahPickerModal=$('surahPickerModal'),surahPickerList=$('surahPickerList'),surahPickerSearch=$('surahPickerSearch');
 function syncSurahPickerLabel(){
  const selected=surahPicker.selectedOptions&&surahPicker.selectedOptions[0];
  if(surahPickerCurrent&&selected)surahPickerCurrent.textContent=selected.textContent;
  if(surahPickerList){
   surahPickerList.querySelectorAll('[data-surah-option]').forEach(button=>{
    const active=Number(button.dataset.surahOption)===Number(surahPicker.value);
    button.setAttribute('aria-selected',String(active));
   });
  }
 }
 function renderSurahPickerOptions(query){
  const q=String(query||'').trim().toLocaleLowerCase('ar');
  const options=Array.from(surahPicker.options).filter(option=>!q||option.textContent.toLocaleLowerCase('ar').includes(q)||String(option.value).includes(q));
  const fragment=document.createDocumentFragment();
  if(options.length){
   options.forEach(option=>{
    const number=Number(option.value),active=number===Number(surahPicker.value);
    const name=String(option.textContent||'').replace(/^\s*\d+\s*[.．-]?\s*/,'');
    const button=document.createElement('button');
    button.type='button';
    button.className='surah-picker-option';
    button.setAttribute('role','option');
    button.dataset.surahOption=String(number);
    button.setAttribute('aria-selected',String(active));
    const seal=document.createElement('span');
    seal.className='surah-picker-option-tulip';
    seal.setAttribute('aria-hidden','true');
    const image=document.createElement('img');
    image.src='assets/tulip-cutout.svg';
    image.alt='';
    image.loading='lazy';
    image.decoding='async';
    seal.append(image);
    const copy=document.createElement('span');
    copy.className='surah-picker-option-copy';
    const numberLabel=document.createElement('span');
    numberLabel.className='surah-picker-option-number';
    numberLabel.textContent=number+'.';
    const nameLabel=document.createElement('span');
    nameLabel.className='surah-picker-option-name';
    nameLabel.textContent=name;
    copy.append(numberLabel,nameLabel);
    button.append(seal,copy);
    fragment.append(button);
   });
  }else{
   const empty=document.createElement('div');
   empty.className='surah-picker-empty';
   empty.textContent='لا توجد سورة بهذا الاسم.';
   fragment.append(empty);
  }
  surahPickerList.replaceChildren(fragment);
 }
 function closeSurahPicker(){
  if(!surahPickerModal||surahPickerModal.hidden)return;
  surahPickerModal.hidden=true;
  if(surahPickerButton)surahPickerButton.setAttribute('aria-expanded','false');
  if(surahPickerButton)surahPickerButton.focus();
 }
 if(surahPickerButton)surahPickerButton.addEventListener('click',()=>{
  renderSurahPickerOptions('');
  surahPickerSearch.value='';
  surahPickerModal.hidden=false;
  surahPickerButton.setAttribute('aria-expanded','true');
  surahPickerSearch.focus();
 });
 if(surahPickerList)surahPickerList.addEventListener('click',event=>{
  const option=event.target.closest('[data-surah-option]');if(!option)return;
  surahPicker.value=String(option.dataset.surahOption);
  surahPicker.dispatchEvent(new Event('change',{bubbles:true}));
  closeSurahPicker();
 });
 if(surahPickerSearch)surahPickerSearch.addEventListener('input',()=>renderSurahPickerOptions(surahPickerSearch.value));
 if(surahPickerModal)surahPickerModal.addEventListener('click',event=>{if(event.target===surahPickerModal)closeSurahPicker()});
 $('surahPickerClose').addEventListener('click',closeSurahPicker);
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&surahPickerModal&&!surahPickerModal.hidden)closeSurahPicker()});
 surahPicker.addEventListener('change',syncSurahPickerLabel);
 syncSurahPickerLabel();
 const mode=()=>document.querySelector('input[name=rm]:checked').value;
 const readerAdvanceSelect=$('readerAdvanceMode');
 let readerAdvancePreference=globalThis.AnwarPrivatePreferences.get().readerAdvance,activePlaybackKind='radio';
 if(readerAdvanceSelect)readerAdvanceSelect.value=readerAdvancePreference;
 function selectPlaybackMode(value){const control=document.querySelector('input[name="rm"][value="'+(value==='s'?'s':'c')+'"]');if(control)control.checked=true;}
 globalThis.AnwarPrivatePreferences.subscribe(preferences=>{
  readerAdvancePreference=preferences.readerAdvance==='s'?'s':'c';
  if(readerAdvanceSelect)readerAdvanceSelect.value=readerAdvancePreference;
  if(activePlaybackKind==='reader'){
   selectPlaybackMode(readerAdvancePreference);
   st.textContent=readerAdvancePreference==='c'?'سيواصل هذا القارئ تلقائيًا إلى السورة التالية.':'وضع الاختيار اليدوي: ستتوقف التلاوة عند نهاية السورة.';
  }
 });
 if(readerAdvanceSelect)readerAdvanceSelect.addEventListener('change',()=>{
  readerAdvancePreference=readerAdvanceSelect.value==='s'?'s':'c';
  globalThis.AnwarPrivatePreferences.set('readerAdvance',readerAdvancePreference);
  // The visitor's preference applies to reciter-list playback, never to the radio broadcast.
  if(activePlaybackKind==='reader'){
   selectPlaybackMode(readerAdvancePreference);
   st.textContent=readerAdvancePreference==='c'
    ?'سيواصل هذا القارئ تلقائيًا إلى السورة التالية.'
    :'وضع الاختيار اليدوي: ستتوقف التلاوة عند نهاية السورة.';
  }
 });
 function ui(){
  const on=started&&!au.paused,live=mode()==='l';
  const selectedStation=$('rl').selectedOptions[0];
  const stationName=selectedStation?selectedStation.textContent:'إذاعة مباشرة';
  syncLiveStationPicker();
  const liveButton=$('liveRadioPlay'),liveStatus=$('liveRadioStatus');
  pp.textContent=on?'⏸':'▶';rb.textContent=on?'⏸':'▶';rb.classList.toggle('on',on);
  $('radioNow').textContent=on?(live?stationName:'القارئ: '+R[cr][0]):'إذاعة أنوار القرآنية';
  $('radioSub').textContent=on?(live?'بث إذاعي مباشر · استمع الآن':'سورة '+SU[n-1]+' · تلاوة متتابعة'):'اختر قارئك أو افتح البث المباشر';
  $('radioLiveDot').classList.toggle('playing',on);
  document.querySelector('.radio-hero').classList.toggle('playing',on);
  $('reciterGrid').querySelectorAll('[data-reciter-play]').forEach(b=>{
   const active=on&&!live&&+b.dataset.reciterPlay===cr,label=b.dataset.playLabel||'';
   b.dataset.playing=String(active);
   b.textContent=b.classList.contains('reciter-version')?label:(active?'Ⅱ':'▶');
  });
  if(liveButton){
   liveButton.setAttribute('aria-pressed',String(on&&live));
   liveButton.textContent=on&&live?'إيقاف البث مؤقتًا':(started&&live&&au.paused?'متابعة البث　▶':'تشغيل المحطة المختارة　▶');
  }
  if(liveStatus){
   liveStatus.textContent=on&&live?'يُبث الآن داخل المفكرة: '+stationName:
    (started&&live&&au.paused?'البث متوقف مؤقتًا. يمكنك متابعة الاستماع.':
     (stationName==='إذاعة مباشرة'?'اختر محطة للاستماع إليها داخل المفكرة.':'المحطة المختارة: '+stationName));
  }
  if(on)st.textContent=live?'بث مباشر: '+stationName:'يُتلى الآن: سورة '+SU[n-1]+' — '+R[cr][0];
 }
 function availableSurahs(){const a=R[cr]&&Array.isArray(R[cr][2])?R[cr][2]:null;return a&&a.length?a:Array.from({length:114},(_,i)=>i+1)}
 function moveSurah(step){const a=availableSurahs(),i=a.indexOf(n),next=i<0?0:(i+step+a.length)%a.length;n=a[next];rsu.value=String(n);play()}
 function play(){
  const requestId=++playRequestId;
  radioShouldPlay=true;
  started=true;
  const available=availableSurahs();
  if(!available.includes(n))n=available[0]||1;
  const station=mode()==='l';
  const rawBase=R[cr]&&safeHttpsURL(R[cr][1]);
  const base=rawBase?rawBase.replace(/\/?$/,'/'):'';
  // جميع خوادم المصاحف، بما فيها Way2Quran، تستخدم ترقيم السور بثلاث خانات: 001.mp3 … 114.mp3.
  const fileName=String(n).padStart(3,'0')+'.mp3';
  const u=station?safeHttpsURL($('rl').value):(base?base+fileName:'');
  if(!u){
   radioShouldPlay=false;started=false;st.textContent='لا يتوفر رابط صوت صالح لهذا الاختيار.';ui();return;
  }
  // ابدأ التشغيل من البيانات التي جُهّزت مسبقًا إن كان المصدر هو نفسه، ولا تُعد تحميله من الصفر.
  au.preload='auto';
  if(au.src!==u){
   au.pause();au.src=u;au.load();
  }else if(au.error){
   au.load();
  }else if(au.ended){
   try{au.currentTime=0}catch(_e){}
  }
  $('ro').href=u;$('ro').hidden=true;
  rsu.value=String(n);surahPicker.value=String(n);syncSurahPickerLabel();st.textContent='جارٍ تشغيل سورة '+SU[n-1]+' داخل أنوار…';
  clearTimeout(wd);
  wd=setTimeout(()=>{
   if(requestId!==playRequestId)return;
   if(au.paused||au.readyState<2)st.textContent='تأخر وصول الصوت من الخادم؛ يمكنك إعادة المحاولة أو اختيار قارئ آخر.';
  },10000);
  const attempt=au.play();
  if(attempt&&typeof attempt.catch==='function')attempt.catch(error=>{
   if(requestId!==playRequestId||error?.name==='AbortError')return;
   if(error&&error.name==='NotAllowedError')st.textContent='اضغط زر التشغيل مرة أخرى للسماح بالتلاوة داخل أنوار.';
   else st.textContent='تعذّر بدء الصوت. تحقّق من الاتصال ثم أعد المحاولة أو اختر قارئًا آخر.';
  });
  ui();
 }
 function toggle(){
  if(started&&au.src){
   if(au.paused){
    radioShouldPlay=true;
    const requestId=++playRequestId;
    st.textContent='جارٍ استئناف التلاوة…';
    const attempt=au.play();
    if(attempt&&typeof attempt.catch==='function')attempt.catch(error=>{
     if(requestId!==playRequestId||error?.name==='AbortError')return;
     st.textContent=error?.name==='NotAllowedError'
      ?'اضغط زر التشغيل مرة أخرى للسماح باستئناف التلاوة.'
      :'تعذّر استئناف الصوت؛ تحقّق من الاتصال ثم أعد المحاولة.';
     ui();
    });
   }else{
    radioShouldPlay=false;
    ++playRequestId;clearTimeout(wd);au.pause();st.textContent='متوقف مؤقتًا';
   }
  }else{
   cr=+rr.value||0;
   // زر الإذاعة في الصفحة الرئيسة يظل متواصلاً مهما كان اختيار الزائر لقوائم القراء.
   activePlaybackKind='radio';
   selectPlaybackMode('c');
   play();
  }
  ui();
 }
 au.addEventListener('playing',()=>{clearTimeout(wd);syncRadioDucking();ui()});
 au.addEventListener('waiting',()=>{if(started&&!au.paused)st.textContent='جارٍ تحميل التلاوة…'});
 au.addEventListener('stalled',()=>{if(started&&!au.paused)st.textContent='الاتصال بخادم الصوت بطيء؛ جارٍ انتظار التلاوة…'});
 au.addEventListener('pause',ui);
 au.addEventListener('ended',()=>{
  if(mode()==='l'){
   // إذا انتهى اتصال البث المباشر، أعد محاولة الاتصال بالمحطة نفسها.
   play();
  }else if(activePlaybackKind==='radio'||mode()==='c'){
   // الإذاعة لا تتوقف عند نهاية السورة؛ تنتقل دائمًا إلى التالية ثم تعود للأولى.
   moveSurah(1);
  }else{
   // في قوائم القراء، يحترم الوضع اليدوي اختيار الزائر ويتوقف عند نهاية السورة.
   started=false;radioShouldPlay=false;ui();st.textContent='انتهت السورة؛ اختر سورة أخرى ثم اضغط تشغيل القارئ للمتابعة.';
  }
 });
 au.addEventListener('error',()=>{
  if(!au.src)return;
  ++playRequestId;clearTimeout(wd);started=false;radioShouldPlay=false;ui();
  st.textContent='تعذّر تحميل ملف الصوت داخل المشغّل. لم يتم فتح أي موقع خارجي؛ جرّب قارئًا آخر أو أعد المحاولة.';
  $('ro').hidden=false;$('ro').textContent='↗ فتح رابط الملف الأصلي (اختياري)';
  toast('تعذّر تحميل التلاوة',3000);
 });
 
 function readerIdentity(name){
  let base=String(name||'قارئ').split(' — ')[0].trim();
  const m=base.match(/[（(]([^()（）]+)[)）]$/);
  if(m&&/(ورش|قالون|حفص|الدوري|شعبة|البزي|قنبل|المجود|المرتل|المعلم|رواية)/.test(m[1]))base=base.slice(0,m.index).trim();
  return base||String(name||'قارئ');
 }
 function readerKey(name){
  return readerIdentity(name).normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g,'')
   .replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ؤ/g,'و').replace(/ئ/g,'ي').replace(/[\u200e\u200f]/g,'')
   .replace(/[\sـ،؛:,.()[\]{}'"]/g,'').toLowerCase();
 }
 function readerVariantLabel(name,index,total){
  const s=String(name||''),dash=s.split(' — ');
  if(dash.length>1)return dash.slice(1).join(' — ').trim();
  const m=s.match(/[（(]([^()（）]+)[)）]$/);
  if(m&&/(ورش|قالون|حفص|الدوري|شعبة|البزي|قنبل|المجود|المرتل|المعلم|رواية)/.test(m[1]))return m[1].trim();
  return total>1?'تسجيل '+(index+1):'استمع';
 }
 let reciterGroupsCache=null;
 function groupedReciters(){
  if(reciterGroupsCache)return reciterGroupsCache;
  const groups=new Map();
  R.forEach((r,i)=>{
   const name=readerIdentity(r[0]),key=readerKey(name);
   if(!groups.has(key))groups.set(key,{name,variants:[],seen:new Map()});
   const group=groups.get(key),url=String(r[1]||'').replace(/\/+$/,'').toLowerCase();
   const variantKey=url;
   if(group.seen.has(variantKey)){
    const previous=group.seen.get(variantKey),oldSurahs=R[previous.index][2],newSurahs=r[2];
    const merged=[...new Set([
     ...(Array.isArray(oldSurahs)?oldSurahs:[]),
     ...(Array.isArray(newSurahs)?newSurahs:[])
    ].map(Number).filter(number=>Number.isInteger(number)&&number>=1&&number<=114))].sort((a,b)=>a-b);
    if(merged.length)R[previous.index][2]=merged;
    return;
   }
   const variant={index:i,label:readerVariantLabel(r[0],group.variants.length,1)};
   group.seen.set(variantKey,variant);group.variants.push(variant);
  });
  for(const g of groups.values()){
   if(g.variants.length>1)g.variants.forEach((v,i)=>{if(v.label==='استمع')v.label='تسجيل '+(i+1)});
  }
  reciterGroupsCache=[...groups.values()].sort((a,b)=>a.name.localeCompare(b.name,'ar'));
  return reciterGroupsCache;
 }
 function uniqueRecitationCount(){return groupedReciters().reduce((sum,g)=>sum+g.variants.length,0)}
 let reciterDisplayLimit=36,reciterUiReady=false;
 function fill(){
  const selected=+rr.value||0,q=($('rq').value||'').trim().toLocaleLowerCase('ar'),all=groupedReciters();
  rr.innerHTML=R.map((r,i)=>'<option value="'+i+'">'+esc(r[0])+'</option>').join('');
  rr.value=String(Math.min(selected,Math.max(0,R.length-1)));
  const surah=+rsu.value||1;rsu.innerHTML=SU.map((x,i)=>'<option value="'+(i+1)+'">'+(i+1)+'. '+esc(x)+'</option>').join('');rsu.value=String(surah);
  const L=all.filter(g=>!q||g.name.toLocaleLowerCase('ar').includes(q)||g.variants.some(v=>String(R[v.index][0]).toLocaleLowerCase('ar').includes(q)));
  const shown=L.slice(0,reciterDisplayLimit);
  $('reciterGrid').innerHTML=shown.length?shown.map(g=>'<div class="reciter-card" role="listitem"><span class="reciter-seal"><img src="assets/tulip-cutout.svg" alt="زهرة توليب" loading="lazy" decoding="async"></span><div class="reciter-body"><span class="reciter-name">'+esc(g.name)+'</span>'+(g.variants.length>1?'<details class="reciter-variants-menu"><summary aria-label="عرض الروايات والتسجيلات" title="الروايات والتسجيلات"></summary><div class="reciter-variants">'+g.variants.map(v=>'<button type="button" class="reciter-version" data-reciter-play="'+v.index+'" data-play-label="'+esc(v.label)+'" aria-label="تشغيل '+esc(g.name)+' — '+esc(v.label)+'">'+esc(v.label)+'</button>').join('')+'</div></details>':'')+'</div><button type="button" class="reciter-play" data-reciter-play="'+g.variants[0].index+'" aria-label="تشغيل '+esc(g.name)+'">▶</button></div>').join(''):'<div class="reciter-empty">لا توجد نتائج بهذا الاسم.</div>';
  const count=$('reciterCount');if(count)count.textContent='القرّاء '+new Intl.NumberFormat('ar').format(L.length)+' من '+new Intl.NumberFormat('ar').format(all.length);
  const more=$('reciterMore');
  if(more){more.hidden=L.length<=shown.length;more.textContent='عرض المزيد من القرّاء · '+new Intl.NumberFormat('ar').format(Math.max(0,L.length-shown.length))+' متبقٍ';}
  ui();
 }
 function anwarApiGatewayBase(){
  return trustedAnwarGatewayBase();
 }
 function anwarApiGatewayUrl(source){
  const base=anwarApiGatewayBase();if(!base)return source;
  try{
   const url=new URL(source);
   if(url.origin!=='https://www.mp3quran.net'||url.searchParams.size!==1||url.searchParams.get('language')!=='ar')return source;
   if(url.pathname==='/api/v3/reciters')return new URL('/v1/reciters',base).href;
   if(url.pathname==='/api/v3/radios')return new URL('/v1/radios',base).href;
  }catch(_e){}
  return source;
 }
 const anwarApiFailureUntil=new Map();
 async function J(u){
  const target=anwarApiGatewayUrl(u),now=Date.now(),retryAt=anwarApiFailureUntil.get(target)||0;
  if(retryAt>now)throw new Error('أُجّل طلب البيانات قليلًا لتخفيف الضغط؛ أعد المحاولة بعد انتهاء المهلة.');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6500);
  try{
   const response=await fetch(target,{signal:controller.signal,cache:'force-cache',credentials:'omit',referrerPolicy:'no-referrer'});
   if(!response.ok){
    const retry=Math.max(1,Math.min(60,Number(response.headers.get('Retry-After'))||15));
    anwarApiFailureUntil.set(target,Date.now()+retry*1000);
    throw new Error('HTTP '+response.status);
   }
   return await response.json();
  }catch(error){
   if(!anwarApiFailureUntil.has(target)||anwarApiFailureUntil.get(target)<=Date.now()){
    anwarApiFailureUntil.set(target,Date.now()+10000);
   }
   throw error;
  }finally{clearTimeout(timer)}
 }
 let reciterApiPromise=null,radioApiPromise=null;
 function ensureReciterCatalog(){
  if(reciterApiPromise)return reciterApiPromise;
  const B='https://www.mp3quran.net/api/v3/';
  reciterApiPromise=J(B+'reciters?language=ar').then(data=>{
   const currentReciter=R[cr]?{name:R[cr][0],server:R[cr][1]}:null;
   const reciters=Array.isArray(data.reciters)?data.reciters:[];let added=0;
   reciters.forEach(reciter=>{
    (reciter.moshaf||[]).forEach(moshaf=>{
     const server=safeHttpsURL(moshaf.server);if(!server)return;
     let surahs=[];
     if(typeof moshaf.surah_list==='string'&&moshaf.surah_list.trim()){
      surahs=[...new Set(moshaf.surah_list.split(',').map(value=>Number.parseInt(value.trim(),10)).filter(value=>Number.isInteger(value)&&value>=1&&value<=114))];
     }else if(Number.isFinite(+moshaf.surah_total)&&+moshaf.surah_total>0){
      surahs=Array.from({length:Math.min(114,+moshaf.surah_total)},(_,i)=>i+1);
     }
     if(!surahs.length)return;
     const base=String(reciter.name||'قارئ').trim().slice(0,90);
     const rewaya=String(moshaf.name||'رواية متاحة').trim().slice(0,70);
     const label=base+' — '+rewaya,url=server.replace(/\/?$/,'/');
     if(!R.some(item=>item[0]===label&&item[1]===url)){R.push([label,url,surahs]);added++}
    });
   });
   R.sort((a,b)=>a[0].localeCompare(b[0],'ar'));
   reciterGroupsCache=null;
   if(currentReciter){
    const currentIndex=R.findIndex(item=>item[0]===currentReciter.name&&item[1]===currentReciter.server);
    if(currentIndex>=0){cr=currentIndex;rr.value=String(currentIndex)}
   }
   fill();
   $('src').textContent='تم تحديث قائمة القرّاء من MP3Quran: '+reciters.length+' قارئًا و'+uniqueRecitationCount()+' خيار تلاوة.';
   return reciters.length;
  }).catch(error=>{
   reciterApiPromise=null;
   $('src').textContent='القائمة الأساسية تعمل؛ تعذّر تحديثها من MP3Quran الآن.';
   return 0;
  });
  return reciterApiPromise;
 }
 function ensureRadioCatalog(){
  const select=$('rl');
  if(select.value)return Promise.resolve(select.options.length);
  if(radioApiPromise)return radioApiPromise;
  const button=$('liveRadioPlay'),status=$('liveRadioStatus');
  if(button){
   button.disabled=true;
   button.setAttribute('aria-busy','true');
   button.textContent='جارٍ تحميل محطات البث…';
  }
  if(status)status.textContent='جارٍ جلب قائمة المحطات المتاحة…';
  radioApiPromise=J('https://www.mp3quran.net/api/v3/radios?language=ar').then(data=>{
   const radios=Array.isArray(data.radios)?data.radios:[];
   const stations=[],seen=new Set();
   radios.forEach(item=>{
    const url=safeHttpsURL(item&&item.url);
    if(!url||seen.has(url))return;
    seen.add(url);
    stations.push({name:String(item&&item.name||'إذاعة القرآن').trim().slice(0,100)||'إذاعة القرآن',url});
   });
   // محطة زين بلادي القرآنية: رابط صوت مباشر HTTPS بصيغة AAC (96 kbps).
   // تبقى متاحة حتى عند تعذر فهرس MP3Quran الخارجي.
   const zineBladiUrl=safeHttpsURL('https://asmaki.ma:8000/radio.mp3');
   if(zineBladiUrl){
    const duplicateIndex=stations.findIndex(station=>station.url===zineBladiUrl);
    if(duplicateIndex>=0)stations.splice(duplicateIndex,1);
    stations.unshift({name:'إذاعة زين بلادي للقرآن الكريم',url:zineBladiUrl});
   }
   if(!stations.length){
    radioApiPromise=null;
    if(status)status.textContent='لم تصل قائمة محطات صالحة الآن. يمكنك إعادة المحاولة.';
    if(button){
     button.disabled=false;
     button.removeAttribute('aria-busy');
     button.textContent='إعادة تحميل المحطات';
    }
    return 0;
   }
   const previous=select.value,fragment=document.createDocumentFragment();
   stations.forEach(station=>{
    const option=document.createElement('option');
    option.value=station.url;
    option.textContent=station.name;
    fragment.append(option);
   });
   select.replaceChildren(fragment);
   if(previous&&stations.some(station=>station.url===previous))select.value=previous;
   if(!select.value)select.selectedIndex=0;
   syncLiveStationPicker();
   $('liveStationArea').hidden=false;
   if(status)status.textContent='تم تحميل '+stations.length+' محطة. اختر المحطة التي تريد الاستماع إليها.';
   if(button){
    button.disabled=false;
    button.removeAttribute('aria-busy');
    button.textContent='تشغيل المحطة المختارة　▶';
   }
   return stations.length;
  }).catch(error=>{
   radioApiPromise=null;
   // لا نحرم المستخدم من محطة زين بلادي إذا تعذر جلب القائمة العامة.
   const fallbackUrl=safeHttpsURL('https://asmaki.ma:8000/radio.mp3');
   if(fallbackUrl){
    const option=document.createElement('option');
    option.value=fallbackUrl;
    option.textContent='إذاعة زين بلادي للقرآن الكريم';
    select.replaceChildren(option);
    select.selectedIndex=0;
    syncLiveStationPicker();
    $('liveStationArea').hidden=false;
    if(status)status.textContent='تعذّر تحميل بقية المحطات؛ محطة زين بلادي متاحة للاستماع.';
    if(button){
     button.disabled=false;
     button.removeAttribute('aria-busy');
     button.textContent='تشغيل المحطة المختارة　▶';
    }
    return 1;
   }
   if(status)status.textContent='تعذّر تحميل قائمة المحطات. تحقق من الاتصال ثم أعد المحاولة.';
   if(button){
    button.disabled=false;
    button.removeAttribute('aria-busy');
    button.textContent='إعادة المحاولة لتحميل البث';
   }
   return 0;
  });
  return radioApiPromise;
 }
 $('src').textContent='قائمة القرّاء الأساسية جاهزة. تُحمّل التحديثات عند فتح الإذاعة، وتُحمّل المحطات عند طلب البث المباشر.';
 document.querySelectorAll('input[name=rm]').forEach(x=>x.addEventListener('change',()=>{if(started)play()}));
 $('rl').addEventListener('change',()=>{
  syncLiveStationPicker();
  if(started&&activePlaybackKind==='live'&&!au.paused)play();
  else{
   const selected=$('rl').selectedOptions[0];
   const status=$('liveRadioStatus');
   if(status&&selected)status.textContent='تم اختيار '+selected.textContent+'؛ اضغط تشغيل المحطة لبدء البث.';
  }
 });
 $('rq').addEventListener('input',()=>{reciterDisplayLimit=36;fill()});
 $('reciterMore').addEventListener('click',()=>{reciterDisplayLimit+=36;fill()});

  const countrySelect=$('reciterCountry'),countryOpen=$('reciterCountryOpen'),countryStatus=$('reciterCountryStatus');
 const countryDirectory={
  'saudi-arabia':{name:'المملكة العربية السعودية',code:'SA',marker:'سعودي'},
  'egypt':{name:'مصر',code:'EG',marker:'مصري'},
  'morocco':{name:'المغرب',code:'MA',marker:'مغربي'},
  'iraq':{name:'العراق',code:'IQ',marker:'عراقي'},
  'yemen':{name:'اليمن',code:'YE',marker:'يمني'},
  'syria':{name:'سوريا',code:'SY',marker:'سوري'},
  'palestine':{name:'فلسطين',code:'PS',marker:'فلسطيني'},
  'kuwait':{name:'الكويت',code:'KW',marker:'كويتي'},
  'united-arab-emirates':{name:'الإمارات العربية المتحدة',code:'AE',marker:'إماراتي'},
  'qatar':{name:'قطر',code:'QA',marker:'قطري'},
  'algeria':{name:'الجزائر',code:'DZ',marker:'جزائري'},
  'libya':{name:'ليبيا',code:'LY',marker:'ليبي'},
  'bahrain':{name:'البحرين',code:'BH',marker:'بحريني'},
  'jordan':{name:'الأردن',code:'JO',marker:'أردني'},
  'sudan':{name:'السودان',code:'SD',marker:'سوداني'},
  'tunisia':{name:'تونس',code:'TN',marker:'تونسي'},
  'oman':{name:'سلطنة عُمان',code:'OM',marker:'عماني'},
  'mauritania':{name:'موريتانيا',code:'MR',marker:'موريتاني'},
  'lebanon':{name:'لبنان',code:'LB',marker:'لبناني'},
  'somalia':{name:'الصومال',code:'SO',marker:'صومالي'},
  'djibouti':{name:'جيبوتي',code:'DJ',marker:'جيبوتي'},
  'comoros':{name:'جزر القمر',code:'KM',marker:'قمري'}
 };
 const countryModal=$('reciterCountryModal'),countryDialog=countryModal.querySelector('.country-reader-dialog');
 const countrySearch=$('countryReaderSearch'),countryList=$('countryReaderList'),countryStatusBox=$('countryReaderStatus');
 const countryCountBox=$('countryReaderCount'),countryPageBox=$('countryReaderPage'),countryPrev=$('countryReaderPrev'),countryNext=$('countryReaderNext'),countryRetry=$('countryReaderRetry');
 const countryQuickToggle=$('countryQuickToggle'),countryQuickPanel=$('countryQuickPanel'),countryRandomButton=$('countryRandomPlay');
 const countryCache=new Map(),countryProfileCache=new Map();let activeCountryKey='',activeCountryRows=[],activeCountryPage=1,countryTotalPages=1,countryTotalCount=0,countryPageBusy=false,countryLoadToken=0,countryPlayToken=0,countryPageController=null,countryProfileController=null,countryProfileSlug='',failedCountryPage=1,countryPreviousOverflow='';
 const COUNTRY_BASE='https://way2quran.com/ar/reciters';
 function countryNorm(v){
  return String(v||'').normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g,'')
   .replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ؤ/g,'و').replace(/ئ/g,'ي').replace(/[\u200e\u200f]/g,'')
   .replace(/\s+/g,'').replace(/[ـ،؛:,.]/g,'').toLowerCase();
 }
 function countryDigits(v){
  return String(v||'').replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
 }
 function countryListPageUrl(code,page){
  const url=new URL(COUNTRY_BASE);
  url.searchParams.set('nationality',code);
  if(page>1)url.searchParams.set('currentPage',String(page));
  return url.href;
 }
 function parseCountryPage(html){
  const doc=new DOMParser().parseFromString(html,'text/html'),rows=[];
  doc.querySelectorAll('a[href]').forEach(a=>{
   let u;try{u=new URL(a.getAttribute('href'),COUNTRY_BASE)}catch(_e){return}
   if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||u.search||!['way2quran.com','www.way2quran.com'].includes(u.hostname.toLowerCase()))return;
   const match=u.pathname.match(/^\/ar\/reciters\/([^/]+)\/?$/);
   if(!match)return;
   const raw=(a.textContent||a.getAttribute('aria-label')||a.getAttribute('title')||'').replace(/[\u064B-\u065F\u0670]/g,'').replace(/\s+/g,' ').trim();
   const heading=a.querySelector('h2,h3,h4,[data-reciter-name]');
   let name=(heading?.textContent||raw).trim();
   const latinAt=name.search(/[A-Za-z]/);
   if(latinAt>0)name=name.slice(0,latinAt).trim();
   if(!heading){
    name=name.replace(/\s*[|·،,]\s*(?:مختار|مصري|سعودي|مغربي|جزائري|عراقي|يمني|سوري|فلسطيني|كويتي|إماراتي|قطري|ليبي|بحريني|أردني|سوداني|تونسي|عُماني|موريتاني|لبناني|صومالي).*$/,'').trim();
   }
   name=name.replace(/^[\s·،,]+|[\s·،,]+$/g,'');
   if(!name||name.length>120)return;
   const digits=raw.match(/([0-9٠-٩]+)\s*(?:قراءة|قراءات|قراءتان)/);
   const recordings=/قراءتان/.test(raw)?2:digits?Math.max(1,Number(countryDigits(digits[1]))||1):0;
   rows.push({name,slug:match[1],profileUrl:u.href,recordings});
  });
  return rows;
 }
 function abortCountryPageRequest(){
  if(countryPageController){
   try{countryPageController.abort()}catch(_e){}
   countryPageController=null;
  }
 }
 function abortCountryProfileRequest(){
  if(countryProfileController){
   const oldSlug=countryProfileSlug;
   try{countryProfileController.abort()}catch(_e){}
   if(oldSlug)countryProfileCache.delete(oldSlug);
   countryProfileController=null;countryProfileSlug='';
  }
 }
 const countryFetchFailureUntil=new Map();
 function resolveCountryRequest(value){
  const base=new URL(COUNTRY_BASE);
  const source=new URL(String(value));
  const allowedOrigins=new Set([base.origin,'https://www.way2quran.com']);
  if(source.protocol!=='https:'||!allowedOrigins.has(source.origin)||source.username||source.password||source.port||source.hash){
   throw new Error('المصدر أو مسار القارئ غير موثوق.');
  }
  let sourceUrl=null,apiUrl=null;
  const basePath=base.pathname;
  if(source.pathname===basePath||source.pathname===basePath+'/'){
   if([...source.searchParams.keys()].some(key=>key!=='nationality'&&key!=='currentPage')){
    throw new Error('معاملات صفحة البلد غير صالحة.');
   }
   const code=source.searchParams.get('nationality')||'';
   const pageText=source.searchParams.get('currentPage')||'1';
   const allowedCodes=new Set(Object.values(countryDirectory).map(item=>item.code));
   const page=Number(pageText);
   if(source.searchParams.getAll('nationality').length!==1||
      source.searchParams.getAll('currentPage').length>1||
      !allowedCodes.has(code)||!/^\d{1,3}$/.test(pageText)||
      !Number.isInteger(page)||page<1||page>100){
    throw new Error('معاملات صفحة البلد غير صالحة.');
   }
   sourceUrl=new URL(COUNTRY_BASE);
   sourceUrl.searchParams.set('nationality',code);
   if(page>1)sourceUrl.searchParams.set('currentPage',String(page));
   const gateway=anwarApiGatewayBase();
   if(gateway){
    apiUrl=new URL('/v1/country/list',gateway);
    apiUrl.searchParams.set('nationality',code);
    if(page>1)apiUrl.searchParams.set('page',String(page));
   }
  }else if(source.searchParams.size===0){
   const match=source.pathname.match(/^\/ar\/reciters\/([a-z0-9-]{1,100})\/?$/i);
   if(match){
    const slug=match[1];
    sourceUrl=new URL(COUNTRY_BASE);
    sourceUrl.pathname=basePath+'/'+slug;
    const gateway=anwarApiGatewayBase();
    if(gateway){
     apiUrl=new URL('/v1/country/profile',gateway);
     apiUrl.searchParams.set('slug',slug);
    }
   }
  }
  if(!sourceUrl)throw new Error('المصدر أو مسار القارئ غير مدرج في بوابة أنوار.');
  return {sourceUrl:sourceUrl.href,gatewayUrl:apiUrl?apiUrl.href:''};
 }
 async function fetchCountryHtml(url,externalSignal){
  if(externalSignal&&externalSignal.aborted)throw new Error('أُلغي الطلب السابق');
  const request=resolveCountryRequest(url);
  const sourceUrl=request.sourceUrl;
  const retryAt=countryFetchFailureUntil.get(sourceUrl)||0;
  if(retryAt>Date.now())throw new Error('تم تأجيل إعادة طلب هذه الصفحة لتخفيف الضغط؛ حاول بعد قليل.');
  try{
   if(request.gatewayUrl){
    const response=await fetch(request.gatewayUrl,{
     signal:externalSignal,cache:'force-cache',credentials:'omit',referrerPolicy:'no-referrer'
    });
    if(!response.ok){
     const retry=Math.max(1,Math.min(60,Number(response.headers.get('Retry-After'))||15));
     const error=new Error(response.status===429?'تجاوزت طلبات الشبكة الحد المسموح؛ انتظر ثم أعد المحاولة.':'تعذّر جلب الصفحة عبر بوابة أنوار.');
     error.retryAfterMs=retry*1000;throw error;
    }
    const body=await response.text();
    if(body.length<300||body.length>3000000)throw new Error('استجابة غير صالحة');
    return body;
   }

   const allOriginsUrl=new URL('/raw','https://api.allorigins.win');
   allOriginsUrl.searchParams.set('url',sourceUrl);
   const corsProxyUrl=new URL('/','https://corsproxy.io');
   corsProxyUrl.searchParams.set('url',sourceUrl);
   const proxies=[allOriginsUrl.href,corsProxyUrl.href];
   const controllers=[];
   const abortJobs=()=>controllers.forEach(controller=>{try{controller.abort()}catch(_e){}});
   if(externalSignal)externalSignal.addEventListener('abort',abortJobs,{once:true});
   try{
    let lastError=null;
    for(const proxyUrl of proxies){
     if(externalSignal&&externalSignal.aborted)throw new Error('أُلغي الطلب السابق');
     const controller=new AbortController();controllers.push(controller);
     const timer=setTimeout(()=>controller.abort(),5000);
     try{
      const response=await fetch(proxyUrl,{signal:controller.signal,cache:'force-cache',credentials:'omit',referrerPolicy:'no-referrer'});
      if(!response.ok)throw new Error('HTTP '+response.status);
      const body=await response.text();
      if(body.length<300||body.length>3000000)throw new Error('استجابة غير صالحة');
      return body;
     }catch(error){lastError=error;if(externalSignal&&externalSignal.aborted)throw error}
     finally{clearTimeout(timer)}
    }
    throw lastError||new Error('تعذر جلب بيانات المصدر');
   }finally{
    if(externalSignal)externalSignal.removeEventListener('abort',abortJobs);
    controllers.forEach(controller=>{try{controller.abort()}catch(_e){}});
   }
  }catch(error){
   if(!(externalSignal&&externalSignal.aborted)){
    const delay=Math.max(10000,Math.min(60000,Number(error.retryAfterMs)||15000));
    countryFetchFailureUntil.set(sourceUrl,Date.now()+delay);
   }
   throw error;
  }
 }
 function dedupeCountryRows(rows){
  const byIdentity=new Map();
  rows.forEach(row=>{
   const key=String(row.slug||countryNorm(row.name)).toLowerCase();
   if(!byIdentity.has(key))byIdentity.set(key,{...row});
   else{
    const old=byIdentity.get(key);
    old.recordings=Math.max(old.recordings||0,row.recordings||0);
   }
  });
  return [...byIdentity.values()].sort((a,b)=>a.name.localeCompare(b.name,'ar')||a.slug.localeCompare(b.slug,'ar'));
 }
 function countryPageMeta(html){
  const doc=new DOMParser().parseFromString(html,'text/html');
  let pages=1,total=0;
  const base=new URL(COUNTRY_BASE);
  doc.querySelectorAll('a[href]').forEach(a=>{
   try{
    const u=new URL(a.getAttribute('href'),COUNTRY_BASE);
    if(u.origin!==base.origin||u.pathname.replace(/\/$/,'')!==base.pathname.replace(/\/$/,''))return;
    const page=Number(u.searchParams.get('currentPage')||1);
    if(Number.isInteger(page)&&page>pages)pages=page;
   }catch(_e){}
  });
  const body=doc.body?.textContent||'';
  const match=body.match(/النتائج\s*[:：]?\s*([0-9٠-٩٬,]+)/);
  if(match)total=Number(countryDigits(match[1]).replace(/[٬,]/g,''))||0;
  const markerMatch=body.match(/البلد\s*[:：]\s*([^\s·،,]+)/);
  const marker=markerMatch?markerMatch[1].trim():'';
  return {pages:Math.max(1,pages),total,marker};
 }
 function renderCountryRows(){
  countryPlayToken++;abortCountryProfileRequest();
  if(countryActiveAudio)stopCountryAudio();
  const q=countryNorm(countrySearch.value);
  const filtered=activeCountryRows.filter(row=>!q||countryNorm(row.name).includes(q));
  countryList.innerHTML=filtered.length?filtered.map(r=>'<div class="country-reader-item" role="listitem" data-country-reciter="'+esc(r.slug)+'" data-country-profile="'+esc(r.profileUrl)+'"><span class="country-reader-seal" aria-hidden="true"><img class="anwar-tulip-img" src="assets/tulip-cutout.svg" alt=""></span><span class="country-reader-name">'+esc(r.name)+'</span><small>'+(r.recordings>1?new Intl.NumberFormat('ar').format(r.recordings)+' تلاوات':(r.recordings===1?'تلاوة':'قارئ'))+'</small><button type="button" class="country-reader-play" data-country-play aria-label="تشغيل تلاوة '+esc(r.name)+' داخل المفكرة" title="تشغيل داخل أنوار">▶</button></div>').join(''):'<div class="country-reader-empty">'+(q?'لا توجد أسماء مطابقة في هذه الصفحة. انتقل إلى الصفحة التالية أو غيّر البحث.':'لا توجد أسماء في هذه الصفحة.')+'</div>';
  countryCountBox.textContent=new Intl.NumberFormat('ar').format(filtered.length)+(countryTotalCount?' / '+new Intl.NumberFormat('ar').format(countryTotalCount):'');
  countryPageBox.textContent=activeCountryPage+' / '+countryTotalPages;
  countryPrev.disabled=activeCountryPage<=1||countryPageBusy;
  countryNext.disabled=activeCountryPage>=countryTotalPages||countryPageBusy;
 }
 async function loadCountryReaders(key,page=1,force=false){
  const entry=countryDirectory[key];if(!entry)return;
  const targetPage=Math.max(1,Number(page)||1);
  const token=++countryLoadToken;
  countryPlayToken++;
  activeCountryKey=key;
  abortCountryPageRequest();
  abortCountryProfileRequest();
  const cache=countryCache.get(key)||{pages:new Map(),totalPages:1,totalCount:0};
  if(cache.pages.has(targetPage)&&!force){
   countryPageBusy=false;
   activeCountryRows=cache.pages.get(targetPage);
   activeCountryPage=targetPage;countryTotalPages=cache.totalPages;countryTotalCount=cache.totalCount;
   countryRetry.hidden=true;renderCountryRows();
   countryStatusBox.textContent='صفحة محفوظة لهذه الجلسة من الطريق إلى القرآن · تُحمّل بقية الصفحات عند طلبها.';
   return activeCountryRows;
  }
  countryPageBusy=true;countryRetry.hidden=true;countryPrev.disabled=true;countryNext.disabled=true;
  countryPageController=new AbortController();
  const pageSignal=countryPageController.signal;
  if(countryActiveAudio)stopCountryAudio();
  countryList.innerHTML='<div class="country-reader-empty">جارٍ تحميل صفحة واحدة فقط…</div>';
  countryStatusBox.textContent='جارٍ جلب الصفحة '+targetPage+' من قرّاء '+entry.name+'…';
  try{
   const html=await fetchCountryHtml(countryListPageUrl(entry.code,targetPage),pageSignal);
   const meta=countryPageMeta(html);
   const actualMarker=countryNorm(meta.marker);
   const expectedMarker=countryNorm(entry.marker);
   if(!meta.marker||actualMarker!==expectedMarker)throw new Error('المصدر لم يؤكد البلد المطلوب؛ أُوقفت القائمة حمايةً من خلط الدول');
   const rows=dedupeCountryRows(parseCountryPage(html));
   if(token!==countryLoadToken||activeCountryKey!==key||countryModal.hidden)return;
   cache.pages.set(targetPage,rows);
   cache.totalPages=Math.max(1,meta.pages);
   cache.totalCount=meta.total;
   countryCache.set(key,cache);
   activeCountryRows=rows;activeCountryPage=targetPage;countryTotalPages=cache.totalPages;countryTotalCount=cache.totalCount;
   renderCountryRows();
   $('countryModalSub').textContent=(countryTotalCount?new Intl.NumberFormat('ar').format(countryTotalCount)+' قارئًا':'قائمة '+entry.name)+' · '+countryTotalPages+' صفحات عند الطلب';
   countryStatusBox.textContent=rows.length
    ?'عُثر على '+new Intl.NumberFormat('ar').format(rows.length)+' قارئًا في صفحة '+targetPage+' من '+entry.name+'. لم تُحمّل الصفحات الأخرى بعد.'
    :'لم يعرض المصدر قرّاء في هذه الصفحة من '+entry.name+'. يمكنك الانتقال إلى الصفحة التالية إن وُجدت.';
   return rows;
  }catch(error){
   if(token!==countryLoadToken||activeCountryKey!==key)return;
   failedCountryPage=targetPage;
   countryList.innerHTML='<div class="country-reader-empty">تعذّر تحميل هذه الصفحة. أعد المحاولة؛ لن نحمّل بقية الصفحات دفعة واحدة.</div>';
   countryRetry.hidden=false;
   countryStatusBox.textContent=String(error&&error.message||'').includes('لم يؤكد البلد المطلوب')
    ?'لم يؤكد المصدر أن النتائج تخص '+entry.name+'؛ لم نعرض أسماء قد تكون من دولة أخرى.'
    :'تعذّر جلب الصفحة '+targetPage+' خلال المهلة المحددة. يمكنك إعادة المحاولة.';
   return [];
  }finally{
   if(countryPageController&&countryPageController.signal===pageSignal)countryPageController=null;
   if(token===countryLoadToken){
    countryPageBusy=false;
    countryPrev.disabled=activeCountryPage<=1;
    countryNext.disabled=activeCountryPage>=countryTotalPages;
   }
  }
 }
 const countryPlaceholder=document.createElement('option');
 countryPlaceholder.value='';
 countryPlaceholder.textContent='اختر الدولة…';
 const countryOptions=[countryPlaceholder];
 Object.entries(countryDirectory).forEach(([key,entry])=>{
  const option=document.createElement('option');
  option.value=key;option.textContent=entry.name;
  countryOptions.push(option);
 });
 countrySelect.replaceChildren(...countryOptions);
 function updateCountryDirectory(){
  const key=countrySelect.value,entry=countryDirectory[key];
  countryOpen.disabled=!key;
  countryOpen.textContent='عرض القائمة';
  if(entry)countryStatus.textContent='ستُحمّل صفحة واحدة من قرّاء '+entry.name+' عند فتح القائمة.';
  else countryStatus.textContent='اختر قارئًا عشوائيًا، أو حدّد دولة لعرض أسمائها.';
 }
 function openCountryModal(countryKey){
  const key=countryKey||countrySelect.value;if(!key)return Promise.resolve([]);
  countrySelect.value=key;updateCountryDirectory();
  countryQuickPanel.hidden=true;countryQuickToggle.setAttribute('aria-expanded','false');countryQuickToggle.classList.remove('is-open');
  abortCountryPageRequest();abortCountryProfileRequest();
  activeCountryKey=key;activeCountryRows=[];activeCountryPage=1;countryTotalPages=1;countryTotalCount=0;countrySearch.value='';countryLoadToken++;countryPlayToken++;countryPageBusy=false;
  countryPrev.disabled=true;countryNext.disabled=true;
  if(countryModal.hidden)countryPreviousOverflow=document.body.style.overflow;
  countryModal.hidden=false;countryOpen.setAttribute('aria-expanded','true');document.body.classList.add('country-reader-open');document.body.style.overflow='hidden';
  const entry=countryDirectory[key];
  $('countryModalTitle').textContent='قرّاء '+(entry?entry.name:countrySelect.selectedOptions[0].textContent.split('·')[0].trim());
  $('countryModalSub').textContent=entry?'فهرس '+entry.name+' من الطريق إلى القرآن · تُحمّل صفحة واحدة في كل مرة':'لا توجد قائمة موثقة لهذه الدولة';
  countryList.replaceChildren();countryRetry.hidden=true;
  countryCountBox.textContent='—';countryPageBox.textContent='—';
  let loadPromise=Promise.resolve([]);
  if(!entry){
   countryCountBox.textContent='0';countryStatusBox.textContent='لا توجد قائمة موثقة لهذه الدولة في الفهرس الحالي.';
   countryPrev.disabled=true;countryNext.disabled=true;
  }else{
   loadPromise=loadCountryReaders(key,1).catch(()=>[]);
  }
  requestAnimationFrame(()=>countryDialog.focus());
  return loadPromise;
 }
 function closeCountryModal(){
  countryLoadToken++;countryPlayToken++;countryPageBusy=false;
  abortCountryPageRequest();abortCountryProfileRequest();
  if(countryActiveAudio)stopCountryAudio();
  countryModal.hidden=true;countryOpen.setAttribute('aria-expanded','false');document.body.classList.remove('country-reader-open');document.body.style.overflow=countryPreviousOverflow;
  countryOpen.focus();
 }
 let countryActiveAudio=null,countryActiveButton=null,countryActiveCard=null;
 function countryMp3QuranSource(name){
  const key=readerKey(name);
  const matches=R.filter(r=>{
   if(readerKey(r[0])!==key||!String(r[1]||''))return false;
   try{const audioUrl=new URL(r[1]);return audioUrl.protocol==='https:'&&!audioUrl.username&&!audioUrl.password&&['mp3quran.net','www.mp3quran.net'].includes(audioUrl.hostname.toLowerCase())}catch(_e){return false}
  });
  if(!matches.length)return '';
  const match=matches.find(r=>Array.isArray(r[2])&&r[2].includes(1))||matches.find(r=>Array.isArray(r[2])&&r[2].length)||matches[0];
  const folder=safeHttpsURL(match[1]);if(!folder)return '';
  const available=Array.isArray(match[2])?match[2].filter(n=>Number.isInteger(+n)&&+n>=1&&+n<=114).map(Number):[];
  const surah=available.includes(1)?1:(available[0]||1);
  return folder.replace(/\/?$/,'/')+String(surah).padStart(3,'0')+'.mp3';
 }
 function countryAudioCandidates(html){
  const doc=new DOMParser().parseFromString(html,'text/html'),found=[];
  const add=value=>{
   if(!value)return;
   let u;try{u=new URL(String(value).trim().replace(/&amp;/gi,'&'),'https://way2quran.com/')}catch(_e){return}
   const hostAllowed=['way2quran.com','www.way2quran.com','mp3quran.net','www.mp3quran.net'].includes(u.hostname.toLowerCase());
   const audioPath=/\.(?:mp3|m4a|aac|ogg|wav)$/i.test(u.pathname);
   if(u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&hostAllowed&&audioPath&&!found.includes(u.href))found.push(u.href);
  };
  doc.querySelectorAll('audio[src],audio source[src],audio source[data-src],source[src],source[data-src],a[href],[data-audio-url],[data-audio],[data-mp3],[data-file],[data-media],[data-src],[data-url]').forEach(el=>{
   ['src','href','data-audio-url','data-audio','data-mp3','data-file','data-media','data-src','data-url'].forEach(k=>add(el.getAttribute(k)));
  });
  const rawMatches=html.match(/https?:\/\/[^"'<>\\\s]+?\.(?:mp3|m4a|aac|ogg|wav)(?:[?#][^"'<>\\\s]*)?/gi)||[];
  rawMatches.forEach(add);
  return found.sort((a,b)=>Number(!/\.mp3(?:$|[?#])/i.test(a))-Number(!/\.mp3(?:$|[?#])/i.test(b)));
 }
 function countryTrackOptions(urls){
  const groups=new Map(),extras=[];
  urls.forEach(url=>{
   let u;try{u=new URL(url)}catch(_e){return}
   const match=u.pathname.match(/\/(\d{1,3})\.mp3$/i);
   if(!match){extras.push({url,label:'تلاوة '+(extras.length+1)});return}
   const number=Number(match[1]);if(number<1||number>114)return;
   const folder=u.origin+u.pathname.replace(/\d{1,3}\.mp3$/i,'');
   if(!groups.has(folder))groups.set(folder,new Map());
   groups.get(folder).set(number,url);
  });
  const best=[...groups.entries()].sort((a,b)=>b[1].size-a[1].size)[0];
  if(best&&best[1].size>=2){
   return [...best[1].entries()].sort((a,b)=>a[0]-b[0]).map(([number,url])=>({url,label:String(number).padStart(3,'0')+' · '+(SU[number-1]||'السورة '+number)}));
  }
  return extras.length?extras:urls.slice(0,1).map((url,i)=>({url,label:'التلاوة '+(i+1)}));
 }
 function stopCountryAudio(){
  if(countryActiveAudio){
   countryActiveAudio.pause();
   countryActiveAudio.removeAttribute('src');
   countryActiveAudio.load();
   countryActiveAudio.remove();
  }
  if(countryActiveButton)countryActiveButton.textContent='▶';
  if(countryActiveCard)countryActiveCard.querySelector('.country-reader-audio-wrap')?.remove();
  countryActiveAudio=null;countryActiveButton=null;countryActiveCard=null;
  if('mediaSession' in navigator)try{navigator.mediaSession.playbackState='none'}catch(_e){}
 }
 window.__anwarStopCountryAudio=()=>{
  countryPlayToken++;
  abortCountryProfileRequest();
  if(countryActiveAudio)stopCountryAudio();
 };
 function mountCountryAudio(card,button,name,urls,sourceLabel){
  const lessonAudio=$('lessonAudio');
  if(lessonAudio&&!lessonAudio.paused)lessonAudio.pause();
  stopCountryAudio();
  const tracks=countryTrackOptions(urls);
  if(!tracks.length)throw new Error('لم توجد ملفات صوت صالحة');
  const wrap=document.createElement('div');wrap.className='country-reader-audio-wrap';
  const audio=document.createElement('audio');audio.className='country-reader-audio';audio.controls=true;audio.preload='none';audio.volume=radioBaseVolume;audio.setAttribute('playsinline','');audio.setAttribute('aria-label','تلاوة '+name);
  audio.src=tracks[0].url;
  if(tracks.length>1){
   const label=document.createElement('label');label.className='country-reader-track-label';label.textContent='اختر السورة';
   const select=document.createElement('select');select.className='country-reader-track';select.setAttribute('aria-label','اختر سورة للقارئ '+name);
   select.innerHTML=tracks.map((track,index)=>'<option value="'+index+'">'+esc(track.label)+'</option>').join('');
   select.addEventListener('change',()=>{
    const track=tracks[Number(select.value)||0];
    audio.pause();audio.src=track.url;audio.load();
    countryStatusBox.textContent='جارٍ تشغيل '+track.label+' للقارئ '+name+' داخل أنوار…';
    const attempt=audio.play();
    if(attempt&&attempt.catch)attempt.catch(()=>{countryStatusBox.textContent='تم اختيار السورة؛ اضغط ▶ في مشغّل الصوت.'});
   });
   wrap.append(label,select);
  }
  wrap.append(audio);card.append(wrap);
  countryActiveAudio=audio;countryActiveButton=button;countryActiveCard=card;
  const setCountryMediaState=state=>{
   if(!('mediaSession' in navigator))return;
   try{
    navigator.mediaSession.metadata=new MediaMetadata({
     title:'تلاوة القرآن الكريم',artist:name,album:'مفكرة أنوار',
     artwork:[{src:new URL('icon-192.png?v=20261118-clarity1',location.href).href,sizes:'192x192',type:'image/png'}]
    });
    navigator.mediaSession.playbackState=state;
    navigator.mediaSession.setActionHandler('play',()=>audio.play().catch(()=>{}));
    navigator.mediaSession.setActionHandler('pause',()=>audio.pause());
   }catch(_e){}
  };
  audio.addEventListener('play',()=>{button.textContent='⏸';setCountryMediaState('playing')});
  audio.addEventListener('pause',()=>{button.textContent='▶';setCountryMediaState(audio.ended?'none':'paused')});
  audio.addEventListener('ended',()=>{button.textContent='▶';setCountryMediaState('none')});
  audio.addEventListener('waiting',()=>{countryStatusBox.textContent='جارٍ تحميل الصوت داخل أنوار: '+name+'…'});
  audio.addEventListener('playing',()=>{button.textContent='⏸';countryStatusBox.textContent='يُشغَّل الآن داخل مفكرة أنوار: '+name+' · '+sourceLabel;setCountryMediaState('playing')});
  audio.addEventListener('error',()=>{
   button.textContent='▶';
   countryStatusBox.textContent='تعذّر تحميل ملف الصوت داخل المشغّل لهذا القارئ. لم يتم فتح أي موقع خارجي؛ جرّب تلاوة أخرى.';
  },{once:true});
  audio.load();
  button.textContent='▶';
  countryStatusBox.textContent='تم العثور على '+tracks.length+' رابط تلاوة للقارئ '+name+'؛ جارٍ بدء الملف الأول داخل أنوار…';
  const attempt=audio.play();
  if(attempt&&typeof attempt.catch==='function')attempt.catch(error=>{
   if(error&&error.name==='NotAllowedError')countryStatusBox.textContent='المشغّل جاهز داخل أنوار؛ اضغط ▶ في شريط الصوت لبدء التلاوة.';
   else countryStatusBox.textContent='لم يبدأ الملف تلقائيًا؛ اضغط ▶ في مشغّل الصوت داخل البطاقة.';
  });
 }
 function countryProfileAudio(card){
  const slug=card.dataset.countryReciter||'',profileUrl=card.dataset.countryProfile||'';
  if(!slug||!profileUrl)return Promise.reject(new Error('رابط صفحة القارئ غير موجود'));
  if(countryProfileController&&countryProfileSlug!==slug)abortCountryProfileRequest();
  if(countryProfileCache.has(slug))return countryProfileCache.get(slug);
  abortCountryProfileRequest();
  if(countryProfileCache.size>=16){
   const oldest=countryProfileCache.keys().next().value;
   if(oldest)countryProfileCache.delete(oldest);
  }
  const controller=new AbortController();
  countryProfileController=controller;countryProfileSlug=slug;
  const promise=fetchCountryHtml(profileUrl,controller.signal).then(html=>{
   const urls=countryAudioCandidates(html);
   if(!urls.length)throw new Error('لم تُعثر على روابط MP3 مباشرة');
   return urls;
  }).catch(error=>{
   countryProfileCache.delete(slug);throw error;
  }).finally(()=>{
   if(countryProfileController===controller){
    countryProfileController=null;countryProfileSlug='';
   }
  });
  countryProfileCache.set(slug,promise);
  return promise;
 }
 countryList.addEventListener('pointerdown',e=>{
  const button=e.target.closest('[data-country-play]');if(!button)return;
  const card=button.closest('[data-country-reciter]');if(!card)return;
  countryProfileAudio(card).catch(()=>{});
 },{passive:true});
 countryList.addEventListener('click',async e=>{
  const button=e.target.closest('[data-country-play]');if(!button)return;
  const card=button.closest('[data-country-reciter]');if(!card)return;
  const requestToken=++countryPlayToken;
  const name=card.querySelector('.country-reader-name')?.textContent||'القارئ';
  if(countryActiveAudio&&card.contains(countryActiveAudio)){
   if(countryActiveAudio.paused){
    const attempt=countryActiveAudio.play();
    if(attempt&&attempt.catch)attempt.catch(()=>{countryStatusBox.textContent='اضغط زر التشغيل داخل مشغّل الصوت.'});
   }else countryActiveAudio.pause();
   return;
  }
  button.disabled=true;button.textContent='…';
  if(countryActiveAudio)stopCountryAudio();
  countryStatusBox.textContent='جارٍ تجهيز ملف '+name+'؛ لا تُحمّل بقية القرّاء أو السور.';
  try{
   let urls=[],sourceLabel='الطريق إلى القرآن';
   try{urls=await countryProfileAudio(card)}catch(_profileError){}
   if(!urls.length){
    const fallback=countryMp3QuranSource(name);
    if(fallback){urls=[fallback];sourceLabel='MP3Quran'}
   }
   if(!urls.length)throw new Error('لم تتوفر روابط صوت مباشرة');
   if(requestToken!==countryPlayToken||countryModal.hidden||!card.isConnected)return;
   mountCountryAudio(card,button,name,urls,sourceLabel);
  }catch(error){
   if(requestToken===countryPlayToken){
    button.textContent='▶';
    countryStatusBox.textContent='تعذّر جلب ملف صوت صالح لهذا القارئ خلال المهلة القصيرة. بقيت المفكرة مفتوحة؛ أعد الضغط للمحاولة.';
   }
  }finally{button.disabled=false}
 });
 let countryRandomBusy=false;
 function shuffleCountryKeys(){
  const keys=Object.keys(countryDirectory);
  for(let i=keys.length-1;i>0;i--){
   const j=Math.floor(Math.random()*(i+1));
   [keys[i],keys[j]]=[keys[j],keys[i]];
  }
  return keys;
 }
 async function playRandomCountryReader(){
  if(countryRandomBusy)return;
  countryRandomBusy=true;countryRandomButton.disabled=true;
  countryRandomButton.setAttribute('aria-busy','true');
  countryRandomButton.textContent='… جارٍ اختيار قارئ';
  const keys=shuffleCountryKeys();
  const cached=keys.filter(key=>countryCache.get(key)?.pages?.get(1)?.length);
  const order=cached.length?cached.concat(keys.filter(key=>!cached.includes(key))):keys;
  let selected=false;
  try{
   for(const key of order.slice(0,2)){
    countryRandomButton.textContent='… جارٍ البحث عن قارئ';
    const rows=await openCountryModal(key);
    if(!rows.length)continue;
    const row=rows[Math.floor(Math.random()*rows.length)];
    const cards=[...countryList.querySelectorAll('[data-country-reciter]')];
    const card=cards.find(item=>item.dataset.countryReciter===row.slug);
    const button=card?.querySelector('[data-country-play]');
    if(!button)continue;
    countryStatusBox.textContent='اختير عشوائيًا: '+row.name+' · '+countryDirectory[key].name+'؛ جارٍ تجهيز الصوت داخل أنوار.';
    button.click();
    selected=true;
    break;
   }
   if(!selected){
    countryStatusBox.textContent='لم نعثر على قارئ متاح في المحاولات الحالية. جرّب الاختيار اليدوي من قائمة الدول.';
   }
  }catch(error){
   countryStatusBox.textContent='تعذّر اختيار قارئ عشوائي الآن. يمكنك اختيار الدولة يدويًا.';
  }finally{
   countryRandomBusy=false;countryRandomButton.disabled=false;
   countryRandomButton.removeAttribute('aria-busy');
   countryRandomButton.textContent='🎲 استمع إلى قارئ عشوائي';
  }
 }
 countryQuickToggle.addEventListener('click',()=>{
  const open=countryQuickPanel.hidden;
  countryQuickPanel.hidden=!open;
  countryQuickToggle.setAttribute('aria-expanded',String(open));
  countryQuickToggle.classList.toggle('is-open',open);
 });
 countryRandomButton.addEventListener('click',playRandomCountryReader);
 countryOpen.addEventListener('click',openCountryModal);
 $('countryModalClose').addEventListener('click',closeCountryModal);
 countryModal.addEventListener('click',e=>{if(e.target===countryModal)closeCountryModal()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!countryModal.hidden){e.preventDefault();closeCountryModal()}});
 countrySearch.addEventListener('input',renderCountryRows);
 countryPrev.addEventListener('click',()=>{if(activeCountryPage>1)loadCountryReaders(activeCountryKey,activeCountryPage-1)});
 countryNext.addEventListener('click',()=>{if(activeCountryPage<countryTotalPages)loadCountryReaders(activeCountryKey,activeCountryPage+1)});
 countryRetry.addEventListener('click',()=>loadCountryReaders(activeCountryKey,failedCountryPage,true));
 countrySelect.addEventListener('change',updateCountryDirectory);
 updateCountryDirectory();

 surahPicker.addEventListener('change',()=>{
  const chosen=Number(surahPicker.value);if(!Number.isInteger(chosen)||chosen<1||chosen>114)return;
  n=chosen;rsu.value=String(n);
  if(started){
   // اختيار سورة صريح يحوّل أي بث أو إذاعة جارية إلى تلاوة القارئ المختار.
   cr=Number(rr.value)||0;
   activePlaybackKind='reader';
   selectPlaybackMode(readerAdvancePreference);
   st.textContent='تم اختيار سورة '+SU[n-1]+'؛ جارٍ تحويل التشغيل إليها.';
   play();
  }else{
   st.textContent='تم اختيار سورة '+SU[n-1]+'؛ اختر القارئ لبدء التلاوة.';
  }
 });
 $('reciterGrid').addEventListener('click',e=>{
  const b=e.target.closest('[data-reciter-play]');if(!b)return;
  const menu=b.closest('details.reciter-variants-menu');if(menu)menu.open=false;
  const i=+b.dataset.reciterPlay;
  if(started&&!au.paused&&activePlaybackKind==='reader'&&cr===i){
   radioShouldPlay=false;au.pause();st.textContent='أوقفت التلاوة مؤقتاً';ui();return;
  }
  activePlaybackKind='reader';
  cr=i;rr.value=String(i);
  selectPlaybackMode(readerAdvancePreference);
  const available=availableSurahs();
  if(!available.includes(n)){n=available[0]||1;surahPicker.value=String(n);st.textContent='هذه الرواية لا توفر السورة المختارة؛ تم الانتقال إلى أول سورة متاحة.';}
  rsu.value=String(n);play();
 });
 $('liveRadioPlay').addEventListener('click',()=>{
  if(started&&activePlaybackKind==='live'&&!au.paused){
   radioShouldPlay=false;++playRequestId;clearTimeout(wd);au.pause();
   st.textContent='البث متوقف مؤقتًا';ui();return;
  }
  if(!$('rl').value){
   st.textContent='لم تجهز محطة البث بعد؛ جارٍ تحميل المحطات. اضغط التشغيل بعد ظهور القائمة.';
   ensureRadioCatalog();
   return;
  }
  activePlaybackKind='live';
  document.querySelector('input[name=rm][value="l"]').checked=true;
  play();
 });
 $('rpv').addEventListener('click',()=>moveSurah(-1));
 $('rtm').addEventListener('change',e=>{
  clearTimeout(sl);const m=+e.target.value;
  if(m){
   sl=setTimeout(()=>{
    if(typeof window.__anwarStopCountryAudio==='function')window.__anwarStopCountryAudio();
    const lesson=$('lessonAudio');if(lesson&&!lesson.paused)lesson.pause();
    radioShouldPlay=false;au.pause();started=false;ui();$('rtm').value='0';toast('انتهى مؤقت النوم');
   },m*60000);
   toast('سيتوقف الصوت بعد '+m+' دقيقة');
  }
 });
 if('mediaSession' in navigator){
   const bindRadioControls=()=>{
    try{
     navigator.mediaSession.metadata=new MediaMetadata({
      title:mode()==='l'?'بث إذاعة القرآن':'سورة '+SU[n-1],
      artist:R[cr]?R[cr][0]:'إذاعة أنوار',album:'مفكرة أنوار',
      artwork:[{src:new URL('icon-192.png?v=20261118-clarity1',location.href).href,sizes:'192x192',type:'image/png'}]
     });
     navigator.mediaSession.playbackState='playing';
    }catch(e){}
    [['play',()=>{radioShouldPlay=true;if(!au.src){cr=+rr.value||0;play()}else au.play().catch(()=>{})}],
     ['pause',()=>{radioShouldPlay=false;au.pause()}],['nexttrack',()=>$('rnx').click()],
     ['previoustrack',()=>$('rpv').click()]].forEach(([action,handler])=>{
      try{navigator.mediaSession.setActionHandler(action,handler)}catch(e){}
     });
   };
   au.addEventListener('playing',bindRadioControls);
   au.addEventListener('pause',()=>{try{if(au.src)navigator.mediaSession.playbackState='paused'}catch(e){}});
   au.addEventListener('ended',()=>{try{navigator.mediaSession.playbackState='none'}catch(e){}});
  }
 function applyEncryptedRadioPreference(preferences){
  const saved=preferences&&preferences.radio;
  if(!saved)return;
  const index=R.findIndex(item=>item&&item[0]===saved.reciter);
  if(index>=0){rr.value=String(index);cr=index}
  if(saved.surah>=1&&saved.surah<=114){
   n=saved.surah;rsu.value=String(n);
   if(surahPicker){surahPicker.value=String(n);syncSurahPickerLabel()}
  }
 }
 globalThis.AnwarPrivatePreferences.subscribe(applyEncryptedRadioPreference);
 au.addEventListener('playing',()=>{
  globalThis.AnwarPrivatePreferences.set('radio',{reciter:R[cr]?R[cr][0]:'',surah:n});
 });
 selectPlaybackMode(readerAdvancePreference);
 // سخّن اتصال خادم القارئ المختار وجهّز بيانات السورة الأولى دون تشغيلها أو تحميل بقية السور.
 function warmCurrentSurah(){
  if(started||mode()==='l')return;
  const rawBase=R[cr]&&safeHttpsURL(R[cr][1]);
  const base=rawBase?rawBase.replace(/\/?$/,'/'):'';if(!base)return;
  const url=base+String(n).padStart(3,'0')+'.mp3';
  try{
   const origin=new URL(url).origin;
   if(!document.querySelector('link[data-anwar-radio-origin="'+origin+'"]')){
    const link=document.createElement('link');link.rel='preconnect';link.href=origin;
    link.setAttribute('data-anwar-radio-origin',origin);document.head.appendChild(link);
   }
   if(!(navigator.connection&&navigator.connection.saveData)){
    au.preload='metadata';au.src=url;au.load();
   }
  }catch(_e){}
 }
 function scheduleRadioWarmup(){
  const connection=navigator.connection||{};
  if(connection.saveData||/^(slow-2g|2g)$/.test(connection.effectiveType||''))return;
  const start=()=>{if(!started)warmCurrentSurah()};
  if('requestIdleCallback' in window)window.requestIdleCallback(start,{timeout:700});
  else setTimeout(start,250);
 }
 rb.addEventListener('click',toggle);pp.addEventListener('click',toggle);
 const radioPanel=$('rd'),radioToggle=$('rg');
 function setRadioPanel(open){
  if(open){
   scheduleRadioWarmup();
   if(!reciterUiReady){fill();reciterUiReady=true;}
   ensureReciterCatalog().catch(()=>{});
   $('liveStationArea').hidden=false;
   ensureRadioCatalog();
   radioPanel.style.setProperty('--curtain-top','0px');
   radioPanel.classList.add('o');
   document.body.classList.add('radio-open');
   radioToggle.setAttribute('aria-expanded','true');
  }else{
   radioPanel.classList.remove('o');
   document.body.classList.remove('radio-open');
   radioToggle.setAttribute('aria-expanded','false');
  }
 }
 radioToggle.addEventListener('click',e=>{e.stopPropagation();setRadioPanel(!radioPanel.classList.contains('o'))});
 $('closeRadioPanel').addEventListener('click',()=>setRadioPanel(false));
 $('ownerBtn').addEventListener('click',e=>{e.stopPropagation();const dialog=$('ownerDialog');if(dialog&&!dialog.open)dialog.showModal();});
 radioPanel.addEventListener('click',e=>e.stopPropagation());
 document.addEventListener('click',e=>{if(!e.target.closest('#rd,#rg'))setRadioPanel(false)});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&radioPanel.classList.contains('o'))setRadioPanel(false)});
 window.addEventListener('resize',()=>{if(radioPanel.classList.contains('o'))radioPanel.style.setProperty('--curtain-top','0px')});
 $('rnx').addEventListener('click',()=>moveSurah(1));
 rr.addEventListener('change',()=>{
  cr=+rr.value||0;
  if(started){if(activePlaybackKind==='reader')selectPlaybackMode(readerAdvancePreference);play();}
 });
 rsu.addEventListener('change',()=>{n=+rsu.value;if(!availableSurahs().includes(n)){st.textContent='هذه السورة غير متاحة ضمن مصحف القارئ المختار.';return;}play()});
 $('rv').addEventListener('input',e=>{
  const volume=Math.max(0,Math.min(1,+e.target.value||0));
  radioBaseVolume=volume;
  au.volume=volume;
  if(countryActiveAudio)countryActiveAudio.volume=volume;
  syncRadioDucking();
 });
})();

// Floating windows: open centered, drag reliably, keep the dropped position, and stay inside the viewport.
(function(){
 const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
 const edge=8;
 function viewport(){
  const vv=window.visualViewport;
  return {w:Math.max(1,Math.min(document.documentElement.clientWidth||innerWidth,vv?vv.width:innerWidth)),h:Math.max(1,Math.min(document.documentElement.clientHeight||innerHeight,vv?vv.height:innerHeight))};
 }
 function size(el){
  const r=el.getBoundingClientRect(),v=viewport();
  return {w:r.width||Math.min(v.w-2*edge,460),h:r.height||Math.min(v.h-2*edge,500)};
 }
 function place(el,x,y){
  const v=viewport(),{w,h}=size(el);
  const maxX=Math.max(edge,v.w-w-edge),maxY=Math.max(edge,v.h-h-edge);
  el.style.boxSizing='border-box';el.style.position='fixed';el.style.margin='0';el.style.inset='auto';el.style.transform='none';
  el.style.right='auto';el.style.bottom='auto';el.style.maxWidth='calc(100vw - 16px)';
  el.style.left=clamp(x,edge,maxX)+'px';el.style.top=clamp(y,edge,maxY)+'px';
 }
 function center(el){
  const v=viewport(),{w,h}=size(el);
  place(el,(v.w-w)/2,(v.h-h)/2);
 }
 window.centerFloatingWindow=el=>{requestAnimationFrame(()=>requestAnimationFrame(()=>center(el)))};
 function addBar(el,isDialog){
  if(el.querySelector(':scope > .float-head'))return;
  el.style.boxSizing='border-box';
  const bar=document.createElement('div');bar.className='float-head';
  bar.innerHTML='<b>⋮⋮ اسحب النافذة لتحريكها</b><span class="fh-actions"><button type="button" class="fh-close" aria-label="إغلاق النافذة">✕ إغلاق</button></span>';
  el.insertBefore(bar,el.firstChild);
  bar.querySelector('.fh-close').addEventListener('click',()=>{
   if(isDialog)el.close();else el.classList.remove('o');
  });
  let drag=null;
  bar.addEventListener('pointerdown',e=>{
   if(e.target.closest('button')||e.button!==0)return;
   const r=el.getBoundingClientRect();
   drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top};
   
   el.style.position='fixed';el.style.margin='0';el.style.inset='auto';el.style.transform='none';el.style.right='auto';el.style.bottom='auto';
   try{bar.setPointerCapture(e.pointerId)}catch(_e){}
   e.preventDefault();
  });
  bar.addEventListener('pointermove',e=>{
   if(!drag||e.pointerId!==drag.id)return;
   const r=el.getBoundingClientRect();
   const x=drag.left+e.clientX-drag.x,y=drag.top+e.clientY-drag.y;
   const v=viewport();el.style.left=clamp(x,edge,Math.max(edge,v.w-r.width-edge))+'px';
   el.style.top=clamp(y,edge,Math.max(edge,v.h-r.height-edge))+'px';
   e.preventDefault();
  });
  const stop=e=>{
   if(!drag||(e&&e.pointerId!==drag.id))return;
   const r=el.getBoundingClientRect();
   place(el,r.left,r.top);
   drag=null;
   
  };
  bar.addEventListener('pointerup',stop);
  bar.addEventListener('pointercancel',stop);
  bar.addEventListener('lostpointercapture',stop);
  if(isDialog){
   const nativeShow=el.showModal.bind(el);
   el.showModal=function(){
    nativeShow();
    requestAnimationFrame(()=>requestAnimationFrame(()=>center(el)));
   };
   el.addEventListener('close',()=>{
    el.style.left='';el.style.right='';el.style.top='';el.style.bottom='';el.style.inset='';el.style.transform='';el.style.position='';el.style.margin='';
   });
  }
 }
 document.querySelectorAll('dialog').forEach(d=>addBar(d,true));
 const keepInside=()=>document.querySelectorAll('dialog[open]').forEach(el=>{const r=el.getBoundingClientRect();place(el,r.left,r.top)});
 addEventListener('resize',keepInside);addEventListener('orientationchange',()=>setTimeout(keepInside,120));
 if(window.visualViewport)window.visualViewport.addEventListener('resize',keepInside);
})();
// Keep the ownership/adhkar panel edge-to-edge after the generic dialog centering helper runs.
(function(){
 const owner=document.getElementById('ownerDialog');
 if(!owner)return;
 const show=owner.showModal.bind(owner);
 owner.showModal=function(){
  show();
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
   owner.style.position='fixed';owner.style.left='0';owner.style.top='0';owner.style.right='0';owner.style.bottom='0';
   owner.style.inset='0';owner.style.margin='0';owner.style.transform='none';owner.style.width='100vw';owner.style.height='100dvh';
   owner.style.maxWidth='100vw';owner.style.maxHeight='100dvh';
  }));
 };
})();
// Lesson library: verified official series, complete catalog links, and direct playback only where verified.
(function(){
 const $=id=>document.getElementById(id),series=$('lessonSeries'),track=$('lessonTrack'),audio=$('lessonAudio'),play=$('lessonPlay'),status=$('lessonStatus'),links=$('lessonSourceLinks'),frame=$('lessonFrame');
 if(!series||!track||!audio)return;
 const catalog={
  // Direct MP3 patterns already present in the supplied version.
  tawhid:{name:'شرح كتاب التوحيد — السلسلة الكاملة',count:55,url:i=>'https://d1.islamhouse.com/data/ar/ih_sounds/chain_01/shar7-ketab-taw7eed-al-badr/ar-'+String(i+1).padStart(2,'0')+'-shar7-ketab-taw7eed-al-badr.mp3',source:'https://islamhouse.com/ar/audios/2837173',direct:true},
  wasitiyya:{name:'شرح العقيدة الواسطية (عام 1432هـ)',count:50,url:i=>'https://archive.org/download/Sharh_Wasitiya_1432H/'+String(i+1).padStart(2,'0')+'.mp3',source:'https://alfiqh.net/شرح-العقيدة-الواسطية-عام-1432هـ-عبدالرزاق-البدر/',direct:true},
  dawa:{name:'شرح الداء والدواء',count:83,url:i=>'https://sabil-alrashad.com/Home/DownloadAudioFile/'+(36+i),source:'https://sabil-alrashad.com/AudioPlaylist/9',direct:true},
  
  usul:{name:'شرح ثلاثة الأصول (1429هـ)',count:17,url:i=>'https://al-badr.net/download/esound/choroohat/tsalatsatul-ushul/'+String(i+1).padStart(2,'0')+'.mp3',source:'https://al-badr.net/sub/196',direct:true},
  usul2:{name:'شرح الأصول الثلاثة وأدلتها (1434هـ)',count:9,url:i=>'https://al-badr.net/download/esound/choroohat/tsalatsatul-ushul-1434h/'+String(i+1).padStart(2,'0')+'.mp3',source:'https://al-badr.net/sub/303',direct:true},
  qawaid:{name:'شرح القواعد الأربع',count:3,url:i=>'https://al-badr.net/download/esound/choroohat/kawaid-alarbaa/'+String(i+1).padStart(3,'0')+'.mp3',source:'https://al-badr.net/sub/59',direct:true},
    nawqid:{name:'شرح نواقض الإسلام (1431هـ)',count:11,url:i=>'https://al-badr.net/download/esound/choroohat/nawaqidlul-islam/'+String(i+1).padStart(2,'0')+'.mp3',source:'https://al-badr.net/sub/215',direct:true},
  kashf:{name:'شرح كشف الشبهات (1428–1429هـ)',count:11,url:i=>'https://al-badr.net/download/esound/choroohat/Kashf-Alshubuhat/'+String(i+1).padStart(2,'0')+'.mp3',source:'https://al-badr.net/sub/80',direct:true},
  masail:{name:'شرح مسائل الجاهلية',count:11,url:i=>'https://al-badr.net/download/esound/choroohat/masail-aljahilia/'+String(i+1).padStart(3,'0')+'.mp3',source:'https://al-badr.net/sub/60',direct:true},
  usulIman:{name:'شرح كتاب أصول الإيمان',count:30,url:i=>'https://al-badr.net/download/esound/choroohat/usul-aliman/'+String(i+1).padStart(3,'0')+'.mp3',source:'https://al-badr.net/sub/56',direct:true},
  usulAqaid:{name:'شرح رسالة أصول العقائد الدينية',count:14,url:i=>'https://al-badr.net/download/esound/choroohat/usul-alakaid/'+String(i+1).padStart(3,'0')+'.mp3',source:'https://al-badr.net/sub/58',direct:true},
  kabair:{name:'شرح كتاب الكبائر',count:41,url:i=>'https://al-badr.net/download/esound/choroohat/alkabair-li-abdil-wahhab/'+String(i+1).padStart(2,'0')+'.mp3',source:'https://al-badr.net/sub/315',direct:true},
  sharia:{name:'شرح كتاب الشريعة للآجري',count:140,url:i=>'https://archive.org/download/fawaid_051/'+String(i+1).padStart(3,'0')+'.mp3',source:'https://www.ajurry.com/vb/forum/منابر-المتون-العلمية-وشروحها/منبر-المنهج-السلفي-وأصوله/شـروح-منهجية/43507-شرح-كتاب-الشريعة-للآجري-للشيخ-عبد-الرزاق-البدر-حفظه-الله',direct:true},
  maarij:{name:'تعليق على معارج القبول',count:280,url:i=>'https://al-badr.net/download/esound/choroohat/ma3arijul-qobul/'+String(i+1).padStart(3,'0')+'.mp3',source:'https://al-badr.net/sub/362',direct:true},
  // Official subject indexes expose further audio series beyond this curated selector.
  jawhara:{name:'شرح الجوهرة الفريدة في تحقيق العقيدة (6 دروس)',count:6,trackNames:['من البيت 1 إلى 57','من البيت 58 إلى 91','من البيت 92 إلى 135','من البيت 136 إلى 196','من البيت 197 إلى 248','من البيت 249 إلى 296'],url:i=>'https://mail.al-badr.net/download/esound/choroohat/Manduma-Aljawhara/'+String(i+1).padStart(2,'0')+'.mp3',source:'https://mail.al-badr.net/sub/84',sourceLabel:'↗ فهرس سلسلة الجوهرة الفريدة (المصدر الرسمي)',direct:true},
  allAqidah:{name:'فهرس بقية صوتيات الشيخ وسلاسله',count:0,source:'https://way2allah.com/khotab-audio-211.htm',sourceLabel:'↗ فتح فهرس بقية صوتيات الشيخ في تبويب مستقل'},
 };
 const groups=[
  ['tawhid'],
  ['wasitiyya','usulIman','usulAqaid','usul','usul2','qawaid','nawqid','kashf','masail','kabair','jawhara','sharia','maarij'],
  ['dawa'],
  ['allAqidah']
 ];
 const groupNames=['شرح كتاب التوحيد','شروح كتب العقيدة والعلوم الشرعية','شروح أخرى','فهرس بقية الصوتيات'];
 series.innerHTML=groups.map((g,i)=>`<optgroup label="${groupNames[i]}">${g.map(k=>`<option value="${k}">${catalog[k].name}${catalog[k].count?' ('+catalog[k].count+' درسًا)':''}</option>`).join('')}</optgroup>`).join('');
 const seriesButton=$('lessonSeriesButton'),seriesCurrent=$('lessonSeriesCurrent'),seriesModal=$('lessonSeriesModal'),seriesList=$('lessonSeriesList'),seriesSearch=$('lessonSeriesSearch');
 function updateSeriesLabel(){
  const option=series.selectedOptions&&series.selectedOptions[0];
  if(seriesCurrent&&option)seriesCurrent.textContent=option.textContent;
  if(seriesList)seriesList.querySelectorAll('[data-series-option]').forEach(button=>{
   const active=button.dataset.seriesOption===series.value;
   button.setAttribute('aria-selected',String(active));
   const check=button.querySelector('.lesson-series-option-check');if(check)check.textContent=active?'✓':'';
  });
 }
 function renderSeriesOptions(query){
  const q=String(query||'').trim().toLocaleLowerCase('ar');
  seriesList.innerHTML='';
  Array.from(series.querySelectorAll('optgroup')).forEach(group=>{
   const section=document.createElement('section');section.className='lesson-series-group';
   const heading=document.createElement('div');heading.className='lesson-series-group-title';heading.textContent=group.label;section.append(heading);
   let shown=0;
   Array.from(group.querySelectorAll('option')).forEach(option=>{
    if(q&&!option.textContent.toLocaleLowerCase('ar').includes(q)&&!group.label.toLocaleLowerCase('ar').includes(q))return;
    const button=document.createElement('button');button.type='button';button.className='lesson-series-option';button.dataset.seriesOption=option.value;button.setAttribute('role','option');button.setAttribute('aria-selected',String(option.value===series.value));
    const tulip=document.createElement('span');tulip.className='lesson-series-option-tulip';tulip.setAttribute('aria-hidden','true');
    const image=document.createElement('img');image.src='assets/tulip-cutout.svg';image.alt='';image.loading='lazy';image.decoding='async';tulip.append(image);
    const copy=document.createElement('span');copy.className='lesson-series-option-copy';
    const name=document.createElement('span');name.className='lesson-series-option-name';name.textContent=option.textContent;
    const meta=document.createElement('span');meta.className='lesson-series-option-meta';meta.textContent=catalog[option.value]?.count?(catalog[option.value].count+' درسًا'):'فهرس صوتي';
    const check=document.createElement('span');check.className='lesson-series-option-check';check.setAttribute('aria-hidden','true');check.textContent=option.value===series.value?'✓':'';
    copy.append(name,meta);button.append(tulip,copy,check);section.append(button);shown++;
   });
   if(shown){seriesList.append(section)}else section.hidden=true;
  });
  if(!seriesList.children.length){const empty=document.createElement('div');empty.className='lesson-series-empty';empty.textContent='لا توجد سلسلة بهذا الاسم.';seriesList.append(empty)}
 }
 function closeSeriesModal(){
  if(seriesModal.hidden)return;
  seriesModal.hidden=true;seriesButton.setAttribute('aria-expanded','false');seriesButton.focus();
 }
 seriesButton.addEventListener('click',()=>{
  seriesSearch.value='';renderSeriesOptions('');
  seriesModal.hidden=false;seriesButton.setAttribute('aria-expanded','true');seriesSearch.focus();
 });
 seriesList.addEventListener('click',event=>{
  const button=event.target.closest('[data-series-option]');if(!button)return;
  series.value=button.dataset.seriesOption;
  series.dispatchEvent(new Event('change',{bubbles:true}));
  updateSeriesLabel();closeSeriesModal();
 });
 seriesSearch.addEventListener('input',()=>renderSeriesOptions(seriesSearch.value));
 seriesModal.addEventListener('click',event=>{if(event.target===seriesModal)closeSeriesModal()});
 $('lessonSeriesClose').addEventListener('click',closeSeriesModal);
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!seriesModal.hidden)closeSeriesModal()});
 series.addEventListener('change',updateSeriesLabel);
 updateSeriesLabel();
 let current=0,lessonPlayRequest=0;
 function renderSource(c){links.replaceChildren();const sourceLink=document.createElement('a');sourceLink.href=c.source;sourceLink.target='_blank';sourceLink.rel='noopener noreferrer';sourceLink.textContent=c.sourceLabel||('↗ فهرس المصدر الرسمي (يفتح خارج المفكرة): '+c.name);links.append(sourceLink);if(frame){frame.removeAttribute('src');frame.hidden=true;frame.style.display='none';const mayEmbed=!!c.embed&&series.value!=='maarij';if(mayEmbed){frame.hidden=false;frame.src=c.source;frame.style.display='block';}}}
  function renderMaarijFileLink(c,index){if(series.value!=='maarij')return;const fileLink=document.createElement('a');fileLink.href=c.url(index);fileLink.target='_blank';fileLink.rel='noopener noreferrer';fileLink.textContent='↗ فتح ملف الدرس '+String(index+1).padStart(3,'0')+' خارج المفكرة';links.append(fileLink);}
 function fill(){
  ++lessonPlayRequest;
  const c=catalog[series.value];current=0;audio.pause();audio.removeAttribute('src');audio.preload=series.value==='maarij'?'metadata':'none';audio.load();play.textContent='▶';audio.style.display=c.direct?'block':'none';if(frame){frame.removeAttribute('src');frame.hidden=true;frame.style.display='none';}
  track.innerHTML=c.count?Array.from({length:c.count},(_,i)=>`<option value="${i}">${c.trackNames?.[i]||('الدرس '+String(i+1).padStart(2,'0')+' من '+c.count)}</option>`).join(''):'<option value="0">افتح فهرس الدروس من المصدر الرسمي</option>';
  track.disabled=!c.count;
  const lessonList=$('lessonList');
  if(lessonList){
   lessonList.innerHTML=c.count?Array.from({length:c.count},(_,i)=>`<button type="button" class="lesson-item" role="listitem" data-lesson-index="${i}" aria-current="false"><span class="lesson-tulip" aria-hidden="true"><img src="assets/tulip-cutout.svg" alt=""></span><span class="lesson-item-name">${c.trackNames?.[i]||('الدرس '+String(i+1).padStart(2,'0')+' من '+c.count)}</span></button>`).join(''):'<div class="lesson-empty">لا تتوفر قائمة تشغيل مباشرة لهذه المادة؛ افتح فهرس المصدر أدناه.</div>';
  }
  renderSource(c);updateSeriesLabel();
  status.textContent=c.direct?'قائمة كاملة: '+c.count+' درسًا. اختر الدرس للتشغيل الداخلي أو شغّل السلسلة للانتقال التلقائي.':c.count?'تتوفر '+c.count+' مادة صوتية في هذه السلسلة.':'هذا فهرس للسلاسل الصوتية؛ افتح رابطه في تبويب مستقل لتصفح بقية الصوتيات.';
 }
 function loadTrack(auto){
  const c=catalog[series.value],index=Number(track.value)||0;
  if(!c||!c.direct){renderSource(c||catalog.allAqidah);status.textContent='هذه السلسلة فهرس صوتي وليست قائمة MP3 داخلية؛ افتح رابط المصدر أدناه.';return;}
  if(index<0||index>=c.count){status.textContent='رقم الدرس غير موجود في هذه السلسلة.';return;}
  current=index;
  const requestId=++lessonPlayRequest;
  const source=c.url(current);
  audio.pause();audio.src=source;audio.preload=series.value==='maarij'?'metadata':'none';audio.load();
  play.textContent='▶';renderSource(c);renderMaarijFileLink(c,current);markLessonPlaying();
  status.textContent='الدرس '+(current+1)+' من '+c.count+' · '+c.name+' — جارٍ تحميل ملف الصوت';
  if(auto){
   try{
    const attempt=audio.play();
    if(attempt&&typeof attempt.then==='function'){
     attempt.then(()=>{
      if(requestId===lessonPlayRequest)play.textContent='⏸';
     }).catch(error=>{
      if(requestId!==lessonPlayRequest)return;
      play.textContent='▶';
      status.textContent=error?.name==='NotAllowedError'
       ?'المتصفح منع التشغيل التلقائي؛ اضغط زر التشغيل لبدء الدرس.'
       :'تعذّر بدء الدرس؛ تحقق من الاتصال ثم اضغط إعادة المحاولة.';
     });
    }else play.textContent='⏸';
   }catch(error){
    if(requestId===lessonPlayRequest){
     play.textContent='▶';status.textContent='تعذّر بدء الدرس؛ اضغط زر التشغيل للمحاولة مجددًا.';
    }
   }
  }
 }
 series.addEventListener('change',fill);track.addEventListener('change',()=>{loadTrack(false);markLessonPlaying()});
 const lessonList=$('lessonList');
 function markLessonPlaying(){if(!lessonList)return;lessonList.querySelectorAll('[data-lesson-index]').forEach(btn=>{const active=+btn.dataset.lessonIndex===current&&!!audio.src;btn.setAttribute('aria-current',String(active));});}
 if(lessonList)lessonList.addEventListener('click',e=>{const btn=e.target.closest('[data-lesson-index]');if(!btn)return;current=+btn.dataset.lessonIndex;track.value=String(current);loadTrack(true);markLessonPlaying();});
 audio.addEventListener('play',()=>{
  if(typeof window.__anwarStopCountryAudio==='function')window.__anwarStopCountryAudio();
  markLessonPlaying();
 });
 audio.addEventListener('pause',markLessonPlaying);
 audio.addEventListener('playing',markLessonPlaying);
 play.addEventListener('click',()=>{
  const c=catalog[series.value];
  if(!c||!c.direct){renderSource(c||catalog.allAqidah);status.textContent='هذا فهرس للسلاسل وليس درسًا صوتيًا مباشرًا؛ افتح رابط المصدر أدناه.';return;}
  if(!audio.src)loadTrack(false);
  if(audio.paused){
   const requestId=lessonPlayRequest;
   try{
    const attempt=audio.play();
    if(attempt&&typeof attempt.then==='function')attempt.then(()=>{
     if(requestId===lessonPlayRequest)play.textContent='⏸';
    }).catch(error=>{
     if(requestId!==lessonPlayRequest)return;
     play.textContent='▶';
     status.textContent=error?.name==='NotAllowedError'?'اضغط زر التشغيل للسماح ببدء الدرس.':'تعذّر تشغيل الدرس؛ أعد المحاولة أو افتح المصدر الأصلي.';
    });
   }catch(error){play.textContent='▶';status.textContent='تعذّر تشغيل الدرس؛ أعد المحاولة.'}
  }else{audio.pause();play.textContent='▶';}
 });
 $('lessonPrev').addEventListener('click',()=>{
  const c=catalog[series.value];if(!c||!c.direct)return;
  if(current<=0){status.textContent='أنت في أول درس من هذه السلسلة.';return;}
  current--;track.value=String(current);loadTrack(true);
 });
 $('lessonNext').addEventListener('click',()=>{
  const c=catalog[series.value];if(!c||!c.direct)return;
  if(current>=c.count-1){status.textContent='وصلت إلى آخر درس في هذه السلسلة.';return;}
  current++;track.value=String(current);loadTrack(true);
 });
 audio.addEventListener('playing',()=>{
  play.textContent='⏸';
  status.textContent='يُشغّل الآن: '+catalog[series.value].name+' — الدرس '+(current+1);
  if('mediaSession' in navigator){
   try{
    navigator.mediaSession.metadata=new MediaMetadata({
     title:catalog[series.value].name+' — الدرس '+(current+1),
     artist:'الشيخ عبد الرزاق البدر',album:'دروس مفكرة أنوار',
     artwork:[{src:new URL('icon-192.png?v=20261118-clarity1',location.href).href,sizes:'192x192',type:'image/png'}]
    });
    navigator.mediaSession.playbackState='playing';
    navigator.mediaSession.setActionHandler('play',()=>audio.play().catch(()=>{}));
    navigator.mediaSession.setActionHandler('pause',()=>audio.pause());
    navigator.mediaSession.setActionHandler('nexttrack',()=>$('lessonNext').click());
    navigator.mediaSession.setActionHandler('previoustrack',()=>$('lessonPrev').click());
   }catch(e){}
  }
 });
 audio.addEventListener('pause',()=>{if(!audio.ended){play.textContent='▶';if('mediaSession' in navigator)try{navigator.mediaSession.playbackState='paused'}catch(e){}}});
 audio.addEventListener('ended',()=>{
  const c=catalog[series.value];
  if(c&&current<c.count-1){
   current++;track.value=String(current);loadTrack(true);
  }else{
   play.textContent='▶';status.textContent='انتهت السلسلة.';markLessonPlaying();
   if('mediaSession' in navigator)try{navigator.mediaSession.playbackState='none'}catch(e){}
  }
 });
 audio.addEventListener('error',()=>{
  play.textContent='▶';
  const c=catalog[series.value];
  status.textContent=series.value==='maarij'?'لم يسمح المتصفح بتشغيل الملف داخل المفكرة؛ استخدم رابط فتح ملف الدرس خارج المفكرة.':'تعذّر تشغيل الدرس '+(current+1)+' من هذه السلسلة؛ افتح التسجيل من المصدر الأصلي أدناه.';
  renderSource(c);renderMaarijFileLink(c,current);
  const direct=audio.currentSrc||audio.src;
  if(series.value!=='maarij'&&direct){
   const fallback=document.createElement('a');
   fallback.href=direct;fallback.target='_blank';fallback.rel='noopener noreferrer';
   fallback.textContent='↗ محاولة فتح ملف الدرس مباشرة';
   links.prepend(fallback);
  }
  if('mediaSession' in navigator)try{navigator.mediaSession.playbackState='none'}catch(e){}
 });
 if('mediaSession' in navigator){
  try{
   navigator.mediaSession.setActionHandler('play',()=>audio.play().catch(()=>{}));
   navigator.mediaSession.setActionHandler('pause',()=>audio.pause());
   navigator.mediaSession.setActionHandler('nexttrack',()=>$('lessonNext').click());
   navigator.mediaSession.setActionHandler('previoustrack',()=>$('lessonPrev').click());
  }catch(e){}
 }
 fill();
})();

(function(){
 const button=$('paletteBtn');if(!button)return;
 const palettes=[
  ['blue','أزرق هادئ'],['green','أخضر مريح'],['purple','بنفسجي'],
  ['rose','وردي ناعم'],['amber','عنبر دافئ'],['slate','رمادي أنيق']
 ];
 function syncLabel(){
  const current=palettes.find(item=>item[0]===(S.palette||'blue'))||palettes[0];
  button.setAttribute('aria-label','تغيير لون الواجهة؛ اللون الحالي '+current[1]);
  button.title='اللون الحالي: '+current[1]+'؛ انقر للتغيير';
 }
 button.addEventListener('click',()=>{
  const index=palettes.findIndex(item=>item[0]===(S.palette||'blue'));
  S.palette=palettes[(index+1+palettes.length)%palettes.length][0];
  save();theme();syncLabel();
  toast('تم تغيير لون الواجهة وحفظه');
 });
 syncLabel();
})();;
$('vaultForm').addEventListener('submit',submitVaultForm);
$('vaultDisableEncryptionBtn').addEventListener('click',beginVaultDisableEncryption);
$('vaultCancelSetupBtn').addEventListener('click',cancelVaultSetup);
$('vaultDeviceUnlock').addEventListener('click',unlockVaultWithDevice);
$('vaultPasswordFallbackToggle').addEventListener('click',()=>{
 $('vaultPasswordFields').hidden=false;
 $('vaultPasswordFallbackToggle').hidden=true;
 $('vaultPassword').value='';
 $('vaultPassword').disabled=false;
 $('vaultPassword').focus();
});
$('vaultDeviceManage').addEventListener('click',openVaultDeviceSetupDialog);
$('vaultDeviceSetupForm').addEventListener('submit',submitVaultDeviceSetup);
$('vaultDeviceDisableBtn').addEventListener('click',disableVaultDeviceUnlock);
$('vaultDeviceSetupClose').addEventListener('click',()=>$('vaultDeviceSetupDialog').close());
$('backupPassword').value='';
bootVault();

/* تهيئة وإدارة موحّدة لكل الطبقات التي تفتحها الأيقونات */
(function(){
 const $=id=>document.getElementById(id);
 const makeHeader=(el,title,onClose)=>{
  if(!el||el.querySelector(':scope > .mobile-layer-header'))return;
  const h=document.createElement('div');
  h.className='mobile-layer-header';
  const label=document.createElement('strong');
  label.textContent=title;
  const close=document.createElement('button');
  close.type='button';
  close.textContent='✕ إغلاق';
  close.setAttribute('aria-label','إغلاق '+title);
  close.addEventListener('click',onClose);
  h.append(label,close);
  el.insertBefore(h,el.firstChild);
 };
 const dialogs=[
  ['dg','النسخة الاحتياطية'],
  ['historyDialog','سجل إصدارات العمل'],
  ['ownerDialog','الملكية وبطاقة النشر']
 ];
 dialogs.forEach(([id,title])=>{
  const d=$(id);
  if(d)makeHeader(d,title,()=>d.close());
 });
 const palette=$('palettePanel'),font=$('fm'),radio=$('rd');
 const paletteBtn=$('paletteBtn'),fontBtn=$('fb');
 if(palette)makeHeader(palette,'تخصيص ألوان المفكرة',()=>{
  palette.classList.remove('open');
  if(paletteBtn)paletteBtn.setAttribute('aria-expanded','false');
 });
 if(font)makeHeader(font,'اختيار نوع الخط',()=>font.classList.remove('o'));
 const active=()=>!!(
  document.querySelector('dialog[open]')||
  palette?.classList.contains('open')||
  font?.classList.contains('o')||
  radio?.classList.contains('o')
 );
 const sync=()=>{
  const on=active();
  if(document.documentElement.classList.contains('anwar-overlay-open')!==on)
   document.documentElement.classList.toggle('anwar-overlay-open',on);
  if(document.body.classList.contains('anwar-overlay-open')!==on)
   document.body.classList.toggle('anwar-overlay-open',on);
  [palette,font,radio].filter(Boolean).forEach(el=>{
   const shown=el===palette?el.classList.contains('open'):
    el===font?el.classList.contains('o'):el.classList.contains('o');
   el.setAttribute('aria-hidden',String(!shown));
   if(shown)el.setAttribute('aria-modal','true');
   else el.removeAttribute('aria-modal');
  });
 };
 const observer=new MutationObserver(sync);
 const observedLayers=[palette,font,radio,...dialogs.map(([id])=>$(id))].filter(Boolean);
 observedLayers.forEach(layer=>observer.observe(layer,{attributes:true,attributeFilter:['class','open']}));
 sync();
 document.addEventListener('keydown',e=>{
  if(e.key!=='Escape')return;
  const dialog=document.querySelector('dialog[open]');
  if(dialog){e.stopImmediatePropagation();return;}
  if(radio?.classList.contains('o')){
   radio.classList.remove('o');
   document.body.classList.remove('radio-open');
   const toggle=$('rg');if(toggle)toggle.setAttribute('aria-expanded','false');
   e.preventDefault();e.stopImmediatePropagation();sync();return;
  }
  if(palette?.classList.contains('open')){
   palette.classList.remove('open');
   if(paletteBtn)paletteBtn.setAttribute('aria-expanded','false');
   e.preventDefault();e.stopImmediatePropagation();sync();return;
  }
  if(font?.classList.contains('o')){
   font.classList.remove('o');
   e.preventDefault();e.stopImmediatePropagation();sync();return;
  }
  if($('app')?.classList.contains('focus')){
   $('app').classList.remove('focus');
   e.preventDefault();e.stopImmediatePropagation();
   requestAnimationFrame(()=>$('fo')?.focus());
   return;
  }
 },true);
 if(paletteBtn){
  paletteBtn.setAttribute('aria-controls','palettePanel');
  paletteBtn.setAttribute('aria-expanded','false');
  paletteBtn.addEventListener('click',()=>requestAnimationFrame(()=>paletteBtn.setAttribute('aria-expanded',String(!!palette?.classList.contains('open')))));
 }
 if(fontBtn)fontBtn.setAttribute('aria-controls','fm');
})();


// Update bridge: freeze editing, flush pending changes and verify persistence before reload.
window.AnouarUpdateBridge = Object.freeze({
  async prepareForReload() {
    if (storageRecoveryBlocked) {
      throw new Error('استرداد البيانات قيد المعالجة. أكمل الاسترداد قبل تحديث المفكرة.');
    }
    if (!vaultReady) {
      throw new Error('افتح المفكرة وأنهِ إعداد الخزنة قبل التحديث.');
    }

    const app = $('app');
    const editor = $('pg');
    const titleInput = $('t');
    const previous = {
      appInert: app ? app.inert : false,
      editorEditable: editor ? editor.getAttribute('contenteditable') : null,
      titleDisabled: titleInput ? titleInput.disabled : false
    };
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      if (app) app.inert = previous.appInert;
      if (editor) {
        if (previous.editorEditable === null) editor.removeAttribute('contenteditable');
        else editor.setAttribute('contenteditable', previous.editorEditable);
      }
      if (titleInput) titleInput.disabled = previous.titleDisabled;
    };

    if (editor && document.activeElement === editor) editor.blur();
    if (titleInput && document.activeElement === titleInput) titleInput.blur();
    if (app) app.inert = true;
    if (editor) editor.setAttribute('contenteditable', 'false');
    if (titleInput) titleInput.disabled = true;

    try {
      if (vaultUnlocked) {
        // Both encrypted and free-use modes must flush the editor before reload.
        flushPendingEdit(false);
        flushPrivatePreferenceSave();
      }
      await vaultSaveQueue;
      if (vaultLastWriteError) {
        throw new Error('تعذّر التحقق من آخر حفظ. ألغينا التحديث حمايةً لبياناتك؛ حاول الحفظ مجدداً.');
      }
      return release;
    } catch (error) {
      release();
      throw error;
    }
  }
});

},0));

;

// Sync only changed radio controls; ignore editor mutations to keep typing responsive.
(()=>{
 const selector='#rb,#rpp,.reciter-play,.country-reader-play,#lessonPlay,.reciter-version';
 const update=el=>{if(el&&!el.classList.contains('reciter-version'))el.dataset.playing=/[⏸Ⅱ]/.test(el.textContent)?'true':'false'};
 const scanAdded=node=>{
  if(!node||node.nodeType!==1||node.closest('#pg'))return;
  if(node.matches(selector))update(node);
  node.querySelectorAll(selector).forEach(update);
 };
 document.querySelectorAll(selector).forEach(update);
 const observer=new MutationObserver(records=>{
  records.forEach(record=>{
   const target=record.target.nodeType===1?record.target:record.target.parentElement;
   if(target&&!target.closest('#pg')){const control=target.closest(selector);if(control)update(control)}
   record.addedNodes.forEach(scanAdded);
  });
 });
 observer.observe(document.body,{subtree:true,childList:true,characterData:true});
})();

;

;

;

// Cache the local application shell; external radio, APIs and fonts remain network-dependent.
if('serviceWorker' in navigator&&location.protocol==='https:'){
 window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js',{scope:'./'}).catch(error=>console.warn('تعذّر تسجيل عامل خدمة مفكرة أنوار',error)));
}


/* Anwar service dashboard: organize prayer, Quran, radio, lessons, adhkar and tasbih. */
(()=>{
 'use strict';
 const panel=document.getElementById('rd');
 const home=document.getElementById('anwarServiceHome');
 const quranPage=document.getElementById('anwarQuranPage');
 const radioPage=document.getElementById('anwarRadioPage');
 const lessonsPage=document.getElementById('anwarLessonsPage');
 const adhkarPage=document.getElementById('anwarAdhkarPage');
 const tasbihPage=document.getElementById('anwarTasbihPage');
 if(!panel||!home||!quranPage||!radioPage||!lessonsPage||!adhkarPage||!tasbihPage)return;

 const sectionTitles=Array.from(panel.querySelectorAll('.radio-section-title'));
 const quranTitle=sectionTitles.find(title=>title.textContent.includes('القرآن الكريم'));
 const radioTitle=sectionTitles.find(title=>title.textContent.includes('الإذاعات المباشرة'));
 const liveStation=document.getElementById('liveStationArea');
 const lessonHub=document.getElementById('lessonHub');
 if(!quranTitle||!radioTitle||!liveStation||!lessonHub)return;

 const pages={quran:quranPage,radio:radioPage,lessons:lessonsPage,adhkar:adhkarPage,tasbih:tasbihPage};
 const serviceButtons=Array.from(panel.querySelectorAll('[data-anwar-service]'));
 let lastOpener=null;

 const existingChildren=Array.from(panel.children);
 let insideQuran=false;
 for(const node of existingChildren){
  if(node===quranTitle)insideQuran=true;
  if(node===lessonHub){
   lessonsPage.append(node);
   break;
  }
  if(!insideQuran)continue;
  if(node===liveStation)radioPage.append(node);
  else quranPage.append(node);
 }

 function closeTasbihIfOpen(){
  if(tasbihPage.hidden)return;
  const controller=window.AnwarTasbihController;
  if(controller&&typeof controller.close==='function'){
   try{controller.close()}catch(error){console.warn('تعذر إيقاف السبحة عند مغادرة صفحتها',error)}
  }else{
   const panel=document.getElementById('tasbihPanel');
   if(panel)panel.hidden=true;
  }
 }

 function showHome(restoreFocus){
  closeTasbihIfOpen();
  home.hidden=false;
  Object.values(pages).forEach(page=>{page.hidden=true});
  serviceButtons.forEach(button=>button.setAttribute('aria-pressed','false'));
  const adhanButton=panel.querySelector('[data-anwar-service="adhan"]');
  const prayerSettings=document.querySelector('#anwarPrayerCard .anwar-prayer-settings');
  if(adhanButton)adhanButton.setAttribute('aria-expanded',String(Boolean(prayerSettings&&prayerSettings.open)));
  panel.scrollTo({top:0,behavior:'smooth'});
  if(restoreFocus&&lastOpener)lastOpener.focus({preventScroll:true});
 }

 function openService(name,button){
  if(name==='adhan'){
   const card=document.getElementById('anwarPrayerCard');
   const settings=card&&card.querySelector('.anwar-prayer-settings');
   if(settings)settings.open=true;
   if(button)button.setAttribute('aria-expanded',String(Boolean(settings&&settings.open)));
   if(card)card.scrollIntoView({behavior:'smooth',block:'start'});
   const summary=settings&&settings.querySelector('summary');
   if(summary)summary.focus({preventScroll:true});
   return;
  }
  const page=pages[name];
  if(!page)return;
  if(!tasbihPage.hidden&&name!=='tasbih')closeTasbihIfOpen();
  lastOpener=button||lastOpener;
  home.hidden=true;
  Object.entries(pages).forEach(([key,item])=>{item.hidden=key!==name});
  serviceButtons.forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
  if(name==='adhkar'&&typeof window.AnwarRenderAdhkar==='function'){
   try{window.AnwarRenderAdhkar('morning')}catch(error){console.warn('تعذر عرض أذكار الصباح',error)}
  }
  if(name==='tasbih'){
   const controller=window.AnwarTasbihController;
   if(controller&&typeof controller.open==='function'){
    try{controller.open()}catch(error){console.warn('تعذر فتح السبحة',error)}
   }else{
    const tasbih=document.getElementById('tasbihPanel');
    if(tasbih)tasbih.hidden=false;
   }
  }
  panel.scrollTo({top:0,behavior:'smooth'});
  const back=page.querySelector('[data-anwar-service-back]');
  if(back)back.focus({preventScroll:true});
 }

 serviceButtons.forEach(button=>{
  button.addEventListener('click',()=>openService(button.dataset.anwarService,button));
 });
 panel.querySelectorAll('[data-anwar-service-back]').forEach(button=>{
  button.addEventListener('click',()=>showHome(true));
 });

 // Opening the Tulip launcher always starts from the organized home screen.
 const launcher=document.getElementById('rg');
 if(launcher)launcher.addEventListener('click',()=>showHome(false));
})();
