import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const dataSource=fs.readFileSync(new URL('../protective-adhkar.js',import.meta.url),'utf8');
const window={};
vm.runInNewContext(dataSource,{window},{timeout:3000});
assert.ok(Array.isArray(window.ANWAR_PROTECTIVE_ADHKAR),'empty protective collection is initialized');
assert.equal(window.ANWAR_PROTECTIVE_ADHKAR.length,0,'no preset adhkar are imposed on visitors');

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../app-core.js',import.meta.url),'utf8');
const worker=fs.readFileSync(new URL('../service-worker.js',import.meta.url),'utf8');
assert.ok(html.includes('data-anwar-service="adhkar"')&&html.includes('class="protective-page-title">أذكار التحصين</h2>'),'the dashboard opens one dedicated protection page');
assert.ok(html.includes('id="adhkarContent"')&&!html.includes('id="adhkarAdminOpen"'),'the page provides a personal content area, not an owner-only control');
assert.ok(app.includes('function cleanCustomAdhkar(value)')&&app.includes('customAdhkar:cleanCustomAdhkar(d.customAdhkar)'),'personal entries are normalized as part of notebook storage');
assert.ok(app.includes('S.customAdhkar.push({id,title,text,ts:Date.now()})')&&app.includes('save();form.reset()'),'a visitor can add an entry and save it through notebook persistence');
assert.ok(app.includes('entry.title=title;entry.text=text;entry.ts=Date.now()')&&app.includes('S.customAdhkar=S.customAdhkar.filter(entry=>entry.id!==item.id)'),'personal entries can be edited and removed');
assert.ok(app.includes('titleInput.maxLength=120')&&app.includes('textInput.maxLength=3000')&&app.includes('S.customAdhkar.length>=100'),'entry lengths and collection size are bounded');
assert.ok(app.includes('body.textContent=item.text')&&!app.includes('body.innerHTML=item.text'),'user-authored content is rendered as inert text, not HTML');
assert.ok(app.includes('function renderProtectiveAdhkar()')&&app.includes('window.AnwarRenderAdhkar=function(){return renderProtectiveAdhkar();}'),'the dashboard opens the personal editor directly');
assert.ok(app.includes('customAdhkar:[]'),'fresh storage begins with an empty personal collection');
assert.ok(worker.includes("const CACHE_NAME='anwar-shell-2026-11-21-v129';")&&worker.includes("'./protective-adhkar.js'"),'the empty starter data ships in the new offline shell');
console.log('PASS: no preset adhkar; visitors manage their own saved personal collection.');
