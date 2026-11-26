import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { TextEncoder, TextDecoder } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cryptoSource = fs.readFileSync(path.join(root, 'vault-crypto.js'), 'utf8');
const vaultSource = fs.readFileSync(path.join(root, 'tasbih-vault.js'), 'utf8');

assert.match(vaultSource, /anwar-tasbih-private-vault-v1/);
assert.match(vaultSource, /AnwarVaultCrypto\.createVault/);
assert.match(vaultSource, /AnwarVaultCrypto\.encryptWithKey/);
assert.match(vaultSource, /writePair\(primaryText, backupText\)/);
assert.match(vaultSource, /await saveQueue/);
assert.doesNotMatch(vaultSource, /localStorage|sessionStorage|fetch\s*\(|XMLHttpRequest|sendBeacon/,
  'the independent Tasbih vault does not use web storage or network APIs');

function makeIndexedDb() {
  const data = new Map();
  let created = false;
  const db = {
    objectStoreNames: { contains: name => name === 'records' && created },
    createObjectStore(name) { if (name === 'records') created = true; },
    transaction(name, mode) {
      assert.equal(name, 'records');
      const tx = { oncomplete: null, onerror: null, onabort: null, pending: 0, finished: false };
      const complete = () => {
        if (tx.finished || tx.pending !== 0) return;
        tx.finished = true;
        setTimeout(() => tx.oncomplete?.(), 0);
      };
      tx.objectStore = () => ({
        get(key) {
          const request = { result: undefined, onsuccess: null, onerror: null };
          tx.pending++;
          setTimeout(() => {
            request.result = data.has(key) ? data.get(key) : undefined;
            request.onsuccess?.();
            tx.pending--;
            complete();
          }, 0);
          return request;
        },
        put(value, key) {
          assert.equal(mode, 'readwrite');
          tx.pending++;
          setTimeout(() => {
            data.set(key, value);
            tx.pending--;
            complete();
          }, 0);
        }
      });
      return tx;
    }
  };
  return {
    data,
    open() {
      const request = { result: null, onupgradeneeded: null, onsuccess: null, onerror: null, onblocked: null };
      setTimeout(() => {
        request.result = db;
        if (!created) request.onupgradeneeded?.();
        request.onsuccess?.();
      }, 0);
      return request;
    }
  };
}

const fakeDb = makeIndexedDb();
const sandbox = {
  crypto: webcrypto,
  indexedDB: { open: () => fakeDb.open() },
  TextEncoder,
  TextDecoder,
  atob,
  btoa,
  console: { warn() {}, error() {} },
  setTimeout,
  clearTimeout
};
sandbox.globalThis = sandbox;
vm.runInNewContext(cryptoSource, sandbox, { timeout: 3000 });
vm.runInNewContext(vaultSource, sandbox, { timeout: 3000 });

const vault = sandbox.AnwarTasbihVault;
assert.ok(vault, 'the independent vault API is registered');
const original = {
  count: 42,
  dhikr: 'سبحان الله',
  customDhikrs: ['ذكر خاص'],
  removedOfficialDhikrs: [],
  theme: 'emerald',
  elapsedMs: 123000,
  designVersion: 'royal-reference-1'
};
const password = 'Correct horse battery staple 2026';

await vault.create(password, original);
assert.equal(vault.isUnlocked(), true, 'the vault unlocks only after encrypted primary and backup are verified');
const encryptedPrimary = fakeDb.data.get('primary');
const encryptedBackup = fakeDb.data.get('backup');
assert.equal(typeof encryptedPrimary, 'string');
assert.equal(typeof encryptedBackup, 'string');
assert.ok(!encryptedPrimary.includes('سبحان الله'));
assert.ok(!encryptedPrimary.includes('ذكر خاص'));
assert.ok(!encryptedBackup.includes('سبحان الله'));
assert.ok(!encryptedBackup.includes('ذكر خاص'));
assert.ok(!encryptedPrimary.includes(password));
assert.ok(!encryptedBackup.includes(password));

const status = await vault.status();
assert.equal(status.exists, true);
assert.equal(status.primaryAvailable, true);
assert.equal(status.backupAvailable, true);
assert.equal(status.unlocked, true);

await vault.lock();
assert.equal(vault.isUnlocked(), false, 'locking discards the in-memory key');
await assert.rejects(() => vault.save(original), /مقفلة/);
await assert.rejects(() => vault.unlock('Incorrect password 2026'), /كلمة المرور|ملف الخزنة/);

const opened = await vault.unlock(password);
assert.deepEqual(JSON.parse(JSON.stringify(opened.data)), original);
assert.equal(opened.recoveredFromBackup, false);

const updated = { ...original, count: 43, elapsedMs: 124000 };
await vault.save(updated);
assert.notEqual(fakeDb.data.get('primary'), encryptedPrimary, 'each save creates fresh ciphertext');
assert.notEqual(fakeDb.data.get('backup'), encryptedBackup, 'the backup also receives fresh ciphertext');

fakeDb.data.set('primary', '{damaged-record');
await vault.lock();
const recovered = await vault.unlock(password);
assert.equal(recovered.recoveredFromBackup, true, 'a damaged primary opens only through its separately stored encrypted backup');
assert.equal(recovered.data.count, 43, 'backup fallback restores the most recent verified count');
await vault.lock();

console.log('Independent Tasbih vault tests passed: PBKDF2/AES-256-GCM, separate IndexedDB records, verified primary/backup writes, no plaintext/password at rest, lock, and backup recovery.');
