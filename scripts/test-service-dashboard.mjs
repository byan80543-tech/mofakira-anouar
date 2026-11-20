import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root=process.cwd();
const appCore=fs.readFileSync(path.join(root,'app-core.js'),'utf8');
const marker='/* Anwar service dashboard: organize existing prayer, Quran, live radio and lesson controls. */';
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
const radioTitle=new FakeElement('radio-title','الإذاعات المباشرة');
const quranTitle=new FakeElement('quran-title','القرآن الكريم · اختر صوتاً وابدأ فوراً');
const liveStation=new FakeElement('live-station');
const radioHero=new FakeElement('radio-hero');
const readerList=new FakeElement('reader-list');
const lessonHub=new FakeElement('lesson-hub');

const quranBack=new FakeElement('quran-back');
const radioBack=new FakeElement('radio-back');
const lessonsBack=new FakeElement('lessons-back');
quranPage.backButton=quranBack;
radioPage.backButton=radioBack;
lessonsPage.backButton=lessonsBack;
quranPage.append(quranBack);
radioPage.append(radioBack);
radioPage.append(radioTitle);
lessonsPage.append(lessonsBack);

const services={};
for(const name of ['adhan','quran','radio','lessons']){
 const button=new FakeElement(name+'-button');
 button.dataset.anwarService=name;
 services[name]=button;
}
const backs=[quranBack,radioBack,lessonsBack];
panel.append(new FakeElement('header'));
panel.append(home);
panel.append(quranPage);
panel.append(radioPage);
panel.append(lessonsPage);
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
 liveStationArea:liveStation,
 lessonHub,
 rg:launcher,
 anwarPrayerCard:prayerCard
};
const document={
 getElementById:id=>ids[id]||null,
 querySelector:selector=>selector==='#anwarPrayerCard .anwar-prayer-settings'?prayerSettings:null
};

vm.runInNewContext(dashboardSource,{document});

assert.equal(quranTitle.parentNode,quranPage,'Quran heading must remain in Quran page');
assert.equal(radioTitle.parentNode,radioPage,'live-radio heading must remain in live-radio page');
assert.equal(liveStation.parentNode,radioPage,'live station picker must be in live-radio page');
assert.equal(radioHero.parentNode,quranPage,'reader hero must remain in Quran page');
assert.equal(readerList.parentNode,quranPage,'reader list must remain in Quran page');
assert.equal(lessonHub.parentNode,lessonsPage,'lesson library must be in lessons page');

services.quran.fire('click');
assert.equal(home.hidden,true,'opening Quran hides the dashboard');
assert.equal(quranPage.hidden,false,'opening Quran shows the Quran page');
assert.equal(radioPage.hidden,true,'opening Quran hides the live-radio page');
assert.equal(quranBack.focused,true,'opening Quran moves focus to its return control');

quranBack.fire('click');
assert.equal(home.hidden,false,'returning from Quran restores the dashboard');
assert.equal(quranPage.hidden,true,'returning from Quran hides the Quran page');
assert.equal(services.quran.focused,true,'returning restores focus to the launch card');

services.radio.fire('click');
assert.equal(home.hidden,true,'opening live radio hides the dashboard');
assert.equal(radioPage.hidden,false,'opening live radio shows its own page');
assert.equal(quranPage.hidden,true,'opening live radio hides Quran content');
assert.equal(radioTitle.parentNode,radioPage,'live-radio title is not displaced by navigation');
radioBack.fire('click');

services.lessons.fire('click');
assert.equal(lessonsPage.hidden,false,'opening lessons shows the lesson page');
assert.equal(quranPage.hidden,true,'opening lessons hides Quran content');
lessonsBack.fire('click');

services.adhan.fire('click');
assert.equal(prayerSettings.open,true,'Adhan card opens the existing settings disclosure');
assert.equal(services.adhan.getAttribute('aria-expanded'),'true','Adhan tile reports its expanded state');
assert.equal(prayerSummary.focused,true,'Adhan action moves focus to the settings summary');

launcher.fire('click');
assert.equal(home.hidden,false,'opening the Tulip launcher resets the panel to its home view');
assert.equal(quranPage.hidden,true,'opening the Tulip launcher hides stale Quran content');
assert.equal(radioPage.hidden,true,'opening the Tulip launcher hides stale radio content');
assert.equal(lessonsPage.hidden,true,'opening the Tulip launcher hides stale lesson content');

console.log('Service dashboard navigation, section placement, and return-focus tests passed.');
