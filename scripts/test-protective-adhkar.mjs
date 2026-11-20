import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root=process.cwd();
const dataSource=fs.readFileSync(new URL('../protective-adhkar.js',import.meta.url),'utf8');
const window={};
vm.runInNewContext(dataSource,{window},{timeout:3000});
const entries=window.ANWAR_PROTECTIVE_ADHKAR;
assert.ok(Array.isArray(entries)&&entries.length>=10,'the protective collection includes a useful curated set');
assert.equal(new Set(entries.map(item=>item.id)).size,entries.length,'every protective entry has a stable unique identifier');
for(const item of entries){
 assert.ok(item.id&&item.group&&item.title&&item.text&&item.source,'every entry includes a title, group, text and source');
 assert.ok(item.sourceUrl.startsWith('https://'),'every entry links to an HTTPS source');
 assert.ok(item.count===null||(Number.isInteger(item.count)&&item.count>0),'repetition is either a positive specified count or explicitly unspecified');
}
const byId=Object.fromEntries(entries.map(item=>[item.id,item]));
assert.equal(byId['three-surahs'].count,3,'the three protective surahs retain their narrated repetition count');
assert.equal(byId['bismillah-protection'].count,3,'the protection invocation retains its narrated repetition count');
assert.equal(byId['audhu-evening'].count,3,'the evening invocation retains its narrated repetition count');
assert.equal(byId['children-protection'].count,null,'the children invocation is not assigned an unsupported repetition count');
assert.equal(byId['ruqya-eye'].count,null,'the ruqya is not assigned an unsupported repetition count');
assert.equal(byId['eye-blessing-note'].kind,'note','the eye/blessing guidance is distinguished from a prescribed formula');
assert.equal(byId['kahf-protection'].kind,'note','the Kahf protection reminder is not presented as a counted dhikr');
assert.ok(entries.some(item=>item.source.includes('صحيح البخاري 3371')),'the children protection invocation cites Sahih al-Bukhari');
assert.ok(entries.some(item=>item.source.includes('صحيح مسلم 2186')),'the ruqya invocation cites Sahih Muslim');
assert.ok(entries.some(item=>item.source.includes('صحيح مسلم 589')),'the protection from trials invocation cites Sahih Muslim');

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../app-core.js',import.meta.url),'utf8');
const worker=fs.readFileSync(new URL('../service-worker.js',import.meta.url),'utf8');
assert.match(html,/<button[^>]*id="protectionTab"[^>]*>التحصين<\/button>/,'the adhkar page shows a dedicated protection tab');
assert.ok(html.indexOf('<script src="./protective-adhkar.js')<html.indexOf('<script src="./app-core.js'),'protective data loads before the application renderer');
assert.match(app,/else if\(id==='protectionTab'\)renderAdhkar\('protection'\)/,'the protection tab is wired to the renderer');
assert.match(app,/function renderProtectiveAdhkar\(\)/,'the dedicated protective renderer exists');
assert.match(app,/countButton\.dataset\.protectiveAction='count'/,'the renderer exposes a per-entry repeat action');
assert.match(app,/protectiveProgress/,'per-entry progress is tracked independently');
assert.match(app,/source\.rel='noopener noreferrer'/,'source links use safe new-tab attributes');
assert.ok(worker.includes("'./protective-adhkar.js'"),'the protective data file is precached for offline use');
assert.match(worker,/anwar-shell-2026-11-20-v119/,'the service-worker cache is bumped for the new local data');
console.log('Protective adhkar content, source metadata, repeat counts and offline integration tests passed.');
