import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const secure = read('android/app/src/main/java/com/anwar/mofakira/AnwarEncryptedStore.kt');
const adhkar = read('android/app/src/main/java/com/anwar/mofakira/NativeAdhkarActivity.kt');
const prayer = read('android/app/src/main/java/com/anwar/mofakira/PrayerSettings.kt');
const notebook = read('android/app/src/main/java/com/anwar/mofakira/NativeNotebookActivity.kt');
const gradle = read('android/app/build.gradle.kts');

assert.match(secure, /KeyStore\.getInstance\("AndroidKeyStore"\)/, 'private data key is held by Android Keystore');
assert.match(secure, /Cipher\.getInstance\("AES\/GCM\/NoPadding"\)/, 'private preference values use authenticated AES-GCM');
assert.match(secure, /\.setKeySize\(256\)/, 'the Keystore key is 256 bits');
assert.match(secure, /cipher\.updateAAD\(namespace\.toByteArray/, 'encrypted records are bound to their namespace');
assert.match(secure, /if \(read\(context, namespace\) != plaintext\)/, 'writes are read back and verified');
const singleMigration = secure.slice(secure.indexOf('fun readOrMigrate'), secure.indexOf('fun readPreferencesJson'));
const firstMigrationPath = singleMigration.slice(singleMigration.indexOf('val plaintext = legacy.getString'));
assert.ok(firstMigrationPath.indexOf('write(context, namespace, plaintext)') <
  firstMigrationPath.indexOf('if (read(context, namespace) != plaintext)') &&
  firstMigrationPath.indexOf('if (read(context, namespace) != plaintext)') <
  firstMigrationPath.indexOf('legacy.edit().remove(legacyKey).commit()'),
  'legacy adhkar text is removed only after encrypted replacement verification');
const multiMigration = secure.slice(secure.indexOf('fun readPreferencesJson'), secure.indexOf('private fun preferencesToJson'));
assert.ok(multiMigration.indexOf('write(context, namespace, plaintext)') <
  multiMigration.indexOf('if (read(context, namespace) != plaintext)') &&
  multiMigration.indexOf('if (read(context, namespace) != plaintext)') <
  multiMigration.indexOf('legacy.edit().clear().commit()'),
  'legacy prayer preferences are cleared only after encryption verification');

assert.match(adhkar, /AnwarEncryptedStore\.readOrMigrate/, 'personal adhkar migrate into encrypted storage');
assert.match(adhkar, /AnwarEncryptedStore\.write/, 'personal adhkar updates are encrypted');
assert.doesNotMatch(adhkar, /preferences\.edit\(\)\.putString\(KEY_ENTRIES/,
  'personal adhkar are no longer written as plaintext preferences');
assert.match(adhkar, /storageAvailable = false/, 'storage failures block further edits instead of replacing unreadable records');

assert.match(prayer, /AnwarEncryptedStore\.readPreferencesJson/, 'prayer settings and schedules load from encrypted storage');
assert.match(prayer, /AnwarEncryptedStore\.write/, 'prayer settings and schedule updates are encrypted');
assert.doesNotMatch(prayer, /getSharedPreferences\(PREFS/,
  'native prayer settings no longer read plaintext SharedPreferences directly');

assert.match(notebook, /FLAG_SECURE/, 'native notebook screens are protected from screenshots and recent-app previews');
assert.match(notebook, /BIOMETRIC_STRONG[\s\S]*?DEVICE_CREDENTIAL/, 'Android 11+ accepts strong biometrics or the system device credential');
assert.match(notebook, /setAllowedAuthenticators\(authenticators\)/, 'the system authentication prompt is explicitly configured');
assert.match(notebook, /REQUEST_DEVICE_UNLOCK/, 'older Android versions use system device credential confirmation');
assert.match(notebook, /authenticationRequiredOnResume = true/, 'leaving the foreground marks the notebook as requiring authentication again');
assert.match(notebook, /notes\.clear\(\)/, 'private note models are cleared from the active screen on relock');
assert.match(notebook, /externalActivityPending = true[\s\S]*?REQUEST_EXPORT/, 'the encrypted backup file picker is not mistaken for an app-background lock');
assert.match(gradle, /androidx\.biometric:biometric:1\.1\.0/, 'AndroidX Biometric is included');

console.log('Android private-storage encryption, safe migration, and device re-authentication checks passed.');
