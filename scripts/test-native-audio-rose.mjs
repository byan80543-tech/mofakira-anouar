import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readText = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const readBytes = (path) => readFileSync(new URL(path, import.meta.url));
const activity = readText("../android/app/src/main/java/com/anwar/mofakira/NativeAudioActivity.kt");
const rose = readText("../android/app/src/main/java/com/anwar/mofakira/NativeRosePlayButton.kt");
const webCss = readText("../android/app/src/main/assets/audio/app.css");
const closedSvg = readText("../android/app/src/main/assets/audio/royal-rose-closed.svg");
const openSvg = readText("../android/app/src/main/assets/audio/royal-rose-open.svg");

function assertPng(path) {
  const bytes = readBytes(path);
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(bytes.readUInt32BE(16), 96);
  assert.equal(bytes.readUInt32BE(20), 96);
}
assertPng("../android/app/src/main/res/drawable-nodpi/anwar_rose_closed.png");
assertPng("../android/app/src/main/res/drawable-nodpi/anwar_rose_open.png");

assert.match(closedSvg, /royal rose|royal rose/i);
assert.match(closedSvg, /url\(#bud\)/);
assert.match(openSvg, /url\(#outer\)/);
assert.match(openSvg, /url\(#core\)/);

assert.ok(rose.includes("R.drawable.anwar_rose_closed"));
assert.ok(rose.includes("R.drawable.anwar_rose_open"));
assert.ok(rose.includes("AnimatorSet()"));
assert.ok(rose.includes("PropertyValuesHolder.ofFloat(View.SCALE_X, 0.34f, 1.12f)"));
assert.ok(rose.includes("duration = 278L"));
assert.ok(rose.includes("duration = 163L"));
assert.ok(rose.includes("duration = 139L"));
assert.doesNotMatch(rose, /android\.webkit\.WebView|JavascriptInterface/);

assert.ok(activity.includes("NativeRosePlayButton"));
assert.ok(activity.includes("playPauseButton.setPlaybackActive(isPlaying)"));
assert.ok(activity.includes("onRoseClick"));
assert.ok(activity.includes('currentId == "radio:'));
assert.ok(activity.includes('currentMediaId == "ibtihal:$trackId"'));
assert.doesNotMatch(activity, /android\.webkit\.WebView|JavascriptInterface/);

assert.match(webCss, /anwarFlowerBloom/);
assert.match(webCss, /scale\(\.34\)/);
assert.match(webCss, /scale\(1\.12\)/);
console.log("Native rose play-control and bloom-animation checks passed.");
