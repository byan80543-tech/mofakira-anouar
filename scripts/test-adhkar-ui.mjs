import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');
const html=read('../index.html');
const core=read('../app-core.js');
const serviceWorker=read('../service-worker.js');
const start=html.indexOf('<section id="anwarAdhkarPage"');
const end=html.indexOf('<section id="anwarTasbihPage"',start);
const page=html.slice(start,end);

assert.ok(start>=0&&end>start,'the protection page remains a separate service');
assert.ok(page.includes('class="protective-page-title">أذكار التحصين</h2>'),'the page keeps its familiar title');
assert.ok(page.includes('id="adhkarContent"')&&page.includes('أضف أذكارك'),'the page explains the visitor-owned workflow');
assert.doesNotMatch(page,/adhkarAdminOpen|إدارة المالك|للزوار القراءة فقط/,'the old read-only/owner-only surface is removed');
assert.doesNotMatch(html,/adhkarAdminDialog|adhkarOfficialForm|adhkarOfficialList/,'the retired shared-library dialog and form are removed');
assert.doesNotMatch(html,/adhkar-management\.js/,'the owner-only library client is no longer loaded');
assert.ok(core.includes('customAdhkar:cleanCustomAdhkar(d.customAdhkar)')&&core.includes('save();form.reset()'),'the visitor list is saved with notebook data');
assert.ok(core.includes('body.textContent=item.text')&&core.includes("window.confirm('حذف هذا الذكر من مفكرتك؟')"),'entry text is inert and deletion is confirmed');
const renderer=core.slice(core.indexOf('function renderProtectiveAdhkar()'),core.indexOf('window.AnwarRenderAdhkar=function()'));
assert.ok(renderer.includes("textInput.name='text'")&&!renderer.includes('titleInput')&&!renderer.includes('titleLabel'),'the protection editor has only a single text input without a title field');
assert.ok(core.includes("submit.textContent='حفظ الذكر'")&&core.includes("submit.textContent='حفظ التعديل'"),'the single field has clear save and edit actions');
assert.ok(!serviceWorker.includes("'./adhkar-management.js'"),'the retired admin client is not precached');
assert.ok(page.includes('data-dismiss-adhkar-notice="privacy"')&&page.includes('adhkar-note-dismiss'),'the privacy guidance has a visible dismiss control');
assert.ok(core.includes('function makeAdhkarNotice(text,key,className)')&&core.includes("localStorage.setItem('anwar_adhkar_notice_'+t.dataset.dismissAdhkarNotice,'dismissed')")&&core.includes("localStorage.getItem('anwar_adhkar_notice_'+key)==='dismissed'"),'both guidance notices remember dismissal on this device and stay hidden after rerender');
assert.ok(core.includes("data-dismiss-adhkar-notice=key")&&core.includes("t.closest('.adhkar-dismissible-note')?.remove()"),'dismiss controls remove only their own notice');
console.log('PASS: protection editor contains one text field and dismissible persistent guidance.');
