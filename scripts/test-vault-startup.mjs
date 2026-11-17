import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('async function bootVault(){');
const end=html.indexOf('async function submitVaultForm(event){',start);
assert.ok(start>=0&&end>start,'bootVault startup function exists');
const source=html.slice(start,end);

function makeHarness(initial={},failReads=false){
  const values=new Map(Object.entries(initial));
  const calls={mode:null,message:null,legacyPrepared:false,recovery:null,opened:undefined};
  const sandbox={
    localStorage:{
      getItem(key){
        if(failReads)throw new Error('simulated localStorage read failure');
        return values.has(key)?values.get(key):null;
      }
    },
    VAULT_STORAGE_KEY:'anwar_vault_v1',
    VAULT_BACKUP_KEY:'anwar_vault_backup_v1',
    S:{notes:[]},
    emptyStorageState(){return {notes:[]}},
    showVaultGate(mode,message){calls.mode=mode;calls.message=message},
    prepareLegacyStateForVault(){calls.legacyPrepared=true;return true},
    showStorageRecoveryNotice(title,message,raw){calls.recovery={title,message,raw}},
    theme(){},
    chips(){},
    openNote(value){calls.opened=value},
    console:{warn(){}}
  };
  vm.runInNewContext(source+'\nthis.run=bootVault;',sandbox,{timeout:3000});
  return {run:sandbox.run,calls};
}

let h=makeHarness({'anwar_vault_backup_v1':'encrypted-backup'});
await h.run();
assert.equal(h.calls.mode,'unlock','backup-only storage opens the unlock gate');
assert.match(h.calls.message,/نسخة احتياطية مشفرة/,'backup-only storage explains that recovery is available');
assert.equal(h.calls.legacyPrepared,false,'backup-only storage does not start a new vault or import legacy data');

h=makeHarness({'anwar_vault_v1':'encrypted-primary'});
await h.run();
assert.equal(h.calls.mode,'unlock','primary encrypted storage opens the unlock gate');
assert.equal(h.calls.legacyPrepared,false,'existing primary vault does not run first-time setup');

h=makeHarness();
await h.run();
assert.equal(h.calls.mode,'setup','first launch without encrypted data prepares a new vault');
assert.equal(h.calls.legacyPrepared,true,'first launch checks legacy plaintext before setup');

h=makeHarness({},true);
await h.run();
assert.ok(h.calls.recovery,'blocked storage access is shown as a recovery warning');
assert.equal(h.calls.mode,null,'blocked storage access never starts a new vault');

console.log('All encrypted-vault startup and backup-recovery tests passed.');
