import fs from 'node:fs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const exists = (path) => fs.existsSync(new URL('../' + path, import.meta.url));
const testPath = new URL(import.meta.url).pathname;
const syntax = spawnSync(process.execPath, ['--check', testPath], { encoding: 'utf8' });
assert.equal(syntax.status, 0, 'native audio test script must parse: ' + (syntax.stderr || syntax.stdout));

const manifest = read('android/app/src/main/AndroidManifest.xml');
const gradle = read('android/app/build.gradle.kts');
const rootGradle = read('android/build.gradle.kts');
const home = read('android/app/src/main/java/com/anwar/mofakira/MainActivity.kt');
const notebook = read('android/app/src/main/java/com/anwar/mofakira/NativeNotebookActivity.kt');
const gate = read('android/app/src/main/java/com/anwar/mofakira/ReligiousGateActivity.kt');
const activity = read('android/app/src/main/java/com/anwar/mofakira/NativeAudioActivity.kt');
const artwork = read('android/app/src/main/java/com/anwar/mofakira/NativeAudioArtwork.kt');
const roseButton = read('android/app/src/main/java/com/anwar/mofakira/NativeRosePlayButton.kt');
const service = read('android/app/src/main/java/com/anwar/mofakira/playback/NativeMediaService.kt');
const catalog = read('android/app/src/main/java/com/anwar/mofakira/playback/NativeMediaCatalog.kt');
const legacy = read('android/app/src/main/java/com/anwar/mofakira/LegacyWebActivity.kt');

assert.match(gradle, /versionCode = 19/);
assert.match(gradle, /versionName = "0.10.0"/);
assert.match(gradle, /androidx\.media3:media3-exoplayer:1\.11\.1/);
assert.match(gradle, /androidx\.media3:media3-session:1\.11\.1/);
assert.match(rootGradle, /org\.jetbrains\.kotlin\.android.*2\.3\.21/);
assert.match(manifest, /FOREGROUND_SERVICE_MEDIA_PLAYBACK/);
assert.match(manifest, /android:name="\.NativeAudioActivity"[\s\S]*?android:exported="false"/);
assert.doesNotMatch(manifest, /NativeAudioWebActivity/,
  'the retired audio WebView activity is no longer registered');
assert.equal(
  exists('android/app/src/main/java/com/anwar/mofakira/NativeAudioWebActivity.kt'),
  false,
  'the dedicated audio WebView source file is removed'
);

assert.match(gate, /NativeAudioActivity::class\.java/);
assert.match(gate, /NativeAudioActivity\.MODE_QURAN/);
assert.match(gate, /NativeAudioActivity\.MODE_RADIO/);
assert.match(gate, /NativeAudioActivity\.MODE_LESSONS/);
assert.doesNotMatch(gate, /NativeAudioWebActivity::class\.java/);

assert.match(activity, /class NativeAudioActivity : Activity\(\)/);
assert.doesNotMatch(activity, /WebView|JavascriptInterface|WebViewClient|android\.webkit/,
  'the native audio activity has no WebView or JavaScript bridge');
assert.match(activity, /MediaController\.Builder\(this, token\)\.buildAsync\(\)/);
assert.match(activity, /NativeMediaService::class\.java/);
assert.match(activity, /MODE_QURAN/);
assert.match(activity, /MODE_RADIO/);
assert.match(activity, /MODE_LESSONS/);
assert.match(activity, /MODE_IBTIHALAT/);
assert.match(activity, /private fun renderQuran\(/);
assert.match(activity, /private fun showSurahPickerDialog\(/);
assert.match(activity, /private fun applyReciterFilter\(/);
assert.match(activity, /private fun renderRadio\(/);
assert.match(activity, /private fun renderLessons\(/);
assert.match(activity, /private fun renderIbtihalat\(/);
assert.match(activity, /private fun playQuran\(/);
assert.match(activity, /private fun playStation\(/);
assert.match(activity, /private fun playLessons\(/);
assert.match(activity, /private fun playDevotional\(/);
assert.match(activity, /seekToPreviousMediaItem/);
assert.match(activity, /seekToNextMediaItem/);
assert.match(activity, /private lateinit var seekBar: SeekBar/);
assert.match(activity, /private lateinit var volumeSeekBar: SeekBar/);
assert.match(activity, /controller\?\.volume = safePercent \/ 100f/);
assert.match(activity, /private fun updateVolumeUi\(\)/);
assert.match(activity, /private fun openExternal\(url: String\)/,
  'native audio keeps the approved source-opening action without a JavaScript bridge');
assert.match(activity, /NativeAudioArtwork\.badge/);
assert.match(activity, /NativeRosePlayButton\(/);

assert.match(artwork, /private const val TULIP_ASSET = "audio\/tulip-cutout\.svg"/);
assert.match(artwork, /BitmapFactory\.decodeByteArray/);
assert.match(roseButton, /R\.drawable\.anwar_rose_closed/);
assert.match(roseButton, /R\.drawable\.anwar_rose_open/);
assert.ok(exists('android/app/src/main/assets/audio/tulip-cutout.svg'),
  'the exact original tulip asset remains bundled for NativeAudioArtwork');
assert.ok(exists('android/app/src/main/res/drawable-nodpi/anwar_rose_closed.png'));
assert.ok(exists('android/app/src/main/res/drawable-nodpi/anwar_rose_open.png'));

for (const path of [
  'android/app/src/main/assets/audio/index.html',
  'android/app/src/main/assets/audio/app.css',
  'android/app/src/main/assets/audio/app.js',
  'android/app/src/main/assets/audio/royal-rose-closed.svg',
  'android/app/src/main/assets/audio/royal-rose-open.svg'
]) {
  assert.equal(exists(path), false, 'obsolete audio WebView asset is removed: ' + path);
}

assert.match(service, /class NativeMediaService : MediaSessionService\(\)/);
assert.match(service, /ExoPlayer\.Builder\(this\)/);
assert.match(service, /MediaSession\.Builder\(this, exoPlayer\)/);
assert.match(service, /persistPlaybackState\(\)/);
assert.match(service, /restorePlaybackState\(exoPlayer\)/);
assert.match(service, /KEY_POSITION/);
assert.match(service, /PERSIST_INTERVAL_MS = 15_000L/);
assert.match(service, /Deliberately do not call prepare\(\) or play\(\)/);
assert.match(service, /setHandleAudioBecomingNoisy\(true\)/);
assert.match(manifest, /android:name="\.playback\.NativeMediaService"[\s\S]*?android:foregroundServiceType="mediaPlayback"/);

assert.match(catalog, /https:\/\/www\.mp3quran\.net\/api\/v3\/reciters\?language=ar/);
assert.match(catalog, /https:\/\/www\.mp3quran\.net\/api\/v3\/radios\?language=ar/);
assert.match(catalog, /https:\/\/asmaki\.ma:8000\/radio\.mp3/);
assert.match(catalog, /https:\/\/archive\.org\/download\/20240309_20240309_1714/);
assert.match(catalog, /يا رب إن عظمت ذنوبي/);
assert.match(catalog, /أغيب وذو اللطائف لا يغيب/);
for (const id of ['tawhid','wasitiyya','dawa','usul','usul2','qawaid','nawqid','kashf','masail','usulIman','usulAqaid','kabair','sharia','maarij','jawhara']) {
  assert.ok(catalog.includes('"' + id + '"'), 'native audio catalog preserves lesson series ' + id);
}

assert.match(notebook, /radioToolbarButton = toolbarIconButton/);
assert.match(notebook, /private fun toggleRadioPlayback/);
assert.match(notebook, /NativeMediaCatalog\.quickRadioStation\(\)/);
assert.match(catalog, /fun quickRadioStation\(\): LiveStation/);
assert.match(catalog, /quickRadioStation\(\)[\s\S]*?https:\/\/asmaki\.ma:8000\/radio\.mp3/);
assert.match(notebook, /controller\.setMediaItem\(item\)/);
assert.match(notebook, /controller\.pause\(\)/);
const radioToolbar = notebook.slice(notebook.indexOf('radioToolbarButton ='), notebook.indexOf('shell.addView(toolbar)'));
assert.doesNotMatch(radioToolbar, /startActivity|NativeAudioActivity/,
  'the home radio button starts and pauses the shared player directly instead of opening the audio library');

assert.match(legacy, /class LegacyWebActivity : Activity\(\)/);
assert.match(legacy, /WebView/,
  'the generic legacy activity remains available for features that have not yet migrated');
assert.match(manifest, /android:name="\.LegacyWebActivity"/);

console.log('Native Media3 audio is fully native: Quran, radio, lessons, devotional playback, tulip, native rose, seek and volume controls; audio WebView resources are retired.');
