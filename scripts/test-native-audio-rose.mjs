import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readText = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const readBytes = (path) => readFileSync(new URL(path, import.meta.url));

const activity = readText("../android/app/src/main/java/com/anwar/mofakira/NativeAudioActivity.kt");
const rose = readText("../android/app/src/main/java/com/anwar/mofakira/NativeRosePlayButton.kt");

function assertPng(path) {
  const bytes = readBytes(path);
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(bytes.readUInt32BE(16), 96);
  assert.equal(bytes.readUInt32BE(20), 96);
}
assertPng("../android/app/src/main/res/drawable-nodpi/anwar_rose_closed.png");
assertPng("../android/app/src/main/res/drawable-nodpi/anwar_rose_open.png");

assert.ok(rose.includes("R.drawable.anwar_rose_closed"));
assert.ok(rose.includes("R.drawable.anwar_rose_open"));
assert.ok(rose.includes("AnimatorSet()"));
assert.ok(rose.includes("playSequentially(bloom, settle, finish)"));
assert.ok(rose.includes("PropertyValuesHolder.ofFloat(View.SCALE_X, 0.34f, 1.12f)"));
assert.ok(rose.includes("duration = 278L"));
assert.ok(rose.includes("duration = 163L"));
assert.ok(rose.includes("duration = 139L"));
assert.ok(rose.includes('contentDescription = "تشغيل: $itemLabel"'));
assert.ok(rose.includes('"إيقاف مؤقت: $itemLabel"'));
assert.doesNotMatch(rose, /android\.webkit\.WebView|JavascriptInterface/);

assert.ok(activity.includes("NativeRosePlayButton"));
assert.ok(activity.includes("playPauseButton.setPlaybackActive(isPlaying)"));
assert.ok(activity.includes("onRoseClick"));
assert.ok(activity.includes('currentMediaItem?.mediaId == "radio:${station.url}"'));
assert.ok(activity.includes('currentMediaId == "ibtihal:$trackId"'));
assert.ok(activity.includes("pendingRoseBloomKeys.remove(key)"));
assert.ok(activity.includes("animateRose = playing && shouldAnimateRose(position)"));
assert.doesNotMatch(activity, /android\.webkit\.WebView|JavascriptInterface/);

console.log("Native rose play-control, original artwork resources, accessibility and bloom-animation checks passed.");
