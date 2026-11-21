import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const manifest = read('android/app/src/main/AndroidManifest.xml');
const gradle = read('android/app/build.gradle.kts');
const home = read('android/app/src/main/java/com/anwar/mofakira/MainActivity.kt');
const audioActivity = read('android/app/src/main/java/com/anwar/mofakira/NativeAudioActivity.kt');
const audioService = read('android/app/src/main/java/com/anwar/mofakira/playback/NativeMediaService.kt');
const catalog = read('android/app/src/main/java/com/anwar/mofakira/playback/NativeMediaCatalog.kt');
const legacy = read('android/app/src/main/java/com/anwar/mofakira/LegacyWebActivity.kt');

assert.match(gradle, /androidx\.media3:media3-exoplayer:1\.11\.1/);
assert.match(gradle, /androidx\.media3:media3-session:1\.11\.1/);
assert.match(manifest, /FOREGROUND_SERVICE_MEDIA_PLAYBACK/);
assert.match(manifest, /android:name="\.NativeAudioActivity"[\s\S]*?android:exported="false"/);
assert.match(manifest, /android:name="\.playback\.NativeMediaService"[\s\S]*?android:exported="true"[\s\S]*?android:foregroundServiceType="mediaPlayback"/);
assert.match(manifest, /androidx\.media3\.session\.MediaSessionService/);
assert.match(audioService, /class NativeMediaService : MediaSessionService\(\)/);
assert.match(audioService, /ExoPlayer\.Builder\(this\)/);
assert.match(audioService, /MediaSession\.Builder\(this, exoPlayer\)/);
assert.match(audioService, /controllerInfo\.isTrusted/,
  'only trusted controllers such as the app and Android system can control the shared media session');
assert.match(audioService, /setHandleAudioBecomingNoisy\(true\)/);
assert.match(audioActivity, /MediaController\.Builder\(this, token\)\.buildAsync\(\)/);
assert.match(audioActivity, /c\.setMediaItems\(items, index, 0L\)/,
  'Quran and lesson queues support starting at the selected track');
assert.match(audioActivity, /MODE_QURAN/);
assert.match(audioActivity, /MODE_RADIO/);
assert.match(audioActivity, /MODE_LESSONS/);
assert.match(audioActivity, /MODE_IBTIHALAT/);
assert.match(audioActivity, /NativeMediaService::class\.java/);
assert.doesNotMatch(audioActivity, /WebView|WEB_MESSAGE_LISTENER|mofakira-anouar\.pages\.dev/,
  'the native audio screen does not depend on the web notebook');
assert.match(audioActivity, /seekToPreviousMediaItem/);
assert.match(audioActivity, /seekToNextMediaItem/);
assert.match(audioActivity, /setMediaItem\(item\)/,
  'live radio uses the same native player engine as other audio');
assert.match(home, /NativeAudioActivity\.MODE_QURAN/);
assert.match(home, /NativeAudioActivity\.MODE_RADIO/);
assert.match(home, /NativeAudioActivity\.MODE_LESSONS/);
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
assert.match(catalog, /"الحسيمة" to "Al Hoceima"/,
  'native prayer city mapping remains covered by the native audio integration branch only when catalog exists');
console.log('Native Media3 playback, Quran, radio, lessons and devotional catalog tests passed.');
