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
assert.equal(byId['ayat-al-kursi'].count,1,'Ayat al-Kursi is included in the unified daily protection collection');
assert.equal(byId['morning-opening'].occasion,'يقال في الصباح','the morning invocation is preserved in the unified collection');
assert.equal(byId['evening-opening'].occasion,'يقال في المساء','the evening invocation is preserved in the unified collection');
assert.equal(byId['sayyid-istighfar'].count,1,'the daily istighfar is transferred into the unified collection');
assert.equal(byId.contentment.count,3,'the threefold contentment invocation remains in the unified collection');
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
assert.ok(html.includes('data-anwar-service="adhkar"')&&html.includes('class="protective-page-title">أذكار التحصين</h2>'),'the dashboard opens one unified protection page');
assert.doesNotMatch(html,/id="morningTab"|id="eveningTab"|id="protectionTab"/,'separate morning evening and secondary protection tabs are removed');
assert.ok(html.indexOf('<script src="./protective-adhkar.js')<html.indexOf('<script src="./app-core.js'),'protective data loads before the application renderer');
assert.match(app,/window\.AnwarRenderAdhkar=function\(\)\{return renderProtectiveAdhkar\(\);\}/,'the protection renderer is directly callable by the dashboard');
assert.match(app,/window\.AnwarRenderAdhkar\('protection'\)/,'opening the adhkar service card directly renders protection');
assert.match(app,/function renderProtectiveAdhkar\(\)/,'the dedicated protective renderer exists');
assert.match(app,/countButton\.dataset\.protectiveAction='count'/,'the renderer exposes a per-entry repeat action');
assert.match(app,/protectiveProgress/,'per-entry progress is tracked independently');
assert.match(app,/source\.rel='noopener noreferrer'/,'source links use safe new-tab attributes');
assert.ok(worker.includes("'./protective-adhkar.js'"),'the protective data file is precached for offline use');
assert.match(worker,/const CACHE_NAME='anwar-shell-\d{4}-\d{2}-\d{2}-v\d+';/,'the service-worker cache remains date-and-version tagged for offline app updates');
console.log('Protective adhkar content, source metadata, repeat counts and offline integration tests passed.');
