import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');

const activity = read('android/app/src/main/java/com/anwar/mofakira/LegacyWebActivity.kt');
const appUpdater = read('android/app/src/main/java/com/anwar/mofakira/AppUpdateManager.kt');
const webUpdater = read('android/app/src/main/java/com/anwar/mofakira/WebShellUpdateManager.kt');
const appCore = read('app-core.js');
const gradle = read('android/app/build.gradle.kts');
const webRelease = read('.github/workflows/android-web-shell-release.yml');
const apkRelease = read('.github/workflows/android-release.yml');
const androidBuild = read('.github/workflows/build-anwar-android.yml');

assert.match(activity, /AppUpdateManager\(this, updateButton, shellUpdater\)/,
  'the Android shell must connect the combined update manager');
assert.match(activity, /webShellUpdateManager\?\.intercept\(uri\)/,
  'normal WebView requests must be able to read OTA overrides');
assert.match(activity, /ServiceWorkerController\.getInstance\(\)\.setServiceWorkerClient/,
  'service-worker requests must also route through the OTA asset resolver');
assert.match(appUpdater, /webShellUpdater\.start\(\)/,
  'web-shell updates must work even when APK updates are disabled for previews');
assert.match(appUpdater, /showAvailableUpdates\(\)/,
  'the single update icon must present the available update type');
assert.match(appUpdater, /webShellUpdater\.hasUpdate\(\)/,
  'the update icon visibility must include pending web-shell releases');

assert.match(webUpdater, /releases\?per_page=100/,
  'the OTA manager must inspect the repository release feed');
assert.match(webUpdater, /optBoolean\("prerelease", false\)/,
  'the web-shell channel must be separated from the stable APK release channel');
assert.match(webUpdater, /mofakira-anwar-web-update\.json/,
  'the updater must require its metadata manifest');
assert.match(webUpdater, /mofakira-anwar-web-shell\.zip/,
  'the updater must require the dedicated web-shell archive');
assert.match(webUpdater, /uri\.host == "github\.com"/,
  'release downloads must be HTTPS GitHub URLs');
assert.match(webUpdater, /RELEASE_DOWNLOAD_PATH/,
  'release downloads must be limited to this repository');
assert.match(webUpdater, /MessageDigest\.getInstance\("SHA-256"\)/,
  'the downloaded web bundle must pass SHA-256 verification');
assert.match(webUpdater, /totalBytes != update\.sizeBytes/,
  'the downloaded archive length must match metadata');
assert.match(webUpdater, /canonicalFile/,
  'archive extraction must prevent path traversal');
assert.ok(webUpdater.includes(String.raw\`entry.name.contains('\\')\`),
  'archive extraction must reject Windows path separators');
assert.match(webUpdater, /MAX_EXTRACTED_BYTES/,
  'archive extraction must limit expanded size');
assert.match(webUpdater, /File\(activity\.filesDir, WEB_SHELL_DIRECTORY\)/,
  'the web bundle must be stored in app-private storage');
assert.match(webUpdater, /BuildConfig\.WEB_BASELINE_TIMESTAMP/,
  'the updater must compare the release with the bundled APK baseline');
assert.match(webUpdater, /WebResourceResponse\(/,
  'updated resources must be served through the same HTTPS-style WebView origin');
assert.match(appCore, /AnouarUpdateBridge/);
assert.match(appCore, /flushPendingEdit\(false\)/);
assert.match(appCore, /await vaultSaveQueue/);
assert.match(webUpdater, /window\.AnouarUpdateBridge/);
assert.match(webUpdater, /preparePageAndActivate/);
assert.match(webUpdater, /window\.__anwarReleaseAfterOta/);
assert.match(webUpdater, /window\.caches\.delete/,
  'the web cache must be refreshed after a verified OTA update');
assert.doesNotMatch(webUpdater, /localStorage\.clear|indexedDB\.deleteDatabase/,
  'the OTA updater must not clear local notes, poems, or app databases');

assert.match(gradle, /versionCode = 18/);
assert.match(gradle, /versionName = "0\.9\.9"/);
assert.match(gradle, /WEB_BASELINE_TIMESTAMP/);
assert.match(gradle, /applicationIdSuffix = "\.preview\.v18"/);

assert.match(webRelease, /web-shell-\$\{GITHUB_RUN_NUMBER\}-\$\{GITHUB_SHA:0:12\}/);
assert.match(webRelease, /mofakira-anwar-web-shell\.zip/);
assert.match(webRelease, /mofakira-anwar-web-update\.json/);
assert.match(webRelease, /sha256sum/);
assert.match(webRelease, /--prerelease/,
  'web-shell releases must not replace the latest stable APK release');
assert.match(androidBuild, /scripts\/test-android-web-shell-updater\.mjs/);
assert.match(androidBuild, /ANWAR_WEB_BASELINE_TIMESTAMP/);

assert.match(apkRelease, /- "android\/\*\*"/);
assert.doesNotMatch(apkRelease, /- "\*\.html"|- "\*\.js"|- "\*\.css"/,
  'web-only changes must not trigger a new APK build');

console.log('Android OTA web-shell updater, service-worker interception, integrity checks and separated release channels passed.');
