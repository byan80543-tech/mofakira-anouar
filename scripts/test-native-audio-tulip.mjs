import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const activity = read("../android/app/src/main/java/com/anwar/mofakira/NativeAudioActivity.kt");
const artwork = read("../android/app/src/main/java/com/anwar/mofakira/NativeAudioArtwork.kt");
const tulip = read("../android/app/src/main/assets/audio/tulip-cutout.svg");

const webpPayload = tulip.match(/data:image\\/webp;base64,([A-Za-z0-9+/=]+)/)?.[1];
assert.ok(webpPayload, "The original tulip must contain its bundled WebP artwork.");
const webpBytes = Buffer.from(webpPayload, "base64");
assert.equal(webpBytes.toString("ascii", 0, 4), "RIFF");
assert.equal(webpBytes.toString("ascii", 8, 12), "WEBP");

assert.match(artwork, /audio\\/tulip-cutout\\.svg/);
assert.match(artwork, /BitmapFactory\\.decodeByteArray/);
assert.match(artwork, /ImageView\\(context\\)/);
assert.doesNotMatch(artwork, /android\\.webkit\\.WebView|JavascriptInterface/);
assert.equal((activity.match(/NativeAudioArtwork\\.badge\\(/g) || []).length, 2,
  "The native row renderer and devotional cards must reuse the same tulip artwork.");
assert.match(activity, /TulipRowStyle\\.RECITER/);
assert.match(activity, /TulipRowStyle\\.STATION/);
assert.match(activity, /TulipRowStyle\\.LESSON/);
assert.doesNotMatch(activity, /android\\.webkit\\.WebView|JavascriptInterface/);

console.log("Native audio tulip artwork checks passed.");
