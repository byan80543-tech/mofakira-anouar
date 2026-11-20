import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root=process.cwd();
const prayer=fs.readFileSync(path.join(root,'prayer-times.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const worker=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');

assert.doesNotThrow(()=>new vm.Script(prayer,{filename:'prayer-times.js'}),'prayer controller syntax');
assert.match(prayer,/const infoDetails=el\('details','anwar-prayer-info'\)/,'privacy explanation has a details disclosure');
assert.match(prayer,/infoDetails\.append\(infoSummary,privacyLine\)/,'complete original privacy explanation remains inside the disclosure');
assert.match(prayer,/card\.append\(head,nextBox,timesGrid,dateLine,infoDetails,details,audio\)/,'prayer card keeps all original sections and the privacy disclosure');
assert.match(prayer,/nextBox\.hidden=true/,'countdown starts hidden while prayer data is unavailable');
assert.match(prayer,/nextBox\.hidden=false/,'countdown appears when a next prayer event is calculated');
assert.match(prayer,/nextName\.textContent='';nextWhen\.textContent='';countdown\.textContent='';/,'unavailable countdown does not show placeholder dashes');
assert.match(prayer,/جارٍ تحميل مواقيت الصلاة…/,'initial loading state is clear and visible');
assert.match(prayer,/تعذّر تحميل المواقيت؛ تحقق من اسم المدينة أو الاتصال/,'failed loading state tells the user what to check');
assert.match(prayer,/dateLine\.dataset\.state='ready'/,'successful timings mark the card ready');
assert.match(prayer,/function cityForDisplay\(value\)/,'city display helper exists');
assert.match(prayer,/meknes:'مكناس'/,'Meknes is displayed in Arabic');
assert.match(prayer,/locationLabel\.textContent=cityForDisplay\(settings\.city\)\+' · '\+countryForDisplay\(settings\.country\)/,'location heading displays city before country in Arabic');
assert.match(prayer,/\.anwar-prayer-card\{gap:7px;padding:10px 11px\}/,'prayer card uses compact spacing');
assert.match(prayer,/\.anwar-prayer-next\[hidden\]\{display:none!important\}/,'hidden countdown is not forced visible by the grid rule');
assert.match(html,/<small>أصوات الأذان<\/small><strong>اختيار الصوت والتنبيهات<\/strong>/,'section card distinguishes adhan sounds from the prayer timetable');
assert.match(html,/#rd \.curtain-head #ownerBtn\.radio-owner-pen[\s\S]*?width:34px!important;height:34px!important/,'ownership button matches the close button dimensions');
assert.match(html,/prayer-times\.js\?v=20261120-6/,'HTML loads the updated prayer controller');
assert.match(worker,/anwar-shell-2026-11-20-v109/,'service worker cache is bumped for the updated prayer card');

console.log('Prayer card compact layout, loading states, Arabic location and header controls tests passed.');
