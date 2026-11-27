/* Verified encrypted vault storage.
 * IndexedDB is the preferred database; encrypted envelopes are mirrored to
 * localStorage so the notebook can continue when IndexedDB is unavailable.
 * This module never receives or writes plaintext notebook content.
 */
(function installAnwarVaultStorage(root){
 'use strict';
 const DB_NAME='anwar-vault-storage';
 const DB_VERSION=1;
 const STORE_NAME='records';
 let databasePromise=null;

 function assertKey(key){
  if(key!=='anwar_vault_v1'&&key!=='anwar_vault_backup_v1')throw new Error('مفتاح خزنة غير معروف.');
 }
 function readLocal(key){
  try{return {ok:true,value:root.localStorage.getItem(key)}}
  catch(error){return {ok:false,error}}
 }
 function writeLocal(key,value){
  try{
   root.localStorage.setItem(key,value);
   return root.localStorage.getItem(key)===value;
  }catch(error){return false}
 }
 function removeLocal(key){
  try{
   root.localStorage.removeItem(key);
   return root.localStorage.getItem(key)===null;
  }catch(error){return false}
 }
 function warn(message,error){
  if(root.console&&typeof root.console.warn==='function')root.console.warn(message,error||'');
 }

 function openDatabase(){
  if(databasePromise)return databasePromise;
  databasePromise=new Promise((resolve,reject)=>{
   if(!root.indexedDB){
    reject(new Error('IndexedDB غير متاح؛ سيُستخدم مخزن النسخ المشفرة الاحتياطي عند توفره.'));
    return;
   }
   let request;
   try{request=root.indexedDB.open(DB_NAME,DB_VERSION)}
   catch(error){reject(new Error('تعذّر فتح مخزن IndexedDB.'));return}
   request.onupgradeneeded=()=>{
    const db=request.result;
    if(!db.objectStoreNames.contains(STORE_NAME))db.createObjectStore(STORE_NAME);
   };
   request.onsuccess=()=>resolve(request.result);
   request.onerror=()=>reject(new Error('تعذّر فتح مخزن IndexedDB.'));
   request.onblocked=()=>reject(new Error('تحديث مخزن IndexedDB ينتظر إغلاق نسخة أخرى مفتوحة من المفكرة.'));
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
    request.onerror=()=>reject(new Error('تعذّرت قراءة سجل الخزنة من IndexedDB.'));
    transaction.oncomplete=()=>resolve(value);
    transaction.onerror=()=>reject(new Error('تعذّرت قراءة سجل الخزنة من IndexedDB.'));
    transaction.onabort=()=>reject(new Error('أُلغيت قراءة سجل الخزنة من IndexedDB.'));
   }catch(error){reject(new Error('تعذّرت قراءة سجل الخزنة من IndexedDB.'))}
  });
 }

 async function writeDatabase(key,value){
  const db=await openDatabase();
  await new Promise((resolve,reject)=>{
   let transaction;
   try{
    transaction=db.transaction(STORE_NAME,'readwrite');
    const request=transaction.objectStore(STORE_NAME).put(value,key);
    request.onerror=()=>reject(new Error('تعذّر حفظ سجل الخزنة في IndexedDB.'));
    transaction.oncomplete=resolve;
    transaction.onerror=()=>reject(new Error('تعذّر حفظ سجل الخزنة في IndexedDB.'));
    transaction.onabort=()=>reject(new Error('أُلغيت كتابة سجل الخزنة في IndexedDB.'));
   }catch(error){reject(new Error('تعذّر حفظ سجل الخزنة في IndexedDB.'))}
  });
  const verified=await readDatabase(key);
  if(verified!==value)throw new Error('لم تتطابق مراجعة IndexedDB مع السجل المكتوب.');
 }

 async function deleteDatabase(key){
  const db=await openDatabase();
  await new Promise((resolve,reject)=>{
   let transaction;
   try{
    transaction=db.transaction(STORE_NAME,'readwrite');
    const request=transaction.objectStore(STORE_NAME).delete(key);
    request.onerror=()=>reject(new Error('تعذّر حذف سجل الخزنة من IndexedDB.'));
    transaction.oncomplete=resolve;
    transaction.onerror=()=>reject(new Error('تعذّر حذف سجل الخزنة من IndexedDB.'));
    transaction.onabort=()=>reject(new Error('أُلغيت عملية حذف سجل الخزنة.'));
   }catch(error){reject(new Error('تعذّر حذف سجل الخزنة من IndexedDB.'))}
  });
  if(await readDatabase(key)!==null)throw new Error('لم يكتمل التحقق من حذف سجل الخزنة.');
 }

 async function get(key){
  assertKey(key);
  let existing;
  try{existing=await readDatabase(key)}
  catch(databaseError){
   const fallback=readLocal(key);
   if(fallback.ok&&typeof fallback.value==='string')return fallback.value;
   throw databaseError;
  }
  if(existing!==null){
   if(typeof existing!=='string')throw new Error('سجل الخزنة المخزن ليس نصًا صالحًا.');
   const mirror=readLocal(key);
   if(!mirror.ok||mirror.value===null)writeLocal(key,existing);
   else if(mirror.value!==existing)warn('احتُفظ بالنسخة المحلية المختلفة كنسخة استرداد؛ سجل IndexedDB هو النسخة الأساسية.');
   return existing;
  }
  const legacy=readLocal(key);
  if(!legacy.ok)throw new Error('تعذّرت قراءة نسخة الخزنة المحلية الاحتياطية.');
  if(legacy.value===null)return null;
  if(typeof legacy.value!=='string')throw new Error('سجل الخزنة المحلي غير صالح.');
  try{await writeDatabase(key,legacy.value)}
  catch(error){
   warn('تعذّر ترحيل النسخة المشفرة إلى IndexedDB؛ استُخدمت النسخة المشفرة المحلية بعد قراءتها.',error);
   return legacy.value;
  }
  // Keep the verified local copy as a recovery mirror; it contains ciphertext only.
  return legacy.value;
 }

 async function set(key,value){
  assertKey(key);
  if(typeof value!=='string'||!value)throw new Error('قيمة سجل الخزنة غير صالحة.');
  // Write and read back the encrypted mirror first. This leaves a recoverable
  // copy if IndexedDB is blocked or becomes unavailable during this save.
  const mirrorVerified=writeLocal(key,value);
  try{
   await writeDatabase(key,value);
   return true;
  }catch(error){
   if(mirrorVerified){
    warn('حُفظت النسخة المشفرة والتحقق منها في التخزين المحلي الاحتياطي؛ تعذّر تحديث IndexedDB.',error);
    return true;
   }
   throw error;
  }
 }

 async function remove(key){
  assertKey(key);
  // Do not delete the only fallback copy when IndexedDB itself is unavailable.
  await openDatabase();
  if(!removeLocal(key))throw new Error('تعذّر التحقق من إزالة النسخة المحلية الاحتياطية؛ لم نحذف سجل IndexedDB.');
  await deleteDatabase(key);
  return true;
 }

 root.AnwarVaultStorage=Object.freeze({get,set,remove});
})(globalThis);
