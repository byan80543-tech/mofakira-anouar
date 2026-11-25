import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const source=fs.readFileSync(new URL('../vault-device-unlock.js',import.meta.url),'utf8');
const appCore=fs.readFileSync(new URL('../app-core.js',import.meta.url),'utf8');
const PASSWORD='Never persisted in clear text - test only';

function makeEnvironment(hostname,seedWrapper=false){
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
  const context={
    crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,URL,
    btoa:value=>Buffer.from(value,'binary').toString('base64'),
    atob:value=>Buffer.from(value,'base64').toString('binary'),
    localStorage,location:{hostname},isSecureContext:true,
    PublicKeyCredential:function(){},
    navigator:{credentials:{
      async create(){createCalls++;throw new Error('must not call create on blocked origin')},
      async get(){getCalls++;throw new Error('must not call get on blocked origin')}
    }},
    console
  };
  context.globalThis=context;
  vm.runInNewContext(source,context,{timeout:3000});
  return {api:context.AnwarDeviceUnlock,values,get createCalls(){return createCalls},get getCalls(){return getCalls}};
}

const blocked=makeEnvironment('byan80543-tech.github.io',true);
assert.equal(blocked.api.isSharedGitHubPagesOrigin(),true);
assert.equal(blocked.api.supported(),false,'WebAuthn quick unlock is disabled on the shared GitHub Pages host');
assert.equal(blocked.api.isConfigured(),false,'a legacy quick-unlock wrapper cannot remain active');
assert.equal(blocked.values.has('anwar_vault_device_unlock_v1'),false,'only the local wrapped-password record is removed');
await assert.rejects(()=>blocked.api.protectPassword(PASSWORD),/عُطّل الفتح بالبصمة على GitHub Pages/);
await assert.rejects(()=>blocked.api.unlockPassword(),/عُطّل الفتح بالبصمة على GitHub Pages/);
assert.equal(blocked.createCalls,0,'registration never reaches the authenticator on a shared origin');
assert.equal(blocked.getCalls,0,'unlock never requests a PRF assertion on a shared origin');

const sibling=makeEnvironment('another-owner.github.io',true);
assert.equal(sibling.api.isSharedGitHubPagesOrigin(),true,'the policy covers other GitHub Pages owner hosts too');
assert.equal(sibling.values.has('anwar_vault_device_unlock_v1'),false,'legacy wrapper is removed on every github.io host');

assert.ok(appCore.includes("deviceManage.textContent=deviceConfigured?'إدارة فتح الهاتف':sharedDeviceOrigin?'سبب تعطيل البصمة':'إعداد فتح الهاتف';"),'the shared-origin gate clearly explains why fingerprint unlock is disabled');

const isolated=makeEnvironment('mofakira-anouar.pages.dev',false);
assert.equal(isolated.api.isSharedGitHubPagesOrigin(),false,'a dedicated origin is not classified as GitHub Pages');
assert.equal(isolated.api.supported(),true,'device unlock remains available on a supported isolated HTTPS origin');
assert.equal(isolated.api.isConfigured(),false,'an isolated origin starts without an old credential wrapper');

console.log('Shared GitHub Pages origin lockout tests passed.');
