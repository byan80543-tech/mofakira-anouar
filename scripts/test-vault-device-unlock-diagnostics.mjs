import assert from 'node:assert/strict';
import fs from 'node:fs';

const root=new URL('../',import.meta.url);
const helper=fs.readFileSync(new URL('vault-device-unlock.js',root),'utf8');
const core=fs.readFileSync(new URL('app-core.js',root),'utf8');
const html=fs.readFileSync(new URL('index.html',root),'utf8');
const worker=fs.readFileSync(new URL('service-worker.js',root),'utf8');

assert.match(helper,/function diagnostics\(\)/,'device helper exposes a local diagnostic snapshot');
for(const field of ['secureContext','trustedOrigin','credentialsApi','publicKeyCredential','cryptoSubtle','localStorageReadable','recordConfigured','standalone','supported']) {
 assert.match(helper,new RegExp('\\b'+field+'\\b'),'diagnostics include '+field);
}
assert.match(helper,/root\.AnwarDeviceUnlock=Object\.freeze\(\{[\s\S]*?diagnostics,/,
 'diagnostics are exposed through the existing device-unlock API');
assert.match(core,/const diagnostic=deviceApi\.diagnostics\(\)/,
 'vault gate checks device availability in the current PWA session');
assert.match(core,/سبب الفحص:/,'vault gate reports why the device action is unavailable');
assert.match(core,/إعداد قفل الهاتف غير موجود في هذه الجلسة/,
 'vault gate distinguishes a missing wrapper from unsupported APIs');
assert.match(html,/vault-device-unlock\.js\?v=20261126-2/,
 'HTML refreshes the diagnostic helper');
assert.match(html,/app-core\.js\?v=20261126-80/,
 'HTML refreshes the diagnostic UI');
assert.match(worker,/anwar-shell-2026-11-26-v214/,
 'service worker receives a fresh app shell cache');
console.log('PWA device-unlock local diagnostics tests passed.');
