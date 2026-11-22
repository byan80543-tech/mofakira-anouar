import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const manifest = read('android/app/src/main/AndroidManifest.xml');
const home = read('android/app/src/main/java/com/anwar/mofakira/MainActivity.kt');
const activity = read('android/app/src/main/java/com/anwar/mofakira/NativeAdhkarActivity.kt');
const gradle = read('android/app/build.gradle.kts');
const legacy = read('android/app/src/main/java/com/anwar/mofakira/LegacyWebActivity.kt');
const migration = read('android/NATIVE_APP_MIGRATION.md');
const readme = read('android/README.md');

assert.match(manifest, /android:name="\.NativeAdhkarActivity"[\s\S]*?android:exported="false"/,
  'the native personal adhkar screen is registered as an internal activity');
assert.match(home, /"أذكار التحصين"[\s\S]*?NativeAdhkarActivity::class\.java/,
  'the home protection tile opens the native personal adhkar screen');
assert.match(activity, /class NativeAdhkarActivity : Activity\(\)/);
assert.doesNotMatch(activity, /WebView|WEB_MESSAGE_LISTENER|http:\/\/|https:\/\//,
  'the native personal notes screen has no web or remote service dependency');
assert.match(activity, /PREFS_NAME = "anwar_personal_adhkar"/);
assert.match(activity, /KEY_ENTRIES = "entries_v1"/);
assert.match(activity, /SharedPreferences/);
assert.match(activity, /JSONArray\(raw\)/);
assert.match(activity, /putString\(KEY_ENTRIES, array\.toString\(\)\)/);
assert.match(activity, /MAX_TEXT_LENGTH = 3000/);
assert.match(activity, /MAX_ENTRIES = 100/);
assert.match(activity, /InputFilter\.LengthFilter\(MAX_TEXT_LENGTH\)/);
assert.match(activity, /setTextIsSelectable\(true\)/);
assert.match(activity, /text = value/,
  'saved adhkar are rendered through Android text views rather than parsed markup');
assert.doesNotMatch(activity, /innerHTML|loadDataWithBaseURL/,
  'personal adhkar are never interpreted as HTML or loaded into a WebView');
assert.match(activity, /fun showEditor\(existing: Entry\?\)/);
assert.match(activity, /fun showManager\(\)/);
assert.match(activity, /fun confirmDelete\(entry: Entry\)/);
assert.match(activity, /entries\[index\] = existing\.copy\(text = value/);
assert.match(activity, /entries\.removeAll \{ it\.id == entry\.id \}/);
assert.match(activity, /UUID\.randomUUID\(\)/);
assert.match(activity, /managerContent\?\.let \{ populateManager\(it\) \}/,
  'the separate manager refreshes when an entry changes');
assert.match(activity, /LegacyWebActivity::class\.java/,
  'the previous web notebook remains reachable for older notes and its font catalogue');
assert.match(legacy, /WEB_MESSAGE_LISTENER/,
  'the existing web compatibility activity is retained');
assert.match(gradle, /versionCode = 6/);
assert.ok(gradle.includes('versionName = "0.6.0"'));
assert.match(migration, /أذكار التحصين الشخصية/);
assert.match(migration, /لا يوجد حتى الآن استيراد تلقائي/);
assert.match(readme, /NativeAdhkarActivity/);
assert.match(readme, /لا تنتقل تلقائيًا/);

console.log('Native personal adhkar screen, bounded local storage, editor/manager, legacy access and version tests passed.');
