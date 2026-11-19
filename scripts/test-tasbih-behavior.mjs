import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const controller=fs.readFileSync(new URL('../tasbih-controller.js',import.meta.url),'utf8');

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
 get options(){return this.tagName==='OPTGROUP'?this.children:undefined}
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
 let state={tasbih:{count:options.initialCount??0,dhikr:nodes.tasbihDhikr.value,customDhikrs:[],removedOfficialDhikrs:[],theme:options.initialTheme??'emerald'}};
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

const app=buildApp();
assert.equal(app.sandbox.__ANWAR_TASBIH_CONTROLLER_READY__,true,'the controller initializes when the required UI is present');
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

// Arabic speech recognition counts only complete, normalized matches and ignores duplicate finals.
const recognition=app.recognitions[0];
app.nodes.tasbihDhikr.value='سبحان الله';
app.nodes.tasbihDhikr.dispatch('change');
app.nodes.tasbihVoice.click();
recognition.onstart();
const spoken={0:{transcript:'سُبْحَانَ الله، سبحان الله'},length:1,isFinal:true};
recognition.onresult({resultIndex:0,results:[spoken]});
assert.equal(count(app),2,'a final Arabic transcript counts each complete matching phrase');
recognition.onresult({resultIndex:0,results:[spoken]});
assert.equal(count(app),2,'a repeated final event at the same result index is counted only once');
const punctuated={0:{transcript:'سبحان الله؛'},length:1,isFinal:true};
recognition.onresult({resultIndex:1,results:[spoken,punctuated]});
assert.equal(count(app),3,'Arabic semicolon punctuation does not prevent a correct phrase from matching');

// A final result arriving after stop must not increment the counter.
app.nodes.tasbihVoice.click();
assert.ok(recognition.stopped>0,'the stop control asks the recognition service to stop');
app.nodes.tasbihVoice.click();
recognition.onstart();
const late={0:{transcript:'سبحان الله'},length:1,isFinal:true};
app.nodes.tasbihVoice.click();
recognition.onresult({resultIndex:0,results:[late]});
assert.equal(count(app),3,'a late final transcript after stop is ignored');

// Changing the selected dhikr stops the old recording before a late result can be attributed to the new phrase.
app.nodes.tasbihVoice.click();
recognition.onstart();
app.nodes.tasbihDhikr.value='الحمد لله';
app.nodes.tasbihDhikr.dispatch('change');
recognition.onresult({resultIndex:0,results:[late]});
assert.equal(count(app),0,'switching dhikr resets the count and does not accept speech from the prior selection');
assert.ok(recognition.stopped>=2,'changing dhikr stops the active microphone session');

// A broken speech-recognition constructor must not disable the manual tasbih.
const brokenVoice=buildApp({throwRecognition:true});
assert.equal(brokenVoice.nodes.tasbihVoice.disabled,true,'a constructor failure disables only the unavailable voice control');
brokenVoice.nodes.tasbihTap.click();
assert.equal(count(brokenVoice),1,'the manual counter still works when voice recognition cannot initialize');

const unsupportedVoice=buildApp({noRecognition:true});
assert.equal(unsupportedVoice.nodes.tasbihVoice.disabled,true,'unsupported browsers get a clear disabled voice control');

console.log('Tasbih behavior tests passed: bounded counter, persistence, custom dhikr add/delete/deduplication, official restore, exact Arabic speech matching, duplicate/late result protection and graceful microphone initialization failure.');
