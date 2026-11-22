import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const manifest = read('android/app/src/main/AndroidManifest.xml');
const legacy = read('android/app/src/main/java/com/anwar/mofakira/LegacyWebActivity.kt');
const notebook = read('android/app/src/main/java/com/anwar/mofakira/NativeNotebookActivity.kt');
const tasbih = read('android/app/src/main/java/com/anwar/mofakira/NativeTasbihActivity.kt');
const adaptiveIcon = read('android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml');
const fallbackIcon = read('android/app/src/main/res/mipmap-anydpi/ic_launcher.xml');
const foreground = read('android/app/src/main/res/drawable/ic_launcher_foreground.xml');
const monochrome = read('android/app/src/main/res/drawable/ic_launcher_monochrome.xml');
const workflow = read('.github/workflows/build-anwar-android.yml');

assert.match(manifest, /android:icon="@mipmap\/ic_launcher"/,
  'Android must expose a launcher icon');
assert.match(manifest, /android:roundIcon="@mipmap\/ic_launcher"/,
  'Android must expose a round launcher icon as well');
assert.match(manifest, /android\.permission\.RECORD_AUDIO/,
  'microphone permission must be declared for the voice-only features');

assert.match(adaptiveIcon, /<adaptive-icon[\s\S]*?<background[\s\S]*?<foreground[\s\S]*?<monochrome/,
  'Android 8+ must use adaptive and themed icon layers');
assert.match(fallbackIcon, /<vector[\s\S]*?viewportWidth="108"/,
  'older Android versions need a vector launcher fallback');
assert.match(foreground, /#D5AF61/);
assert.match(foreground, /#F6EDD9/);
assert.match(foreground, /#123B34/);
assert.match(monochrome, /<vector/);

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

console.log('Android launcher icon and on-demand microphone permission checks passed.');
