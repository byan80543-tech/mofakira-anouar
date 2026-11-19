import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const controller=fs.readFileSync(new URL('../tasbih-controller.js',import.meta.url),'utf8');
const appCore=fs.readFileSync(new URL('../app-core.js',import.meta.url),'utf8');
const officialAdhkar=fs.readFileSync(new URL('../official-adhkar.js',import.meta.url),'utf8');

class FakeElement {
 constructor(id='',tagName='DIV'){
  this.id=id;this.tagName=tagName.toUpperCase();this.children=[];this.parentElement=null;
  this.dataset={};this.attributes={};this.listeners={};this.className='';this.textContent='';
  this.value='';this.hidden=false;this.disabled=false;this.open=false;this.selected=false;
  this.classList={
   toggle:(name,force)=>{const set=new Set(String(this.className).split(/\s+/).filter(Boolean));if(force===undefined)force=!set.has(name);if(force)set.add(name);else set.delete(name);this.className=[...set].join(' ')},
   add:name=>{if(!this.classList.contains(name))this.className=(this.className+' '+name).trim()},
   remove:name=>{this.className=String(this.className).split(/\s+/).filter(x=>x&&x!==name).join(' ')},
   contains:name=>String(this.className).split(/\s+/).includes(name)
  };
 }
 addEventListener(type,handler){(this.listeners[type]??=[]).push(handler)}
 dispatch(type,event={}){
  const value={preventDefault(){},stopPropagation(){},...event,target:event.target||this};
  for(const handler of this.listeners[type]||[])handler(value);
 }
 click(){if(!this.disabled)this.dispatch('click')}
 setAttribute(name,value){this.attributes[name]=String(value);if(name==='open')this.open=true}
 getAttribute(name){return this.attributes[name]??null}
 appendChild(child){child.parentElement=this;this.children.push(child);return child}
 replaceChildren(...items){for(const child of this.children)child.parentElement=null;this.children=[];for(const item of items)this.appendChild(item)}
 remove(){if(this.parentElement){const list=this.parentElement.children;const index=list.indexOf(this);if(index>=0)list.splice(index,1);this.parentElement=null}}
 querySelector(selector){
  if(selector==='.anwar-tasbih-counter')return this.counter||null;
  if(selector==='optgroup[data-anwar-custom-dhikrs]')return this.children.find(x=>x.tagName==='OPTGROUP'&&x.dataset.anwarCustomDhikrs!==undefined)||null;
  return null;
 }
 querySelectorAll(selector){
  if(selector==='optgroup')return this.children.filter(x=>x.tagName==='OPTGROUP');
  return [];
 }
 cloneNode(deep=false){
  const clone=new FakeElement('',this.tagName);
  clone.className=this.className;clone.textContent=this.textContent;clone.value=this.value;
  clone.dataset={...this.dataset};clone.attributes={...this.attributes};
  if(deep)this.children.forEach(child=>clone.appendChild(child.cloneNode(true)));
  return clone;
 }
 focus(){this.focused=true}
 scrollIntoView(){}
 animate(){this.animated=true}
}
class FakeSelect extends FakeElement {
 constructor(id){super(id,'SELECT')}
 get options(){return this.children.flatMap(group=>group.children)}
 get value(){const option=this.options.find(item=>item.selected);return option?option.value:''}
 set value(value){
  const match=this.options.find(item=>item.value===String(value));
  this.options.forEach(item=>{item.selected=false});
  if(match)match.selected=true;
 }
 querySelectorAll(selector){return selector==='optgroup'?this.children.filter(x=>x.tagName==='OPTGROUP'):[]}
 querySelector(selector){return selector==='optgroup[data-anwar-custom-dhikrs]'?this.children.find(x=>x.tagName==='OPTGROUP'&&x.dataset.anwarCustomDhikrs==='true')||null:null}
}

function clone(value){return JSON.parse(JSON.stringify(value))}
function buildApp(options={}){
 const selectMatch=html.match(/<select id="tasbihDhikr"[^>]*>([\s\S]*?)<\/select>/);
 assert.ok(selectMatch,'the tasbih select exists in the real HTML');
 const nodes={};
 const ids=[
  'tasbihPanel','adhkarTasbihToggle','tasbihClose','ownerDialog','ownerPanel','adhkarPanel','sharePanel',
  'ownerTab','adhkarTab','shareTab','tasbihCount','tasbihPhrase','tasbihDhikr','tasbihTap','tasbihMinus',
  'tasbihReset','tasbihDhikrCards','tasbihCustomDhikrInput','tasbihAddCustomDhikr','tasbihCustomDhikrStatus',
  'tasbihRemoveDhikr','tasbihRestoreOfficial','tasbihVoicePanel','tasbihVoice','tasbihVoiceState',
  'tasbihVoiceStatus','tasbihVoiceButtonLabel','tasbihVoiceTranscript','morningTab','eveningTab',
  'tasbihCounterControl','tasbihThemeToggle','tasbihThemePicker','tasbihThemeEmerald','tasbihThemeDark','tasbihThemePink','tasbihThemeNight','tasbihThemeHeritage','tasbihThemeGlass'
 ];
 for(const id of ids)nodes[id]=id==='tasbihDhikr'?new FakeSelect(id):new FakeElement(id,id==='ownerDialog'?'DIALOG':'DIV');
 const themeNames=['emerald','dark','pink','night','heritage','glass'];
 themeNames.forEach(name=>{nodes['tasbihTheme'+name[0].toUpperCase()+name.slice(1)].dataset.tasbihThemeOption=name});
 nodes.tasbihThemePicker.hidden=true;
 nodes.tasbihPanel.hidden=true;
 const counter=new FakeElement('tasbihCounterControl','DIV');nodes.tasbihPanel.counter=counter;nodes.tasbihCounterControl=counter;
 nodes.ownerDialog.showModal=function(){this.open=true};
 const groupPattern=/<optgroup label="([^"]*)">([\s\S]*?)<\/optgroup>/g;
 for(const groupMatch of selectMatch[1].matchAll(groupPattern)){
  const group=new FakeElement('', 'OPTGROUP');group.label=groupMatch[1];
  const optionPattern=/<option(\s+selected)?>([\s\S]*?)<\/option>/g;
  for(const optionMatch of groupMatch[2].matchAll(optionPattern)){
   const option=new FakeElement('', 'OPTION');option.value=optionMatch[2];option.textContent=optionMatch[2];option.selected=!!optionMatch[1];
   group.appendChild(option);
  }
  nodes.tasbihDhikr.appendChild(group);
 }
 const listeners=new Set();
 let state={tasbih:{count:options.initialCount??0,dhikr:nodes.tasbihDhikr.value,customDhikrs:[],removedOfficialDhikrs:options.initialRemoved??[],theme:options.initialTheme??'emerald'}};
 const preferences={
  get(){return clone(state)},
  set(section,value){state={...state,[section]:clone(value)};for(const listener of listeners)listener(clone(state));return clone(state)},
  subscribe(listener){listeners.add(listener);listener(clone(state));return ()=>listeners.delete(listener)}
 };
 const document={
  readyState:'complete',
  getElementById(id){return nodes[id]||null},
  createElement(tag){return new FakeElement('',tag)},
  addEventListener(){}
 };
 const recognitions=[];
 class MockSpeechRecognition {
  constructor(){if(options.throwRecognition)throw new Error('mock constructor failure');recognitions.push(this)}
  start(){this.started=(this.started||0)+1}
  stop(){this.stopped=(this.stopped||0)+1}
 }
 const sandbox={
  document,window:null,globalThis:null,AnwarPrivatePreferences:preferences,
  requestAnimationFrame(callback){callback()},
  confirm(){return true},
  console:{warn(){},error(){}},
  SpeechRecognition:options.noRecognition?undefined:MockSpeechRecognition
 };
 sandbox.window=sandbox;sandbox.globalThis=sandbox;
 vm.runInNewContext(officialAdhkar,sandbox,{timeout:3000});
 vm.runInNewContext(controller,sandbox,{timeout:3000});
 return {nodes,preferences,get state(){return clone(state)},recognitions,sandbox};
}
function count(app){return app.state.tasbih.count}

const counterInput=buildApp();
counterInput.nodes.tasbihCounterControl.click();
assert.equal(count(counterInput),1,'tapping the circular counter itself increments the count');
counterInput.nodes.tasbihCounterControl.dispatch('keydown',{key:'Enter'});
assert.equal(count(counterInput),2,'the circular counter supports Enter from the keyboard');
counterInput.nodes.tasbihCounterControl.dispatch('keydown',{key:' '});
assert.equal(count(counterInput),3,'the circular counter supports Space from the keyboard');

const officialApp=buildApp();
const officialOptions=officialApp.nodes.tasbihDhikr.options.filter(option=>option.dataset.anwarOfficialDhikr==='true');
assert.ok(officialOptions.length>=35,'morning and evening official adhkar are both loaded');
const officialTasbih=officialOptions.filter(option=>option.dataset.period==='tasbih');
assert.ok(officialTasbih.length>=8,'a separate official tasbih collection is loaded');
assert.ok(officialTasbih.some(option=>option.textContent==='سبحان الله'&&option.dataset.repeat==='33'&&option.dataset.source.includes('مسلم 597')),'the tasbih subhan Allah card has its established repetition and source');
assert.ok(officialTasbih.some(option=>option.textContent==='الحمد لله'&&option.dataset.repeat==='33'),'the tahmid card has its established repetition');
assert.ok(officialTasbih.some(option=>option.textContent==='الله أكبر'&&option.dataset.repeat==='33'),'the takbir card has its established repetition');
assert.ok(officialTasbih.some(option=>option.textContent==='لا حول ولا قوة إلا بالله'&&option.dataset.repeat==='غير محدد'),'unfixed repetitions are not invented');
assert.equal(officialApp.nodes.tasbihDhikrCards.children[0].children[0].textContent,'أذكار السبحة الرسمية','official tasbih is shown first in the visible list');
assert.ok(officialApp.nodes.tasbihDhikrCards.children[0].children.some(card=>card.dataset.anwarOfficialId==='tasbih-after-prayer'),'the official tasbih card is visible in the first list section');
const renderedOfficialCards=officialApp.nodes.tasbihDhikrCards.children.flatMap(group=>group.children).filter(card=>card.dataset.anwarOfficialId);
assert.ok(renderedOfficialCards.length>=35,'official morning/evening/daily adhkar render visibly in tasbih cards using native DOM children');
assert.ok(officialApp.nodes.tasbihDhikrCards.children.some(group=>group.children.some(card=>card.className==='tasbih-dhikr-card'&&card.children.some(child=>child.className==='tasbih-dhikr-card-name'&&child.textContent==='سبحان الله'))),'the original basic tasbih adhkar remain alongside the new official morning/evening sections');
assert.ok(officialOptions.some(option=>option.textContent==='آية الكرسي'&&option.dataset.dhikrText.includes('الْحَيُّ الْقَيُّومُ')),'the full Ayat al-Kursi text is available');
assert.ok(officialOptions.some(option=>option.textContent==='سور الإخلاص والفلق والناس'&&option.dataset.repeat==='3'),'the three Quls are complete and marked three times');
assert.ok(officialOptions.some(option=>option.textContent==='سبحان الله وبحمده'&&option.dataset.repeat==='100'),'the hundred-repetition dhikr includes its count');
assert.ok(officialOptions.every(option=>option.dataset.source&&option.value.length>5),'official adhkar include full text and source metadata');
assert.equal(new Set(officialOptions.map(option=>option.value)).size,officialOptions.length,'each morning/evening entry has a unique selection value even when its text is identical');
const kursiOptions=officialOptions.filter(option=>option.textContent==='آية الكرسي');
assert.equal(kursiOptions.length,2,'the same Quranic text is independently available in morning and evening');
const eveningKursiCard=officialApp.nodes.tasbihDhikrCards.children.flatMap(group=>group.children).find(card=>card.dataset.anwarOfficialId===kursiOptions[1].dataset.anwarOfficialId);
eveningKursiCard.click();
assert.equal(officialApp.nodes.tasbihDhikr.value,kursiOptions[1].value,'selecting the evening card selects its own entry, not the morning duplicate');
assert.equal(officialApp.nodes.tasbihPhrase.textContent,kursiOptions[1].dataset.dhikrText,'the selected card exposes the full text to the counter and voice matcher');

const officialCard=officialApp.nodes.tasbihDhikrCards.children.flatMap(group=>group.children).find(card=>card.className==='tasbih-dhikr-card'&&card.children.some(child=>child.className==='tasbih-dhikr-card-meta'));
assert.ok(officialCard,'official adhkar render as designed cards with details');
assert.ok(officialCard.children.some(child=>child.className==='tasbih-dhikr-card-text'),'official cards display the full dhikr text');
const longOfficial=officialOptions.find(option=>option.dataset.dhikrText.length>200);
assert.ok(longOfficial,'a long official dhikr is present for persistence-boundary testing');
officialApp.nodes.tasbihDhikr.value=longOfficial.value;
officialApp.nodes.tasbihRemoveDhikr.click();
assert.ok(officialApp.state.tasbih.removedOfficialDhikrs.includes(longOfficial.dataset.anwarOfficialId),'removing an official dhikr stores its stable identifier');
const restoredRemoved=buildApp({initialRemoved:officialApp.state.tasbih.removedOfficialDhikrs});
assert.ok(restoredRemoved.state.tasbih.removedOfficialDhikrs.includes(longOfficial.dataset.anwarOfficialId),'reload receives the stored official ID');
assert.ok(restoredRemoved.nodes.tasbihDhikr.options.some(option=>option.dataset.anwarOfficialId===longOfficial.dataset.anwarOfficialId),'the test fixture recreates the same official ID');
assert.ok(!restoredRemoved.nodes.tasbihDhikrCards.children.flatMap(group=>group.children).some(card=>card.dataset.anwarOfficialId===longOfficial.dataset.anwarOfficialId),'a removed official dhikr stays out of the visible cards after reload');
restoredRemoved.nodes.tasbihRestoreOfficial.click();
assert.ok(restoredRemoved.nodes.tasbihDhikrCards.children.flatMap(group=>group.children).some(card=>card.dataset.anwarOfficialId===longOfficial.dataset.anwarOfficialId),'the official dhikr returns to the visible cards after restoration');

const app=buildApp();
assert.equal(app.sandbox.__ANWAR_TASBIH_CONTROLLER_READY__,true,'the controller initializes when the required UI is present');
assert.equal(app.sandbox.AnwarTasbihController.open(),true,'the public tasbih controller opens the panel');
assert.equal(app.nodes.tasbihPanel.hidden,false,'the tasbih panel becomes visible when opened');
assert.equal(app.nodes.adhkarTasbihToggle.getAttribute('aria-expanded'),'true','opening the tasbih updates the launch icon state');
assert.equal(app.sandbox.AnwarTasbihController.close(),true,'the public tasbih controller closes the panel');
assert.equal(app.nodes.tasbihPanel.hidden,true,'the tasbih panel hides when closed');
assert.match(appCore,/else if\(id==='adhkarTasbihToggle'\)toggleTasbihFromToolbar\(t\)/,'the visible tasbih toolbar icon is delegated to the controller');
assert.equal(app.nodes.tasbihPanel.dataset.tasbihTheme,'emerald','the classic emerald theme is the safe default');
app.nodes.tasbihThemeToggle.click();
assert.equal(app.nodes.tasbihThemePicker.hidden,false,'the appearance selector opens from its palette button');
assert.equal(app.nodes.tasbihThemeToggle.getAttribute('aria-expanded'),'true','the palette button exposes its expanded state');
app.nodes.tasbihThemePink.click();
assert.equal(app.nodes.tasbihPanel.dataset.tasbihTheme,'pink','selecting the tulip theme updates the panel appearance');
assert.equal(app.state.tasbih.theme,'pink','the selected appearance is persisted with private preferences');
assert.equal(app.nodes.tasbihThemePink.getAttribute('aria-pressed'),'true','the chosen theme is marked as selected');
assert.equal(app.nodes.tasbihThemePicker.hidden,true,'the appearance selector closes after choosing a theme');
assert.equal(app.nodes.tasbihThemeToggle.getAttribute('aria-expanded'),'false','the palette button returns to its collapsed state');
app.nodes.tasbihReset.click();
assert.equal(app.state.tasbih.theme,'pink','ordinary counter actions preserve the selected appearance');
const restoredTheme=buildApp({initialTheme:'pink'});
assert.equal(restoredTheme.nodes.tasbihPanel.dataset.tasbihTheme,'pink','the chosen appearance is restored on the next visit');
const invalidTheme=buildApp({initialTheme:'unknown'});
assert.equal(invalidTheme.nodes.tasbihPanel.dataset.tasbihTheme,'emerald','unknown saved appearance values safely fall back to the default');

// Manual counter: increment, decrement with a zero floor, reset, and persistence.
app.nodes.tasbihTap.click();
assert.equal(count(app),1,'the tap button increments the counter');
assert.notEqual(app.nodes.tasbihCount.textContent,'0','the visible counter refreshes after a tap');
assert.equal(app.state.tasbih.count,1,'the counter is written to private preferences');
app.nodes.tasbihMinus.click();
assert.equal(count(app),0,'the minus button decrements the counter');
app.nodes.tasbihMinus.click();
assert.equal(count(app),0,'the counter never becomes negative');
app.nodes.tasbihTap.click();
app.nodes.tasbihTap.click();
app.nodes.tasbihReset.click();
assert.equal(count(app),0,'the reset button clears the counter');
assert.equal(app.state.tasbih.count,0,'reset is persisted');

// Large but valid saved values are capped rather than overflowing.
const capped=buildApp({initialCount:999999999});
capped.nodes.tasbihTap.click();
assert.equal(count(capped),1000000000,'the counter accepts its documented upper bound');
capped.nodes.tasbihTap.click();
assert.equal(count(capped),1000000000,'the counter cannot exceed its documented upper bound');

// Add, normalize, select, persist, deduplicate and delete a custom dhikr.
app.nodes.tasbihCustomDhikrInput.value='  ذكر   تجريبي  ';
app.nodes.tasbihAddCustomDhikr.click();
assert.equal(app.nodes.tasbihDhikr.value,'ذكر تجريبي','adding a custom dhikr selects the normalized text');
assert.deepEqual(app.state.tasbih.customDhikrs,['ذكر تجريبي'],'the custom dhikr is persisted');
assert.ok(app.nodes.tasbihDhikr.options.some(option=>option.value==='ذكر تجريبي'),'the custom dhikr appears in the selector');
app.nodes.tasbihCustomDhikrInput.value='ذكر تجريبي';
app.nodes.tasbihAddCustomDhikr.click();
assert.equal(app.state.tasbih.customDhikrs.length,1,'adding a duplicate does not duplicate the custom list');
app.nodes.tasbihRemoveDhikr.click();
assert.equal(app.state.tasbih.customDhikrs.length,0,'the selected custom dhikr can be deleted');
assert.ok(!app.nodes.tasbihDhikr.options.some(option=>option.value==='ذكر تجريبي'),'deleting a custom dhikr removes its option');

// Official dhikrs can be hidden for this device and restored without modifying the source list.
app.nodes.tasbihDhikr.value='سبحان الله';
app.nodes.tasbihDhikr.dispatch('change');
app.nodes.tasbihRemoveDhikr.click();
assert.ok(app.state.tasbih.removedOfficialDhikrs.includes('سبحان الله'),'removing an official dhikr stores a per-device exclusion');
assert.equal(app.nodes.tasbihRestoreOfficial.hidden,false,'the restore action appears after an official dhikr is removed');
app.nodes.tasbihRestoreOfficial.click();
assert.deepEqual(app.state.tasbih.removedOfficialDhikrs,[],'restoring clears the official-dhikr exclusions');
assert.ok(app.nodes.tasbihDhikr.options.some(option=>option.value==='سبحان الله'),'the official dhikr is available again');

// Arabic speech recognition displays interim text, combines split final results,
// checks alternatives and counts each completed selected phrase only once.
const recognition=app.recognitions[0];
assert.equal(recognition.lang,'ar-MA','speech recognition prefers the visitor’s Moroccan Arabic locale');
app.nodes.tasbihDhikr.value='سبحان الله';
app.nodes.tasbihDhikr.dispatch('change');
app.nodes.tasbihVoice.click();
assert.equal(recognition.started,1,'the recording button starts the speech recognition service');
recognition.onstart();
const interim={0:{transcript:'سُبْحَانَ الله'},length:1,isFinal:false};
recognition.onresult({resultIndex:0,results:[interim]});
assert.equal(app.nodes.tasbihVoiceTranscript.textContent,'سُبْحَانَ الله','interim recognized words are shown immediately in the transcript');
assert.equal(count(app),0,'interim speech is displayed but not counted before recognition is final');
const spoken={0:{transcript:'سُبْحَانَ الله، سبحان الله'},length:1,isFinal:true};
recognition.onresult({resultIndex:0,results:[spoken]});
assert.equal(count(app),2,'a final Arabic transcript counts each complete, normalized phrase');
recognition.onresult({resultIndex:0,results:[spoken]});
assert.equal(count(app),2,'repeated final events do not count the same words twice');
const punctuated={0:{transcript:'سبحان الله؛'},length:1,isFinal:true};
recognition.onresult({resultIndex:1,results:[spoken,punctuated]});
assert.equal(count(app),3,'Arabic punctuation and cumulative final results do not prevent a correct match');

const alternativeApp=buildApp();
alternativeApp.nodes.tasbihDhikr.value='أستغفر الله';
alternativeApp.nodes.tasbihDhikr.dispatch('change');
alternativeApp.nodes.tasbihVoice.click();
const alternativeRecognition=alternativeApp.recognitions[0];
alternativeRecognition.onstart();
const alternatives={0:{transcript:'استغفر بالله'},1:{transcript:'أستغفر الله'},length:2,isFinal:true};
alternativeRecognition.onresult({resultIndex:0,results:[alternatives]});
assert.equal(alternativeApp.nodes.tasbihVoiceTranscript.textContent,'أستغفر الله','the recognized transcript uses the alternative that best matches the selected dhikr');
assert.equal(count(alternativeApp),1,'the matching second Arabic recognition alternative increments the counter');

const splitApp=buildApp();
splitApp.nodes.tasbihDhikr.value='أستغفر الله العظيم وأتوب إليه';
splitApp.nodes.tasbihDhikr.dispatch('change');
splitApp.nodes.tasbihVoice.click();
const splitRecognition=splitApp.recognitions[0];
splitRecognition.onstart();
const firstPart={0:{transcript:'أستغفر الله العظيم'},length:1,isFinal:true};
splitRecognition.onresult({resultIndex:0,results:[firstPart]});
assert.equal(count(splitApp),0,'a partial final segment is not counted as a complete long dhikr');
const secondPart={0:{transcript:'وأتوب إليه'},length:1,isFinal:true};
splitRecognition.onresult({resultIndex:1,results:[firstPart,secondPart]});
assert.equal(count(splitApp),1,'the controller joins multiple final segments before matching a complete dhikr');
assert.equal(splitApp.nodes.tasbihVoiceTranscript.textContent,'أستغفر الله العظيم وأتوب إليه','the complete spoken phrase is retained visibly');

// A broken speech-recognition constructor must not disable the manual tasbih.
const brokenVoice=buildApp({throwRecognition:true});
assert.equal(brokenVoice.nodes.tasbihVoice.disabled,true,'a constructor failure disables only the unavailable voice control');
brokenVoice.nodes.tasbihTap.click();
assert.equal(count(brokenVoice),1,'the manual counter still works when voice recognition cannot initialize');

const unsupportedVoice=buildApp({noRecognition:true});
assert.equal(unsupportedVoice.nodes.tasbihVoice.disabled,true,'unsupported browsers get a clear disabled voice control');

console.log('Tasbih behavior tests passed: official morning/evening texts, repetition/source metadata, long official hide/restore persistence, themes, counter, custom dhikr management, speech matching and microphone fallback.');
