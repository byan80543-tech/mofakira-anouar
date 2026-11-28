import fs from 'node:fs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const exists = (path) => fs.existsSync(new URL('../' + path, import.meta.url));
const testPath = new URL(import.meta.url).pathname;
const syntax = spawnSync(process.execPath, ['--check', testPath], { encoding: 'utf8' });
assert.equal(syntax.status, 0, 'audio WebView retirement test must parse: ' + (syntax.stderr || syntax.stdout));

const manifest = read('android/app/src/main/AndroidManifest.xml');
const gate = read('android/app/src/main/java/com/anwar/mofakira/ReligiousGateActivity.kt');
const nativeAudio = read('android/app/src/main/java/com/anwar/mofakira/NativeAudioActivity.kt');
const nativeArtwork = read('android/app/src/main/java/com/anwar/mofakira/NativeAudioArtwork.kt');
const nativeRose = read('android/app/src/main/java/com/anwar/mofakira/NativeRosePlayButton.kt');
const mediaService = read('android/app/src/main/java/com/anwar/mofakira/playback/NativeMediaService.kt');
const legacy = read('android/app/src/main/java/com/anwar/mofakira/LegacyWebActivity.kt');

assert.doesNotMatch(manifest, /NativeAudioWebActivity/,
  'the dedicated audio WebView activity is no longer registered');
assert.doesNotMatch(gate, /NativeAudioWebActivity/,
  'the religious gateway has no route to the retired audio WebView');
assert.match(gate, /NativeAudioActivity::class\.java/,
  'the religious gateway launches the native audio screen');
assert.match(gate, /NativeAudioActivity\.MODE_QURAN/);
assert.match(gate, /NativeAudioActivity\.MODE_RADIO/);
assert.match(gate, /NativeAudioActivity\.MODE_LESSONS/);

assert.equal(
  exists('android/app/src/main/java/com/anwar/mofakira/NativeAudioWebActivity.kt'),
  false,
  'the obsolete audio WebView Activity source has been deleted'
);
for (const path of [
  'android/app/src/main/assets/audio/index.html',
  'android/app/src/main/assets/audio/app.css',
  'android/app/src/main/assets/audio/app.js',
  'android/app/src/main/assets/audio/royal-rose-closed.svg',
  'android/app/src/main/assets/audio/royal-rose-open.svg'
]) {
  assert.equal(exists(path), false, 'obsolete WebView audio asset is deleted: ' + path);
}

assert.doesNotMatch(nativeAudio, /WebView|JavascriptInterface|WebViewClient|android\.webkit/,
  'the native audio Activity contains no browser surface or JavaScript bridge');
assert.match(nativeAudio, /MediaController\.Builder\(this, token\)\.buildAsync\(\)/);
assert.match(nativeAudio, /NativeMediaService::class\.java/);
assert.match(nativeAudio, /volumeSeekBar = SeekBar\(this\)/);
assert.match(nativeAudio, /seekToNextMediaItem/);
assert.match(nativeAudio, /seekToPreviousMediaItem/);
assert.match(nativeAudio, /private fun renderQuran\(/);
assert.match(nativeAudio, /private fun renderRadio\(/);
assert.match(nativeAudio, /private fun renderLessons\(/);
assert.match(nativeAudio, /private fun renderIbtihalat\(/);

assert.match(nativeArtwork, /TULIP_ASSET = "audio\/tulip-cutout\.svg"/,
  'the exact original tulip is retained as the native list artwork');
assert.ok(exists('android/app/src/main/assets/audio/tulip-cutout.svg'));
assert.match(nativeRose, /R\.drawable\.anwar_rose_closed/);
assert.match(nativeRose, /R\.drawable\.anwar_rose_open/);
assert.ok(exists('android/app/src/main/res/drawable-nodpi/anwar_rose_closed.png'));
assert.ok(exists('android/app/src/main/res/drawable-nodpi/anwar_rose_open.png'));

assert.match(mediaService, /class NativeMediaService : MediaSessionService/);
assert.match(mediaService, /persistPlaybackState\(\)/);
assert.match(mediaService, /restorePlaybackState\(exoPlayer\)/);

assert.match(legacy, /class LegacyWebActivity : Activity\(\)/);
assert.match(legacy, /WebView/,
  'the general compatibility WebView remains available for features not yet migrated');
assert.match(manifest, /android:name="\.LegacyWebActivity"/,
  'the migration does not remove the general legacy compatibility activity');

const audioAssetNames = fs.readdirSync(new URL('../android/app/src/main/assets/audio/', import.meta.url)).sort();
assert.deepEqual(audioAssetNames, ['tulip-cutout.svg'],
  'the audio assets folder retains only the tulip bitmap container consumed by native Android');

console.log('Dedicated audio WebView and HTML shell retired; native Media3 audio and original tulip/rose artwork retained. General LegacyWebActivity remains.');
