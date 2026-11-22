import fs from 'node:fs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const manifest = read('android/app/src/main/AndroidManifest.xml');
const gradle = read('android/app/build.gradle.kts');
const gate = read('android/app/src/main/java/com/anwar/mofakira/ReligiousGateActivity.kt');
const activity = read('android/app/src/main/java/com/anwar/mofakira/NativeAudioWebActivity.kt');
const legacyActivity = read('android/app/src/main/java/com/anwar/mofakira/NativeAudioActivity.kt');
const service = read('android/app/src/main/java/com/anwar/mofakira/playback/NativeMediaService.kt');
const catalog = read('android/app/src/main/java/com/anwar/mofakira/playback/NativeMediaCatalog.kt');
const html = read('android/app/src/main/assets/audio/index.html');
const css = read('android/app/src/main/assets/audio/app.css');
const js = read('android/app/src/main/assets/audio/app.js');
const tulip = read('android/app/src/main/assets/audio/tulip-cutout.svg');
const roseClosed = read('android/app/src/main/assets/audio/royal-rose-closed.svg');
const roseOpen = read('android/app/src/main/assets/audio/royal-rose-open.svg');

assert.match(gradle, /versionCode = 16/);
assert.match(gradle, /versionName = "0.9.7"/);
assert.match(gradle, /applicationIdSuffix = "\.preview.v16"/);
assert.match(manifest, /android:name="\.NativeAudioWebActivity"[\s\S]*?android:exported="false"/);
assert.match(gate, /NativeAudioWebActivity::class\.java/);
assert.match(gate, /NativeAudioActivity\.MODE_QURAN/);
assert.match(gate, /NativeAudioActivity\.MODE_RADIO/);
assert.match(gate, /NativeAudioActivity\.MODE_LESSONS/);

assert.match(activity, /file:\/\/\/android_asset\/audio\/index\.html/);
assert.match(activity, /addJavascriptInterface\(AudioBridge\(\), "AnwarAudioBridge"\)/);
assert.match(activity, /allowUniversalAccessFromFileURLs = false/);
assert.match(activity, /MIXED_CONTENT_NEVER_ALLOW/);
assert.match(activity, /MediaController\.Builder\(this, token\)\.buildAsync\(\)/);
assert.match(activity, /NativeMediaService::class\.java/);
assert.match(activity, /NativeMediaCatalog\.loadReciters\(\)/);
assert.match(activity, /NativeMediaCatalog\.loadStations\(\)/);
assert.match(activity, /NativeMediaCatalog\.lessonSeries/);
assert.match(activity, /player\.setMediaItems\(items, startIndex/);
assert.match(activity, /player\.repeatMode = repeatMode/);
assert.match(activity, /@JavascriptInterface fun playEdition/);
assert.match(activity, /@JavascriptInterface fun playStation/);
assert.match(activity, /@JavascriptInterface fun playLesson/);
assert.match(activity, /@JavascriptInterface fun seekTo/);
assert.match(activity, /@JavascriptInterface fun setVolume/);
assert.match(activity, /player\?\.volume/);
assert.match(activity, /player\.play\(\)/);
assert.match(activity, /controller\?\.release\(\)/);

assert.match(service, /class NativeMediaService : MediaSessionService/);
assert.match(service, /persistPlaybackState\(\)/,
  'the original UI must control the same persistent native playback service');
assert.match(legacyActivity, /class NativeAudioActivity/);

for (const id of [
  'quranScreen','radioScreen','lessonsScreen','ibtihalatScreen',
  'reciterGrid','reciterMore','surahPickerModal','surahPickerList',
  'lessonSeriesModal','lessonSeriesList','lessonList','stationGrid',
  'rpp','previousTrack','nextTrack','seekRange','volumeRange'
]) {
  assert.match(html, new RegExp('id="' + id + '"'), 'audio page contains ' + id);
}
assert.match(html, /id="reciterGrid" class="reciter-grid"/);
assert.match(html, /id="lessonList" class="lesson-list"/);
assert.match(html, /id="surahPickerModal"/);
assert.match(html, /id="lessonSeriesModal"/);

assert.match(css, /\.reciter-card/);
assert.match(css, /\.reciter-seal/);
assert.match(css, /\.reciter-play/);
assert.match(css, /royal-rose-closed\.svg/);
assert.match(css, /royal-rose-open\.svg/);
assert.match(css, /anwarFlowerBloom/);
assert.match(css, /\.surah-picker-option/);
assert.match(css, /\.lesson-series-option/);
assert.match(css, /\.lesson-item/);
assert.match(css, /\.lesson-tulip/);
assert.match(css, /max-height:min\(88dvh,780px\)/);

assert.ok(tulip.includes('data:image/webp;base64,'), 'original transparent tulip artwork is bundled locally');
assert.ok(roseClosed.startsWith('<svg') && roseOpen.startsWith('<svg'),
  'the original closed and open flower controls are bundled locally');

assert.match(js, /AnwarAudioBridge/);
assert.match(js, /groupReciters/);
assert.match(js, /renderSurahOptions/);
assert.match(js, /renderSeriesOptions/);
assert.match(js, /AnwarAudioBridge/);
assert.match(js, /playEdition/);
assert.match(js, /playStation/);
assert.match(js, /playLesson/);
assert.match(js, /onPlayerState/);
assert.match(js, /textContent/,
  'catalog values are written as text, not injected as HTML');
assert.doesNotMatch(js, /\bfetch\s*\(/,
  'the local interface does not create a second network audio or data client');

const jsPath = new URL('../android/app/src/main/assets/audio/app.js', import.meta.url);
const syntax = spawnSync(process.execPath, ['--check', jsPath.pathname], { encoding: 'utf8' });
assert.equal(syntax.status, 0, 'audio JavaScript must parse: ' + (syntax.stderr || syntax.stdout));

console.log('Original Anwar Quran reader, tulip and rose lists, lesson dialogs, and native Media3 bridge tests passed.');
