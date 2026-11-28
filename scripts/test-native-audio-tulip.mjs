import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const activity = read("../android/app/src/main/java/com/anwar/mofakira/NativeAudioActivity.kt");
const artwork = read("../android/app/src/main/java/com/anwar/mofakira/NativeAudioArtwork.kt");
const tulip = read("../android/app/src/main/assets/audio/tulip-cutout.svg");

const marker = "data:image/webp;base64,";
const markerIndex = tulip.indexOf(marker);
assert.notEqual(markerIndex, -1, "The original tulip must contain its bundled WebP artwork.");
const webpPayload = tulip.slice(markerIndex + marker.length).split('"')[0];
const webpBytes = Buffer.from(webpPayload, "base64");
assert.equal(webpBytes.toString("ascii", 0, 4), "RIFF");
assert.equal(webpBytes.toString("ascii", 8, 12), "WEBP");

assert.ok(artwork.includes('audio/tulip-cutout.svg'));
assert.ok(artwork.includes('BitmapFactory.decodeByteArray'));
assert.ok(artwork.includes('ImageView(context)'));
const artworkImports = artwork.split("\n").filter((line) => line.startsWith("import ")).join("\n");
const activityImports = activity.split("\n").filter((line) => line.startsWith("import ")).join("\n");
assert.doesNotMatch(artworkImports, /WebView|JavascriptInterface/);
assert.doesNotMatch(activityImports, /WebView|JavascriptInterface/);
assert.equal((activity.match(/NativeAudioArtwork[.]badge[(]/g) || []).length, 2,
  "The native row renderer and devotional cards must reuse the same tulip artwork.");
assert.ok(activity.includes("TulipRowStyle.RECITER"));
assert.ok(activity.includes("TulipRowStyle.STATION"));
assert.ok(activity.includes("TulipRowStyle.LESSON"));
assert.doesNotMatch(activity, /WebView|JavascriptInterface/);

console.log("Native audio tulip artwork checks passed.");
