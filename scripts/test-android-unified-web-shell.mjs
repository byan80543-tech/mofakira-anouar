import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (path) => readFileSync(resolve(root, path), "utf8");

const main = read("android/app/src/main/java/com/anwar/mofakira/MainActivity.kt");
const legacy = read("android/app/src/main/java/com/anwar/mofakira/LegacyWebActivity.kt");
const gradle = read("android/app/build.gradle.kts");
const manifest = read("android/app/src/main/AndroidManifest.xml");

assert.match(main, /NativeNotebookActivity::class\.java/, "The launcher restores the migrated native notebook.");
assert.match(legacy, /WebViewAssetLoader\.Builder\(\)/, "The complete original web experience remains available through the native services gateway.");
assert.match(legacy, /WebViewClientCompat/, "The WebView must route local resources through WebViewAssetLoader.");
assert.match(legacy, /appassets\.androidplatform\.net/, "The packaged page must use the HTTPS appassets origin.");
assert.match(legacy, /assets\/www\/index\.html/, "The complete bundled PWA entry point must be used.");
assert.match(legacy, /settings\.allowFileAccess = false/, "File URL access must remain disabled.");
assert.match(legacy, /AnwarAdhanBridge/, "The native background-adhan bridge must remain wired.");
assert.match(legacy, /setOf\(SITE_ORIGIN\)/, "The JavaScript bridge must be origin-restricted.");
assert.doesNotMatch(legacy, /mofakira-anouar\.pages\.dev|byan80543-tech\.github\.io/, "The app shell must not require a remote website to render its interface.");

assert.match(gradle, /tasks\.register<Sync>\("syncAnwarWebAssets"\)/, "Gradle must bundle the web app automatically.");
assert.match(gradle, /dependsOn\(syncAnwarWebAssets\)/, "The asset synchronization must run before Android builds.");
for (const path of [
  "index.html",
  "app-core.js",
  "prayer-times.js",
  "manifest.webmanifest",
  "service-worker.js",
  "assets/tulip-cutout.svg",
  "assets/royal-rose-open.svg"
]) {
  assert.ok(existsSync(resolve(root, path)), `The canonical web application resource is missing: ${path}`);
}
assert.match(manifest, /\.LegacyWebActivity/, "The unified WebView activity must remain registered in Android.");

console.log("PASS: the complete original PWA is bundled as one Android WebView application shell.");
