import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

const root=new URL('..',import.meta.url);
const html=fs.readFileSync(new URL('../app-core.js',import.meta.url),'utf8');
const cryptoSource=fs.readFileSync(new URL('../vault-crypto.js',import.meta.url),'utf8');
const extract=(start,end)=>{
  const a=html.indexOf(start),b=html.indexOf(end,a);
  assert.ok(a>=0&&b>a,'source block exists: '+start);
  return html.slice(a,b);
};
const preferenceSource=extract('/* Encrypted private settings shared by the notebook modules. */','requestAnimationFrame(()=>setTimeout(()=>{');
const clearSource=extract('function clearLegacyPlaintext(){','async function persistVaultSnapshot(plaintext){');
const persistenceSource=extract('function importLegacyPrivatePreferences(base){','function finishVaultOpen(){');
const submitSource=extract('async function submitVaultForm(event,suppliedPassword){','async function lockVault(){');

function makeHarness({failVerification=false}={}){
  const initialState={
    notes:[{id:'migration-note-1',title:'قصيدة خاصة',html:'<div>محتوى لا يجب كشفه</div>',ts:1763400000000,history:[]}],
    theme:'dark',palette:'blue',days:['2026-11-17']
  };
  const data=new Map([
    ['anwar_v1',JSON.stringify(initialState)],
    ['anwar_v1_backup_v2',JSON.stringify(initialState)],
    ['anwar_rd',JSON.stringify({r:'قارئ قديم',n:55,m:'c'})],
    ['anwar_reader_advance','s'],
    ['anwar_tasbih_count_v1','144'],
    ['anwar_tasbih_dhikr_v1','الحمد لله']
  ]);
  const operations=[];
  const elements={
    vaultPassword:{value:'Strong phrase for Anouar 2026',disabled:false},
    vaultPasswordConfirm:{value:'Strong phrase for Anouar 2026',disabled:false},
    vaultSubmit:{disabled:false},
    vaultError:{textContent:''}
  };
  const calls={finished:false,toasts:[]};
  const sandbox={
    crypto:webcrypto,
    TextEncoder,TextDecoder,Uint8Array,btoa,atob,
    localStorage:{
      getItem(key){operations.push('get:'+key);return data.has(key)?data.get(key):null},
      setItem(key,value){operations.push('set:'+key);data.set(key,String(value))},
      removeItem(key){operations.push('remove:'+key);data.delete(key)}
    },
    S:initialState,
    vaultGateMode:'setup',
    vaultUnlocked:false,
    vaultKey:null,
    vaultTemplate:null,
    vaultReady:false,
    vaultDisableAfterUnlock:false,
    vaultBackupWarningShown:false,
    VAULT_STORAGE_KEY:'anwar_vault_v1',
    VAULT_BACKUP_KEY:'anwar_vault_backup_v1',
    VAULT_MODE_KEY:'anwar_vault_mode_v1',
    $:id=>elements[id]||(elements[id]={value:'',textContent:'',disabled:false,hidden:false}),
    readStoredState(value){return JSON.parse(value)},
    finishVaultOpen(){calls.finished=true;sandbox.vaultReady=true},
    toast(message){calls.toasts.push(String(message))},
    console:{warn(){}}
  };
  vm.runInNewContext(preferenceSource,sandbox,{timeout:3000});
  vm.runInNewContext(cryptoSource,sandbox,{timeout:3000});
  if(failVerification){
    const real=sandbox.AnwarVaultCrypto;
    sandbox.AnwarVaultCrypto=Object.freeze({
      ...real,
      async decryptWithKey(){throw new Error('simulated read-back verification failure')}
    });
  }
  vm.runInNewContext(clearSource+'\n'+persistenceSource+'\n'+submitSource+'\nthis.run=submitVaultForm;',sandbox,{timeout:3000});
  return {sandbox,elements,data,operations,calls,run:sandbox.run,initialState};
}

const successful=makeHarness();
await successful.run({preventDefault(){}});
const {sandbox,elements,data,operations,calls,initialState}=successful;
assert.equal(calls.finished,true,'verified initial migration opens the vault');
assert.equal(sandbox.vaultUnlocked,true,'vault unlocks only after verification');
assert.equal(data.get('anwar_vault_mode_v1'),'encrypted','the encrypted mode marker is stored only after successful verification');
const primaryText=data.get('anwar_vault_v1');
const backupText=data.get('anwar_vault_backup_v1');
assert.ok(primaryText&&backupText,'primary and secondary encrypted envelopes are stored');
assert.ok(!primaryText.includes('محتوى لا يجب كشفه'),'primary envelope does not expose note text');
assert.ok(!backupText.includes('محتوى لا يجب كشفه'),'backup envelope does not expose note text');
const primary=JSON.parse(primaryText),backup=JSON.parse(backupText);
assert.equal(await sandbox.AnwarVaultCrypto.decryptWithKey(sandbox.vaultKey,primary),JSON.stringify(initialState),'primary envelope decrypts to the original notes');
assert.equal(await sandbox.AnwarVaultCrypto.decryptWithKey(sandbox.vaultKey,backup),JSON.stringify(initialState),'secondary envelope decrypts to the original notes');
assert.equal(data.has('anwar_v1'),false,'legacy plaintext primary is removed only after verification');
assert.equal(data.has('anwar_v1_backup_v2'),false,'legacy plaintext backup is removed only after verification');
assert.equal(data.has('anwar_rd'),false,'legacy radio preference is removed after encrypted verification');
assert.equal(data.has('anwar_reader_advance'),false,'legacy reader preference is removed after encrypted verification');
assert.equal(data.has('anwar_tasbih_count_v1'),false,'legacy tasbih count is removed after encrypted verification');
assert.equal(data.has('anwar_tasbih_dhikr_v1'),false,'legacy tasbih choice is removed after encrypted verification');
assert.deepEqual(JSON.parse(await sandbox.AnwarVaultCrypto.decryptWithKey(sandbox.vaultKey,primary)).preferences,{radio:{reciter:'قارئ قديم',surah:55},readerAdvance:'s',tasbih:{count:144,dhikr:'الحمد لله',customDhikrs:[]}},'legacy settings and the empty custom dhikr list are included in the encrypted snapshot');
assert.equal(elements.vaultPassword.value,'','password field is cleared after success');
assert.equal(elements.vaultPasswordConfirm.value,'','password confirmation field is cleared after success');
assert.ok(operations.indexOf('remove:anwar_v1')>operations.indexOf('get:anwar_vault_backup_v1'),'legacy cleanup occurs after encrypted backup verification');

const failed=makeHarness({failVerification:true});
await failed.run({preventDefault(){}});
assert.equal(failed.calls.finished,false,'failed read-back verification never opens the vault');
assert.equal(failed.sandbox.vaultUnlocked,false,'failed verification never marks the vault unlocked');
assert.ok(failed.data.has('anwar_v1'),'legacy plaintext primary is retained after failed verification');
assert.ok(failed.data.has('anwar_v1_backup_v2'),'legacy plaintext backup is retained after failed verification');
assert.ok(failed.data.has('anwar_rd'),'legacy radio preference is retained after failed verification');
assert.ok(failed.data.has('anwar_reader_advance'),'legacy reader preference is retained after failed verification');
assert.ok(failed.data.has('anwar_tasbih_count_v1'),'legacy tasbih count is retained after failed verification');
assert.ok(failed.data.has('anwar_tasbih_dhikr_v1'),'legacy tasbih choice is retained after failed verification');
assert.equal(failed.data.has('anwar_vault_v1'),false,'unverified encrypted primary envelope is rolled back');
assert.equal(failed.data.has('anwar_vault_backup_v1'),false,'no secondary backup is written before primary verification');
assert.equal(failed.data.has('anwar_vault_mode_v1'),false,'failed encrypted setup rolls back the mode marker and remains recoverable as plaintext');
assert.match(failed.elements.vaultError.textContent,/simulated read-back verification failure/,'the failure is surfaced to the user');

console.log('All initial vault migration and rollback tests passed.');
