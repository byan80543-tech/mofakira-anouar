import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const activity = read('android/app/src/main/java/com/anwar/mofakira/LegacyWebActivity.kt');
const updater = read('android/app/src/main/java/com/anwar/mofakira/AppUpdateManager.kt');
const manifest = read('android/app/src/main/AndroidManifest.xml');
const gradle = read('android/app/build.gradle.kts');
const providerPaths = read('android/app/src/main/res/xml/update_file_paths.xml');
const releaseWorkflow = read('.github/workflows/android-release.yml');

assert.match(activity, /AppUpdateManager\(this, updateButton, shellUpdater\)/,
  'the native WebView shell must expose the in-app update affordance');
assert.match(activity, /Gravity\.TOP or Gravity\.END/,
  'the update affordance must float above the existing original web interface');
assert.match(updater, /releases\/latest/,
  'the updater must inspect the latest published release');
assert.match(updater, /activity\.packageName != PRODUCTION_PACKAGE/,
  'debug previews with changing package IDs must not attempt in-place production updates');
assert.match(updater, /currentInstalledVersionCode\(\)/,
  'the updater must read the installed version from Android package metadata');
assert.match(updater, /isTrustedReleaseUrl/,
  'only official HTTPS release assets from this repository may be installed');
assert.match(updater, /MessageDigest\.getInstance\("SHA-256"\)/,
  'the downloaded APK must pass its published SHA-256 check');
assert.match(updater, /getPackageArchiveInfo/,
  'the APK package identity and version must be inspected before handing it to Android');
assert.match(updater, /canRequestPackageInstalls/,
  'Android unknown-source installation permission must be checked and requested explicitly');
assert.match(updater, /FileProvider\.getUriForFile/,
  'the installer must receive a safe content URI, not a raw file path');
assert.match(updater, /Intent\.ACTION_VIEW/,
  'the final install must be delegated to the Android package installer');

assert.match(manifest, /android\.permission\.REQUEST_INSTALL_PACKAGES/,
  'the release updater must declare Android install-source permission');
assert.match(manifest, /androidx\.core\.content\.FileProvider/,
  'a non-exported FileProvider must serve the verified APK');
assert.match(manifest, /android:authorities="\$\{applicationId\}\.updates"/);
assert.match(providerPaths, /<cache-path[\s\S]*?path="updates\/"/);

assert.match(gradle, /versionCode = 18/);
assert.match(gradle, /versionName = "0\.9\.9"/);
assert.match(gradle, /create\("release"\)/,
  'a stable release signing config must be available for upgrade-compatible APKs');

assert.match(releaseWorkflow, /ANWAR_RELEASE_KEYSTORE_BASE64/);
assert.match(releaseWorkflow, /ANWAR_RELEASE_STORE_PASSWORD/);
assert.match(releaseWorkflow, /ANWAR_RELEASE_KEY_ALIAS/);
assert.match(releaseWorkflow, /ANWAR_RELEASE_KEY_PASSWORD/);
assert.match(releaseWorkflow, /gh release create/);
assert.match(releaseWorkflow, /mofakira-anwar-update\.json/);
assert.match(releaseWorkflow, /sha256sum/,
  'every published update must include its APK digest');
assert.match(releaseWorkflow, /if: steps\.signing\.outputs\.ready == 'true'/,
  'no release is published before the owner configures the permanent signing key');

console.log('Android in-app update, package identity, SHA-256 verification, installer permission and signed release workflow checks passed.');
