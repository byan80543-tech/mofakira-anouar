import assert from 'node:assert/strict';
import fs from 'node:fs';

const core=fs.readFileSync(new URL('../app-core.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const worker=fs.readFileSync(new URL('../service-worker.js',import.meta.url),'utf8');

// A normal page visit must not schedule a background request to Google Fonts.
assert.ok(!core.includes('function scheduleBaseFonts'), 'startup font scheduler is removed');
assert.ok(!core.includes('scheduleBaseFonts();'), 'startup font scheduler is never invoked');
assert.equal((core.match(/loadFontStylesheets\(false\)/g)||[]).length,1,
  'the base font bundle has exactly one call site');

const openNoteStart=core.indexOf('function openNote(n){');
const openNoteEnd=core.indexOf('\nfunction newNote(){',openNoteStart);
assert.ok(openNoteStart>=0&&openNoteEnd>openNoteStart,'openNote function is present');
const openNote=core.slice(openNoteStart,openNoteEnd);
const editorBranch=openNote.indexOf('if(on){');
const baseFontCall=openNote.indexOf('loadFontStylesheets(false)');
const closedBranch=openNote.indexOf('\n else {',editorBranch);
assert.ok(editorBranch>=0&&baseFontCall>editorBranch&&baseFontCall<closedBranch,
  'base fonts are requested only when a note is opened in the editor');

// Keep the full font catalogue available after an explicit font-picker action.
assert.ok(core.includes("loadFontStylesheets(true).catch(error=>{console.warn(error);toast('بعض الخطوط تحتاج إلى اتصال بالإنترنت'"),
  'extended font catalogue remains user-triggered from the writing toolbar');
assert.ok(core.includes('loadFontStylesheets(true).then(()=>{if(dialog.open)renderAdhkarFontOptions(search.value)}'),
  'the adhkar font catalogue remains user-triggered');
assert.ok(core.includes("https://fonts.googleapis.com/css2?family="),
  'selectable Arabic fonts remain available from the approved provider');

// The explicit print/PDF paths remain intact; this change does not silently
// remove export capabilities or broaden the Content Security Policy.
assert.ok(core.includes("f.replace(/ /g,'+')}&display=swap"),
  'the print action may still request the selected font only when the visitor prints');
assert.ok(core.includes('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'),
  'PDF rendering library remains on its explicit export path with its integrity value');

// Update cache-busted references and the app-shell revision for the new source.
assert.ok((html.match(/app-core\.js\?v=20261127-86/g)||[]).length>=2,
  'both app-core references use the new asset revision');
assert.ok(!html.includes('app-core.js?v=20261127-85'),
  'no stale app-core asset reference remains');
assert.ok(worker.includes("const CACHE_NAME='anwar-shell-2026-11-27-v254';"),
  'service worker shell cache revision is advanced');

console.log('Deferred third-party font loading privacy tests passed.');
