import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const activity = readFileSync(
  new URL("../android/app/src/main/java/com/anwar/mofakira/NativePdfLibraryActivity.kt", import.meta.url),
  "utf8"
);
const gate = readFileSync(
  new URL("../android/app/src/main/java/com/anwar/mofakira/ReligiousGateActivity.kt", import.meta.url),
  "utf8"
);
const manifest = readFileSync(
  new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url),
  "utf8"
);

assert.match(activity, /class NativePdfLibraryActivity : Activity\(\)/);
assert.match(activity, /PdfRenderer\(descriptor\)/,
  "PDF pages are rendered by Android's native PdfRenderer.");
assert.match(activity, /renderer\.openPage\(index\)/);
assert.match(activity, /PdfRenderer\.Page\.RENDER_MODE_FOR_DISPLAY/);
assert.match(activity, /page\.render\(bitmap, null, null/);
assert.match(activity, /Bitmap\.createBitmap\(/);
assert.match(activity, /MAX_BITMAP_PIXELS/,
  "Rendered page bitmaps have an explicit memory ceiling.");

assert.match(activity, /Intent\.ACTION_OPEN_DOCUMENT/);
assert.match(activity, /type = PDF_MIME/);
assert.match(activity, /private const val PDF_MIME = "application\/pdf"/);
assert.match(activity, /takePersistableUriPermission\(uri, grantedFlags\)/,
  "The user-selected document grant can be retained for reopening the same file.");
assert.match(activity, /OpenableColumns\.DISPLAY_NAME/,
  "The local reader displays the selected document name.");
assert.match(activity, /getSharedPreferences\(PREFERENCES_NAME, MODE_PRIVATE\)/);
assert.match(activity, /KEY_LAST_URI/);
assert.match(activity, /KEY_LAST_NAME/);
assert.match(activity, /KEY_LAST_PAGE/);
assert.match(activity, /private fun openLastDocument\(\)/);
assert.match(activity, /private fun changePage\(delta: Int\)/);
assert.match(activity, /private fun renderCurrentPage\(\)/);
assert.match(activity, /Executors\.newSingleThreadExecutor\(\)/,
  "Page rendering does not block the main UI thread.");
assert.match(activity, /synchronized\(renderLock\)/,
  "The PDF renderer and file descriptor are serialized while pages render or close.");
assert.match(activity, /private const val MAX_RENDER_WIDTH = 2600/);
assert.match(activity, /private const val MAX_BITMAP_PIXELS = 12_000_000L/);
assert.doesNotMatch(activity, /WebView|JavascriptInterface|http:\/\/|https:\/\//,
  "The local PDF reader has no WebView bridge or remote book fetch.");

assert.match(gate, /private fun openLibraryOptions\(\)/);
assert.match(gate, /قارئ الكتب PDF الأصلي من الجهاز/);
assert.match(gate, /NativePdfLibraryActivity::class\.java/,
  "The library gateway opens the new native PDF reader.");
assert.match(gate, /المكتبة الكاملة الحالية/);
assert.match(gate, /LegacyWebActivity::class\.java/,
  "The complete existing library remains available during migration.");
assert.match(manifest, /android:name="\.NativePdfLibraryActivity"[\s\S]*?android:exported="false"/,
  "The native PDF reader is registered as a private Android activity.");

console.log("Native local PDF reader, persisted document access, page rendering and library fallback checks passed.");
