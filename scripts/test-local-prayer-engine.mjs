import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require=createRequire(import.meta.url);
const { PrayTime }=require('../vendor/praytime.js');
assert.equal(typeof PrayTime,'function','bundled PrayTime library exports its calculator');
require('../local-prayer-engine.js');

const engine=globalThis.AnwarLocalPrayerEngine;
assert.ok(engine,'local prayer engine is installed');
assert.equal(engine.getTimezone('Morocco','مكناس'),'Africa/Casablanca','Arabic Meknes resolves locally');
assert.ok(engine.listSupportedCities().length>=50,'offline city coordinates are bundled');

const result=engine.calculateDay({dateText:'26-11-2026',country:'Morocco',city:'Meknes',method:'21',school:'0'});
assert.equal(result.meta.source,'local');
assert.equal(result.meta.timezone,'Africa/Casablanca');
for(const key of ['Fajr','Dhuhr','Asr','Maghrib','Isha'])assert.match(result.timings[key],/^\d{2}:\d{2}$/,key+' is valid');
const minutes=key=>{const [h,m]=result.timings[key].split(':').map(Number);return h*60+m};
assert.ok(minutes('Fajr')<minutes('Dhuhr'));
assert.ok(minutes('Dhuhr')<minutes('Asr'));
assert.ok(minutes('Asr')<minutes('Maghrib'));
assert.ok(minutes('Maghrib')<minutes('Isha'));

const arabic=engine.calculateDay({dateText:'26-11-2026',country:'المغرب',city:'مكناس',method:'21',school:'0'});
assert.deepEqual(arabic.timings,result.timings,'Arabic and Latin Meknes names resolve to the same calculation');

for(const place of engine.listSupportedCities()){
 const day=engine.calculateDay({dateText:'15-06-2026',country:place.country,city:place.city,method:'auto',school:'0'});
 for(const key of ['Fajr','Dhuhr','Asr','Maghrib','Isha'])assert.match(day.timings[key],/^\d{2}:\d{2}$/,place.city+' '+key);
}

assert.throws(()=>engine.calculateDay({dateText:'26-11-2026',country:'Morocco',city:'مدينة غير مدرجة',method:'21'}),/غير مدرجة/);
assert.throws(()=>engine.calculateDay({dateText:'31-02-2026',country:'Morocco',city:'Meknes',method:'21'}),/تاريخ المواقيت غير صالح/);

const controller=fs.readFileSync(path.join(process.cwd(),'prayer-times.js'),'utf8');
assert.doesNotMatch(controller,/api\.aladhan\.com|fetch\s*\(/,'web prayer controller has no external timing request');
assert.match(controller,/engine\.calculateDay/,'controller uses the local engine');
const html=fs.readFileSync(path.join(process.cwd(),'index.html'),'utf8');
assert.match(html,/vendor\/praytime\.js/);
assert.match(html,/local-prayer-engine\.js/);
const sw=fs.readFileSync(path.join(process.cwd(),'service-worker.js'),'utf8');
assert.match(sw,/'\.\/vendor\/praytime\.js'/);
assert.match(sw,/'\.\/local-prayer-engine\.js'/);

console.log('Local prayer engine tests passed: supported cities, times, Arabic aliases, validation and no external timing request.');
