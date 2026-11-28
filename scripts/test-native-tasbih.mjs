import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const generated = spawnSync(
  process.execPath,
  [path.join(root, 'scripts', 'generate-native-adhkar-catalog.mjs')],
  { cwd: root, encoding: 'utf8' }
);
assert.equal(
  generated.status,
  0,
  'the canonical official adhkar source must generate the Android asset: ' +
    (generated.stderr || generated.stdout || 'unknown generator error')
);

const catalogPath = path.join(
  root, 'android', 'app', 'src', 'main', 'assets', 'official-adhkar.json'
);
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
assert.ok(catalog.length >= 35, 'all official morning/evening/daily/tasbih entries are bundled');
for (const period of ['tasbih', 'morning', 'evening', 'daily']) {
  assert.ok(catalog.some((item) => item.period === period), 'the ' + period + ' category exists');
}
const tasbih = catalog.filter((item) => item.period === 'tasbih');
assert.ok(tasbih.length >= 9, 'all nine tasbih-specific official remembrances are carried across');
for (const id of [
  'tasbih-after-prayer',
  'tahmid-after-prayer',
  'takbir-after-prayer',
  'tahlil-complete-hundred',
  'tasbih-hundred-daily',
  'tahlil-hundred-daily',
  'four-beloved-words',
  'hawqala-open',
  'dua-after-prayer'
]) {
  assert.ok(tasbih.some((item) => item.id === id), 'official entry ' + id + ' is preserved');
}
assert.equal(
  tasbih.find((item) => item.id === 'hawqala-open').count,
  null,
  'a dhikr with no prescribed count remains explicitly unnumbered'
);
assert.equal(
  tasbih.find((item) => item.id === 'tasbih-after-prayer').count,
  33,
  'the source-defined post-prayer repetition count is preserved'
);

const activity = read('android/app/src/main/java/com/anwar/mofakira/NativeTasbihActivity.kt');
const manifest = read('android/app/src/main/AndroidManifest.xml');
const home = read('android/app/src/main/java/com/anwar/mofakira/MainActivity.kt');
const religiousGate = read('android/app/src/main/java/com/anwar/mofakira/ReligiousGateActivity.kt');
const gradle = read('android/app/build.gradle.kts');
const legacy = read('android/app/src/main/java/com/anwar/mofakira/LegacyWebActivity.kt');
const oldController = read('tasbih-controller.js');
const oldBehaviorTests = read('scripts/test-tasbih-behavior.mjs');
const oldOpenTests = read('scripts/test-tasbih-open.mjs');

assert.match(activity, /class NativeTasbihActivity\s*:\s*Activity\(\)/);
assert.match(activity, /private const val BEAD_COUNT = 33/);
assert.match(activity, /private fun completedBeads\(\)/);
assert.match(activity, /private fun addCount\(amount: Int\)/);
assert.match(activity, /private fun resetCount\(\)/);
assert.match(activity, /MAX_COUNT = 1_000_000_000/);

for (const theme of ['emerald', 'dark', 'pink', 'night', 'heritage', 'glass']) {
  assert.ok(activity.includes('"' + theme + '"'), 'the ' + theme + ' tasbih theme is retained');
}

for (const category of [
  'أذكار السبحة الرسمية',
  'أذكار الصباح الرسمية',
  'أذكار المساء الرسمية',
  'أذكار يومية',
  'أذكاري المضافة'
]) {
  assert.ok(activity.includes(category), 'native list includes ' + category);
}
assert.match(activity, /MAX_CUSTOM_DHIKRS = 30/);
assert.match(activity, /MAX_CUSTOM_LENGTH = 200/);
assert.match(activity, /private fun removeSelectedDhikr\(\)/);
assert.match(activity, /private fun restoreRemovedDhikrs\(\)/);
assert.match(activity, /private fun renderDhikrList\(\)/);

assert.match(activity, /الباقيات الصالحات/);
assert.match(activity, /أعظمها كلمات الذكر:/);
assert.match(activity, /Color\.rgb\(249, 220, 226\)/);
assert.match(activity, /Color\.rgb\(224, 234, 220\)/);
assert.match(activity, /counterFrame\.addView\(counterCenter/);
assert.match(activity, /mainRow\.addView\(listPanel/);
assert.match(activity, /private var themeKey = "pink"/);
assert.match(activity, /saved == "emerald"\) "pink"/);
assert.doesNotMatch(activity, /يتطلب إذن الميكروفون وخدمة التعرف الصوتي/);
assert.doesNotMatch(activity, /انطق الذكر المختار كاملاً\. لا تُعرض الكلمات المسموعة/);
assert.doesNotMatch(activity, /listPanel\.visibility = View\.GONE/);

assert.match(activity, /AndroidKeyStore/);
assert.match(activity, /AES\/GCM\/NoPadding/);
assert.match(activity, /KeyGenParameterSpec/);
assert.match(activity, /setRandomizedEncryptionRequired\(true\)/);
assert.match(activity, /verified\.contentEquals\(plain\)/);
assert.match(activity, /لم نكتب فوقه|لم نحذف السجل السابق/);
assert.match(activity, /getSharedPreferences\(PREFS_NAME, MODE_PRIVATE\)/);
assert.doesNotMatch(activity, /http:\/\/|https:\/\//,
  'the native tasbih does not use the old web screen as its interface');

assert.match(activity, /SpeechRecognizer/);
assert.match(activity, /Build\.VERSION\.SDK_INT < Build\.VERSION_CODES\.S/,
  "voice counting fails closed below Android 12 rather than using a general recognizer");
assert.match(activity, /SpeechRecognizer\.isOnDeviceRecognitionAvailable\(this\)/,
  "the app checks that an on-device speech service is actually present");
assert.match(activity, /SpeechRecognizer\.createOnDeviceSpeechRecognizer\(this\)/,
  "the tasbih uses Android's dedicated on-device recognizer");
assert.doesNotMatch(activity, /SpeechRecognizer\.createSpeechRecognizer\(this\)/,
  "the app never falls back to the general recognizer that may use remote processing");
assert.match(activity, /RecognizerIntent\.EXTRA_PREFER_OFFLINE/,
  "the recognition request also prefers offline processing");
assert.match(activity, /لم يتم الرجوع إلى خدمة خارجية/,
  "the user is told that unavailable local recognition does not trigger a remote fallback");
const recognitionErrorHandler = activity.slice(
  activity.indexOf("override fun onError(error: Int)"),
  activity.indexOf("override fun onResults(results: Bundle?)")
);
assert.doesNotMatch(recognitionErrorHandler, /ERROR_NETWORK(?:_TIMEOUT)?\s*\|\|/,
  "network errors are not automatically retried as if remote recognition were acceptable");
assert.match(recognitionErrorHandler, /ERROR_NETWORK[\s\S]*?stopVoice\(message\)/,
  "network errors stop the local voice session and keep manual counting available");
assert.doesNotMatch(activity, /Cloudflare|Workers AI|fetch\(/,
  "native tasbih recognition never uploads audio to a cloud endpoint");
assert.match(activity, /listOf\("ar-MA", "ar-SA", "ar"\)/);
assert.match(activity, /private fun normalizeSpeech/);
assert.match(activity, /private fun countPhraseMatches/);
assert.match(activity, /private fun bestSpeechCandidate/);
assert.match(activity, /partialSpeechText/);
assert.match(activity, /finalSpeechSegments/);
assert.doesNotMatch(activity, /voiceStatus\.text\s*=\s*(candidate|partialSpeechText|completeText)/,
  'recognized words are never displayed');
assert.doesNotMatch(activity, /put\("(transcript|speechText|recognizedWords|audio)"/,
  'recognized words/audio are never included in the saved tasbih state');

assert.match(manifest, /android\.permission\.RECORD_AUDIO/);
assert.match(manifest, /android:name="\.NativeTasbihActivity"[\s\S]*?android:exported="false"/);
assert.match(manifest, /android\.speech\.RecognitionService/);
assert.match(religiousGate, /LegacyWebActivity::class\.java/);
assert.match(legacy, /WebView/);
assert.match(gradle, /versionCode = 19/);
assert.ok(gradle.includes('versionName = "0.10.0"'));

assert.ok(oldController.includes("preferences.set('tasbih'"),
  'the existing encrypted web preference adapter remains in place');
assert.ok(oldBehaviorTests.includes('royal tasbih ring renders exactly 33 beads'));
assert.ok(oldBehaviorTests.includes('recognition prefers the visitor’s Moroccan Arabic locale'));
assert.ok(oldOpenTests.includes('encrypted counter preferences and saved state remain active'));

assert.match(religiousGate, /PortalItem\("📿", "السبحة"/);
assert.match(religiousGate, /NativeTasbihActivity::class\.java/);
console.log(
  'Native tasbih checks passed: ' + catalog.length +
  ' official adhkar entries, nine tasbih-specific entries, 33 beads, six themes, ' +
  'custom/remove/restore, Android Keystore encryption, Arabic speech counting, ' +
  'legacy access and version wiring.'
);
