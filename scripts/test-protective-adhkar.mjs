import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function cleanSavedCards(source){
 const start=source.indexOf('function renderProtectiveAdhkar()');
 const end=source.indexOf('window.AnwarRenderAdhkar=function()',start);
 const renderer=source.slice(start,end);
 return start>=0&&end>start&&renderer.includes('card.append(body);fragment.append(card)')&&!renderer.includes('protective-entry-menu');
}

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
assert.ok(app.includes('S.customAdhkar.push({id,text,font,ts:Date.now()})')&&app.includes('save();form.reset()'),'a visitor can save an entry and its selected font through notebook persistence');
assert.ok(app.includes('entry.text=text;entry.font=font;entry.ts=Date.now()')&&app.includes('S.customAdhkar=S.customAdhkar.filter(saved=>saved.id!==item.id)'),'personal entries can be edited with their selected font and removed through the private manager');
assert.ok(app.includes("textInput.name='text'")&&app.includes('textInput.maxLength=3000')&&app.includes('S.customAdhkar.length>=100')&&app.includes('font:safeFontName(item.font)'),'the single text field, selected font and collection size are bounded');
const renderer=app.slice(app.indexOf('function renderProtectiveAdhkar()'),app.indexOf('window.AnwarRenderAdhkar=function()'));
assert.ok(!renderer.includes('titleInput')&&!renderer.includes('titleLabel')&&!renderer.includes('عنوان الذكر'),'the protection editor contains no title field or title metadata');
assert.ok(!/clean\.push\(\{id,title,/.test(app)&&!app.includes('S.customAdhkar.push({id,title,'),'stored personal entries do not require a title');
assert.ok(app.includes('body.textContent=item.text')&&!app.includes('body.innerHTML=item.text'),'user-authored content is rendered as inert text, not HTML');
assert.ok(app.includes('function renderProtectiveAdhkar()')&&app.includes('window.AnwarRenderAdhkar=function(){return renderProtectiveAdhkar();}'),'the dashboard opens the personal editor directly');
assert.ok(app.includes('customAdhkar:[]'),'fresh storage begins with an empty personal collection');
assert.ok(worker.includes("const CACHE_NAME='anwar-shell-2026-11-21-v141';")&&worker.includes("'./protective-adhkar.js'"),'the empty starter data ships in the new offline shell');
assert.ok(html.includes('data-dismiss-adhkar-notice="privacy"')&&app.includes('function makeAdhkarNotice(text,key,className)'),'privacy and writing guidance have independent dismissible controls');
assert.ok(app.includes('function dismissAdhkarNotice(button,key)')&&app.includes("localStorage.setItem('anwar_adhkar_notice_'+noticeKey,'dismissed')")&&app.includes("localStorage.getItem('anwar_adhkar_notice_'+key)==='dismissed'"),'dismissal is remembered across visits and renderer refreshes');
assert.ok(app.includes("document.addEventListener('click',event=>")&&app.includes("target.closest('.adhkar-note-dismiss[data-dismiss-adhkar-notice]')")&&app.includes("button.closest('#anwarAdhkarPage')")&&app.includes('dismissAdhkarNotice(button,button.dataset.dismissAdhkarNotice)')&&app.includes('},true);'),'one capture-phase delegated handler dismisses static and dynamically-created notices');
assert.ok(app.includes("dialog.id='adhkarPersonalManager'")&&app.includes('function openPersonalAdhkarManager()')&&app.includes("manage.textContent='إدارة الأذكار المحفوظة ('")&&cleanSavedCards(app),'saved cards remain free of controls while edit and delete are available in a separate manager');
console.log('PASS: one text field only; guidance notices can be dismissed permanently on this device.');
