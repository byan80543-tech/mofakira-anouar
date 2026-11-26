import fs from 'node:fs';
import assert from 'node:assert/strict';

const root=new URL('../',import.meta.url);
const prayer=fs.readFileSync(new URL('prayer-times.js',root),'utf8');
const core=fs.readFileSync(new URL('app-core.js',root),'utf8');
const adhkarTheme=fs.readFileSync(new URL('adhkar-page-theme.js',root),'utf8');

assert.doesNotMatch(prayer,/localStorage|sessionStorage/,'prayer settings and last-played markers must not use plaintext browser storage');
assert.match(prayer,/function readSettings\(\)[\s\S]{0,360}AnwarPrivatePreferences[\s\S]{0,180}normalizeSavedSettings/,'prayer settings are loaded from the encrypted private-preference adapter');
assert.match(prayer,/function persist\(\)[\s\S]{0,420}privatePrefs\.set\('prayer',settings\)/,'prayer settings are written to the encrypted vault adapter');
assert.match(prayer,/function alreadyPlayed\(key\)\{return settings\.lastPlayedKey===key\}/,'the adhan duplicate-play marker is read from encrypted settings');
assert.match(prayer,/function markPlayed\(key\)\{settings\.lastPlayedKey=String\(key\|\|''\)\.slice\(0,180\);persist\(\)\}/,'the adhan duplicate-play marker is persisted in the encrypted vault');
assert.match(prayer,/function applyVaultPrayerPreferences\(snapshot\)[\s\S]{0,1800}countrySelect\.value=settings\.country[\s\S]{0,800}refreshTimes\(false\)/,'unlocking the vault restores the prayer UI and refreshes timings with the saved location');
assert.match(prayer,/privatePrefs\.subscribe\(applyVaultPrayerPreferences\)/,'prayer UI follows authenticated vault preference changes');
assert.match(prayer,/داخل الخزنة المشفرة/,'the privacy panel accurately identifies encrypted prayer settings');
assert.doesNotMatch(prayer,/من دون تشفير إضافي|localStorage/,'the prayer privacy panel does not claim settings are plaintext');

const prefsStart=core.indexOf('/* Encrypted private settings shared by the notebook modules. */');
const prefsEnd=core.indexOf('requestAnimationFrame(()=>setTimeout(()=>{',prefsStart);
assert.ok(prefsStart>=0&&prefsEnd>prefsStart,'encrypted preference implementation exists');
const prefs=core.slice(prefsStart,prefsEnd);
assert.match(prefs,/prayer:\{/,'the shared encrypted preference model contains prayer settings');
assert.match(prefs,/lastPlayedKey:/,'the shared encrypted preference model contains the adhan replay guard');
assert.match(prefs,/\['radio','readerAdvance','tasbih','prayer','adhkarPageTheme'\]/,'all private preference sections are accepted by the persistence adapter');
assert.match(prefs,/adhkarPageTheme:\[/,'the protective adhkar palette is part of the encrypted preference model');

const migrationStart=core.indexOf('function importLegacyPrivatePreferences(base){');
const migrationEnd=core.indexOf('async function persistVaultSnapshot(plaintext){',migrationStart);
assert.ok(migrationStart>=0&&migrationEnd>migrationStart,'legacy preference migration exists');
const migration=core.slice(migrationStart,migrationEnd);
assert.match(migration,/anwar_prayer_settings_v1/,'legacy prayer settings are migrated before enabling mandatory encryption');
assert.match(migration,/anwar_prayer_last_adhan_v1/,'legacy adhan replay marker is migrated before enabling mandatory encryption');
assert.match(migration,/anwar_adhkar_page_theme/,'the old protective adhkar palette is migrated before enabling mandatory encryption');
assert.match(migration,/for\(const key of \[[\s\S]*anwar_prayer_settings_v1[\s\S]*anwar_prayer_last_adhan_v1[\s\S]*anwar_adhkar_page_theme/,'legacy prayer and adhkar plaintext keys are cleaned only after encrypted persistence');
assert.doesNotMatch(adhkarTheme,/localStorage|sessionStorage/,'the protective adhkar palette no longer uses plaintext browser storage');
assert.match(adhkarTheme,/preferences\.get\(\)\.adhkarPageTheme/,'the protective adhkar palette loads from encrypted preferences');
assert.match(adhkarTheme,/preferences\.set\('adhkarPageTheme',current\)/,'the protective adhkar palette writes back through the encrypted vault');
assert.match(adhkarTheme,/preferences\.subscribe\(/,'the protective adhkar palette restores when the encrypted vault unlocks');

console.log('Encrypted prayer settings integration tests passed.');
