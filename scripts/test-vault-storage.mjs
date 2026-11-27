import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../vault-storage.js',import.meta.url),'utf8');

function makeHarness({supportsIndexedDB=true}={}){
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
 const sandbox={...(supportsIndexedDB?{indexedDB}:{}),localStorage,console,Promise,Map,Set,Error};
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
assert.equal(h.localValues.get(mainKey),legacyPrimary,'legacy primary remains as an encrypted recovery mirror after IndexedDB verification');

assert.equal(await h.api.get(backupKey),legacyBackup,'legacy backup envelope is returned unchanged');
assert.equal(h.records.get(backupKey),legacyBackup,'legacy backup is committed to IndexedDB');
assert.equal(h.localValues.get(backupKey),legacyBackup,'legacy backup remains as an encrypted recovery mirror after IndexedDB verification');

const updated=JSON.stringify({format:'anwar-vault',ciphertext:'new-primary'});
h.localValues.set(mainKey,legacyPrimary);
await h.api.set(mainKey,updated);
assert.equal(h.records.get(mainKey),updated,'new encrypted primary is committed to IndexedDB');
assert.equal(await h.api.get(mainKey),updated,'new encrypted primary can be read back');
assert.equal(h.localValues.get(mainKey),updated,'the local recovery mirror matches the latest verified encrypted write');

await h.api.remove(mainKey);
assert.equal(h.records.has(mainKey),false,'remove deletes the IndexedDB primary');
assert.equal(await h.api.get(mainKey),null,'removed primary is reported as absent');
assert.equal(h.localValues.has(mainKey),false,'verified removal clears the encrypted local mirror before removing the IndexedDB record');

h.localValues.set(mainKey,legacyPrimary);
h.state.failNextReadback=true;
assert.equal(
 await h.api.set(mainKey,updated),
 true,
 'a verified encrypted local mirror keeps the save available when IndexedDB read-back fails'
);
assert.equal(h.localValues.get(mainKey),updated,'the locally verified encrypted mirror remains recoverable when IndexedDB verification fails');

const damagedRecord=makeHarness();
damagedRecord.records.set(mainKey,{unexpected:'non-string'});
damagedRecord.localValues.set(mainKey,legacyPrimary);
await assert.rejects(
 ()=>damagedRecord.api.get(mainKey),
 /ليس نصًا صالحًا/,
 'non-string IndexedDB records are rejected'
);
assert.equal(damagedRecord.localValues.get(mainKey),legacyPrimary,'a recoverable legacy copy is retained when the IndexedDB record has the wrong type');

const differingRecord=makeHarness();
const damagedEnvelope=JSON.stringify({format:'anwar-vault',ciphertext:'damaged-idb-value'});
differingRecord.records.set(mainKey,damagedEnvelope);
differingRecord.localValues.set(mainKey,legacyPrimary);
assert.equal(await differingRecord.api.get(mainKey),damagedEnvelope,'a string IndexedDB record remains the primary read result');
assert.equal(differingRecord.localValues.get(mainKey),legacyPrimary,'a differing legacy envelope is preserved until the IndexedDB record is independently trusted');


const fallback=makeHarness({supportsIndexedDB:false});
fallback.localValues.set(mainKey,legacyPrimary);
assert.equal(await fallback.api.get(mainKey),legacyPrimary,'an encrypted local mirror opens the vault when IndexedDB is unavailable');
const fallbackUpdated=JSON.stringify({format:'anwar-vault',ciphertext:'fallback-updated'});
await fallback.api.set(mainKey,fallbackUpdated);
assert.equal(fallback.localValues.get(mainKey),fallbackUpdated,'encrypted local fallback is updated and read-back verified without IndexedDB');
assert.equal(fallback.records.size,0,'the fallback path does not pretend IndexedDB writes succeeded');

const firstRunFallback=makeHarness({supportsIndexedDB:false});
assert.equal(await firstRunFallback.api.get(mainKey),null,'a first launch can detect an absent encrypted record in local fallback mode');
await firstRunFallback.api.set(mainKey,legacyPrimary);
assert.equal(firstRunFallback.localValues.get(mainKey),legacyPrimary,'a new encrypted vault can be stored through the verified local fallback');
await assert.rejects(()=>firstRunFallback.api.remove(mainKey),/IndexedDB غير متاح/,'vault deletion is not claimed while the primary database cannot be reached');
assert.equal(firstRunFallback.localValues.get(mainKey),legacyPrimary,'failed deletion preserves the only encrypted fallback copy');

await assert.rejects(()=>h.api.get('anwar_v1'),/مفتاح خزنة غير معروف/,'unrecognized storage keys are rejected');
console.log('All verified IndexedDB vault storage tests passed.');
