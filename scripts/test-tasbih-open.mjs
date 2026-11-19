import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root=new URL('../',import.meta.url);
const html=fs.readFileSync(new URL('index.html',root),'utf8');
const appCore=fs.readFileSync(new URL('app-core.js',root),'utf8');
const controller=fs.readFileSync(new URL('tasbih-controller.js',root),'utf8');

function classList(){
 const values=new Set();
 return {
  toggle(name,force){if(force)values.add(name);else values.delete(name)},
  contains(name){return values.has(name)}
 };
}
const dialogStart=html.indexOf('<dialog id="ownerDialog">');
const outerStart=html.indexOf('<div class="owner-tabs">',dialogStart);
const ownerPanelStart=html.indexOf('<section id="ownerPanel"',outerStart);
const adhkarPanelStart=html.indexOf('<section id="adhkarPanel"',ownerPanelStart);
const innerStart=html.indexOf('<div class="owner-tabs adhkar-tabs"',adhkarPanelStart);
const tasbihStart=html.indexOf('<section id="tasbihPanel"',innerStart);
assert.ok(dialogStart>=0&&outerStart>dialogStart&&ownerPanelStart>outerStart&&adhkarPanelStart>ownerPanelStart&&innerStart>adhkarPanelStart&&tasbihStart>innerStart,'dialog contains the expected owner and adhkar sections');
const outerTabs=html.slice(outerStart,ownerPanelStart);
const innerTabs=html.slice(innerStart,tasbihStart);
assert.ok(outerTabs.includes('id="ownerTab"')&&outerTabs.includes('id="adhkarTab"')&&outerTabs.includes('id="shareTab"'),'top navigation exposes owner, adhkar and share tabs');
assert.ok(innerTabs.includes('id="morningTab"')&&innerTabs.includes('id="eveningTab"')&&innerTabs.includes('id="adhkarTasbihToggle"'),'morning, evening and tasbih controls are visible together in the adhkar view');
assert.ok(!innerTabs.includes('id="adhkarTab"')&&!outerTabs.includes('id="adhkarTasbihToggle"'),'adhkar tab is not buried inside the hidden adhkar panel');
for(const id of ['adhkarTab','adhkarTasbihToggle','morningTab','eveningTab','tasbihPanel']){
 assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id+' remains unique');
}
assert.ok(appCore.includes("morning:[")&&appCore.includes("evening:["),'official morning and evening adhkar data remain in the notebook');
assert.ok(appCore.includes("window.AnwarRenderAdhkar=function(period)"),'notebook exposes a small public renderer bridge');
assert.ok(!appCore.includes("const $=id=>document.getElementById(id),panel=$('tasbihPanel')"),'old tasbih controller was removed from the delayed notebook initializer');
assert.ok(/<script src="\.\/tasbih-controller\.js\?v=\d{8}-\d+" defer><\/script>/.test(html),'the new independent controller is loaded by the page with a versioned URL');
assert.ok(fs.readFileSync(new URL('service-worker.js',root),'utf8').includes("'./tasbih-controller.js'"),'the independent controller is included in the offline shell');

function extractBetween(startText,endText){
 const start=controller.indexOf(startText);
 const end=controller.indexOf(endText,start);
 assert.ok(start>=0&&end>start,'controller function exists: '+startText);
 return controller.slice(start,end).trim();
}
const switchFn=extractBetween('  function switchOwnerView(which){','  function revealAdhkarView(){');
const revealFn=extractBetween('  function revealAdhkarView(){','  function openPanel(){');
const openFn=extractBetween('  function openPanel(){','  function closePanel(');

function buildSandbox(bridge){
 const calls=[];
 const panel={hidden:true,scrollIntoView(options){calls.push(['scroll',options])}};
 const ownerDialog={open:false,showModal(){this.open=true;calls.push(['showModal'])}};
 const nodes={
  ownerPanel:{hidden:false},
  adhkarPanel:{hidden:true},
  sharePanel:{hidden:false},
  ownerTab:{classList:classList()},
  adhkarTab:{classList:classList()},
  shareTab:{classList:classList()}
 };
 const toggleButton={attributes:{},setAttribute(name,value){this.attributes[name]=String(value)}};
 const sandbox={
  panel,ownerDialog,nodes,toggleButton,
  ownerPanel:nodes.ownerPanel,adhkarPanel:nodes.adhkarPanel,sharePanel:nodes.sharePanel,
  ownerTab:nodes.ownerTab,adhkarTab:nodes.adhkarTab,shareTab:nodes.shareTab,
  closeButton:{focus(){calls.push(['focus'])}},
  closePanel(){calls.push(['close'])},
  window:bridge||{},
  $:id=>nodes[id]||null,
  requestAnimationFrame(fn){fn()},
  console:{warn(){},error(){}},
  calls
 };
 return sandbox;
}
const bridgeSandbox=buildSandbox({
 AnwarShowOwnerPanel(which){
  bridgeSandbox.nodes.ownerPanel.hidden=which!=='owner';
  bridgeSandbox.nodes.adhkarPanel.hidden=which!=='adhkar';
  bridgeSandbox.nodes.sharePanel.hidden=which!=='share';
  return true;
 }
});
vm.runInNewContext(switchFn+'\n'+revealFn+'\n'+openFn+'\nopenPanel();',bridgeSandbox,{timeout:2000});
assert.equal(bridgeSandbox.ownerDialog.open,true,'launcher opens the parent dialog');
assert.equal(bridgeSandbox.nodes.adhkarPanel.hidden,false,'launcher selects the adhkar view');
assert.equal(bridgeSandbox.panel.hidden,false,'launcher visibly opens the tasbih panel');
assert.equal(bridgeSandbox.toggleButton.attributes['aria-expanded'],'true','launcher exposes its expanded state');
assert.ok(openFn.includes('panel.scrollIntoView'),'open handler scrolls the panel into view');
assert.ok(openFn.includes('closeButton.focus()'),'open handler moves focus to the close control');

const fallbackSandbox=buildSandbox({AnwarRenderAdhkar(period){fallbackSandbox.calls.push(['render',period]);return true}});
vm.runInNewContext(switchFn+'\n'+revealFn+'\n'+openFn+'\nopenPanel();',fallbackSandbox,{timeout:2000});
assert.equal(fallbackSandbox.nodes.adhkarPanel.hidden,false,'fallback opens the adhkar view when the old bridge is absent');
assert.equal(fallbackSandbox.nodes.ownerPanel.hidden,true,'fallback hides the owner view');
assert.ok(fallbackSandbox.calls.some(item=>item[0]==='render'&&item[1]==='morning'),'fallback restores the morning list');
assert.equal(fallbackSandbox.panel.hidden,false,'fallback still opens the tasbih panel');

assert.ok(controller.includes("toggleButton.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();openPanel()})"),'tasbih launcher has its own direct click listener');
assert.ok(controller.includes("morningTab.addEventListener('click'")&&controller.includes("eveningTab.addEventListener('click'"),'morning and evening tab actions are bound');
assert.ok(controller.includes("tap.addEventListener('click',()=>add(1))")&&controller.includes("minus.addEventListener('click',()=>add(-1))")&&controller.includes("reset.addEventListener('click'"),'counter increment, decrement and reset remain wired');
assert.ok(controller.includes("preferences.set('tasbih'")&&controller.includes("preferences.subscribe(saved=>"),'counter and dhikr preferences use the encrypted preference adapter');
assert.ok(controller.includes("removeButton.addEventListener('click'")&&controller.includes("restoreButton.addEventListener('click'")&&controller.includes("customAdd.addEventListener('click'"),'custom dhikr management remains wired');
assert.ok(controller.includes("recognition.lang='ar-SA'")&&controller.includes('countPhraseMatches(said,select.value)'),'Arabic speech recognition counts the selected phrase only');

console.log('Tasbih rebuild tests passed: independent launch, fallback recovery, restored morning/evening navigation, counter, encrypted preferences, custom dhikr and voice recognition.');
