import fs from 'node:fs';
import assert from 'node:assert/strict';

const root=new URL('../',import.meta.url);
const html=fs.readFileSync(new URL('index.html',root),'utf8');
const core=fs.readFileSync(new URL('app-core.js',root),'utf8');

assert.match(html,/<button id="vaultShieldActivate"[^>]*aria-label="تفعيل التشفير الشامل"/,
  'the vault emblem is now an accessible, interactive shield button');
assert.match(html,/<svg viewBox="0 0 24 24"[^>]*>[\s\S]*?M12 2\.5[\s\S]*?\/svg>/,
  'the emblem contains a real shield/check SVG, not a decorative square glyph');
assert.match(html,/#vaultGate \.vault-mark:focus-visible/,
  'the shield can be reached and identified with keyboard focus');
assert.match(core,/shieldButton\.setAttribute\('aria-label',mode==='unlock'/,
  'the shield describes unlock or encryption according to the gate state');

const actionStart=core.indexOf("else if(id==='vaultShieldActivate'){");
const actionEnd=core.indexOf("else if(id==='vaultLockBtn')",actionStart);
assert.ok(actionStart>=0&&actionEnd>actionStart,'the click handler for the shield exists');
const action=core.slice(actionStart,actionEnd);
assert.match(action,/vaultPasswordFields\)\.hidden[\s\S]*?unlockVaultWithDevice\(\)/,
  'the shield uses the existing phone-unlock route when that route is displayed');
assert.match(action,/form\.requestSubmit\(\)/,
  'the shield submits the existing validated vault form');
assert.match(action,/submitVaultForm\(null\)/,
  'older WebViews retain a guarded form-handler fallback');

assert.match(core,/AnwarVaultCrypto\.createVault\(password,plaintext\)/,
  'encryption remains delegated to the established vault cryptography engine');
assert.match(core,/const plaintext=JSON\.stringify\(S\)/,
  'the encryption flow serializes the complete notebook state before encryption');
assert.match(core,/clearLegacyPlaintext\(\)/,
  'legacy plaintext cleanup remains in the existing post-verification flow');

assert.match(html,/<button id="vaultLockBtn"[^>]*data-locked="false"/,'the toolbar shield exposes its locked state');
assert.doesNotMatch(html,/\.app\.ed \.tb #vaultLockBtn\{display:none!important\}/,
  'the shield remains available while editing a poem');
assert.match(core,/function syncVaultLockButton\(\)[\s\S]*?data-locked/,
  'the existing toolbar shield reflects whether the vault is locked');
assert.match(core,/vaultHasEncryptedData=true;[\s\S]{0,280}vaultGate'\)\.hidden=true/,
  'encrypted startup keeps the public app shell visible and does not force the unlock gate');
assert.match(core,/vaultKey=null;[\s\S]{0,100}vaultTemplate=null;[\s\S]{0,300}S=emptyStorageState\(\)/,
  'locking clears the in-memory key and replaces private state with an empty model');
assert.match(core,/visibilityState==='hidden'[\s\S]{0,250}lockVault\('background'\)/,
  'encrypted private content locks when the page moves to the background');
assert.match(core,/addEventListener\('pagehide',[\s\S]{0,180}lockVault\('background'\)/,
  'encrypted private content also locks on page exit');
assert.match(core,/if\(!vaultUnlocked\)[\s\S]{0,220}showVaultGate\('unlock'/,
  'creating a new note while locked first requires authentication');
console.log('Vault shield control tests passed.');
