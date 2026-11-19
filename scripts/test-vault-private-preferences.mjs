import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html=fs.readFileSync(new URL('../app-core.js',import.meta.url),'utf8');
const apiStart=html.indexOf('/* Encrypted private settings shared by the notebook modules. */');
const apiEnd=html.indexOf('requestAnimationFrame(()=>setTimeout(()=>{',apiStart);
assert.ok(apiStart>=0&&apiEnd>apiStart,'private preference API is present');
const sandbox={console,requestAnimationFrame(){},setTimeout(){},clearTimeout(){}};sandbox.globalThis=sandbox;
vm.runInNewContext(html.slice(apiStart,apiEnd),sandbox,{timeout:3000});
const api=sandbox.AnwarPrivatePreferences;
assert.ok(api,'private preference API is installed');

let state=api.get();
assert.equal(state.readerAdvance,'c');
assert.equal(state.radio.surah,1);
assert.equal(state.tasbih.count,0);
assert.equal(state.tasbih.dhikr,'أستغفر الله العظيم وأتوب إليه');
assert.deepEqual(Array.from(state.tasbih.customDhikrs),[],'custom dhikr list starts empty');

let notifications=0,persisted=null;
api.subscribe(()=>notifications++);
api.setPersistHandler(value=>{persisted=value});
api.set('readerAdvance','s');
assert.equal(api.get().readerAdvance,'s');
assert.equal(persisted.readerAdvance,'s','preference change requests encrypted vault persistence');
api.set('radio',{reciter:'قارئ تجريبي',surah:36});
assert.equal(api.get().radio.reciter,'قارئ تجريبي');
assert.equal(api.get().radio.surah,36);
api.set('tasbih',{count:125,dhikr:'سبحان الله'});
assert.equal(api.get().tasbih.count,125);
assert.equal(api.get().tasbih.dhikr,'سبحان الله');
assert.ok(notifications>=4,'subscribers receive initial and changed preference snapshots');

state=api.normalize({
 radio:{reciter:'ق'.repeat(500),surah:999},
 readerAdvance:'invalid',
 tasbih:{count:-5,dhikr:'ذ'.repeat(300)}
});
assert.equal(state.radio.reciter.length,120,'reciter names are length-limited');
assert.equal(state.radio.surah,1,'invalid surah indices are rejected');
assert.equal(state.readerAdvance,'c','invalid reader modes use the safe default');
assert.equal(state.tasbih.count,0,'negative counters are rejected');
assert.equal(state.tasbih.dhikr.length,200,'dhikr labels are length-limited');

state=api.normalize({radio:{surah:114},readerAdvance:'s',tasbih:{count:1000000001,dhikr:'',customDhikrs:['  سبحان الله  ','سبحان الله','الحمد لله']}});
assert.equal(state.radio.surah,114);
assert.equal(state.tasbih.count,1000000000,'counter values are capped at the documented safe maximum');
assert.equal(state.tasbih.dhikr,'أستغفر الله العظيم وأتوب إليه','empty dhikr labels use a safe default');
assert.deepEqual(Array.from(state.tasbih.customDhikrs),['سبحان الله','الحمد لله'],'custom dhikrs are trimmed, deduplicated and kept in order');
const many=Array.from({length:40},(_,index)=>'ذكر '+index);
const capped=api.normalize({tasbih:{customDhikrs:many.concat(['ذ'.repeat(240),''])}});
assert.equal(capped.tasbih.customDhikrs.length,30,'custom dhikr list is capped at 30 entries');
assert.ok(capped.tasbih.customDhikrs.every(item=>item.length<=200&&item.trim()),'custom dhikr entries are normalized and length-limited');

const helperStart=html.indexOf('function importLegacyPrivatePreferences(base){');
const helperEnd=html.indexOf('async function persistVaultSnapshot(plaintext){',helperStart);
assert.ok(helperStart>=0&&helperEnd>helperStart,'legacy settings migration helpers are present');
const stored=new Map([
 ['anwar_rd',JSON.stringify({r:'قارئ قديم',n:55,m:'c'})],
 ['anwar_reader_advance','s'],
 ['anwar_tasbih_count_v1','144'],
 ['anwar_tasbih_dhikr_v1','الحمد لله']
]);
sandbox.localStorage={
 getItem(key){return stored.has(key)?stored.get(key):null},
 removeItem(key){stored.delete(key)}
};
vm.runInNewContext(html.slice(helperStart,helperEnd)+
 '\nthis.importLegacy=importLegacyPrivatePreferences;this.clearLegacy=clearLegacyPrivatePreferences;',sandbox,{timeout:3000});
const migrated=sandbox.importLegacy(api.get());
assert.equal(migrated.radio.reciter,'قارئ قديم');
assert.equal(migrated.radio.surah,55);
assert.equal(migrated.readerAdvance,'s');
assert.equal(migrated.tasbih.count,144);
assert.equal(migrated.tasbih.dhikr,'الحمد لله');
assert.equal(stored.size,4,'migration does not delete plaintext settings before encrypted persistence');
assert.equal(sandbox.clearLegacy(),true);
assert.equal(stored.size,0,'legacy settings can be removed after encrypted persistence succeeds');

assert.ok(!html.includes("localStorage.setItem('anwar_reader_advance'"),'reader mode no longer writes plaintext');
assert.ok(!html.includes("localStorage.setItem(countKey"),'tasbih count no longer writes plaintext');
assert.ok(!html.includes("localStorage.setItem(dhikrKey"),'tasbih choice no longer writes plaintext');

console.log('All encrypted private preference tests passed.');
