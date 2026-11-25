import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const core=fs.readFileSync(new URL('../app-core.js',import.meta.url),'utf8');
assert.doesNotThrow(()=>new vm.Script(core,{filename:'app-core.js'}),'the updated application bundle parses without syntax errors');

assert.ok(html.includes('id="bkp"')&&html.includes('نسخة إنقاذ'),'the one-tap rescue download control is present');
assert.ok(html.includes('id="restoreRescueBtn"'),'the separate restore entry point is present');
assert.ok(html.includes('id="rescueFilePicker"')&&html.includes('accept=".json,application/json"'),'restore accepts a local JSON file');
assert.ok(html.includes('id="rescueFileName"')&&html.includes('id="backupPassword"'),'restore shows the selected file and requests the original vault passphrase');
assert.ok(!html.includes('id="bt"')&&!html.includes('id="cp"')&&!html.includes('id="downloadBackup"'),'the large plaintext-copy/paste dialog is removed');

const sliceBetween=(startMarker,endMarker)=>{
 const start=core.indexOf(startMarker);
 const end=core.indexOf(endMarker,start);
 assert.ok(start>=0&&end>start,'source block exists: '+startMarker);
 return core.slice(start,end);
};
const exportFn=sliceBetween('async function downloadRescueBackup(){','function openRescueRestorePicker(){');
assert.ok(exportFn.includes('await vaultSaveQueue'),'backup waits for queued vault writes');
assert.ok(exportFn.includes('JSON.stringify(S)'),'backup snapshots the complete private notebook state');
assert.ok(exportFn.includes('AnwarVaultCrypto.encryptWithKey(vaultKey,vaultTemplate,plaintext)'),'backup uses the active vault key and existing encryption format');
assert.ok(exportFn.includes('AnwarVaultCrypto.decryptWithKey(vaultKey,envelope)'),'backup is verified by decrypting it before download');
assert.ok(exportFn.includes('URL.createObjectURL(blob)'),'backup is downloaded as a local file');
assert.ok(!/\bfetch\s*\(/.test(exportFn),'backup creation does not upload data to a server');

const fileFn=sliceBetween('async function handleRescueFileSelected(event){','async function restoreRescueBackup(){');
assert.ok(fileFn.includes('file.size>12*1024*1024'),'restore enforces a file-size limit');
assert.ok(fileFn.includes('await file.text()'),'restore reads the selected local file');
assert.ok(fileFn.includes('AnwarVaultCrypto.validateEnvelope(envelope)'),'restore validates the encrypted envelope before asking for a password');

const restoreFn=sliceBetween('async function restoreRescueBackup(){','function updateStorageRecoveryNotice(){');
assert.ok(restoreFn.includes('AnwarVaultCrypto.decryptEnvelope(password,rescuePendingEnvelope)'),'restore decrypts with the original vault passphrase');
assert.ok(restoreFn.includes('readStoredState(decrypted.plaintext)'),'restored content is validated as notebook state');
assert.ok(restoreFn.includes('if(!confirm('),'replacement requires explicit user confirmation');
assert.ok(restoreFn.includes('await persistVaultSnapshot(plaintext)'),'restored content is saved through the existing encrypted vault path');
assert.ok(restoreFn.includes('S=next'),'live state is replaced only after verified encrypted persistence');
assert.ok(core.includes('const freshDevice=vaultUnlocked&&!vaultKey&&!vaultHasEncryptedData;'),'a new device with no local vault is recognized');
assert.ok(restoreFn.includes('if(freshDevice){'),'fresh-device restore uses a dedicated initialization path');
assert.ok(restoreFn.includes('vaultKey=decrypted.key;')&&restoreFn.includes('vaultTemplate=decrypted.envelope;'),'fresh-device restore adopts the verified backup key and template');
assert.ok(restoreFn.includes("localStorage.setItem(VAULT_MODE_KEY,'encrypted')"),'fresh-device restore enables encrypted vault mode only after saving the restored state');
assert.ok(restoreFn.includes('finishVaultOpen()'),'fresh-device restore opens the newly initialized vault without a separate empty-vault setup');
assert.ok(restoreFn.includes('clearLegacyPlaintext()'),'legacy plaintext is cleared only after the encrypted snapshot is persisted');

assert.ok(core.includes("else if(id==='bkp'){downloadRescueBackup()}"),'backup action routes directly to file generation');
assert.ok(core.includes("else if(id==='restoreRescueBtn'){openRescueRestorePicker()}"),'restore action opens the local file picker');
assert.ok(core.includes("else if(id==='rs'){restoreRescueBackup()}"),'restore confirmation routes to the new verified restore path');
assert.ok(core.includes("$('rescueFilePicker').addEventListener('change',handleRescueFileSelected)"),'local file selection is wired');
assert.ok(html.includes('id="rescueReminderBtn"'),'the optional reminder control is present');
assert.ok(core.includes('const RESCUE_REMINDER_INTERVAL_MS=30*24*60*60*1000;'),'the reminder uses a gentle 30-day interval');
assert.ok(core.includes('function toggleRescueReminder(){')&&core.includes('function checkRescueReminder(){'),'the reminder can be explicitly enabled or disabled');
assert.ok(core.includes('checkRescueReminder();'),'reminders are checked when the vault opens');
assert.ok(core.includes('if(isRescueReminderEnabled())try{localStorage.setItem(RESCUE_REMINDER_DUE_KEY'),'a successful backup resets the reminder deadline');
assert.ok(!core.includes('new Notification(')&&!core.includes('Notification.requestPermission('),'the reminder does not request notification permission or send push notifications');

console.log('One-tap encrypted rescue backup and verified restore checks passed.');
