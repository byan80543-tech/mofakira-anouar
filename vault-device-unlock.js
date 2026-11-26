/* Platform-authenticator quick unlock for Mofakira Anouar.
 * The platform authenticator (Android screen lock / biometrics) protects a
 * PRF-derived key. The vault's existing password-based AES-GCM format is unchanged.
 * No password, PRF output, or derived key is persisted in plaintext.
 */
(function installAnwarDeviceUnlock(root){
 'use strict';
 const STORAGE_KEY='anwar_vault_device_unlock_v1';
 const FORMAT='anwar-device-unlock';
 const VERSION=1;
 const INFO='mofakira-anouar/vault-password-unlock/v1';
 const encoder=new TextEncoder();
 const decoder=new TextDecoder('utf-8',{fatal:true});
 const MAX_CIPHERTEXT=16384;
 const TRUSTED_ORIGIN='https://mofakira-anouar.pages.dev';
 const TRUSTED_HOST='mofakira-anouar.pages.dev';
 const SHARED_GITHUB_HOST_SUFFIX='.github.io';

 function isTrustedOrigin(){
  const location=root.location;
  return !!(root.isSecureContext&&location&&location.protocol==='https:'&&
   String(location.hostname||'').toLowerCase()===TRUSTED_HOST&&
   location.origin===TRUSTED_ORIGIN);
 }
 function isSharedGitHubPagesOrigin(){
  const host=String(root.location&&root.location.hostname||'').toLowerCase();
  return host==='github.io'||host.endsWith(SHARED_GITHUB_HOST_SUFFIX);
 }
 function clearSharedOriginDeviceWrapper(){
  if(!isSharedGitHubPagesOrigin())return;
  try{root.localStorage.removeItem(STORAGE_KEY)}catch(_error){}
 }
 function sharedOriginError(){
  return 'عُطّل الفتح بقفل الهاتف على GitHub Pages لأن مسارات هذا المضيف تشترك في أصل التخزين نفسه. افتح الخزنة بعبارة المرور الأساسية؛ أعمالك ونسختك المشفرة لم تُحذف.';
 }
 function originBlockedError(){
  if(isSharedGitHubPagesOrigin())return sharedOriginError();
  return 'حمايةً للخزنة، لا يُتاح الفتح بالبصمة أو قفل الجهاز إلا على النطاق المستقل المعتمد لمفكرة أنوار: https://mofakira-anouar.pages.dev/';
 }

 // GitHub Pages project paths share one origin. Remove the old wrapped-password
 // record there, because another project on the same host could read it and
 // request the same RP ID. The encrypted vault itself is deliberately untouched.
 clearSharedOriginDeviceWrapper();

 function randomBytes(length){
  if(!root.crypto||typeof root.crypto.getRandomValues!=='function')throw new Error('مولّد الأرقام الآمنة غير متاح في هذا المتصفح.');
  return root.crypto.getRandomValues(new Uint8Array(length));
 }
 function toBase64Url(bytes){
  let binary='';
  for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,Math.min(i+0x8000,bytes.length)));
  return root.btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 }
 function fromBase64Url(value,maxBytes){
  if(typeof value!=='string'||!value||value.length>Math.ceil(maxBytes*4/3)+8||!/^[A-Za-z0-9_-]+$/.test(value))throw new Error('بيانات فتح الهاتف غير صالحة.');
  const base64=value.replace(/-/g,'+').replace(/_/g,'/');
  const binary=root.atob(base64+'='.repeat((4-base64.length%4)%4));
  if(binary.length>maxBytes)throw new Error('بيانات فتح الهاتف تتجاوز الحد الآمن.');
  const out=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);
  return out;
 }
 function supported(){
  return isTrustedOrigin()&&!!(root.crypto&&root.crypto.subtle&&
   root.navigator&&root.navigator.credentials&&typeof root.navigator.credentials.create==='function'&&
   typeof root.navigator.credentials.get==='function'&&root.PublicKeyCredential);
 }
 async function prfSupportStatus(){
  if(!supported())return false;
  const credentialApi=root.PublicKeyCredential;
  if(typeof credentialApi.getClientCapabilities!=='function')return null;
  try{
   const capabilities=await credentialApi.getClientCapabilities();
   if(capabilities&&capabilities.userVerifyingPlatformAuthenticator===false)return false;
   if(capabilities&&Object.prototype.hasOwnProperty.call(capabilities,'extension:prf')){
    return capabilities['extension:prf']===true;
   }
   // An omitted capability is unknown, not proof of support or failure.
   return null;
  }catch(_error){return null}
 }
 function readRecord(){
  if(!isTrustedOrigin()){if(isSharedGitHubPagesOrigin())clearSharedOriginDeviceWrapper();return null}
  let raw;
  try{raw=root.localStorage.getItem(STORAGE_KEY)}catch(error){return null}
  if(!raw)return null;
  try{
   const data=JSON.parse(raw);
   if(!data||typeof data!=='object'||Array.isArray(data)||data.format!==FORMAT||data.version!==VERSION||
      typeof data.rpId!=='string'||typeof data.credentialId!=='string')return null;
   if(data.rpId!==root.location.hostname)return null;
   const credentialId=fromBase64Url(data.credentialId,1024);
   const salt=fromBase64Url(data.salt,32),iv=fromBase64Url(data.iv,12),ciphertext=fromBase64Url(data.ciphertext,MAX_CIPHERTEXT);
   if(!credentialId.length||salt.length!==32||iv.length!==12||ciphertext.length<16)return null;
   return {format:FORMAT,version:VERSION,rpId:data.rpId,credentialId:data.credentialId,credentialIdBytes:credentialId,salt,iv,ciphertext};
  }catch(error){return null}
 }
 async function deriveWrappingKey(prfOutput,salt){
  if(!(prfOutput instanceof ArrayBuffer)&&!ArrayBuffer.isView(prfOutput))throw new Error('لم يقدّم قفل الهاتف مفتاحًا صالحًا.');
  const bytes=prfOutput instanceof ArrayBuffer?new Uint8Array(prfOutput):new Uint8Array(prfOutput.buffer,prfOutput.byteOffset,prfOutput.byteLength);
  if(bytes.length!==32)throw new Error('ميزة الحماية الآمنة غير مكتملة في هذا الجهاز.');
  const material=await root.crypto.subtle.importKey('raw',bytes,'HKDF',false,['deriveKey']);
  return root.crypto.subtle.deriveKey(
   {name:'HKDF',hash:'SHA-256',salt,info:encoder.encode(INFO)},
   material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']
  );
 }
 function aad(rpId,credentialId){
  return encoder.encode([FORMAT,VERSION,rpId,credentialId].join('|'));
 }
 async function requestPrf(credentialId,salt){
  const challenge=randomBytes(32);
  let assertion;
  try{
   assertion=await root.navigator.credentials.get({
    publicKey:{
     challenge,
     rpId:root.location.hostname,
     allowCredentials:[{type:'public-key',id:credentialId}],
     userVerification:'required',
     timeout:60000,
     extensions:{prf:{eval:{first:salt}}}
    }
   });
  }catch(error){
   if(error&&['NotAllowedError','AbortError'].includes(error.name))throw new Error('أُلغي التحقق بقفل الهاتف أو انتهت مهلته. جرّب مجددًا أو استخدم كلمة المرور الأساسية.');
   if(error&&error.name==='NotSupportedError')throw new Error('لا يدعم هذا المتصفح طريقة فتح الهاتف المطلوبة. استخدم كلمة المرور الأساسية.');
   throw new Error('تعذّر إكمال تحقق الهاتف. يمكنك فتح الخزنة بكلمة المرور الأساسية.');
  }
  if(!assertion)throw new Error('لم تكتمل مصادقة الهاتف. استخدم كلمة المرور الأساسية.');
  const output=assertion.getClientExtensionResults?.().prf?.results?.first;
  if(!output)throw new Error('لم يدعم قفل الهاتف اشتقاق مفتاح الحماية. استخدم كلمة المرور الأساسية.');
  return output;
 }
 async function protectPassword(password){
  if(!isTrustedOrigin())throw new Error(originBlockedError());
  if(!supported())throw new Error('الفتح بقفل الهاتف يحتاج HTTPS ومتصفحًا يدعم اعتماد الجهاز.');
  if(typeof password!=='string'||Array.from(password).length<12||password.length>2048)throw new Error('كلمة المرور الأساسية غير صالحة.');
  const rpId=root.location.hostname;
  const challenge=randomBytes(32),userId=randomBytes(16),salt=randomBytes(32);
  let credential;
  try{
   credential=await root.navigator.credentials.create({
    publicKey:{
     challenge,
     rp:{id:rpId,name:'مفكرة أنوار'},
     user:{id:userId,name:'mofakira-anouar-local',displayName:'مفكرة أنوار على هذا الجهاز'},
     pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],
     authenticatorSelection:{
      authenticatorAttachment:'platform',
      // The credential ID is stored locally and supplied in allowCredentials.
      // A discoverable credential is therefore helpful but not required.
      residentKey:'preferred',
      userVerification:'required'
     },
     timeout:60000,
     attestation:'none',
     extensions:{prf:{}}
    }
   });
  }catch(error){
   if(error&&['NotAllowedError','AbortError'].includes(error.name))throw new Error('أُلغي إعداد قفل الهاتف. لم تتغير كلمة المرور أو بيانات الخزنة.');
   if(error&&error.name==='NotSupportedError')throw new Error('لا يدعم هذا الهاتف أو المتصفح اعتمادًا آمنًا متوافقًا. ستبقى كلمة المرور الأساسية متاحة.');
   throw new Error('تعذّر إعداد اعتماد الهاتف. لم تتغير بيانات الخزنة.');
  }
  if(!credential)throw new Error('لم يكتمل إعداد قفل الهاتف.');
  const prfResult=credential.getClientExtensionResults?.().prf;
  if(!prfResult||prfResult.enabled!==true)throw new Error('أنشأ مدير كلمات المرور اعتمادًا للهاتف، لكنه لم يثبت دعمه لاشتقاق مفتاح PRF اللازم لحماية الخزنة. لم يُربط الاعتماد بالخزنة، وبقيت كلمة المرور الأساسية كما هي. قد تحتاج إلى إزالة اعتماد «مفكرة أنوار» غير المستخدم من مدير كلمات المرور.');
  const credentialId=toBase64Url(new Uint8Array(credential.rawId));
  const credentialIdBytes=new Uint8Array(credential.rawId);
  if(!credentialIdBytes.length)throw new Error('لم يُرجع الهاتف معرّف اعتماد صالحًا.');
  // Some authenticators enable PRF for the new credential but do not return an
  // evaluation during create(). Obtain the first output from a verified assertion.
  const prfOutput=await requestPrf(credentialIdBytes,salt);
  const wrappingKey=await deriveWrappingKey(prfOutput,salt);
  const iv=randomBytes(12);
  const encrypted=await root.crypto.subtle.encrypt(
   {name:'AES-GCM',iv,additionalData:aad(rpId,credentialId),tagLength:128},
   wrappingKey,encoder.encode(password)
  );
  const record={
   format:FORMAT,version:VERSION,rpId,credentialId,
   salt:toBase64Url(salt),iv:toBase64Url(iv),
   ciphertext:toBase64Url(new Uint8Array(encrypted))
  };
  root.localStorage.setItem(STORAGE_KEY,JSON.stringify(record));
  return true;
 }
 async function unlockPassword(){
  if(!isTrustedOrigin())throw new Error(originBlockedError());
  const record=readRecord();
  if(!record)throw new Error('لم يُعثر على إعداد صالح لفتح الهاتف على هذا النطاق. استخدم كلمة المرور الأساسية.');
  if(!supported())throw new Error('الفتح بقفل الهاتف غير متاح هنا. استخدم كلمة المرور الأساسية.');
  const prfOutput=await requestPrf(record.credentialIdBytes,record.salt);
  const wrappingKey=await deriveWrappingKey(prfOutput,record.salt);
  try{
   const plaintext=await root.crypto.subtle.decrypt(
    {name:'AES-GCM',iv:record.iv,additionalData:aad(record.rpId,record.credentialId),tagLength:128},
    wrappingKey,record.ciphertext
   );
   const password=decoder.decode(plaintext);
   if(Array.from(password).length<12)throw new Error('بيانات فتح الهاتف غير صالحة.');
   return password;
  }catch(error){
   throw new Error('لم يفتح اعتماد الهاتف الخزنة. استخدم كلمة المرور الأساسية للتحقق أو الاسترداد.');
  }
 }
 function isConfigured(){
  if(!isTrustedOrigin()){if(isSharedGitHubPagesOrigin())clearSharedOriginDeviceWrapper();return false}
  return !!readRecord();
 }
 function disable(){
  try{root.localStorage.removeItem(STORAGE_KEY);return true}
  catch(error){throw new Error('تعذّر إيقاف فتح الهاتف في التخزين المحلي.')}
 }
 root.AnwarDeviceUnlock=Object.freeze({
  storageKey:STORAGE_KEY,
  isSharedGitHubPagesOrigin,
  isTrustedOrigin,
  supported,
  prfSupportStatus,
  isConfigured,
  protectPassword,
  unlockPassword,
  disable
 });
})(globalThis);
