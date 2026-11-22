import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCipheriv, createDecipheriv, createHmac, pbkdf2Sync, randomBytes, webcrypto } from 'node:crypto';

if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}
await import('../vault-crypto.js');
const pwaVault = globalThis.AnwarVaultCrypto;
assert.ok(pwaVault, 'the existing PWA vault crypto API is available');

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const activity = read('android/app/src/main/java/com/anwar/mofakira/NativeNotebookActivity.kt');
const test = read('scripts/test-native-notebook.mjs');
const gradle = read('android/app/build.gradle.kts');
const workflow = read('.github/workflows/build-anwar-android.yml');

const password = 'Portable-Notebook-2026';
const plaintext = JSON.stringify({
  notes: [{
    id: 'legacy-poem-1',
    title: 'قصيدة محفوظة',
    type: 'poem',
    html: '<div>بيت أول</div><div>بيت ثانٍ</div>',
    pin: true,
    ts: 1763400000000,
    font: 'Amiri',
    size: 20,
    paper: 'poetry',
    history: [{ title: 'مسودة سابقة', type: 'poem', html: '<div>مسودة</div>', ts: 1763300000000, font: 'Amiri', size: 20, paper: 'plain' }]
  }],
  customAdhkar: [],
  theme: '',
  palette: 'blue',
  wallColor: 'mist',
  paperColor: 'white',
  days: [],
  preferences: {}
});

// A PWA-generated encrypted envelope must be decryptable by the PBKDF2/AES-GCM
// parameters implemented by Android, including the exact authenticated metadata.
const pwaCreated = await pwaVault.createVault(password, plaintext);
const pwaEnvelope = pwaCreated.envelope;
assert.equal(pwaEnvelope.format, 'anwar-vault');
assert.equal(pwaEnvelope.kdf, 'PBKDF2-HMAC-SHA-256');
assert.equal(pwaEnvelope.cipher, 'AES-256-GCM');
assert.equal(pwaEnvelope.iterations, 600000);

function derive(passwordText, saltText, iterations) {
  return pbkdf2Sync(
    Buffer.from(passwordText, 'utf8'),
    Buffer.from(saltText, 'base64'),
    iterations,
    32,
    'sha256'
  );
}
function associatedData(envelope) {
  return Buffer.from([
    envelope.format,
    envelope.version,
    envelope.kdf,
    envelope.cipher,
    envelope.iterations,
    envelope.salt
  ].join('|'), 'utf8');
}
function derivePortableOneBlock(passwordText, salt, iterations) {
  const passwordBytes = Buffer.from(passwordText, 'utf8');
  const firstBlock = Buffer.concat([salt, Buffer.from([0, 0, 0, 1])]);
  let u = createHmac('sha256', passwordBytes).update(firstBlock).digest();
  const derived = Buffer.from(u);
  for (let round = 1; round < iterations; round++) {
    u = createHmac('sha256', passwordBytes).update(u).digest();
    for (let index = 0; index < derived.length; index++) {
      derived[index] ^= u[index];
    }
  }
  passwordBytes.fill(0);
  u.fill(0);
  firstBlock.fill(0);
  return derived;
}
const arabicPassword = 'عبارة مرور أنوار 2026';
const pbkdfSalt = randomBytes(16);
assert.equal(
  derivePortableOneBlock(arabicPassword, pbkdfSalt, 600000).toString('hex'),
  pbkdf2Sync(Buffer.from(arabicPassword, 'utf8'), pbkdfSalt, 600000, 32, 'sha256').toString('hex'),
  'the Android UTF-8 one-block PBKDF2-HMAC-SHA-256 loop matches the standard implementation for Arabic passwords'
);
function decryptEnvelope(passwordText, envelope) {
  const encrypted = Buffer.from(envelope.ciphertext, 'base64');
  const tag = encrypted.subarray(encrypted.length - 16);
  const data = encrypted.subarray(0, encrypted.length - 16);
  const decipher = createDecipheriv(
    'aes-256-gcm',
    derive(passwordText, envelope.salt, envelope.iterations),
    Buffer.from(envelope.iv, 'base64')
  );
  decipher.setAAD(associatedData(envelope));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
assert.equal(decryptEnvelope(password, pwaEnvelope), plaintext,
  'PWA AES-GCM envelope decrypts with UTF-8 PBKDF2-HMAC-SHA-256 and the shared AAD');

// Verify round-trip encryption for the Android-specific archive format while
// keeping the same PBKDF2/AES-GCM metadata and authenticated-data layout.
const nativeLike = {
  format: 'anwar-vault',
  version: 1,
  kdf: 'PBKDF2-HMAC-SHA-256',
  iterations: 600000,
  cipher: 'AES-256-GCM',
  salt: randomBytes(16).toString('base64')
};
const iv = randomBytes(12);
const cipher = createCipheriv('aes-256-gcm', derive(password, nativeLike.salt, nativeLike.iterations), iv);
cipher.setAAD(associatedData(nativeLike));
const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final(), cipher.getAuthTag()]);
nativeLike.iv = iv.toString('base64');
nativeLike.ciphertext = encrypted.toString('base64');
assert.equal(decryptEnvelope(password, nativeLike), plaintext,
  'the native backup envelope decrypts with the PWA-compatible contract');
assert.equal((await pwaVault.decryptEnvelope(password, nativeLike)).plaintext, plaintext,
  'the PWA crypto implementation can open an Android-exported encrypted backup');
const tamperedBytes = Buffer.from(pwaEnvelope.ciphertext, 'base64');
tamperedBytes[0] ^= 0x01;
assert.throws(
  () => decryptEnvelope(password, { ...pwaEnvelope, ciphertext: tamperedBytes.toString('base64') }),
  /authenticate|Unsupported state|unable to authenticate/i,
  'tampered authenticated ciphertext must fail'
);

// Android wiring, bounds, and transactional safeguards.
for (const feature of [
  'private fun showHistory',
  'private fun confirmRestoreHistory',
  'private fun parseHistory',
  'private fun encodeHistory',
  'private fun exportPortableBackup',
  'private fun selectBackupFile',
  'private fun encryptPortableBackup',
  'private fun decryptPortableBackup',
  'private fun parsePortableNotes',
  'private fun mergeImportedNotes',
  'private fun persistExportFile',
  'private fun readLimited',
  'ACTION_CREATE_DOCUMENT',
  'ACTION_OPEN_DOCUMENT',
  'Mac.getInstance("HmacSHA256")',
  'password.toByteArray(StandardCharsets.UTF_8)',
  'var u = mac.doFinal(firstBlock)',
  'u = mac.doFinal(u)',
  'AES/GCM/NoPadding',
  'PORTABLE_ITERATIONS = 600_000',
  'PORTABLE_FORMAT = "anwar-vault"',
  'externalPwaPaper(note.paper)',
  'externalPwaPaper(version.paper)',
  'plainTextToHtml(version.text)',
  'Html.fromHtml',
  'readBack.contentEquals(bytes)'
]) {
  assert.ok(activity.includes(feature), 'Android portable archive/history includes ' + feature);
}
assert.match(activity, /private const val MAX_HISTORY = 15/);
assert.match(activity, /MAX_PORTABLE_FILE_BYTES = 12 \* 1024 \* 1024/);
assert.match(activity, /history = parseHistory\(item\.optJSONArray\("history"\)\)/);
assert.match(activity, /if \(!saveEncryptedState\(\)\) \{[\s\S]*?notes\.clear\(\)[\s\S]*?notes\.addAll\(previous\)/,
  'an unsuccessful imported write restores the previous in-memory notes');
assert.match(activity, /setPositiveButton\("استبدال"\)/,
  'replacing existing records requires explicit confirmation');
assert.match(test, /persistent font\/size\/color\/paper formatting/);
assert.match(gradle, /versionCode = 10/);
assert.ok(gradle.includes('versionName = "0.9.1"'));
assert.match(workflow, /test-native-notebook-archive\.mjs/);

console.log('Native notebook archive checks passed: PWA PBKDF2/AES-GCM interoperability, tamper detection, 15-version history, bounded encrypted import/export, merge/replace rollback and version wiring.');
