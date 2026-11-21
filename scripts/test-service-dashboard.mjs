import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root=process.cwd();
const appCore=fs.readFileSync(path.join(root,'app-core.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const backNavigation=fs.readFileSync(path.join(root,'toolbar-back-navigation.js'),'utf8');
const marker='/* Anwar service dashboard: organize prayer, Quran, radio, lessons, adhkar and tasbih. */';
const start=appCore.indexOf(marker);
assert.notEqual(start,-1,'service dashboard initializer exists');
const dashboardSource=appCore.slice(start);
new vm.Script(dashboardSource,{filename:'anwar-service-dashboard.js'});

class FakeElement{
 constructor(name,text=''){
  this.name=name;
  this.textContent=text;
  this.children=[];
  this.parentNode=null;
  this.dataset={};
  this.attributes=new Map();
  this.listeners=new Map();
  this.hidden=false;
  this.open=false;
  this.focused=false;
  this.scrollCount=0;
 }
 append(child){
  if(child.parentNode){
   const old=child.parentNode.children.indexOf(child);
   if(old>=0)child.parentNode.children.splice(old,1);
  }
  child.parentNode=this;
  this.children.push(child);
 }
 addEventListener(type,callback){
  if(!this.listeners.has(type))this.listeners.set(type,[]);
  this.listeners.get(type).push(callback);
 }
 fire(type){
  for(const callback of this.listeners.get(type)||[])callback({target:this});
 }
 setAttribute(name,value){this.attributes.set(name,String(value))}
 getAttribute(name){return this.attributes.get(name)??null}
 focus(){this.focused=true}
 scrollTo(){this.scrollCount++}
 scrollIntoView(){this.scrollCount++}
 querySelector(selector){
  if(selector==='[data-anwar-service-back]')return this.backButton||null;
  if(selector==='.anwar-prayer-settings')return this.settings||null;
  if(selector==='summary')return this.summary||null;
  return null;
 }
 querySelectorAll(){return []}
}

const panel=new FakeElement('radio-panel');
const home=new FakeElement('service-home');
const quranPage=new FakeElement('quran-page');
const radioPage=new FakeElement('radio-page');
const lessonsPage=new FakeElement('lessons-page');
const adhkarPage=new FakeElement('adhkar-page');
const tasbihPage=new FakeElement('tasbih-page');
quranPage.hidden=true;radioPage.hidden=true;lessonsPage.hidden=true;adhkarPage.hidden=true;tasbihPage.hidden=true;
const radioTitle=new FakeElement('radio-title','الإذاعات المباشرة');
const quranTitle=new FakeElement('quran-title','القرآن الكريم · اختر صوتاً وابدأ فوراً');
const liveStation=new FakeElement('live-station');
const radioHero=new FakeElement('radio-hero');
const readerList=new FakeElement('reader-list');
const lessonHub=new FakeElement('lesson-hub');

const quranBack=new FakeElement('quran-back');
const radioBack=new FakeElement('radio-back');
const lessonsBack=new FakeElement('lessons-back');
const adhkarBack=new FakeElement('adhkar-back');
const tasbihBack=new FakeElement('tasbih-back');
quranPage.backButton=quranBack;
radioPage.backButton=radioBack;
lessonsPage.backButton=lessonsBack;
adhkarPage.backButton=adhkarBack;
tasbihPage.backButton=tasbihBack;
quranPage.append(quranBack);
radioPage.append(radioBack);
radioPage.append(radioTitle);
lessonsPage.append(lessonsBack);
adhkarPage.append(adhkarBack);
tasbihPage.append(tasbihBack);

const services={};
for(const name of ['adhan','quran','radio','lessons','adhkar','tasbih']){
 const button=new FakeElement(name+'-button');
 button.dataset.anwarService=name;
 services[name]=button;
}
const backs=[quranBack,radioBack,lessonsBack,adhkarBack,tasbihBack];
panel.append(new FakeElement('header'));
panel.append(home);
panel.append(quranPage);
panel.append(radioPage);
panel.append(lessonsPage);
panel.append(adhkarPage);
panel.append(tasbihPage);
panel.append(quranTitle);
panel.append(radioHero);
panel.append(liveStation);
panel.append(readerList);
panel.append(lessonHub);

panel.querySelectorAll=selector=>{
 if(selector==='.radio-section-title')return [radioTitle,quranTitle];
 if(selector==='[data-anwar-service]')return Object.values(services);
 if(selector==='[data-anwar-service-back]')return backs;
 return [];
};
panel.querySelector=selector=>{
 if(selector==='[data-anwar-service="adhan"]')return services.adhan;
 return null;
};

const prayerSummary=new FakeElement('prayer-summary');
const prayerSettings=new FakeElement('prayer-settings');
prayerSettings.open=false;
prayerSettings.querySelector=selector=>selector==='summary'?prayerSummary:null;
const prayerCard=new FakeElement('prayer-card');
prayerCard.settings=prayerSettings;

const launcher=new FakeElement('tulip-launcher');
const ids={
 rd:panel,
 anwarServiceHome:home,
 anwarQuranPage:quranPage,
 anwarRadioPage:radioPage,
 anwarLessonsPage:lessonsPage,
 anwarAdhkarPage:adhkarPage,
 anwarTasbihPage:tasbihPage,
 liveStationArea:liveStation,
 lessonHub,
 rg:launcher,
 anwarPrayerCard:prayerCard
};
const document={
 getElementById:id=>ids[id]||null,
 querySelector:selector=>selector==='#anwarPrayerCard .anwar-prayer-settings'?prayerSettings:null,
 querySelectorAll:()=>[]
};

const renderedAdhkar=[];
const tasbihCalls=[];
const windowListeners=new Map();
const historyEntries=[{anwarNotebookTestStart:true}];
let historyIndex=0;
const history={
 get state(){return historyEntries[historyIndex]??null},
 pushState(state){
  historyEntries.splice(historyIndex+1);
  historyEntries.push(state);
  historyIndex++;
 },
 back(){
  if(historyIndex<=0)return;
  historyIndex--;
  for(const callback of windowListeners.get('popstate')||[]){
   callback({state:historyEntries[historyIndex]??null});
  }
 },
 forward(){
  if(historyIndex>=historyEntries.length-1)return;
  historyIndex++;
  for(const callback of windowListeners.get('popstate')||[]){
   callback({state:historyEntries[historyIndex]??null});
  }
 }
};
const window={
 history,
 location:{href:'https://example.test/mofakira-anouar/'},
 addEventListener(type,callback){
  if(!windowListeners.has(type))windowListeners.set(type,[]);
  windowListeners.get(type).push(callback);
 },
 AnwarRenderAdhkar(period){renderedAdhkar.push(period);return true},
 AnwarTasbihController:{
  open(){tasbihCalls.push('open');return true},
  close(){tasbihCalls.push('close');return true}
 }
};
vm.runInNewContext(dashboardSource,{document,window,console:{warn(){}}});

assert.equal(quranTitle.parentNode,quranPage,'Quran heading must remain in Quran page');
assert.equal(radioTitle.parentNode,radioPage,'live-radio heading must remain in live-radio page');
assert.equal(liveStation.parentNode,radioPage,'live station picker must be in live-radio page');
assert.equal(radioHero.parentNode,quranPage,'reader hero must remain in Quran page');
assert.equal(readerList.parentNode,quranPage,'reader list must remain in Quran page');
assert.equal(lessonHub.parentNode,lessonsPage,'lesson library must be in lessons page');

services.quran.fire('click');
assert.equal(window.history.state.anwarServiceView,'quran','opening Quran adds a same-page history entry');
assert.equal(home.hidden,true,'opening Quran hides the dashboard');
assert.equal(quranPage.hidden,false,'opening Quran shows the Quran page');
assert.equal(radioPage.hidden,true,'opening Quran hides the live-radio page');
assert.equal(quranBack.focused,true,'opening Quran moves focus to its return control');

quranBack.fire('click');
assert.equal(home.hidden,false,'returning from Quran restores the dashboard');
assert.equal(quranPage.hidden,true,'returning from Quran hides the Quran page');
assert.equal(services.quran.focused,true,'returning restores focus to the launch card');
assert.equal(window.history.state.anwarNotebookTestStart,true,'returning from Quran removes only the religious section history entry');

services.radio.fire('click');
assert.equal(home.hidden,true,'opening live radio hides the dashboard');
assert.equal(radioPage.hidden,false,'opening live radio shows its own page');
assert.equal(quranPage.hidden,true,'opening live radio hides Quran content');
assert.equal(radioTitle.parentNode,radioPage,'live-radio title is not displaced by navigation');
radioBack.fire('click');
assert.equal(home.hidden,false,'returning from live radio restores the dashboard');
assert.equal(radioPage.hidden,true,'returning from live radio hides the live-radio page');

services.lessons.fire('click');
assert.equal(lessonsPage.hidden,false,'opening lessons shows the lesson page');
assert.equal(quranPage.hidden,true,'opening lessons hides Quran content');
lessonsBack.fire('click');


services.adhkar.fire('click');
assert.equal(home.hidden,true,'opening adhkar hides the dashboard');
assert.equal(adhkarPage.hidden,false,'opening adhkar shows the dedicated adhkar page');
assert.deepEqual(renderedAdhkar,['protection'],'opening the adhkar card opens the unified protection collection directly');
assert.equal(window.history.state.anwarServiceView,'adhkar','opening adhkar records the current service view');
window.history.back();
assert.equal(home.hidden,false,'Android/browser back returns to religious sections instead of leaving the religious dashboard');
assert.equal(adhkarPage.hidden,true,'browser back hides only the current adhkar page');
window.history.forward();
assert.equal(home.hidden,true,'browser forward restores the previous religious section');
assert.equal(adhkarPage.hidden,false,'browser forward restores the same adhkar page');
adhkarBack.fire('click');
assert.equal(home.hidden,false,'returning from adhkar restores the dashboard');
assert.equal(adhkarPage.hidden,true,'returning from adhkar hides its page');

services.tasbih.fire('click');
assert.equal(home.hidden,true,'opening tasbih hides the dashboard');
assert.equal(tasbihPage.hidden,false,'opening tasbih shows the dedicated tasbih page');
assert.deepEqual(tasbihCalls,['open'],'opening tasbih invokes the existing standalone counter controller');
tasbihBack.fire('click');
assert.equal(home.hidden,false,'returning from tasbih restores the dashboard');
assert.equal(tasbihPage.hidden,true,'returning from tasbih hides its page');
assert.deepEqual(tasbihCalls,['open','close'],'leaving tasbih closes its controller and releases active voice recognition');

services.adhan.fire('click');
assert.equal(prayerSettings.open,true,'Adhan card opens the existing settings disclosure');
assert.equal(services.adhan.getAttribute('aria-expanded'),'true','Adhan tile reports its expanded state');
assert.equal(prayerSummary.focused,true,'Adhan action moves focus to the settings summary');

launcher.fire('click');
assert.equal(home.hidden,false,'opening the Tulip launcher resets the panel to its home view');
assert.equal(quranPage.hidden,true,'opening the Tulip launcher hides stale Quran content');
assert.equal(radioPage.hidden,true,'opening the Tulip launcher hides stale radio content');
assert.equal(lessonsPage.hidden,true,'opening the Tulip launcher hides stale lesson content');
assert.equal(adhkarPage.hidden,true,'opening the Tulip launcher hides stale adhkar content');
assert.equal(tasbihPage.hidden,true,'opening the Tulip launcher hides stale tasbih content');

assert.ok(dashboardSource.includes("const SERVICE_HISTORY_KEY='anwarServiceView'")&&dashboardSource.includes("window.addEventListener('popstate',handleServicePopState)")&&dashboardSource.includes('historyApi.pushState(serviceState(name)'), 'service pages create browser history entries and listen for Android/browser back');
assert.ok(dashboardSource.includes('function returnToServiceHome()')&&dashboardSource.includes('historyApi.back()')&&dashboardSource.includes('button.addEventListener(\'click\',returnToServiceHome)'), 'the in-page section back control consumes only its service history entry');
assert.ok(dashboardSource.includes('function closeNestedServiceLayer()')&&dashboardSource.includes("'surahPickerModal','surahPickerClose'")&&dashboardSource.includes("'lessonSeriesModal','lessonSeriesClose'")&&dashboardSource.includes('.protective-personal-form[data-edit-id]'), 'system back first closes a nested picker/dialog or cancels adhkar editing');
assert.ok(backNavigation.includes("document.querySelector('#rd .anwar-service-page:not([hidden])')")&&backNavigation.includes("servicePage.querySelector('[data-anwar-service-back]')")&&backNavigation.includes("cancelEdit.click()"), 'the toolbar back button stays inside the religious dashboard and cancels edit mode before leaving the section');
assert.ok(html.includes('id="ownerBtn" class="radio-owner-pen"')&&html.includes('class="owner-pen-icon"')&&(html.match(/class="owner-pen-icon"/g)||[]).length>=2&&!html.includes('M7 3.5 20.5 17'), 'the ownership shortcut and ownership section share the new clear pen emblem');
console.log('Service dashboard navigation, section placement, and return-focus tests passed.');
