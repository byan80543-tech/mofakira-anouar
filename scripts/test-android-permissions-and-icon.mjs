import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const manifest = read('android/app/src/main/AndroidManifest.xml');
const legacy = read('android/app/src/main/java/com/anwar/mofakira/LegacyWebActivity.kt');
const notebook = read('android/app/src/main/java/com/anwar/mofakira/NativeNotebookActivity.kt');
const tasbih = read('android/app/src/main/java/com/anwar/mofakira/NativeTasbihActivity.kt');
const adaptiveIcon = read('android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml');
const fallbackIcon = read('android/app/src/main/res/mipmap-anydpi/ic_launcher.xml');
const monochrome = read('android/app/src/main/res/drawable/ic_launcher_monochrome.xml');
const colors = read('android/app/src/main/res/values/colors.xml');
const iconArtworkPath = new URL('../android/app/src/main/res/drawable-nodpi/ic_launcher_artwork.webp', import.meta.url);
const workflow = read('.github/workflows/build-anwar-android.yml');

assert.match(manifest, /android:icon="@mipmap\/ic_launcher"/,
  'Android must expose a launcher icon');
assert.match(manifest, /android:roundIcon="@mipmap\/ic_launcher"/,
  'Android must expose a round launcher icon as well');
assert.match(manifest, /android\.permission\.RECORD_AUDIO/,
  'microphone permission must be declared for the voice-only features');

assert.match(adaptiveIcon, /<adaptive-icon[\s\S]*?<background[\s\S]*?<foreground[\s\S]*?<monochrome/,
  'Android 8+ must use adaptive and themed icon layers');
assert.match(adaptiveIcon, /android:drawable="@drawable\/ic_launcher_artwork"/,
  'Android 8+ must display the selected pink-green tulip artwork');
assert.match(fallbackIcon, /<bitmap[\s\S]*?@drawable\/ic_launcher_artwork/,
  'older Android versions must display the same selected app artwork');
assert.match(colors, /#FFF0F6/,
  'the adaptive icon background must use the soft pink brand tone');
assert.ok(fs.existsSync(iconArtworkPath) && fs.statSync(iconArtworkPath).size > 10000,
  'the high quality selected tulip artwork must be bundled as an Android resource');
assert.match(monochrome, /<vector/);
assert.equal((legacy.match(/\.setIcon\(R\.drawable\.ic_launcher_artwork\)/g) || []).length, 2,
  'both explanatory Android dialogs for background adhan permission must show the app icon');
assert.match(legacy, /تفعيل الأذان خارج المفكرة[\s\S]*?\.setIcon\(R\.drawable\.ic_launcher_artwork\)/);
assert.match(legacy, /السماح بالأذان في وقته[\s\S]*?\.setIcon\(R\.drawable\.ic_launcher_artwork\)/);

assert.match(legacy, /override fun onPermissionRequest\(request: PermissionRequest\)/,
  'the bundled web shell must handle microphone requests');
assert.match(legacy, /origin != SITE_ORIGIN/,
  'only the bundled local HTTPS origin may request capture');
assert.match(legacy, /requestedResources\.any \{ it != PermissionRequest\.RESOURCE_AUDIO_CAPTURE \}/,
  'web camera and unrelated permissions must be denied');
assert.match(legacy, /requestPermissions\([\s\S]*Manifest\.permission\.RECORD_AUDIO[\s\S]*REQUEST_RECORD_AUDIO/,
  'the runtime microphone permission is requested only after a web feature asks for capture');
assert.match(legacy, /grantPendingWebMicrophoneRequest\(\)/);
assert.match(legacy, /denyPendingWebMicrophoneRequest\(\)/);
assert.match(legacy, /PermissionRequest\.RESOURCE_AUDIO_CAPTURE/);

assert.match(notebook, /private fun startPoetryDictation\(editor: EditText\)[\s\S]*?requestPermissions\([\s\S]*REQUEST_MICROPHONE/,
  'native notebook dictation must ask when its voice button is used');
assert.match(notebook, /if \(requestCode != REQUEST_MICROPHONE\) return/);
assert.match(notebook, /private const val REQUEST_MICROPHONE = 7401/);
assert.match(tasbih, /checkSelfPermission\(Manifest\.permission\.RECORD_AUDIO\)/,
  'native tasbih speech counting retains its on-demand microphone gate');

assert.match(workflow, /node scripts\/test-android-permissions-and-icon\.mjs/,
  'the icon and permissions checks must run in CI');

console.log('Android pink-green tulip icon, adhan permission dialog icon and on-demand microphone checks passed.');
