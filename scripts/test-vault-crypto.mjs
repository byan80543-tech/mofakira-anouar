import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

if(!globalThis.crypto?.subtle){
 Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});
}
await import('../vault-crypto.js');
const vault=globalThis.AnwarVaultCrypto;
assert.ok(vault,'vault crypto API is installed');

const password='Anouar-Notebook-2026!';
const plaintext=JSON.stringify({notes:[{id:'one',title:'قصيدة خاصة',html:'<div>هذا نص سري</div>'}],theme:'dark',days:['2026-11-17']});
const created=await vault.createVault(password,plaintext);
const maximumUnicodePassword=await vault.createVault('😀'.repeat(128),plaintext);
assert.equal((await vault.decryptEnvelope('😀'.repeat(128),maximumUnicodePassword.envelope)).plaintext,plaintext,'128 four-byte Unicode characters fit the 512-byte ceiling');
assert.equal(created.envelope.format,'anwar-vault');
assert.equal(created.envelope.version,1);
assert.equal(created.envelope.kdf,'PBKDF2-HMAC-SHA-256');
assert.equal(created.envelope.cipher,'AES-256-GCM');
assert.equal(created.envelope.iterations,600000);
assert.ok(!JSON.stringify(created.envelope).includes('هذا نص سري'),'envelope does not expose note text');
assert.ok(!JSON.stringify(created.envelope).includes(password),'envelope does not expose password');

const reopened=await vault.decryptEnvelope(password,created.envelope);
assert.equal(reopened.plaintext,plaintext,'correct password decrypts the original payload');
assert.equal(reopened.key.type,'secret','derived AES key is a secret key');
assert.equal(reopened.key.extractable,false,'derived AES key cannot be exported');
await assert.rejects(()=>vault.decryptEnvelope('Different-Password-2026!',created.envelope),/كلمة المرور غير صحيحة/,'wrong password is rejected');

const backup=await vault.encryptWithKey(created.key,created.envelope,plaintext);
assert.notEqual(backup.iv,created.envelope.iv,'each encrypted backup gets a fresh IV');
assert.equal(await vault.decryptWithKey(created.key,backup),plaintext,'backup decrypts with the vault key');
assert.equal((await vault.decryptEnvelope(password,backup)).plaintext,plaintext,'backup decrypts with its password');

const originalCiphertext=created.envelope.ciphertext;
const altered={...created.envelope,ciphertext:(originalCiphertext[0]==='A'?'B':'A')+originalCiphertext.slice(1)};
await assert.rejects(()=>vault.decryptEnvelope(password,altered),/تالف|غير صالحة/,'tampered ciphertext is rejected');
assert.throws(()=>vault.validateEnvelope({...created.envelope,iterations:1000}),/غير مدعومة/,'weakened KDF settings are rejected');
await assert.rejects(()=>vault.createVault('short',plaintext),/12 محرفًا/,'short passwords are rejected');
await assert.rejects(()=>vault.createVault('x'.repeat(129),plaintext),/128 محرفًا/,'passwords above 128 Unicode characters are rejected');
await assert.rejects(()=>vault.createVault('😀'.repeat(129),plaintext),/128 محرفًا/,'astral Unicode passwords are counted by code point, not UTF-16 code unit');

// Check actual UTF-8 bytes before deriving a key or writing an envelope.
const oversizedArabic='ا'.repeat(4*1024*1024);
await assert.rejects(
 ()=>vault.createVault(password,oversizedArabic),
 /8 ميغابايت/,
 'oversized UTF-8 snapshots are rejected before vault creation'
);
await assert.rejects(
 ()=>vault.encryptWithKey(created.key,created.envelope,oversizedArabic),
 /8 ميغابايت/,
 'oversized encrypted backups are rejected before AES-GCM encryption'
);
console.log('All encrypted-vault cryptography tests passed.');