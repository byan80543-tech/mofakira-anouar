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
const continueSource=extract('async function continueVaultAfterRecovery(){','function prepareLegacyStateForVault(){');
const retrySource=extract('async function retryStorageAccess(){','async function restoreStorageBackup(){');

function makeHarness(initial={},failReads=false){
  const values=new Map(Object.entries(initial));
  const calls={mode:null,message:null,legacyPrepared:false,recovery:null,opened:undefined,cleared:false,finished:false,toasts:[],reads:[],privatePreferencesLoaded:0,syncCount:0,renderCount:0};
  const elements={
    vaultGate:{hidden:false},
    vaultLockBtn:{hidden:true,attributes:new Map(),setAttribute(name,value){this.attributes.set(name,String(value))},title:'',getAttribute(name){return this.attributes.get(name)??null}}
  };
  const sandbox={
    $:id=>elements[id]||null,
    AnwarPrivatePreferences:{load(){calls.privatePreferencesLoaded++}},
    vaultKey:null,vaultTemplate:null,vaultUnlocked:false,vaultReady:false,vaultHasEncryptedData:false,vaultGateMode:'setup',
    localStorage:{
      getItem(key){
        calls.reads.push(key);
        if(failReads)throw new Error('simulated localStorage read failure');
        return values.has(key)?values.get(key):null;
      }
    },
    AnwarVaultStorage:{
      async get(key){
        calls.reads.push(key);
        if(failReads)throw new Error('simulated IndexedDB read failure');
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
    emptyStorageState(){return {notes:[],preferences:{}}},
    showVaultGate(mode,message){calls.mode=mode;calls.message=message;sandbox.vaultGateMode=mode},
    syncVaultLockButton(){calls.syncCount++;elements.vaultLockBtn.hidden=false;elements.vaultLockBtn.setAttribute('data-encrypted',sandbox.vaultHasEncryptedData?'true':'false');elements.vaultLockBtn.setAttribute('data-locked',!sandbox.vaultUnlocked&&sandbox.vaultHasEncryptedData?'true':'false')},
    finishVaultOpen(){calls.finished=true;sandbox.vaultUnlocked=true;sandbox.vaultGateMode=null},
    prepareLegacyStateForVault(){calls.legacyPrepared=true;return true},
    importLegacyPrivatePreferences(value){return value},
    showStorageRecoveryNotice(title,message,raw){calls.recovery={title,message,raw}},
    clearStorageRecovery(){calls.cleared=true;sandbox.storageRecoveryBlocked=false},
    toast(message){calls.toasts.push(String(message))},
    theme(){},
    chips(){},
    openNote(value){calls.opened=value},
    renderList(){calls.renderCount++},
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
assert.equal(h.calls.mode,null,'backup-only startup keeps the unlock prompt hidden until the shield is pressed');
assert.equal(h.calls.legacyPrepared,false,'backup-only startup does not start a new vault or import legacy data');
assert.equal(h.sandbox.vaultHasEncryptedData,true,'backup-only startup records that private data is encrypted');
assert.equal(h.sandbox.$('vaultGate').hidden,true,'backup-only startup keeps the public shell available without showing the gate');
assert.equal(h.calls.privatePreferencesLoaded,1,'locked startup loads only empty private preferences');
assert.equal(h.calls.syncCount,1,'locked startup updates the shield to the locked state');
assert.equal(h.calls.opened,null,'locked startup opens no private note');

h=makeHarness({'anwar_vault_v1':'encrypted-primary'});
await h.api.bootVault();
assert.equal(h.calls.mode,null,'primary encrypted startup does not automatically display a password gate');
assert.equal(h.calls.legacyPrepared,false,'existing primary vault does not run first-time setup');
assert.equal(h.sandbox.vaultHasEncryptedData,true,'primary startup records the encrypted vault state');
assert.equal(h.calls.privatePreferencesLoaded,1,'primary startup loads blank private preferences');
assert.equal(h.calls.syncCount,1,'primary startup synchronizes the shield');

h=makeHarness();
await h.api.bootVault();
assert.equal(h.calls.finished,false,'first launch must not open the private notebook before encryption');
assert.equal(h.calls.mode,'setup','first launch requires mandatory encryption setup');
assert.equal(h.calls.legacyPrepared,true,'first launch checks and preserves legacy data before encryption');
assert.equal(h.sandbox.vaultUnlocked,false,'first launch remains locked until the encrypted vault is created');

h=makeHarness({'anwar_vault_mode_v1':'plain','anwar_vault_v1':'stale-encrypted-copy'});
await h.api.bootVault();
assert.equal(h.calls.finished,false,'a legacy plaintext-mode marker cannot bypass an existing encrypted vault');
assert.equal(h.sandbox.vaultHasEncryptedData,true,'existing encrypted records are detected even when local mode metadata says plain');
assert.equal(h.sandbox.vaultGateMode,'unlock','an existing encrypted vault remains locked and requires its original passphrase');
assert.equal(h.calls.legacyPrepared,false,'the app does not overwrite an existing encrypted vault by starting a new plaintext migration');

h=makeHarness({},true);
await h.api.bootVault();
assert.ok(h.calls.recovery,'blocked startup storage access is shown as a recovery warning');
assert.equal(h.calls.mode,null,'blocked storage access never starts a new vault');

h=makeHarness({'anwar_vault_backup_v1':'encrypted-backup'});
await h.api.continueVaultAfterRecovery();
assert.equal(h.calls.mode,'unlock','post-recovery continuation recognizes a backup-only vault');
assert.match(h.calls.message,/نسخة احتياطية مشفرة/,'post-recovery continuation explains backup restoration');

h=makeHarness();
await h.api.continueVaultAfterRecovery();
assert.equal(h.calls.finished,false,'post-recovery continuation must not open plaintext without encryption');
assert.equal(h.calls.mode,'setup','post-recovery continuation requires encryption setup');

h=makeHarness({'anwar_vault_backup_v1':'encrypted-backup'});
assert.equal(await h.api.retryStorageAccess(),true,'retry succeeds when access to backup-only vault returns');
assert.equal(h.calls.mode,'unlock','retry opens the unlock gate for a backup-only vault');
assert.match(h.calls.message,/نسخة احتياطية مشفرة/,'retry explains that the encrypted backup can be restored');
assert.equal(h.calls.cleared,true,'retry clears the storage access warning');
assert.ok(h.calls.reads.includes('anwar_vault_mode_v1'),'retry checks the selected vault mode before deciding how to recover');
assert.equal(h.calls.legacyPrepared,false,'backup recovery never imports legacy plaintext before password verification');

h=makeHarness({'anwar_vault_v1':'encrypted-primary'});
assert.equal(await h.api.retryStorageAccess(),true,'retry recognizes an existing primary vault');
assert.equal(h.calls.mode,'unlock','retry opens the primary vault unlock gate');

h=makeHarness({},true);
assert.equal(await h.api.retryStorageAccess(),false,'retry remains blocked while storage access is unavailable');
assert.equal(h.calls.mode,null,'failed retry does not start a new vault');

console.log('All encrypted-vault startup and backup-recovery tests passed.');
