import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html=fs.readFileSync(new URL('../app-core.js',import.meta.url),'utf8');
const extract=(start,end)=>{
  const a=html.indexOf(start),b=html.indexOf(end,a);
  assert.ok(a>=0&&b>a,'source block exists: '+start);
  return html.slice(a,b);
};
const bootSource=extract('async function bootVault(){','async function submitVaultForm(event,suppliedPassword){');
const continueSource=extract('function continueVaultAfterRecovery(){','function prepareLegacyStateForVault(){');
const retrySource=extract('function retryStorageAccess(){','function restoreStorageBackup(){');

function makeHarness(initial={},failReads=false){
  const values=new Map(Object.entries(initial));
  const calls={mode:null,message:null,legacyPrepared:false,recovery:null,opened:undefined,cleared:false,finished:false,toasts:[],reads:[]};
  const sandbox={
    localStorage:{
      getItem(key){
        calls.reads.push(key);
        if(failReads)throw new Error('simulated localStorage read failure');
        return values.has(key)?values.get(key):null;
      }
    },
    VAULT_STORAGE_KEY:'anwar_vault_v1',
    VAULT_BACKUP_KEY:'anwar_vault_backup_v1',
    VAULT_MODE_KEY:'anwar_vault_mode_v1',
    S:{notes:[]},
    vaultUnlocked:false,
    vaultGateMode:null,
    storageRecoveryBlocked:true,
    emptyStorageState(){return {notes:[]}},
    showVaultGate(mode,message){calls.mode=mode;calls.message=message;sandbox.vaultGateMode=mode},
    finishVaultOpen(){calls.finished=true;sandbox.vaultUnlocked=true;sandbox.vaultGateMode=null},
    prepareLegacyStateForVault(){calls.legacyPrepared=true;return true},
    importLegacyPrivatePreferences(value){return value},
    showStorageRecoveryNotice(title,message,raw){calls.recovery={title,message,raw}},
    clearStorageRecovery(){calls.cleared=true;sandbox.storageRecoveryBlocked=false},
    toast(message){calls.toasts.push(String(message))},
    theme(){},
    chips(){},
    openNote(value){calls.opened=value},
    renderList(){},
    updateStorageRecoveryNotice(){},
    readStoredState(value){return JSON.parse(value)},
    confirm(){return true},
    console:{warn(){}}
  };
  vm.runInNewContext(
    bootSource+'\n'+continueSource+'\n'+retrySource+
    '\nthis.api={bootVault,continueVaultAfterRecovery,retryStorageAccess};',
    sandbox,{timeout:3000}
  );
  return {api:sandbox.api,calls,values,sandbox};
}

let h=makeHarness({'anwar_vault_backup_v1':'encrypted-backup'});
await h.api.bootVault();
assert.equal(h.calls.mode,'unlock','backup-only storage opens the unlock gate');
assert.match(h.calls.message,/نسخة احتياطية مشفرة/,'backup-only startup explains that recovery is available');
assert.equal(h.calls.legacyPrepared,false,'backup-only startup does not start a new vault or import legacy data');

h=makeHarness({'anwar_vault_v1':'encrypted-primary'});
await h.api.bootVault();
assert.equal(h.calls.mode,'unlock','primary encrypted storage opens the unlock gate');
assert.equal(h.calls.legacyPrepared,false,'existing primary vault does not run first-time setup');

h=makeHarness();
await h.api.bootVault();
assert.equal(h.calls.finished,true,'first launch opens directly in free mode without requiring a password');
assert.equal(h.calls.mode,null,'first launch does not display the encryption setup gate');
assert.equal(h.calls.legacyPrepared,true,'first launch checks and preserves legacy plaintext before opening');

h=makeHarness({'anwar_vault_mode_v1':'plain','anwar_vault_v1':'stale-encrypted-copy'});
await h.api.bootVault();
assert.equal(h.calls.finished,true,'explicit free mode opens without asking for an old encryption password');
assert.equal(h.calls.mode,null,'free mode bypasses stale encrypted copies after a verified plaintext switch');

h=makeHarness({},true);
await h.api.bootVault();
assert.ok(h.calls.recovery,'blocked startup storage access is shown as a recovery warning');
assert.equal(h.calls.mode,null,'blocked storage access never starts a new vault');

h=makeHarness({'anwar_vault_backup_v1':'encrypted-backup'});
h.api.continueVaultAfterRecovery();
assert.equal(h.calls.mode,'unlock','post-recovery continuation recognizes a backup-only vault');
assert.match(h.calls.message,/نسخة احتياطية مشفرة/,'post-recovery continuation explains backup restoration');

h=makeHarness();
h.api.continueVaultAfterRecovery();
assert.equal(h.calls.finished,true,'post-recovery continuation returns to free mode when no encrypted vault exists');

h=makeHarness({'anwar_vault_backup_v1':'encrypted-backup'});
assert.equal(h.api.retryStorageAccess(),true,'retry succeeds when access to backup-only vault returns');
assert.equal(h.calls.mode,'unlock','retry opens the unlock gate for a backup-only vault');
assert.match(h.calls.message,/نسخة احتياطية مشفرة/,'retry explains that the encrypted backup can be restored');
assert.equal(h.calls.cleared,true,'retry clears the storage access warning');
assert.ok(h.calls.reads.includes('anwar_vault_mode_v1'),'retry checks the selected vault mode before deciding how to recover');
assert.equal(h.calls.legacyPrepared,false,'backup recovery never imports legacy plaintext before password verification');

h=makeHarness({'anwar_vault_v1':'encrypted-primary'});
assert.equal(h.api.retryStorageAccess(),true,'retry recognizes an existing primary vault');
assert.equal(h.calls.mode,'unlock','retry opens the primary vault unlock gate');

h=makeHarness({},true);
assert.equal(h.api.retryStorageAccess(),false,'retry remains blocked while storage access is unavailable');
assert.equal(h.calls.mode,null,'failed retry does not start a new vault');

console.log('All encrypted-vault startup and backup-recovery tests passed.');
