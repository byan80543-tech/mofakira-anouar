import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const activity = read('android/app/src/main/java/com/anwar/mofakira/NativeNotebookActivity.kt');
const workflow = read('.github/workflows/android-validation.yml');

assert.match(activity, /KEY_ALIAS = "anwar_mofakira_notebook_aes_gcm_v2"/,
  'new notebook records use a distinct v2 Keystore alias');
assert.match(activity, /LEGACY_KEY_ALIAS = "anwar_mofakira_notebook_aes_gcm_v1"/,
  'the previous key is retained only as a migration key');
assert.match(activity, /\.setUserAuthenticationRequired\(true\)/,
  'the new data key requires Android user authentication');
assert.match(activity, /\.setUserAuthenticationParameters\(\s*KEY_AUTH_VALIDITY_SECONDS,\s*KeyProperties\.AUTH_BIOMETRIC_STRONG or KeyProperties\.AUTH_DEVICE_CREDENTIAL\s*\)/,
  'Android 11+ authorizes the key for strong biometrics or device credentials');
assert.match(activity, /setUserAuthenticationValidityDurationSeconds\(KEY_AUTH_VALIDITY_SECONDS\)/,
  'Android 6–10 uses the compatible time-based device-credential authorization API');
assert.match(activity, /KEY_AUTH_VALIDITY_SECONDS = 300/,
  'the authorization window is bounded to five minutes');
assert.match(activity, /setAllowedAuthenticators\(authenticators\)/,
  'the system prompt uses the same biometric/device-credential pair');
assert.match(activity, /prompt\.authenticate\(promptInfo\)/,
  'fallback mode deliberately uses the non-CryptoObject prompt required by Android for biometric-or-device-credential time-window keys');
assert.doesNotMatch(activity, /prompt\.authenticate\(promptInfo,\s*androidx\.biometric\.BiometricPrompt\.CryptoObject/,
  'device-credential fallback is not combined with a CryptoObject');
assert.ok(activity.indexOf('ensureAuthBoundKeystoreKey()') < activity.indexOf('prompt.authenticate(promptInfo)'),
  'the key exists before the user authentication event authorizes its use');

assert.match(activity, /STATE_ENVELOPE_VERSION = 0xA2/,
  'new ciphertext envelopes carry an unambiguous version marker');
assert.match(activity, /decryptAuthBoundState\(encoded\)/,
  'v2 records are decrypted only with the auth-bound key');
assert.match(activity, /decryptLegacyState\(encoded\)/,
  'legacy records can be read for migration without reusing the old key for new encryption');
assert.match(activity, /migrateLegacyNotebookRecords\(primary, plain\)/,
  'legacy records migrate only after successful authenticated decryption');
assert.match(activity, /MIGRATION_OLD_PRIMARY_KEY/,
  'legacy primary ciphertext is staged before migration');
assert.match(activity, /MIGRATION_OLD_BACKUP_KEY/,
  'legacy backup ciphertext is staged before migration');
assert.match(activity, /recoverInterruptedKeyMigration\(\)/,
  'an interrupted migration is verified or rolled back on the next open');
assert.match(activity, /decryptAuthBoundState\(primaryReadBack\)\.contentEquals\(primaryPlain\)/,
  'the migrated primary is decrypted and byte-compared before old ciphertext is discarded');
assert.match(activity, /decryptAuthBoundState\(backupReadBack\)\.contentEquals\(backupPlain\)/,
  'the migrated backup is decrypted and byte-compared before old ciphertext is discarded');
assert.match(activity, /deleteLegacyKeystoreKey\(\)/,
  'the old unbound key is removed only after verified migration cleanup');
assert.match(activity, /isUserAuthenticationExpired\(error\)/,
  'expired authorization is distinguished from data corruption');
assert.match(activity, /if \(authExpired && notebookOpened\)\s*\{\s*runCatching \{ authenticateBeforeOpening\(\) \}/,
  'an expired key prompts for fresh device authentication instead of silently overwriting data');
assert.match(activity, /if \(!notebookOpened\) finish\(\)/,
  'cancelling a refresh prompt does not discard the still-open editor');
assert.match(activity, /authenticationRequiredOnResume = true[\s\S]*?notes\.clear\(\)/,
  'the UI still locks and clears displayed note models immediately on backgrounding');

assert.match(workflow, /test-android-notebook-auth-bound-key\.mjs/,
  'the regression test is wired into Android validation');

console.log('Native notebook Keystore authentication binding and safe key-migration checks passed.');
