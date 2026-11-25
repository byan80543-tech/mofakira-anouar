import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const source=fs.readFileSync(new URL('../vault-device-unlock.js',import.meta.url),'utf8');
const appCore=fs.readFileSync(new URL('../app-core.js',import.meta.url),'utf8');
const PASSWORD='Never persisted in clear text - test only';
const TRUSTED_HOST='mofakira-anouar.pages.dev';

function makeEnvironment(hostname,seedWrapper=false,options={}){
  const values=new Map();
  if(seedWrapper)values.set('anwar_vault_device_unlock_v1',JSON.stringify({
    format:'anwar-device-unlock',version:1,rpId:hostname,
    credentialId:'AQID',salt:'AQIDBA',iv:'AQIDBA',ciphertext:'AQIDBA'
  }));
  let createCalls=0,getCalls=0;
  const localStorage={
    getItem(key){return values.has(key)?values.get(key):null},
    setItem(key,value){values.set(key,String(value))},
    removeItem(key){values.delete(key)}
  };
  const origin=options.origin||'https://'+hostname;
  const context={
    crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,URL,
    btoa:value=>Buffer.from(value,'binary').toString('base64'),
    atob:value=>Buffer.from(value,'base64').toString('binary'),
    localStorage,location:{hostname,protocol:origin.split(':')[0]+':',origin},
    isSecureContext:options.isSecureContext!==false,
    PublicKeyCredential:function(){},
    navigator:{credentials:{
      async create(){createCalls++;throw new Error('unexpected WebAuthn create call')},
      async get(){getCalls++;throw new Error('unexpected WebAuthn get call')}
    }},
    console
  };
  context.globalThis=context;
  vm.runInNewContext(source,context,{timeout:3000});
  return {api:context.AnwarDeviceUnlock,values,get createCalls(){return createCalls},get getCalls(){return getCalls}};
}

// The historical GitHub Pages origin remains blocked and its obsolete
// wrapped-password record alone is removed. Encrypted vault data is untouched.
const github=makeEnvironment('byan80543-tech.github.io',true);
assert.equal(github.api.isSharedGitHubPagesOrigin(),true);
assert.equal(github.api.isTrustedOrigin(),false);
assert.equal(github.api.supported(),false);
assert.equal(github.api.isConfigured(),false);
assert.equal(github.values.has('anwar_vault_device_unlock_v1'),false);
await assert.rejects(()=>github.api.protectPassword(PASSWORD),/عُطّل الفتح بقفل الهاتف على GitHub Pages/);
await assert.rejects(()=>github.api.unlockPassword(),/عُطّل الفتح بقفل الهاتف على GitHub Pages/);
assert.equal(github.createCalls,0);
assert.equal(github.getCalls,0);

const sibling=makeEnvironment('another-owner.github.io',true);
assert.equal(sibling.api.isSharedGitHubPagesOrigin(),true);
assert.equal(sibling.values.has('anwar_vault_device_unlock_v1'),false);

// Only the exact independent Cloudflare Pages production origin may enroll
// or use the platform authenticator.
const trusted=makeEnvironment(TRUSTED_HOST);
assert.equal(trusted.api.isSharedGitHubPagesOrigin(),false);
assert.equal(trusted.api.isTrustedOrigin(),true);
assert.equal(trusted.api.supported(),true);
assert.equal(trusted.api.isConfigured(),false);

// Preview subdomains, lookalikes, arbitrary sites, insecure contexts and
// alternate ports are denied, even when they expose WebAuthn APIs.
for (const [host,options] of [
  ['preview.'+TRUSTED_HOST,{}],
  ['mofakira-anouar.pages.dev.attacker.example',{}],
  ['attacker.example',{}],
  [TRUSTED_HOST,{isSecureContext:false}],
  [TRUSTED_HOST,{origin:'https://'+TRUSTED_HOST+':8443'}]
]) {
  const blocked=makeEnvironment(host,true,options);
  assert.equal(blocked.api.isTrustedOrigin(),false,host);
  assert.equal(blocked.api.supported(),false,host);
  assert.equal(blocked.api.isConfigured(),false,host);
  await assert.rejects(()=>blocked.api.protectPassword(PASSWORD),/النطاق المستقل المعتمد/);
  await assert.rejects(()=>blocked.api.unlockPassword(),/النطاق المستقل المعتمد/);
  assert.equal(blocked.createCalls,0,host+' must not register credentials');
  assert.equal(blocked.getCalls,0,host+' must not request assertions');
  // Only GitHub Pages legacy records are actively cleaned; unrelated origins
  // are never modified by this module.
  assert.equal(blocked.values.has('anwar_vault_device_unlock_v1'),true,host);
}

assert.ok(appCore.includes("deviceManage.textContent=deviceConfigured?'إدارة فتح الهاتف':trustedDeviceOrigin?'إعداد فتح الهاتف':'سبب تعطيل فتح الهاتف';"));
assert.ok(appCore.includes("const trustedOrigin=AnwarDeviceUnlock.isTrustedOrigin();"));
console.log('Dedicated-origin device unlock tests passed.');
