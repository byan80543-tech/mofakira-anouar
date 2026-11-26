import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root=process.cwd();
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const method=read('prayer-morocco-method.js');
const engine=read('prayer-engine.js');
const prayer=read('prayer-times.js');
const html=read('index.html');
const worker=read('service-worker.js');
const headers=read('_headers');

for(const [name,source] of [['prayer-morocco-method.js',method],['prayer-engine.js',engine],['prayer-times.js',prayer]]) {
  assert.doesNotThrow(()=>new vm.Script(source,{filename:name}),name+' must parse');
}

const context=vm.createContext({window:{}});
vm.runInContext(method,context,{filename:'prayer-morocco-method.js'});
vm.runInContext(engine,context,{filename:'prayer-engine.js'});
const localEngine=context.window.AnwarPrayerEngine;
assert.ok(localEngine && typeof localEngine.calculate==='function','local prayer engine is exposed');
assert.ok(context.window.AnwarMoroccoPrayerMethod && typeof context.window.AnwarMoroccoPrayerMethod.calculate==='function','Morocco Habous-method adaptation is loaded');

const meknes=localEngine.calculate({
  date:'26-11-2026',
  city:'Meknes',
  country:'Morocco',
  timezone:'Africa/Casablanca',
  school:'0'
});
assert.deepEqual(
  {...meknes.timings},
  {Fajr:'05:31',Sunrise:'07:02',Dhuhr:'12:14',Asr:'14:55',Maghrib:'17:18',Isha:'18:37'},
  'Meknes calculation vector remains deterministic'
);
assert.equal(meknes.meta.timezone,'UTC','Morocco local calculation pins the post-20-September-2026 clock to UTC even when the saved timezone is stale');
assert.equal(meknes.meta.source,'local-morocco-method-estimate','Morocco results are labelled as local estimates');

for(const city of ['Fes','Rabat','Casablanca','Tangier']) {
  const result=localEngine.calculate({date:'26-11-2026',city,country:'Morocco',timezone:'Africa/Casablanca',school:'0'});
  for(const key of ['Fajr','Dhuhr','Asr','Maghrib','Isha']) {
    assert.match(result.timings[key],/^(?:[01]\d|2[0-3]):[0-5]\d$/,city+' '+key+' must be valid local time');
  }
  assert.equal(result.meta.timezone,'UTC',city+' must use Morocco GMT');
}
assert.throws(
  ()=>localEngine.calculate({date:'26-11-2026',city:'مدينة غير مدرجة',country:'Morocco',timezone:'Africa/Casablanca'}),
  /لم نرسلها إلى أي خدمة/,
  'an unsupported city must be rejected instead of queried remotely or silently guessed'
);

assert.doesNotMatch(engine,/\bfetch\s*\(|XMLHttpRequest|navigator\.geolocation|api\.aladhan\.com/,'the calculation engine must not use network requests or GPS');
assert.doesNotMatch(prayer,/\bfetch\s*\(|XMLHttpRequest|navigator\.geolocation|api\.aladhan\.com|upload\.wikimedia\.org|raw\.githubusercontent\.com/,'the prayer controller must not fetch timings or remote Adhan recordings');
assert.match(prayer,/indexedDB\.open\(LOCAL_AUDIO_DB,1\)/,'Adhan audio is saved in local IndexedDB');
assert.match(prayer,/createObjectURL\(blob\)/,'playback uses the locally stored audio blob');
assert.match(prayer,/file\.size>20\*1024\*1024/,'local audio import enforces the 20 MB limit');
assert.match(prayer,/لا يُحمّل من مضيف صوتي خارجي/,'the privacy disclosure accurately states that no external audio host is used');

const methodIndex=html.indexOf('prayer-morocco-method.js');
const engineIndex=html.indexOf('prayer-engine.js');
const controllerIndex=html.indexOf('prayer-times.js');
assert.ok(methodIndex>=0 && methodIndex<engineIndex && engineIndex<controllerIndex,'script load order is Morocco method, local engine, then UI controller');
assert.ok(worker.includes("'./prayer-morocco-method.js'"),'service worker precaches Morocco method');
assert.ok(worker.includes("'./prayer-engine.js'"),'service worker precaches local engine');
assert.ok(worker.includes("'./prayer-times.js'"),'service worker precaches the UI controller');
assert.match(worker,/anwar-shell-2026-11-26-v216/,'service worker cache is version-bumped');
assert.ok(!html.includes('api.aladhan.com')&&!headers.includes('api.aladhan.com'),'AlAdhan is removed from both page and response CSP');
assert.ok(!/https:\/\/(?:upload\.wikimedia\.org|raw\.githubusercontent\.com)/.test(prayer),'no third-party Adhan audio URL remains in the prayer module');

console.log('Local prayer engine, Morocco timezone, unsupported-city rejection, IndexedDB audio, and no-external-Adhan tests passed.');
