import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const app=fs.readFileSync(new URL('../app-core.js',import.meta.url),'utf8');
const start=app.indexOf('async function submitVaultForm(event,suppliedPassword){');
const end=app.indexOf('function beginVaultDisableEncryption(){',start);
assert.ok(start>=0&&end>start,'vault unlock function is present');
const source=app.slice(start,end);

const validState=JSON.stringify({
 notes:[{id:'backup-note',title:'نسخة سليمة',html:'<div>محتوى النسخة الاحتياطية</div>'}],
 theme:'',palette:'blue',wallColor:'mist',paperColor:'white',days:[],
 preferences:{radio:{reciter:'',surah:1},readerAdvance:'c',tasbih:{count:0,dhikr:'أستغفر الله',customDhikrs:[],removedOfficialDhikrs:[]}}
});

function harness({primary='{"id":"primary"}',backup='{"id":"backup"}',invalidPrimary='json',failRepair=false}={}){
 const records=new Map([
  ['anwar_vault_v1',primary],
  ['anwar_vault_backup_v1',backup]
 ]);
 const elements={
  vaultPassword:{value:'Correct horse battery staple',disabled:false},
  vaultPasswordConfirm:{value:'',disabled:false},
  vaultSubmit:{disabled:false},
  vaultError:{textContent:''}
 };
 const calls={finished:false,toasts:[],decryptAttempts:[],repairs:[]};
 const sandbox={
  VAULT_STORAGE_KEY:'anwar_vault_v1',
  VAULT_BACKUP_KEY:'anwar_vault_backup_v1',
  VAULT_MODE_KEY:'anwar_vault_mode_v1',
  vaultGateMode:'unlock',
  vaultUnlocked:false,
  vaultReady:false,
  vaultDisableAfterUnlock:false,
  vaultKey:null,
  vaultTemplate:null,
  vaultBackupWarningShown:false,
  vaultLegacyCleanupWarningShown:false,
  S:{notes:[],theme:'',palette:'blue',wallColor:'mist',paperColor:'white',days:[],preferences:{}},
  AnwarVaultStorage:{
   async get(key){return records.has(key)?records.get(key):null},
   async set(key,value){
    calls.repairs.push(key);
    if(failRepair&&key==='anwar_vault_v1')throw new Error('simulated primary repair failure');
    records.set(key,String(value));return true;
   },
   async remove(key){records.delete(key);return true}
  },
  AnwarVaultCrypto:{
   async decryptEnvelope(password,envelope){
    calls.decryptAttempts.push(envelope.id);
    if(password!=='Correct horse battery staple')throw new Error('wrong password');
    if(envelope.id==='primary-json-broken')return {key:{id:'primary'},plaintext:'{broken'};
    if(envelope.id==='primary-state-broken')return {key:{id:'primary'},plaintext:JSON.stringify({notes:'not-an-array'})};
    if(envelope.id==='backup')return {key:{id:'backup'},plaintext:validState};
    throw new Error('invalid envelope');
   },
   async decryptWithKey(key,envelope){return envelope&&envelope.payload}
  },
  readStoredState(raw){
   const parsed=JSON.parse(raw);
   if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||!Array.isArray(parsed.notes))throw new Error('invalid stored state');
   return parsed;
  },
  hasOwn:(object,key)=>Object.prototype.hasOwnProperty.call(object,key),
  clearLegacyPlaintext(){return true},
  clearLegacyPrivatePreferences(){return true},
  importLegacyPrivatePreferences(value){return value},
  async persistPlainSnapshot(){return true},
  finishVaultOpen(){calls.finished=true;sandbox.vaultReady=true},
  toast(message){calls.toasts.push(String(message))},
  console:{warn(){}},
  $:id=>elements[id]||(elements[id]={value:'',disabled:false,hidden:false,textContent:'',setAttribute(){}})
 };
 vm.runInNewContext(source+'\nthis.run=submitVaultForm;',sandbox,{timeout:3000});
 return {run:sandbox.run,sandbox,records,elements,calls};
}

for(const type of ['primary-json-broken','primary-state-broken']){
 const primary=JSON.stringify({id:type});
 const h=harness({primary});
 await h.run({preventDefault(){}});
 assert.equal(h.calls.finished,true,type+' primary failure falls through to valid backup');
 assert.equal(h.sandbox.vaultUnlocked,true,type+' backup recovery unlocks the vault');
 assert.deepEqual(h.calls.decryptAttempts,[type,'backup'],type+' checks primary and then backup independently');
 assert.equal(h.records.get('anwar_vault_v1'),h.records.get('anwar_vault_backup_v1'),type+' verified backup repairs the primary envelope');
 assert.equal(h.sandbox.vaultTemplate.id,'backup',type+' keeps the recovered backup as the active template');
}

const repairFailure=harness({primary:JSON.stringify({id:'primary-state-broken'}),failRepair:true});
await repairFailure.run({preventDefault(){}});
assert.equal(repairFailure.calls.finished,true,'verified backup opens even when primary repair fails');
assert.equal(repairFailure.sandbox.vaultUnlocked,true,'repair failure leaves verified backup available in memory');
assert.ok(repairFailure.calls.toasts.some(message=>message.includes('تعذّر إصلاح السجل الأساسي')),'primary repair failure is clearly reported');

const bothInvalid=harness({
 primary:JSON.stringify({id:'primary-json-broken'}),
 backup:JSON.stringify({id:'invalid-backup'})
});
await bothInvalid.run({preventDefault(){}});
assert.equal(bothInvalid.calls.finished,false,'vault stays closed when both records fail full validation');
assert.equal(bothInvalid.sandbox.vaultUnlocked,false,'invalid primary and backup never unlock the vault');
assert.ok(bothInvalid.elements.vaultError.textContent.includes('تعذّر التحقق'),'failed recovery gives a safe explanatory error');

console.log('All encrypted vault backup fallback and recovery tests passed.');
