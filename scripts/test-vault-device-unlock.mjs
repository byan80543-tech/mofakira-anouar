import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

if(!globalThis.crypto?.subtle){
 Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});
}
if(typeof globalThis.btoa!=='function'){
 globalThis.btoa=value=>Buffer.from(value,'binary').toString('base64');
 globalThis.atob=value=>Buffer.from(value,'base64').toString('binary');
}

const storage=new Map();
globalThis.localStorage={
 getItem(key){return storage.has(key)?storage.get(key):null},
 setItem(key,value){storage.set(key,String(value))},
 removeItem(key){storage.delete(key)}
};
globalThis.location={hostname:'mofakira-anouar.pages.dev',protocol:'https:',origin:'https://mofakira-anouar.pages.dev'};
globalThis.isSecureContext=true;
globalThis.PublicKeyCredential=function(){};

let prfOutput=new Uint8Array(32).fill(23);
let prfEnabled=true;
let createCalls=0,getCalls=0;
const credentialId=new Uint8Array([9,7,5,3,1]).buffer;
const copyBuffer=value=>value.buffer.slice(value.byteOffset,value.byteOffset+value.byteLength);

Object.defineProperty(globalThis,'navigator',{
 configurable:true,
 value:{
  credentials:{
   async create(options){
    createCalls++;
    assert.equal(options.publicKey.rp.id,'mofakira-anouar.pages.dev');
    assert.equal(options.publicKey.authenticatorSelection.authenticatorAttachment,'platform');
    assert.equal(options.publicKey.authenticatorSelection.residentKey,'preferred','resident credentials are preferred, not required, for wider device compatibility');
    assert.equal(options.publicKey.authenticatorSelection.userVerification,'required');
    assert.deepEqual(options.publicKey.pubKeyCredParams.map(item=>item.alg),[-7,-257],'standard ES256 and RS256 credential algorithms are offered');
    assert.deepEqual(Object.keys(options.publicKey.extensions.prf),[],'registration enables PRF without requiring create-time evaluation');
    return {
     rawId:credentialId,
     getClientExtensionResults(){
      return {prf:{enabled:prfEnabled}};
     }
    };
   },
   async get(options){
    getCalls++;
    assert.equal(options.publicKey.rpId,'mofakira-anouar.pages.dev');
    assert.equal(options.publicKey.userVerification,'required');
    assert.equal(options.publicKey.allowCredentials[0].type,'public-key');
    assert.ok(options.publicKey.extensions.prf.eval.first,'unlock requests the saved PRF salt');
    return {
     getClientExtensionResults(){
      return {prf:{results:{first:copyBuffer(prfOutput)}}};
     }
    };
   }
  }
 }
});

await import('../vault-device-unlock.js');
const unlock=globalThis.AnwarDeviceUnlock;
assert.ok(unlock,'device unlock helper installs');
assert.equal(unlock.supported(),true,'secure WebAuthn environment is accepted');

const password='Unique-vault-secret-2026!';
await unlock.protectPassword(password);
assert.equal(createCalls,1,'a platform credential is created');
assert.equal(unlock.isConfigured(),true,'device wrapper is stored');
const raw=localStorage.getItem(unlock.storageKey);
assert.ok(raw,'encrypted device wrapper exists');
assert.ok(!raw.includes(password),'primary password is never stored in plaintext');
assert.ok(!raw.includes('23,23,23'),'PRF output is never stored in plaintext');

assert.equal(getCalls,1,'registration obtains PRF output from a verified assertion when create returns no output');
assert.equal(await unlock.unlockPassword(),password,'same platform PRF decrypts the wrapped password');
assert.equal(getCalls,2,'each unlock requires a fresh authenticator assertion');

const saved=JSON.parse(raw);
const tampered={...saved,ciphertext:(saved.ciphertext[0]==='A'?'B':'A')+saved.ciphertext.slice(1)};
localStorage.setItem(unlock.storageKey,JSON.stringify(tampered));
await assert.rejects(()=>unlock.unlockPassword(),/لم يفتح اعتماد الهاتف/,'tampered wrapper is rejected');
localStorage.setItem(unlock.storageKey,raw);

unlock.disable();
assert.equal(unlock.isConfigured(),false,'disabling removes the local wrapper');

prfEnabled=false;
await assert.rejects(()=>unlock.protectPassword(password),/لا يدعم ميزة PRF/,'unsupported PRF registration fails safely');
assert.equal(localStorage.getItem(unlock.storageKey),null,'unsupported registration does not save a wrapper');

console.log('All device-unlock PRF and password-wrapping tests passed.');
