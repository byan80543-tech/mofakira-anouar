import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const activity = readFileSync(
  new URL("../android/app/src/main/java/com/anwar/mofakira/NativeAudioActivity.kt", import.meta.url),
  "utf8"
);

const quranStart = activity.indexOf("private fun renderQuran()");
const filterStart = activity.indexOf("private fun applyReciterFilter(", quranStart);
assert.notEqual(quranStart, -1, "The native Quran section must exist.");
assert.notEqual(filterStart, -1, "The native reciter filter must exist.");
const quranScreen = activity.slice(quranStart, filterStart);

assert.match(activity, /quranPlaybackMode = QURAN_PLAY_MODE_CONTINUOUS/,
  "continuous recitation remains the default playback mode");
assert.ok(quranScreen.includes('actionButton("تلاوة متتابعة"'),
  "the native Quran screen offers continuous recitation");
assert.ok(quranScreen.includes('actionButton("سورة واحدة"'),
  "the native Quran screen offers one-surah playback");
assert.ok(quranScreen.includes("setQuranPlaybackMode(QURAN_PLAY_MODE_CONTINUOUS)"));
assert.ok(quranScreen.includes("setQuranPlaybackMode(QURAN_PLAY_MODE_SINGLE)"));
assert.ok(quranScreen.includes("quranPlaybackMode == QURAN_PLAY_MODE_SINGLE"),
  "the selected native mode is passed to the Media3 queue builder");
assert.ok(quranScreen.includes("updateQuranPlaybackModeControls()"),
  "the active choice and play action label are synchronized");

const filterBodyStart = activity.indexOf("private fun applyReciterFilter(");
const quickPlayStart = activity.indexOf("playQuran(", filterBodyStart);
assert.notEqual(quickPlayStart, -1, "Reciter quick-play must continue to work.");
const quickPlayCall = activity.slice(quickPlayStart, quickPlayStart + 220);
assert.match(quickPlayCall, /quranPlaybackMode == QURAN_PLAY_MODE_SINGLE/,
  "the tulip reciter quick-play action must respect the selected one-surah or continuous mode");

const modeUiStart = activity.indexOf("private fun setQuranPlaybackMode(");
const playQuranStart = activity.indexOf("private fun playQuran(", modeUiStart);
assert.notEqual(modeUiStart, -1, "The native playback mode handler must exist.");
assert.notEqual(playQuranStart, -1, "The native Quran queue builder must exist.");
const modeUi = activity.slice(modeUiStart, playQuranStart);
assert.match(modeUi, /quranPlaybackMode = nextMode/);
assert.match(modeUi, /quranContinuousButton/);
assert.match(modeUi, /quranSingleButton/);
assert.match(modeUi, /quranPlayButtonLabel\(\)/);
assert.match(modeUi, /تشغيل سورة واحدة/);
assert.match(modeUi, /تشغيل التلاوة المتتابعة/);

const playQuranEnd = activity.indexOf("private fun playStation(", playQuranStart);
const playQuran = activity.slice(playQuranStart, playQuranEnd);
assert.match(playQuran, /singleSurahOnly: Boolean/);
assert.match(playQuran, /val queueSurahs = if \(singleSurahOnly\) listOf\(available\[startIndex\]\) else available/,
  "single mode builds a one-item queue; continuous mode keeps the available surah queue");
assert.match(playQuran, /val queueStartIndex = if \(singleSurahOnly\) 0 else startIndex/);
assert.match(playQuran, /startPlaylist\(\s*c,\s*items,\s*queueStartIndex/s,
  "both modes are played through the shared native Media3 playlist");

assert.match(activity, /const val QURAN_PLAY_MODE_CONTINUOUS = "continuous"/);
assert.match(activity, /const val QURAN_PLAY_MODE_SINGLE = "single"/);
assert.doesNotMatch(activity, /android\.webkit\.WebView|JavascriptInterface/,
  "the Quran mode selector and queue remain native Android code");

console.log("Native Quran single-surah and continuous Media3 playback mode checks passed.");
