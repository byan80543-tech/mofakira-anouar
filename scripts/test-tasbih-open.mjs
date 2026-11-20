import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root=new URL('../',import.meta.url);
const html=fs.readFileSync(new URL('index.html',root),'utf8');
const appCore=fs.readFileSync(new URL('app-core.js',root),'utf8');
const controller=fs.readFileSync(new URL('tasbih-controller.js',root),'utf8');
const dashboardMarker='/* Anwar service dashboard: organize prayer, Quran, radio, lessons, adhkar and tasbih. */';
const dashboardStart=appCore.indexOf(dashboardMarker);
assert.ok(dashboardStart>=0,'the service dashboard owns the new navigation');
const dashboardSource=appCore.slice(dashboardStart);
new vm.Script(dashboardSource,{filename:'anwar-service-dashboard.js'});
new vm.Script(controller,{filename:'tasbih-controller.js'});

function elementBlock(source,tag,needle){
 const start=source.indexOf(needle);
 assert.ok(start>=0,'missing '+needle);
 const re=new RegExp('<'+tag+'\\b[^>]*>|<\\/'+tag+'>','g');
 re.lastIndex=start;
 let depth=0,match;
 while((match=re.exec(source))){
  if(match[0].startsWith('</'))depth--;else depth++;
  if(depth===0)return source.slice(start,re.lastIndex);
 }
 throw new Error('unclosed '+needle);
}
const ownerDialog=elementBlock(html,'dialog','<dialog id="ownerDialog">');
const adhkarPage=elementBlock(html,'section','<section id="anwarAdhkarPage"');
const tasbihPage=elementBlock(html,'section','<section id="anwarTasbihPage"');
const ownerTabs=ownerDialog.slice(ownerDialog.indexOf('<div class="owner-tabs">'),ownerDialog.indexOf('<section id="ownerPanel"'));
assert.ok(ownerTabs.includes('id="ownerTab"')&&ownerTabs.includes('id="shareTab"'),'ownership dialog keeps owner and publication tabs');
assert.doesNotMatch(ownerTabs,/adhkarTab/,'the adhkar tab is removed from ownership');
assert.doesNotMatch(ownerDialog,/id="adhkarPanel"|id="tasbihPanel"/,'adhkar and tasbih are no longer nested inside ownership dialog');
assert.ok(adhkarPage.includes('id="adhkarPanel"')&&adhkarPage.includes('id="morningTab"')&&adhkarPage.includes('id="eveningTab"')&&adhkarPage.includes('id="adhkarContent"'),'the dedicated adhkar page contains morning/evening navigation and existing content renderer');
assert.ok(tasbihPage.includes('id="tasbihPanel"')&&tasbihPage.includes('id="tasbihCounterControl"')&&tasbihPage.includes('id="tasbihVoice"')&&tasbihPage.includes('id="tasbihThemePicker"'),'the standalone tasbih page keeps counter, voice and appearance controls');
assert.ok(!tasbihPage.includes('adhkarTasbihToggle'),'the obsolete intermediate tasbih launcher is removed');
for(const id of ['adhkarPanel','tasbihPanel','tasbihCount','tasbihVoice','morningTab','eveningTab']){
 assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id+' remains unique after moving');
}
assert.ok((html.match(/data-anwar-service="adhkar"/g)||[]).length===1,'the home dashboard has one adhkar entry card');
assert.ok((html.match(/data-anwar-service="tasbih"/g)||[]).length===1,'the home dashboard has one tasbih entry card');
assert.ok(appCore.includes('window.AnwarRenderAdhkar=function(period)'), 'the existing morning/evening renderer remains available');
assert.ok(appCore.includes("if(name==='adhkar'&&typeof window.AnwarRenderAdhkar==='function')"),'the adhkar card opens with the morning list');
assert.ok(appCore.includes("if(name==='tasbih')")&&appCore.includes('controller.open()'),'the tasbih card opens its own page controller directly');
assert.ok(!appCore.includes("else if(id==='adhkarTab')")&&!appCore.includes('toggleTasbihFromToolbar'),'the ownership and tasbih entry points are no longer coupled');
assert.ok(controller.includes('window.AnwarTasbihController=Object.freeze({')&&controller.includes('open(){'),'the independent controller exposes its direct open action');
assert.ok(!controller.includes('ownerDialog')&&!controller.includes('ownerPanel')&&!controller.includes('switchOwnerView'),'the counter controller no longer depends on ownership navigation');
assert.ok(controller.includes("preferences.set('tasbih'")&&controller.includes('preferences.subscribe(saved=>'),'encrypted counter preferences and saved state remain active');
assert.ok(controller.includes('voiceButton.addEventListener')&&controller.includes('recognition.lang=speechLanguage'),'voice recognition remains wired after moving the markup');

console.log('Dedicated adhkar and tasbih service pages, owner separation and preserved counter-controller tests passed.');
