import assert from 'node:assert/strict';
import fs from 'node:fs';

const root=new URL('../',import.meta.url);
const core=fs.readFileSync(new URL('app-core.js',root),'utf8');
const html=fs.readFileSync(new URL('index.html',root),'utf8');
const worker=fs.readFileSync(new URL('service-worker.js',root),'utf8');

function section(source,startMarker,endMarker){
 const start=source.indexOf(startMarker);
 const end=source.indexOf(endMarker,start);
 assert.ok(start>=0&&end>start,'source section exists: '+startMarker);
 return source.slice(start,end);
}

const gate=section(core,'function showVaultGate(mode,message){','async function continueVaultAfterRecovery(){');
assert.match(gate,/const deviceSupported=mode==='unlock'&&!!\(deviceApi&&trustedDeviceOrigin&&deviceApi\.supported\(\)\)/,
 'device unlock and rebind actions are limited to the approved origin and supported WebAuthn contexts');
assert.match(gate,/deviceUnlock\.hidden=!deviceSupported/,
 'a missing device wrapper does not hide the setup action on a supported trusted origin');
assert.match(gate,/deviceUnlock\.textContent=deviceConfigured\?'فتح بقفل الهاتف':'إعداد قفل الهاتف'/,
 'the gate labels the action as unlock or setup according to the saved wrapper');
assert.match(gate,/passwordFields\.hidden=deviceConfigured&&deviceSupported/,
 'the master-password fallback stays visible when no valid device wrapper is found');
assert.match(gate,/fallbackToggle\.hidden=!\(deviceConfigured&&deviceSupported\)/,
 'the password fallback toggle only appears when device unlock is actually configured');

const unlock=section(core,'async function unlockVaultWithDevice(){','function openVaultDeviceSetupDialog(){');
assert.match(unlock,/if\(!deviceApi\.isConfigured\(\)\)[\s\S]*?deviceApi\.isTrustedOrigin\(\)&&deviceApi\.supported\(\)[\s\S]*?openVaultDeviceSetupDialog\(\)/,
 'the device button opens safe re-enrollment when the local wrapper is missing');
assert.match(unlock,/deviceApi\.unlockPassword\(\)/,
 'a configured wrapper still uses the existing WebAuthn PRF unlock');

const setup=section(core,'function openVaultDeviceSetupDialog(){','async function submitVaultDeviceSetup(event){');
assert.match(setup,/\$\('vaultDeviceSetupForm'\)\.hidden=!supported/,
 'the setup form remains available for re-binding an existing configured device');
assert.match(setup,/configured\?'إعادة ربط قفل الهاتف':'تفعيل قفل الهاتف'/,
 'the dialog distinguishes initial setup from re-binding');
assert.match(setup,/لن تتغير الخزنة أو الملاحظات/,
 'the user is told the vault and notes remain unchanged');
assert.match(setup,/سيُستبدل سجل فتح الهاتف فقط بعد نجاح التحقق/,
 'the old device wrapper is replaced only after successful verification');

const submit=section(core,'async function submitVaultDeviceSetup(event){','function disableVaultDeviceUnlock(){');
assert.ok(submit.indexOf('AnwarVaultCrypto.decryptEnvelope(password,vaultTemplate)')>=0,
 'an already-open vault still verifies the master password before re-binding');
assert.ok(submit.indexOf('AnwarVaultCrypto.decryptEnvelope(password,JSON.parse(raw))')>=0,
 'a locked vault verifies the password against the existing encrypted primary or backup');
assert.ok(submit.indexOf('await AnwarDeviceUnlock.protectPassword(password)')>
 Math.max(submit.indexOf('AnwarVaultCrypto.decryptEnvelope(password,vaultTemplate)'),
          submit.indexOf('AnwarVaultCrypto.decryptEnvelope(password,JSON.parse(raw))')),
 'a new device wrapper is created only after the current password has decrypted the vault');
assert.doesNotMatch(submit,/AnwarVaultStorage\.remove\(|localStorage\.removeItem\(/,
 'device re-binding never deletes the encrypted vault or backup');

assert.match(html,/id="vaultDeviceUnlock"[^>]*hidden/,
 'the original device-unlock control remains in the vault gate');
assert.match(html,/app-core\.js\?v=20261126-81/,
 'the PWA shell requests the new recovery-enabled application bundle');
// Keep this in sync with the separately versioned WebAuthn helper loaded by index.html.
assert.match(html,/vault-device-unlock\.js\?v=20261126-2/,
 'the existing PRF device helper and credential format remain unchanged');
assert.match(worker,/anwar-shell-\d{4}-\d{2}-\d{2}-v\d+/, 
 'the service-worker shell cache uses a versioned release identifier');
assert.match(worker,/'\.\/app-core\.js'/,
 'the offline shell still precaches the main application bundle');

console.log('PWA device-unlock recovery and safe re-bind tests passed.');
