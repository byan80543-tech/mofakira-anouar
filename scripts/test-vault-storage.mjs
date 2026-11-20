import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../vault-storage.js',import.meta.url),'utf8');

function makeHarness(){
 const records=new Map();
 const localValues=new Map();
 const state={failNextReadback:false,failNextPut:false};
 const localStorage={
  getItem(key){return localValues.has(key)?localValues.get(key):null},
  setItem(key,value){localValues.set(key,String(value))},
  removeItem(key){localValues.delete(key)}
 };
 const database={
  objectStoreNames:{contains(name){return name==='records'&&database.storeReady}},
  storeReady:false,
  createObjectStore(name){assert.equal(name,'records');database.storeReady=true},
  transaction(name,mode){
   assert.equal(name,'records');
   assert.ok(mode==='readonly'||mode==='readwrite');
   const transaction={};
   const objectStore={
    get(key){
     const request={};
     queueMicrotask(()=>{
      request.result=records.has(key)?records.get(key):undefined;
      if(state.failNextReadback){state.failNextReadback=false;request.result='mismatched-readback'}
      if(typeof request.onsuccess==='function')request.onsuccess();
      if(typeof transaction.oncomplete==='function')transaction.oncomplete();
     });
     return request;
    },
    put(value,key){
     const request={};
     queueMicrotask(()=>{
      if(state.failNextPut){
       state.failNextPut=false;
       const error=new Error('simulated IndexedDB write failure');
       request.error=error;
       if(typeof request.onerror==='function')request.onerror();
       if(typeof transaction.onerror==='function')transaction.onerror();
       return;
      }
      records.set(key,value);
      request.result=key;
      if(typeof request.onsuccess==='function')request.onsuccess();
      if(typeof transaction.oncomplete==='function')transaction.oncomplete();
     });
     return request;
    },
    delete(key){
     const request={};
     queueMicrotask(()=>{
      records.delete(key);
      if(typeof request.onsuccess==='function')request.onsuccess();
      if(typeof transaction.oncomplete==='function')transaction.oncomplete();
     });
     return request;
    }
   };
   transaction.objectStore=()=>objectStore;
   return transaction;
  }
 };
 const indexedDB={
  open(name,version){
   assert.equal(name,'anwar-vault-storage');
   assert.equal(version,1);
   const request={};
   queueMicrotask(()=>{
    request.result=database;
    if(!database.storeReady&&typeof request.onupgradeneeded==='function')request.onupgradeneeded();
    if(typeof request.onsuccess==='function')request.onsuccess();
   });
   return request;
  }
 };
 const sandbox={indexedDB,localStorage,console,Promise,Map,Set,Error};
 vm.runInNewContext(source,sandbox,{timeout:3000});
 return {api:sandbox.AnwarVaultStorage,records,localValues,state};
}

const mainKey='anwar_vault_v1',backupKey='anwar_vault_backup_v1';
const legacyPrimary=JSON.stringify({format:'anwar-vault',ciphertext:'encrypted-primary'});
const legacyBackup=JSON.stringify({format:'anwar-vault',ciphertext:'encrypted-backup'});
const h=makeHarness();
h.localValues.set(mainKey,legacyPrimary);
h.localValues.set(backupKey,legacyBackup);

assert.equal(await h.api.get(mainKey),legacyPrimary,'legacy primary envelope is returned unchanged');
assert.equal(h.records.get(mainKey),legacyPrimary,'legacy primary is committed to IndexedDB');
assert.equal(h.localValues.has(mainKey),false,'legacy primary is removed only after IndexedDB read-back verification');

assert.equal(await h.api.get(backupKey),legacyBackup,'legacy backup envelope is returned unchanged');
assert.equal(h.records.get(backupKey),legacyBackup,'legacy backup is committed to IndexedDB');
assert.equal(h.localValues.has(backupKey),false,'legacy backup is removed only after IndexedDB read-back verification');

const updated=JSON.stringify({format:'anwar-vault',ciphertext:'new-primary'});
h.localValues.set(mainKey,legacyPrimary);
await h.api.set(mainKey,updated);
assert.equal(h.records.get(mainKey),updated,'new encrypted primary is committed to IndexedDB');
assert.equal(await h.api.get(mainKey),updated,'new encrypted primary can be read back');
assert.equal(h.localValues.has(mainKey),false,'stale localStorage copy is cleaned after verified write');

await h.api.remove(mainKey);
assert.equal(h.records.has(mainKey),false,'remove deletes the IndexedDB primary');
assert.equal(await h.api.get(mainKey),null,'removed primary is reported as absent');

h.localValues.set(mainKey,legacyPrimary);
h.state.failNextReadback=true;
await assert.rejects(
 ()=>h.api.set(mainKey,updated),
 /لم تتطابق مراجعة التخزين الآمن/,
 'a mismatched IndexedDB read-back rejects the write'
);
assert.equal(h.localValues.get(mainKey),legacyPrimary,'legacy copy is preserved when IndexedDB verification fails');

await assert.rejects(()=>h.api.get('anwar_v1'),/مفتاح خزنة غير معروف/,'unrecognized storage keys are rejected');
console.log('All verified IndexedDB vault storage tests passed.');
