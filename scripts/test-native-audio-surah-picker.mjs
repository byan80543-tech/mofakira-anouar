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

assert.ok(quranScreen.includes("showSurahPickerDialog(surahPicker)"));
assert.ok(quranScreen.includes("surahSelectionLabel()"));
assert.doesNotMatch(quranScreen, /surahSpinner|Spinner\(/,
  "Quran surah selection must use the native searchable picker, not a basic spinner.");
assert.ok(quranScreen.includes("selectedSurah"));
assert.ok(quranScreen.includes("edition.availableSurahs"));

const dialogStart = activity.indexOf("private fun showSurahPickerDialog(");
const dialogEnd = activity.indexOf("private fun applyReciterFilter(", dialogStart);
assert.notEqual(dialogStart, -1, "The native surah picker dialog must exist.");
const dialog = activity.slice(dialogStart, dialogEnd);
assert.ok(dialog.includes("selectedEdition?.availableSurahs"));
assert.ok(dialog.includes("NativeMediaCatalog.surahNames.getOrNull(number - 1)"));
assert.ok(dialog.includes("'٠' -> '0'"));
assert.ok(dialog.includes("'٩' -> '9'"));
assert.ok(dialog.includes("AlertDialog.Builder(this)"));
assert.ok(dialog.includes("addTextChangedListener"));
assert.ok(dialog.includes("filterSurahs"));
assert.ok(dialog.includes("visibleSurahNumbers"));
assert.ok(dialog.includes("selectedSurah = visibleSurahNumbers"));
assert.ok(dialog.includes("target.text = surahSelectionLabel()"));
assert.ok(dialog.includes("dialog.dismiss()"));
assert.ok(dialog.includes("setLayout"));

assert.doesNotMatch(activity, /android\.webkit\.WebView|JavascriptInterface/,
  "The searchable Quran picker must be implemented with Android views.");

console.log("Native searchable Quran surah picker checks passed.");
