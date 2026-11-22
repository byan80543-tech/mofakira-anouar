import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');

const main = read('android/app/src/main/java/com/anwar/mofakira/MainActivity.kt');
const portal = read('android/app/src/main/java/com/anwar/mofakira/ReligiousGateActivity.kt');
const manifest = read('android/app/src/main/AndroidManifest.xml');
const gradle = read('android/app/build.gradle.kts');
const workflow = read('.github/workflows/build-anwar-android.yml');

assert.match(main, /NativeNotebookActivity::class\.java/, 'The first gateway must open the native notebook.');
assert.match(main, /NativeAudioActivity\.MODE_RADIO/, 'The radio shortcut must open radio mode.');
assert.match(main, /ReligiousGateActivity::class\.java/, 'The dedicated religion-gate card must navigate to the second gateway.');
assert.match(main, /NativePrayerActivity::class\.java/, 'Prayer-times shortcut must remain live.');
assert.match(main, /NativeAudioActivity\.MODE_QURAN/, 'Quran shortcut must open Quran mode.');
assert.match(main, /NativeTasbihActivity::class\.java/, 'Tasbih shortcut must remain live.');
assert.match(main, /RippleDrawable/, 'Clickable first-gateway cards must provide visible touch feedback.');

assert.match(portal, /PortalItem\("📖", "القرآن الكريم"/, 'Religion portal must include Quran.');
assert.match(portal, /NativeAudioActivity\.MODE_LESSONS/, 'Religion portal must include lessons.');
assert.match(portal, /NativePrayerActivity::class\.java/, 'Religion portal must include prayer times.');
assert.match(portal, /NativeAdhkarActivity::class\.java/, 'Religion portal must include adhkar.');
assert.match(portal, /NativeTasbihActivity::class\.java/, 'Religion portal must include tasbih.');
assert.match(portal, /LegacyWebActivity::class\.java/, 'Full legacy services must remain reachable.');
assert.match(portal, /setOnClickListener \{ finish\(\) \}/, 'The visible return action must go back to the first gateway.');

assert.match(manifest, /android:name="\.ReligiousGateActivity"/, 'Second gateway must be registered.');
assert.match(gradle, /versionCode = 8/);
assert.match(gradle, /versionName = "0\.8\.0"/);
assert.match(gradle, /applicationIdSuffix = "\.preview\.v08"/);
assert.match(workflow, /node scripts\/test-native-gateway\.mjs/);

console.log('Native two-gateway navigation, route wiring, touch feedback and isolated preview version are valid.');
