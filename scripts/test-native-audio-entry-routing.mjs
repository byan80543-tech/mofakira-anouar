import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const gate = readFileSync(
  new URL("../android/app/src/main/java/com/anwar/mofakira/ReligiousGateActivity.kt", import.meta.url),
  "utf8"
);
const activity = readFileSync(
  new URL("../android/app/src/main/java/com/anwar/mofakira/NativeAudioActivity.kt", import.meta.url),
  "utf8"
);
const manifest = readFileSync(
  new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url),
  "utf8"
);

const openAudioStart = gate.indexOf("private fun openAudio(mode: String)");
assert.notEqual(openAudioStart, -1, "The religious services audio entry point must exist.");
const openAudio = gate.slice(openAudioStart, gate.indexOf("\n    }", openAudioStart) + 6);
assert.ok(openAudio.includes("Intent(this, NativeAudioActivity::class.java)"),
  "Quran, radio and lessons must open the native Android audio library.");
assert.ok(!openAudio.includes("NativeAudioWebActivity"),
  "The audio library entry point must not launch the WebView implementation.");

for (const mode of ["MODE_QURAN", "MODE_RADIO", "MODE_LESSONS"]) {
  assert.ok(gate.includes("openAudio(NativeAudioActivity." + mode + ")"),
    "The religious portal must preserve the " + mode + " destination.");
}
for (const mode of ["MODE_QURAN", "MODE_RADIO", "MODE_LESSONS"]) {
  assert.ok(activity.includes(mode), "The native audio activity must support " + mode + ".");
}
assert.ok(manifest.includes('android:name=".NativeAudioActivity"'),
  "The native audio activity must be registered in AndroidManifest.xml.");
console.log("Native audio entry routing checks passed.");
