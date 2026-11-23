import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const main = read('android/app/src/main/java/com/anwar/mofakira/MainActivity.kt');
const notebook = read('android/app/src/main/java/com/anwar/mofakira/NativeNotebookActivity.kt');
const portal = read('android/app/src/main/java/com/anwar/mofakira/ReligiousGateActivity.kt');
const manifest = read('android/app/src/main/AndroidManifest.xml');
const gradle = read('android/app/build.gradle.kts');
const workflow = read('.github/workflows/build-anwar-android.yml');

assert.match(main, /NativeNotebookActivity::class\.java/, 'The launcher opens the migrated native Android notebook.');
assert.match(notebook, /الخدمات القرآنية والدينية/, 'The services launcher uses the exact original label.');
assert.match(notebook, /NativePrayerActivity::class\\.java/, 'The notebook provides a direct entry to native prayer settings.');
assert.match(notebook, /أرشيف أنوار/, 'The archive control remains available.');
assert.match(notebook, /تشغيل إذاعة القرآن/, 'The radio toolbar control remains available.');
assert.match(notebook, /تبديل الوضع الليلي والنهاري/, 'The theme control remains available.');
assert.match(notebook, /تغيير ألوان المفكرة/, 'The palette control remains available.');
assert.match(notebook, /لا شيء هنا بعد/, 'The empty state matches the original copy.');
assert.match(notebook, /"all" to "الكل"/, 'The all filter remains present.');
assert.match(notebook, /weightSum = 5f/, 'All five filters fit in one row.');
assert.match(notebook, /radioToolbarButton = toolbarIconButton/);
assert.match(notebook, /private fun toggleRadioPlayback/);
assert.match(notebook, /private fun normalizeRichHtml/);
assert.match(notebook, /richHtmlFromEditor\(bodyInput\.text\)/);

assert.match(portal, /الخدمات القرآنية والدينية/);
for (const label of ['أصوات الأذان','اختيار الصوت والتنبيهات','القرآن الكريم','السور والقراء والتلاوات','الإذاعات','محطات البث المباشر','الدروس والمحاضرات','السلاسل والدروس الصوتية','أذكار التحصين','الأذكار اليومية والرقية','السبحة']) {
  assert.ok(portal.includes(label), 'Second screen retains original label: ' + label);
}
assert.doesNotMatch(portal, /بوابة الدين/, 'The visible service screen must not be named بوابة الدين.');
assert.match(portal, /NativeAudioActivity\.MODE_LESSONS/);
assert.match(portal, /NativeAudioWebActivity::class\.java/);
assert.match(portal, /NativePrayerActivity::class\.java/);
assert.match(portal, /NativeAdhkarActivity::class\.java/);
assert.match(portal, /NativeTasbihActivity::class\.java/);
assert.match(portal, /LegacyWebActivity::class\.java/);
assert.match(portal, /setOnClickListener \{ finish\(\) \}/, 'Close returns to the notebook.');
assert.match(manifest, /android:name="\.ReligiousGateActivity"/);
assert.match(manifest, /android:name="\.NativeAudioWebActivity"[\s\S]*?android:exported="false"/);
assert.match(gradle, /versionCode = 18/);
assert.match(gradle, /versionName = "0.9.9"/);
assert.match(gradle, /applicationIdSuffix = "\.preview.v17"/);
assert.match(workflow, /node scripts\/test-native-gateway\.mjs/);

console.log('Original notebook landing, exact service labels, navigation, archive and isolated preview version are valid.');
