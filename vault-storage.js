/* Verified IndexedDB storage for encrypted vault envelopes.
 * Legacy localStorage envelopes are copied, read back, and only then removed.
 * No plaintext notebook content is written by this module.
 */
(function installAnwarVaultStorage(root){
 'use strict';
 const DB_NAME='anwar-vault-storage';
 const DB_VERSION=1;
 const STORE_NAME='records';
 let databasePromise=null;

 function openDatabase(){
  if(databasePromise)return databasePromise;
  databasePromise=new Promise((resolve,reject)=>{
   if(!root.indexedDB){
    reject(new Error('التخزين الآمن غير متاح في هذا المتصفح. لم نغيّر أي بيانات؛ افتح المفكرة في متصفح يدعم IndexedDB.'));
    return;
   }
   let request;
   try{request=root.indexedDB.open(DB_NAME,DB_VERSION)}
   catch(error){reject(new Error('تعذّر فتح مخزن المفكرة الآمن. لم نغيّر أي بيانات.'));return}
   request.onupgradeneeded=()=>{
    const db=request.result;
    if(!db.objectStoreNames.contains(STORE_NAME))db.createObjectStore(STORE_NAME);
   };
   request.onsuccess=()=>resolve(request.result);
   request.onerror=()=>reject(new Error('تعذّر فتح مخزن المفكرة الآمن. لم نغيّر أي بيانات.'));
   request.onblocked=()=>reject(new Error('تحديث مخزن المفكرة ينتظر إغلاق نسخة أخرى مفتوحة من المفكرة.'));
  }).catch(error=>{
   databasePromise=null;
   throw error;
  });
  return databasePromise;
 }

 async function readDatabase(key){
  const db=await openDatabase();
  return new Promise((resolve,reject)=>{
   let value=null;
   let transaction;
   try{
    transaction=db.transaction(STORE_NAME,'readonly');
    const request=transaction.objectStore(STORE_NAME).get(key);
    request.onsuccess=()=>{value=request.result===undefined?null:request.result};
    request.onerror=()=>reject(new Error('تعذّرت قراءة سجل الخزنة من التخزين الآمن.'));
    transaction.oncomplete=()=>resolve(value);
    transaction.onerror=()=>reject(new Error('تعذّرت قراءة سجل الخزنة من التخزين الآمن.'));
    transaction.onabort=()=>reject(new Error('أُلغيت قراءة سجل الخزنة من التخزين الآمن.'));
   }catch(error){reject(new Error('تعذّرت قراءة سجل الخزنة من التخزين الآمن.'))}
  });
 }

 async function writeDatabase(key,value){
  const db=await openDatabase();
  await new Promise((resolve,reject)=>{
   let transaction;
   try{
    transaction=db.transaction(STORE_NAME,'readwrite');
    const request=transaction.objectStore(STORE_NAME).put(value,key);
    request.onerror=()=>reject(new Error('تعذّر حفظ سجل الخزنة في التخزين الآمن.'));
    transaction.oncomplete=resolve;
    transaction.onerror=()=>reject(new Error('تعذّر حفظ سجل الخزنة في التخزين الآمن.'));
    transaction.onabort=()=>reject(new Error('أُلغيت كتابة سجل الخزنة في التخزين الآمن.'));
   }catch(error){reject(new Error('تعذّر حفظ سجل الخزنة في التخزين الآمن.'))}
  });
  const verified=await readDatabase(key);
  if(verified!==value)throw new Error('لم تتطابق مراجعة التخزين الآمن مع السجل المكتوب.');
 }

 async function deleteDatabase(key){
  const db=await openDatabase();
  await new Promise((resolve,reject)=>{
   let transaction;
   try{
    transaction=db.transaction(STORE_NAME,'readwrite');
    const request=transaction.objectStore(STORE_NAME).delete(key);
    request.onerror=()=>reject(new Error('تعذّر حذف سجل الخزنة من التخزين الآمن.'));
    transaction.oncomplete=resolve;
    transaction.onerror=()=>reject(new Error('تعذّر حذف سجل الخزنة من التخزين الآمن.'));
    transaction.onabort=()=>reject(new Error('أُلغيت عملية حذف سجل الخزنة.'));
   }catch(error){reject(new Error('تعذّر حذف سجل الخزنة من التخزين الآمن.'))}
  });
  if(await readDatabase(key)!==null)throw new Error('لم يكتمل التحقق من حذف سجل الخزنة.');
 }

 function removeLegacyCopy(key){
  try{
   const legacy=root.localStorage.getItem(key);
   if(legacy===null)return true;
   root.localStorage.removeItem(key);
   return root.localStorage.getItem(key)===null;
  }catch(error){
   if(root.console&&typeof root.console.warn==='function')root.console.warn('بقيت نسخة مشفرة قديمة في localStorage بعد ترحيلها إلى التخزين الآمن.',error);
   return false;
  }
 }

 async function get(key){
  if(key!=='anwar_vault_v1'&&key!=='anwar_vault_backup_v1')throw new Error('مفتاح خزنة غير معروف.');
  const existing=await readDatabase(key);
  if(existing!==null){
   removeLegacyCopy(key);
   if(typeof existing!=='string')throw new Error('سجل الخزنة المخزن ليس نصًا صالحًا.');
   return existing;
  }
  let legacy=null;
  try{legacy=root.localStorage.getItem(key)}
  catch(error){throw new Error('تعذّرت قراءة النسخة القديمة من الخزنة. لم نحذف أي بيانات.')}
  if(legacy===null)return null;
  if(typeof legacy!=='string')throw new Error('سجل الخزنة القديم غير صالح.');
  await writeDatabase(key,legacy);
  // Keep the original until IndexedDB has committed and read-back matched exactly.
  if(!removeLegacyCopy(key)){
   if(root.console&&typeof root.console.warn==='function')root.console.warn('تم ترحيل الخزنة والتحقق منها، لكن بقيت نسختها المشفرة القديمة في localStorage.');
  }
  return legacy;
 }

 async function set(key,value){
  if(key!=='anwar_vault_v1'&&key!=='anwar_vault_backup_v1')throw new Error('مفتاح خزنة غير معروف.');
  if(typeof value!=='string'||!value)throw new Error('قيمة سجل الخزنة غير صالحة.');
  await writeDatabase(key,value);
  // The IndexedDB copy is committed and verified before the old copy is removed.
  if(!removeLegacyCopy(key)&&root.console&&typeof root.console.warn==='function'){
   root.console.warn('تم حفظ الخزنة في التخزين الآمن، لكن تعذّر تنظيف النسخة المشفرة القديمة من localStorage.');
  }
  return true;
 }

 async function remove(key){
  if(key!=='anwar_vault_v1'&&key!=='anwar_vault_backup_v1')throw new Error('مفتاح خزنة غير معروف.');
  await deleteDatabase(key);
  try{
   root.localStorage.removeItem(key);
   if(root.localStorage.getItem(key)!==null)throw new Error('legacy copy remains');
  }catch(error){
   throw new Error('حُذف سجل الخزنة من التخزين الآمن، لكن بقيت نسخة مشفرة قديمة في التخزين المحلي.');
  }
  return true;
 }

 root.AnwarVaultStorage=Object.freeze({get,set,remove});
})(globalThis);
