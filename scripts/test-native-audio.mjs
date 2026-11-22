import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const manifest = read('android/app/src/main/AndroidManifest.xml');
const gradle = read('android/app/build.gradle.kts');
const rootGradle = read('android/build.gradle.kts');
const androidAppGradle = gradle;
const home = read('android/app/src/main/java/com/anwar/mofakira/MainActivity.kt');
const notebook = read('android/app/src/main/java/com/anwar/mofakira/NativeNotebookActivity.kt');
const religiousGate = read('android/app/src/main/java/com/anwar/mofakira/ReligiousGateActivity.kt');
const audioActivity = read('android/app/src/main/java/com/anwar/mofakira/NativeAudioActivity.kt');
const audioService = read('android/app/src/main/java/com/anwar/mofakira/playback/NativeMediaService.kt');
const catalog = read('android/app/src/main/java/com/anwar/mofakira/playback/NativeMediaCatalog.kt');
const legacy = read('android/app/src/main/java/com/anwar/mofakira/LegacyWebActivity.kt');

assert.match(androidAppGradle, /versionCode = 10/,
  "native tasbih migration increments the Android version code");
assert.match(androidAppGradle, /versionName = "0.9.1"/,
  "native tasbih migration increments the Android version name");
assert.match(gradle, /androidx\.media3:media3-exoplayer:1\.11\.1/);
assert.match(gradle, /androidx\.media3:media3-session:1\.11\.1/);

assert.match(rootGradle, /org\.jetbrains\.kotlin\.android.*2\.3\.21/,
  "Kotlin Gradle plugin is aligned with the Media3 transitive Kotlin metadata");assert.match(manifest, /FOREGROUND_SERVICE_MEDIA_PLAYBACK/);
assert.match(manifest, /android:name="\.NativeAudioActivity"[\s\S]*?android:exported="false"/);
assert.match(manifest, /android:name="\.playback\.NativeMediaService"[\s\S]*?android:exported="true"[\s\S]*?android:foregroundServiceType="mediaPlayback"/);
assert.match(manifest, /androidx\.media3\.session\.MediaSessionService/);
assert.match(audioService, /class NativeMediaService : MediaSessionService\(\)/);
assert.match(audioService, /ExoPlayer\.Builder\(this\)/);
assert.match(audioService, /MediaSession\.Builder\(this, exoPlayer\)/);
assert.match(audioService, /controllerInfo\.isTrusted/,
  'only trusted controllers such as the app and Android system can control the shared media session');
assert.match(audioService, /setHandleAudioBecomingNoisy\(true\)/);

assert.match(audioService, /persistPlaybackState\(\)/,
  'native playback saves the current queue and listening position');
assert.match(audioService, /restorePlaybackState\(exoPlayer\)/,
  'native playback restores the last listening queue after service recreation');
assert.match(audioService, /KEY_POSITION/);
assert.match(audioService, /PERSIST_INTERVAL_MS = 15_000L/,
  'playback progress is checkpointed periodically while audio is active');
assert.match(audioService, /Deliberately do not call prepare\(\) or play\(\)/,
  'restored playback never starts automatically');assert.match(audioActivity, /MediaController\.Builder\(this, token\)\.buildAsync\(\)/);
assert.match(audioActivity, /c\.setMediaItems\(items, index, 0L\)/,
  'Quran and lesson queues support starting at the selected track');
assert.match(audioActivity, /MODE_QURAN/);
assert.match(audioActivity, /MODE_RADIO/);
assert.match(audioActivity, /MODE_LESSONS/);
assert.match(audioActivity, /MODE_IBTIHALAT/);
assert.match(audioActivity, /NativeMediaService::class\.java/);
assert.doesNotMatch(audioActivity, /WebView|WEB_MESSAGE_LISTENER|mofakira-anouar\.pages\.dev/,
  'the native audio screen does not depend on the web notebook');
assert.match(audioActivity, /if \(c\.playbackState == Player\.STATE_IDLE\) c\.prepare\(\)/,
  'resuming a restored queue prepares ExoPlayer before starting playback');
assert.match(audioActivity, /seekToPreviousMediaItem/);
assert.match(audioActivity, /seekToNextMediaItem/);
assert.match(audioActivity, /setMediaItem\(item\)/,
  'live radio uses the same native player engine as other audio');
assert.match(religiousGate, /NativeAudioActivity\.MODE_LESSONS/,
  'lesson mode is opened from the dedicated religious gateway rather than cluttering the first screen');
assert.match(legacy, /WEB_MESSAGE_LISTENER/,
  'the legacy notebook and its adhan bridge remain available during migration');

assert.match(catalog, /https:\/\/www\.mp3quran\.net\/api\/v3\/reciters\?language=ar/);
assert.match(catalog, /https:\/\/www\.mp3quran\.net\/api\/v3\/radios\?language=ar/);
assert.match(catalog, /https:\/\/asmaki\.ma:8000\/radio\.mp3/);
assert.match(catalog, /https:\/\/archive\.org\/download\/20240309_20240309_1714/);
assert.match(catalog, /يا رب إن عظمت ذنوبي/);
assert.match(catalog, /أغيب وذو اللطائف لا يغيب/);
for (const id of ['tawhid','wasitiyya','dawa','usul','usul2','qawaid','nawqid','kashf','masail','usulIman','usulAqaid','kabair','sharia','maarij','jawhara']) {
  assert.ok(catalog.includes('"' + id + '"'), 'native audio catalog preserves lesson series ' + id);
}
assert.match(notebook, /NativeAudioActivity\.MODE_RADIO/);
assert.match(religiousGate, /NativeAudioActivity\.MODE_QURAN/);
assert.match(religiousGate, /NativeAudioActivity\.MODE_RADIO/);
console.log('Native Media3 playback, Quran, radio, lessons and devotional catalog tests passed.');
