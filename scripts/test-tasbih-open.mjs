import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../app-core.js',import.meta.url),'utf8');

// The real owner-tab function is private to the deferred app initializer.
// Evaluate the exact source that exports the narrow bridge from that scope.
const ownerStart=source.indexOf('function showOwnerPanel(which)');
const ownerEnd=source.indexOf('\nasync function makeQR()',ownerStart);
assert.ok(ownerStart>=0&&ownerEnd>ownerStart,'owner panel controller exists');
const ownerBridgeSource=source.slice(ownerStart,ownerEnd);
assert.ok(ownerBridgeSource.includes('window.AnwarShowOwnerPanel=function(which){'),'owner panel controller exports the cross-IIFE bridge');

function classList(){
 const values=new Set();
 return {
  toggle(name,force){if(force)values.add(name);else values.delete(name)},
  contains(name){return values.has(name)}
 };
}
const nodes={
 ownerPanel:{hidden:false},
 adhkarPanel:{hidden:true},
 sharePanel:{hidden:false},
 ownerTab:{classList:classList()},
 adhkarTab:{classList:classList()},
 shareTab:{classList:classList()}
};
const renderCalls=[];
const windowObject={};
vm.runInNewContext(ownerBridgeSource,{
 window:windowObject,
 $:id=>nodes[id]||null,
 renderAdhkar:period=>renderCalls.push(period)
},{timeout:2000});

assert.equal(windowObject.AnwarShowOwnerPanel('adhkar'),true,'the bridge accepts the adhkar destination');
assert.equal(nodes.ownerPanel.hidden,true,'the owner tab is hidden');
assert.equal(nodes.adhkarPanel.hidden,false,'the adhkar panel is shown');
assert.equal(nodes.sharePanel.hidden,true,'the share panel is hidden');
assert.equal(nodes.adhkarTab.classList.contains('active'),true,'the adhkar tab is marked active');
assert.deepEqual(renderCalls,['morning'],'the existing adhkar renderer is invoked');
assert.equal(windowObject.AnwarShowOwnerPanel('unknown'),false,'unknown destinations are rejected');

// Extract the production open handler. Deliberately do NOT expose a global
// showOwnerPanel function: that was the exact false-positive in the old test.
const tasbihStart=source.indexOf("const $=id=>document.getElementById(id),panel=$('tasbihPanel')");
assert.notEqual(tasbihStart,-1,'tasbih controller exists');
const openStart=source.indexOf(' function openPanel(){',tasbihStart);
const openEnd=source.indexOf("\n toggleButton.addEventListener('click',openPanel);",openStart);
assert.ok(openStart>tasbihStart&&openEnd>openStart,'tasbih open handler can be extracted');
const openFunction=source.slice(openStart,openEnd).trim();
assert.ok(openFunction.includes("window.AnwarShowOwnerPanel('adhkar')"),'tasbih uses the explicit cross-IIFE bridge');
assert.equal(openFunction.replaceAll('window.AnwarShowOwnerPanel','').includes('showOwnerPanel('),false,'tasbih does not call the out-of-scope function directly');

const calls=[];
const panel={hidden:true,scrollIntoView(options){calls.push(['scroll',options])}};
const toggleButton={attributes:{},setAttribute(name,value){this.attributes[name]=String(value)}};
const closeButton={focused:false,focus(){this.focused=true}};
const ownerDialog={open:false,showModal(){this.open=true;calls.push(['showModal'])}};
let closeCalls=0;
const sandbox={
 panel,toggleButton,closeButton,ownerDialog,window:windowObject,
 $:id=>id==='adhkarPanel'?nodes.adhkarPanel:null,
 closePanel(){closeCalls++;panel.hidden=true;toggleButton.setAttribute('aria-expanded','false')},
 requestAnimationFrame(callback){callback()},
 console:{error(){}},
 toast(message){calls.push(['toast',message])}
};

vm.runInNewContext(openFunction+'\nopenPanel();',sandbox,{timeout:2000});
assert.equal(ownerDialog.open,true,'the parent dialog opens when necessary');
assert.equal(nodes.adhkarPanel.hidden,false,'the actual owner-panel bridge leaves adhkar visible');
assert.equal(panel.hidden,false,'the tasbih panel becomes visible');
assert.equal(toggleButton.attributes['aria-expanded'],'true','the launch icon reports expanded state');
assert.equal(closeButton.focused,true,'focus moves into the opened tasbih panel');
assert.ok(calls.some(item=>item[0]==='scroll'),'the opened panel is brought into view');

vm.runInNewContext(openFunction+'\nopenPanel();',sandbox,{timeout:2000});
assert.equal(closeCalls,1,'pressing the icon again closes an already open panel');

// Missing initialization must fail visibly and must not pretend the panel opened.
const missingBridgeCalls=[];
const missingSandbox={
 panel:{hidden:true,scrollIntoView(){}},
 toggleButton:{setAttribute(){}},
 closeButton:{focus(){}},
 ownerDialog:{open:true,showModal(){}},
 window:{},
 $:id=>id==='adhkarPanel'?{hidden:true}:null,
 closePanel(){},
 requestAnimationFrame(callback){callback()},
 console:{error(){}},
 toast(message){missingBridgeCalls.push(message)}
};
vm.runInNewContext(openFunction+'\nopenPanel();',missingSandbox,{timeout:2000});
assert.equal(missingSandbox.panel.hidden,true,'panel remains closed when initialization is missing');
assert.equal(missingBridgeCalls.length,1,'missing bridge produces a visible recovery message');

console.log('Tasbih launch tests passed: real scoped owner bridge, tab state, opening, focus, scrolling, toggle-close and missing-bridge failure path.');
