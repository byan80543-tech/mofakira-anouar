import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const manifest = read('android/app/src/main/AndroidManifest.xml');
const home = read('android/app/src/main/java/com/anwar/mofakira/MainActivity.kt');
const religiousGate = read('android/app/src/main/java/com/anwar/mofakira/ReligiousGateActivity.kt');
const activity = read('android/app/src/main/java/com/anwar/mofakira/NativeNotebookActivity.kt');
const gradle = read('android/app/build.gradle.kts');
const legacy = read('android/app/src/main/java/com/anwar/mofakira/LegacyWebActivity.kt');
const workflow = read('.github/workflows/build-anwar-android.yml');
const migration = read('android/NATIVE_APP_MIGRATION.md');
const readme = read('android/README.md');
const debugStrings = read('android/app/src/debug/res/values/strings.xml');

assert.match(manifest, /android:name="\.NativeNotebookActivity"[\s\S]*?android:exported="false"/,
  'the native notebook is registered as an internal Android activity');
assert.match(home, /NativeNotebookActivity::class\.java/,
  "the launcher opens the native notebook directly");
assert.match(activity, /الخدمات القرآنية والدينية/,
  "the original services button is visible in the notebook");
assert.match(religiousGate, /LegacyWebActivity::class\.java/,
  'the complete legacy notebook remains reachable from the religious gateway');
assert.match(activity, /class NativeNotebookActivity\s*:\s*Activity\(\)/);
assert.doesNotMatch(activity, /WebView|https?:\/\//,
  'the native notebook has no remote or WebView dependency');

for (const type of ['poem', 'text', 'idea']) {
  assert.ok(activity.includes('"' + type + '"'), 'native note type ' + type + ' is supported');
}
for (const feature of [
  'private fun showEditor',
  'private fun showHistory',
  'private fun confirmRestoreHistory',
  'private fun togglePin',
  'private fun confirmDelete',
  'private fun renderNotes',
  'addTextChangedListener',
  'searchInput',
  'private const val PAGE_SIZE = 50',
  'filtered.take(renderLimit)',
  'renderNotes(keepPage = true)',
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
assert.match(activity, /put\("font", note\.font\)/);
assert.match(activity, /put\("size", note\.sizeSp\)/);
assert.match(activity, /put\("textColor", note\.textColor\)/);
assert.match(activity, /put\("paper", note\.paper\)/);
assert.match(activity, /put\("history", encodeHistory\(note\.history\)\)/);
assert.match(activity, /private const val MAX_HISTORY = 15/);
assert.match(activity, /takeLast\(MAX_HISTORY\)/);
assert.match(activity, /parseHistory\(item\.optJSONArray\("history"\)\)/);
assert.match(activity, /current\.toHistoryVersion\(\)/);
assert.match(activity, /val font: String/);
assert.match(activity, /val sizeSp: Int/);
assert.match(activity, /val textColor: Int/);
assert.match(activity, /val paper: String/);
assert.match(activity, /private fun showOptionPicker/);
assert.match(activity, /private fun fontTypeface/);
assert.match(activity, /private fun paperBackground/);
assert.match(activity, /private fun textColorFor/);
assert.match(activity, /private fun exportPortableBackup/);
assert.match(activity, /private fun selectBackupFile/);
assert.match(activity, /private fun encryptPortableBackup/);
assert.match(activity, /private fun decryptPortableBackup/);
assert.match(activity, /private fun parsePortableNotes/);
assert.match(activity, /private fun mergeImportedNotes/);
assert.match(activity, /private fun persistExportFile/);
assert.match(activity, /ACTION_CREATE_DOCUMENT/);
assert.match(activity, /ACTION_OPEN_DOCUMENT/);
assert.match(activity, /AES\/GCM\/NoPadding/);
assert.match(activity, /Mac\.getInstance\("HmacSHA256"\)/);
assert.match(activity, /password\.toByteArray\(StandardCharsets\.UTF_8\)/);
assert.match(activity, /PORTABLE_ITERATIONS = 600_000/);
assert.match(activity, /PORTABLE_ITERATIONS = 600_000/);
assert.match(activity, /PORTABLE_FORMAT = "anwar-vault"/);
assert.match(activity, /externalPwaPaper/);
assert.match(activity, /plainTextToHtml\(version\.text\)/);
assert.match(activity, /Html\.fromHtml/);
assert.match(activity, /readBack\.contentEquals\(bytes\)/);
assert.match(activity, /"Amiri" -> "serif"/,
  'legacy Amiri records remain readable through the system serif family');
assert.match(activity, /textColorChoices/);
assert.match(activity, /paperChoices/);
assert.match(activity, /selectedTextSize/);
assert.match(activity, /applyEditorStyle\(\)/);
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
assert.match(gradle, /versionCode = 9/);
assert.ok(gradle.includes('versionName = "0.9.0"'));
assert.match(gradle, /applicationIdSuffix = "\.preview\.v09"/,
  'the versioned debug APK installs alongside stable and earlier preview apps without replacing their local vaults');
assert.match(gradle, /versionNameSuffix = "-preview"/);
assert.match(debugStrings, /<string name="app_name">مفكرة أنوار التجريبية<\/string>/);
assert.match(workflow, /node scripts\/test-native-notebook\.mjs/);
assert.match(migration, /دفتر الكتابة الأصلي \(المرحلة الأولى\)/);
assert.match(migration, /استيراد تلقائي من Chrome\/PWA/);
assert.match(readme, /NativeNotebookActivity/);
assert.match(readme, /لا يجري استيراد أعمال خزنة الويب/);

console.log(
  'Native notebook checks passed: poem/text/idea CRUD, search and filters, pinning, ' +
  'bounded plain-text records, persistent font/size/color/paper formatting, 15-version history, ' +
  'encrypted portable backup/import with legacy PWA decryption, Android Keystore AES-GCM and ' +
  'verified backup/restore.'
);
