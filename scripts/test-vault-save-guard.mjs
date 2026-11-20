import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html=fs.readFileSync(new URL('../app-core.js',import.meta.url),'utf8');
const start=html.indexOf('async function persistVaultSnapshot(plaintext){');
const end=html.indexOf('function finishVaultOpen(){',start);
assert.ok(start>=0&&end>start,'encrypted persistence function is present');
const source=html.slice(start,end);

function harness(){
 const values=new Map();
 let encryptCalls=0;
 const sandbox={
  vaultUnlocked:true,vaultKey:{key:true},vaultTemplate:{format:'test'},
  VAULT_STORAGE_KEY:'anwar_vault_v1',VAULT_BACKUP_KEY:'anwar_vault_backup_v1',
  AnwarVaultCrypto:{
   async encryptWithKey(key,template,plaintext){encryptCalls++;return {format:'test',plaintext}},
   async decryptWithKey(key,envelope){return envelope.plaintext}
  },
  AnwarVaultStorage:{
   async set(key,value){values.set(key,String(value));return true},
   async get(key){return values.has(key)?values.get(key):null},
   async remove(key){values.delete(key);return true}
  },
  clearLegacyPrivatePreferences(){return true},
  console:{warn(){}},toast(){},
  vaultBackupWarningShown:false,
  Date,JSON,Array,String,Number,Math,Set,Object,Error
 };
 vm.runInNewContext(source+'\nthis.persist=persistVaultSnapshot;',sandbox,{timeout:3000});
 return {sandbox,values,run:sandbox.persist,get encryptCalls(){return encryptCalls}};
}
const valid=harness();
const normal=JSON.stringify({notes:[{id:'one',html:'<div>نص</div>'}],preferences:{tasbih:{customDhikrs:[]}}});
await valid.run(normal);
assert.ok(valid.values.has('anwar_vault_v1'),'valid snapshot writes the encrypted primary');
assert.ok(valid.values.has('anwar_vault_backup_v1'),'valid snapshot writes the encrypted backup');
assert.equal(valid.encryptCalls,2,'valid snapshot encrypts primary and backup');

const tooMany=harness();
await assert.rejects(
 ()=>tooMany.run(JSON.stringify({notes:Array.from({length:2501},(_,i)=>({id:String(i),html:'x'}))})),
 /2500/,
 'snapshot above restore note-count limit is rejected before encryption'
);
assert.equal(tooMany.encryptCalls,0,'too-many-notes rejection happens before any encryption');
assert.equal(tooMany.values.size,0,'too-many-notes rejection writes no storage');

const tooLarge=harness();
await assert.rejects(
 ()=>tooLarge.run(JSON.stringify({notes:[{id:'large',html:'x'.repeat(450001)}]})),
 /450 ألف حرف/,
 'single note above restore size limit is rejected before encryption'
);
assert.equal(tooLarge.encryptCalls,0,'oversized-note rejection happens before encryption');
assert.equal(tooLarge.values.size,0,'oversized-note rejection writes no storage');

console.log('Encrypted save guards match startup restore limits.');
