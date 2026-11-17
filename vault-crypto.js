/* Client-side notebook encryption. No password or key is persisted. */
(function installAnwarVaultCrypto(root){
 'use strict';
 const FORMAT='anwar-vault';
 const VERSION=1;
 const KDF='PBKDF2-HMAC-SHA-256';
 const CIPHER='AES-256-GCM';
 const ITERATIONS=600000;
 const MAX_CIPHERTEXT_BYTES=8*1024*1024;
 const encoder=new TextEncoder();
 const decoder=new TextDecoder('utf-8',{fatal:true});

 function bytesToBase64(bytes){
  let binary='';
  for(let offset=0;offset<bytes.length;offset+=0x8000){
   binary+=String.fromCharCode(...bytes.subarray(offset,Math.min(offset+0x8000,bytes.length)));
  }
  return btoa(binary);
 }
 function base64ToBytes(value,maxBytes){
  if(typeof value!=='string'||!value||value.length>Math.ceil(maxBytes*4/3)+8||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)){
   throw new Error('بيانات التشفير غير صالحة.');
  }
  const binary=atob(value);
  if(binary.length>maxBytes)throw new Error('حجم ملف التشفير يتجاوز الحد الآمن.');
  const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  return bytes;
 }
 function requireCrypto(){
  if(!root.crypto||!root.crypto.subtle||typeof root.crypto.getRandomValues!=='function'){
   throw new Error('التشفير غير متاح في هذا المتصفح. افتح المفكرة عبر اتصال HTTPS وحدّث المتصفح.');
  }
 }
 function validatePassword(password){
  if(typeof password!=='string'||Array.from(password).length<12)throw new Error('استخدم عبارة مرور من 12 محرفًا على الأقل.');
 }
 function metadata(envelope){
  if(!envelope||typeof envelope!=='object'||Array.isArray(envelope)||
     envelope.format!==FORMAT||envelope.version!==VERSION||
     envelope.kdf!==KDF||envelope.cipher!==CIPHER||
     envelope.iterations!==ITERATIONS){
   throw new Error('صيغة الخزنة غير مدعومة أو بياناتها غير مكتملة.');
  }
  const salt=base64ToBytes(envelope.salt,16);
  if(salt.length!==16)throw new Error('ملح التشفير غير صالح.');
  return {
   format:FORMAT,version:VERSION,kdf:KDF,cipher:CIPHER,iterations:ITERATIONS,
   salt:envelope.salt,saltBytes:salt
  };
 }
 function validateEnvelope(envelope){
  const meta=metadata(envelope);
  const iv=base64ToBytes(envelope.iv,12);
  if(iv.length!==12)throw new Error('متجه التهيئة غير صالح.');
  const ciphertext=base64ToBytes(envelope.ciphertext,MAX_CIPHERTEXT_BYTES);
  if(ciphertext.length<16)throw new Error('النص المشفر أقصر من المتوقع.');
  return {...meta,iv,ciphertext};
 }
 function aadFor(meta){
  return encoder.encode([meta.format,meta.version,meta.kdf,meta.cipher,meta.iterations,meta.salt].join('|'));
 }
 async function deriveKey(password,salt,iterations){
  requireCrypto();
  validatePassword(password);
  const material=await root.crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveKey']);
  return root.crypto.subtle.deriveKey(
   {name:'PBKDF2',salt,iterations,hash:'SHA-256'},
   material,
   {name:'AES-GCM',length:256},
   false,
   ['encrypt','decrypt']
  );
 }
 async function encryptWithKey(key,template,plaintext){
  requireCrypto();
  if(typeof plaintext!=='string')throw new Error('محتوى الخزنة غير صالح.');
  const meta=metadata(template);
  const iv=root.crypto.getRandomValues(new Uint8Array(12));
  const encrypted=await root.crypto.subtle.encrypt(
   {name:'AES-GCM',iv,additionalData:aadFor(meta),tagLength:128},
   key,
   encoder.encode(plaintext)
  );
  return {
   format:FORMAT,version:VERSION,kdf:KDF,iterations:ITERATIONS,cipher:CIPHER,
   salt:meta.salt,iv:bytesToBase64(iv),ciphertext:bytesToBase64(new Uint8Array(encrypted))
  };
 }
 async function decryptWithKey(key,envelope){
  requireCrypto();
  const env=validateEnvelope(envelope);
  try{
   const decrypted=await root.crypto.subtle.decrypt(
    {name:'AES-GCM',iv:env.iv,additionalData:aadFor(env),tagLength:128},
    key,
    env.ciphertext
   );
   return decoder.decode(decrypted);
  }catch(error){
   throw new Error('تعذّر فك التشفير: قد تكون البيانات تعرضت للتلف.');
  }
 }
 async function createVault(password,plaintext){
  validatePassword(password);
  requireCrypto();
  const salt=root.crypto.getRandomValues(new Uint8Array(16));
  const meta={format:FORMAT,version:VERSION,kdf:KDF,cipher:CIPHER,iterations:ITERATIONS,salt:bytesToBase64(salt),saltBytes:salt};
  const key=await deriveKey(password,salt,ITERATIONS);
  const envelope=await encryptWithKey(key,meta,plaintext);
  return {key,envelope};
 }
 async function decryptEnvelope(password,envelope){
  const env=validateEnvelope(envelope);
  const key=await deriveKey(password,env.saltBytes,env.iterations);
  let plaintext;
  try{
   plaintext=await decryptWithKey(key,envelope);
  }catch(error){
   throw new Error('كلمة المرور غير صحيحة أو أن ملف الخزنة تالف.');
  }
  return {key,plaintext,envelope};
 }
 root.AnwarVaultCrypto=Object.freeze({
  format:FORMAT,version:VERSION,kdf:KDF,cipher:CIPHER,iterations:ITERATIONS,
  validateEnvelope,createVault,encryptWithKey,decryptWithKey,decryptEnvelope
 });
})(globalThis);
