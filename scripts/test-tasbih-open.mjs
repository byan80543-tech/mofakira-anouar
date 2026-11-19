import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../app-core.js',import.meta.url),'utf8');
const tasbihStart=source.indexOf("const $=id=>document.getElementById(id),panel=$('tasbihPanel')");
assert.notEqual(tasbihStart,-1,'tasbih controller exists');

const openStart=source.indexOf(' function openPanel(){',tasbihStart);
const openEnd=source.indexOf("\n toggleButton.addEventListener('click',openPanel);",openStart);
assert.ok(openStart>tasbihStart&&openEnd>openStart,'tasbih open handler can be extracted');
const openFunction=source.slice(openStart,openEnd).trim();

const calls=[];
const adhkarPanel={hidden:true};
const panel={hidden:true,scrollIntoView(options){calls.push(['scroll',options])}};
const toggleButton={attributes:{},setAttribute(name,value){this.attributes[name]=String(value)}};
const closeButton={focused:false,focus(){this.focused=true}};
const ownerDialog={open:false,showModal(){this.open=true;calls.push(['showModal'])}};
const nodes={adhkarPanel};
let closeCalls=0;
const sandbox={
 panel,toggleButton,closeButton,ownerDialog,
 $:id=>nodes[id]||null,
 showOwnerPanel(which){calls.push(['showOwnerPanel',which]);adhkarPanel.hidden=which!=='adhkar'},
 closePanel(){closeCalls++;panel.hidden=true;toggleButton.setAttribute('aria-expanded','false')},
 requestAnimationFrame(callback){callback()},
 console:{error(){}},
 toast(message){calls.push(['toast',message])}
};

vm.runInNewContext(openFunction+'\nopenPanel();',sandbox,{timeout:2000});
assert.equal(ownerDialog.open,true,'the parent dialog opens');
assert.deepEqual(calls.filter(item=>item[0]==='showOwnerPanel'),[['showOwnerPanel','adhkar']],'the adhkar tab is activated directly, without a synthetic click');
assert.equal(adhkarPanel.hidden,false,'the adhkar panel is visible');
assert.equal(panel.hidden,false,'the tasbih panel is visible');
assert.equal(toggleButton.attributes['aria-expanded'],'true','the launch icon reports expanded state');
assert.equal(closeButton.focused,true,'focus moves into the opened tasbih panel');
assert.ok(calls.some(item=>item[0]==='scroll'),'the opened panel is brought into view');

vm.runInNewContext(openFunction+'\nopenPanel();',sandbox,{timeout:2000});
assert.equal(closeCalls,1,'pressing the icon again closes an already open panel');
console.log('Tasbih launch tests passed: parent dialog, direct adhkar-tab activation, panel visibility, focus, and close toggle.');
