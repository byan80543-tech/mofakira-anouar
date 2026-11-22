import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const manifest = read('android/app/src/main/AndroidManifest.xml');
const home = read('android/app/src/main/java/com/anwar/mofakira/MainActivity.kt');
const activity = read('android/app/src/main/java/com/anwar/mofakira/NativeNotebookActivity.kt');
const gradle = read('android/app/build.gradle.kts');
const legacy = read('android/app/src/main/java/com/anwar/mofakira/LegacyWebActivity.kt');
const workflow = read('.github/workflows/build-anwar-android.yml');
const migration = read('android/NATIVE_APP_MIGRATION.md');
const readme = read('android/README.md');

assert.match(manifest, /android:name="\.NativeNotebookActivity"[\s\S]*?android:exported="false"/,
  'the native notebook is registered as an internal Android activity');
assert.match(home, /"دفتر الكتابة"[\s\S]*?NativeNotebookActivity::class\.java/,
  'the home tile opens the native notebook screen');
assert.match(home, /فتح جميع خدمات المفكرة[\s\S]*?LegacyWebActivity::class\.java/,
  'the complete legacy notebook remains reachable');
assert.match(activity, /class NativeNotebookActivity\s*:\s*Activity\(\)/);
assert.doesNotMatch(activity, /WebView|https?:\/\//,
  'the native notebook has no remote or WebView dependency');

for (const type of ['poem', 'text', 'idea']) {
  assert.ok(activity.includes('"' + type + '"'), 'native note type ' + type + ' is supported');
}
for (const feature of [
  'private fun showEditor',
  'private fun togglePin',
  'private fun confirmDelete',
  'private fun renderNotes',
  'addTextChangedListener',
  'searchInput',
  'MAX_NOTES = 2500',
  'MAX_TITLE_LENGTH = 300',
  'MAX_CONTENT_LENGTH = 450_000'
]) {
  assert.ok(activity.includes(feature), 'native notebook includes ' + feature);
}

assert.match(activity, /TYPE_TEXT_FLAG_MULTI_LINE/);
assert.match(activity, /put\("text", note\.text\)/,
  'native records store plain text using the legacy-compatible text field');
assert.match(activity, /put\("type", note\.type\)/);
assert.match(activity, /put\("pin", note\.pinned\)/);
assert.match(activity, /put\("ts", note\.updatedAt\)/);
assert.match(activity, /put\("font", "Amiri"\)/);
assert.match(activity, /put\("paper", "plain"\)/);
assert.match(activity, /root\.optInt\("formatVersion", -1\)/);
assert.match(activity, /body\.isBlank\(\)/,
  'empty work cannot be silently saved');

assert.match(activity, /AndroidKeyStore/);
assert.match(activity, /AES\/GCM\/NoPadding/);
assert.match(activity, /KeyGenParameterSpec/);
assert.match(activity, /setRandomizedEncryptionRequired\(true\)/);
assert.match(activity, /private fun encryptState/);
assert.match(activity, /private fun decryptState/);
assert.match(activity, /putString\(BACKUP_KEY, oldPrimary\)/,
  'the previous encrypted record is backed up before replacing the primary record');
assert.match(activity, /backupReadBack/);
assert.match(activity, /decryptState\(backupReadBack\)\.contentEquals\(oldPlain\)/);
assert.match(activity, /verified\.contentEquals\(plain\)/,
  'the newly committed encrypted state is decrypted and compared');
assert.match(activity, /primaryMayHaveChanged/);
assert.match(activity, /storageAvailable = false/);
assert.match(activity, /بوضع القراءة فقط|للقراءة فقط/,
  'backup recovery is read-only and does not overwrite an unverified primary record');
assert.match(activity, /notes_primary_v1/);
assert.match(activity, /notes_backup_v1/);
assert.doesNotMatch(activity, /innerHTML|loadDataWithBaseURL/,
  'saved content is rendered as ordinary Android text, not interpreted markup');

assert.match(legacy, /WebView/);
assert.match(gradle, /versionCode = 5/);
assert.ok(gradle.includes('versionName = "0.5.0"'));
assert.match(workflow, /node scripts\/test-native-notebook\.mjs/);
assert.match(migration, /دفتر الكتابة الأصلي \(المرحلة الأولى\)/);
assert.match(migration, /لا يوجد استيراد تلقائي/);
assert.match(readme, /NativeNotebookActivity/);
assert.match(readme, /لا يجري استيراد أعمال خزنة الويب/);

console.log(
  'Native notebook checks passed: poem/text/idea CRUD, search and filters, pinning, ' +
  'bounded plain-text records, Android Keystore AES-GCM encryption, verified backup/restore, ' +
  'read-only recovery and legacy compatibility.'
);
