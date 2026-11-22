import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const read=path=>fs.readFileSync(new URL(path,root),'utf8');
const html=read('index.html');
const css=read('floating-panels.css');
const controller=read('floating-panels.js');
const worker=read('service-worker.js');

// Pure geometry tests run without a browser DOM.
const sandbox={window:{document:null}};
vm.runInNewContext(controller,sandbox,{filename:'floating-panels.js',timeout:2000});
const math=sandbox.window.AnwarFloatingPanelMath;
assert.ok(math,'the controller exposes its isolated geometry helpers');
const normal=math.clampRect(
 {left:100,top:130,width:300,height:260},
 {left:20,top:10,width:390,height:760}
);
assert.deepEqual(JSON.parse(JSON.stringify(normal)),{
 left:100,top:130,width:300,height:260
},'normal panel geometry remains unchanged when it already fits');

const clipped=math.clampRect(
 {left:-900,top:9000,width:900,height:1200},
 {left:20,top:10,width:390,height:760}
);
assert.ok(clipped.left>=28&&clipped.top>=18,'panels are clamped to viewport top and left edges');
assert.ok(clipped.left+clipped.width<=402,'panels cannot pass the right viewport edge');
assert.ok(clipped.top+clipped.height<=762,'panels cannot pass the bottom viewport edge');
assert.ok(clipped.width<=374&&clipped.height<=744,'oversized panels are reduced to available space');

const narrow=math.clampRect(
 {left:-50,top:-70,width:1000,height:1000},
 {left:5,top:7,width:170,height:110}
);
assert.equal(narrow.left,13,'very narrow viewport still keeps the panel inside the left edge');
assert.equal(narrow.top,15,'very short viewport still keeps the panel inside the top edge');
assert.equal(narrow.width,154,'minimum panel width adapts to a narrow viewport');
assert.equal(narrow.height,94,'minimum panel height adapts to a short viewport');

const workspace=math.intersectViewport(
 {left:20,top:100,right:380,bottom:700},
 {left:0,top:0,width:400,height:800}
);
assert.deepEqual(JSON.parse(JSON.stringify(workspace)),{left:20,top:100,width:360,height:600},
 'workspace bounds are intersected with the visible screen');
const partiallyOffscreen=math.intersectViewport(
 {left:-30,top:70,right:430,bottom:900},
 {left:0,top:0,width:400,height:800}
);
assert.deepEqual(JSON.parse(JSON.stringify(partiallyOffscreen)),{left:0,top:70,width:400,height:730},
 'workspace edges outside the visible screen are clipped before panel placement');
const tooSmall=math.intersectViewport(
 {left:5,top:5,right:80,bottom:90},
 {left:0,top:0,width:400,height:800}
);
assert.deepEqual(JSON.parse(JSON.stringify(tooSmall)),{left:0,top:0,width:400,height:800},
 'tiny editor geometry safely falls back to the visible screen');
const saved=math.normalizeSavedLayout({x:-100000,y:100000,width:9000,height:4});
assert.deepEqual(JSON.parse(JSON.stringify(saved)),{
 x:-10000,y:10000,width:1200,height:150
},'stored geometry is range-limited before use');
assert.equal(math.normalizeSavedLayout(null),null);
assert.equal(math.normalizeSavedLayout([]),null);
assert.deepEqual(JSON.parse(JSON.stringify(math.normalizeSavedLayout({x:1,y:2,width:3,height:4}))),{
 x:1,y:2,width:220,height:150
},'saved sizes below the safe minimum are normalized before display');

assert.ok((html.match(/class="rib-menu"/g)||[]).length>=5,'all toolbar menus are available to the shared floating-panel controller');
assert.ok(html.includes('<link rel="stylesheet" href="./floating-panels.css?v=20261121-3">'),'floating panel styles are loaded from a same-origin stylesheet');
assert.ok(html.includes('<script src="./floating-panels.js?v=20261121-3" defer></script>'),'floating panel logic is loaded as a deferred same-origin script');
assert.ok(worker.includes("'./floating-panels.js'")&&worker.includes("'./floating-panels.css'"),
 'the offline service-worker shell precaches both floating-panel assets');
const offlineCacheVersion=worker.match(/const CACHE_NAME='anwar-shell-\d{4}-\d{2}-\d{2}-v(\d+)';/);
assert.ok(offlineCacheVersion&&Number(offlineCacheVersion[1])>=143,
 'the offline cache version is refreshed for this release');

for(const event of ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture','setPointerCapture']){
 assert.ok(controller.includes(event),'drag and resize handle '+event+' safely');
}
for(const feature of [
 'float-panel-drag','float-panel-resize','fp-minimize','fp-maximize','fp-reset','fp-close',
 'is-minimized','is-maximized','visualViewport','localStorage',
 'aria-keyshortcuts','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'
]){
 assert.ok(controller.includes(feature),'floating panel feature exists: '+feature);
}
assert.ok(controller.includes("id='anwar-floating-panels-layer'")&&controller.includes('getFloatingLayer().append(panel)')&&controller.includes('menu.append(panel)'),
 'panels are portalled outside the ribbon while retaining their original details menu lifecycle');
assert.ok(controller.includes('intersectViewport')&&controller.includes('visualViewport'),
 'panel movement is bounded by the intersection of the editor workspace and visible mobile viewport');
assert.ok(css.includes('#anwar-floating-panels-layer#anwar-floating-panels-layer')&&css.includes('pointer-events:none!important'),
 'the external floating layer avoids ribbon clipping without blocking the editor');
assert.ok(controller.includes('menus.forEach(other=>{if(other!==menu&&other.open)other.open=false})'),
 'only one toolbar panel is open at a time');
assert.ok(controller.includes('root.addEventListener(\'resize\',keepActiveInsideViewport)'),
 'active panels are clamped after viewport resizing');
assert.ok(controller.includes("const STORAGE_KEY='anwar_floating_panels_v1'"),
 'panel preferences use a dedicated storage key');
assert.ok(controller.includes('raw.length>4096'),
 'stored preferences are size-bounded before parsing');
assert.ok(controller.includes('function panelKey(menu,index)')&&controller.includes('parsed[String(key)]'),
 'saved panel geometry uses stable tool identifiers, not menu order');

assert.ok(css.includes('>.rib-pop.is-floating-panel[hidden]{display:none!important}'),
 'closed book content cannot leak out because of the floating display rules');
for(const feature of ['float-panel-head','float-panel-content','float-panel-resize','.is-minimized','.is-maximized']){
 assert.ok(css.includes(feature),'floating panel style exists: '+feature);
}
assert.ok(css.includes('touch-action:none'),'drag and resize affordances use deliberate touch gesture handling');
assert.ok(css.includes('prefers-reduced-motion'),'reduced-motion users are supported');

assert.ok(!controller.includes('innerHTML')&&!controller.includes('insertAdjacentHTML'),
 'floating panel controls are built with safe DOM APIs, not HTML string injection');
assert.ok(!controller.includes('eval(')&&!controller.includes('new Function('),
 'the floating panel controller does not evaluate dynamic code');

console.log('Floating panel tests passed: viewport geometry, safe persisted layout, single active panel, touch drag, resize, minimize/maximize/reset, keyboard access, hidden-state safety and offline assets.');
