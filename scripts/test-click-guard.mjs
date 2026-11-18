import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const code=fs.readFileSync(new URL('../click-guard.js',import.meta.url),'utf8');
let now=0,handler=null,nextTimer=0;
const timers=new Map();
const insideTarget={inside:true};
const outsideTarget={inside:false};
const body={
 children:[],
 appendChild(node){this.children.push(node)},
 contains(target){return !!target&&target.inside===true}
};
const document={
 body,
 createElement(tag){
  return {
   tagName:tag.toUpperCase(),
   id:'',
   textContent:'',
   style:{},
   attributes:{},
   setAttribute(name,value){this.attributes[name]=String(value)},
   contains(){return false}
  };
 },
 addEventListener(type,callback,capture){
  assert.equal(type,'click');
  assert.equal(capture,true);
  handler=callback;
 }
};
const sandbox={
 document,
 performance:{now:()=>now},
 setTimeout(callback,delay){
  const id=++nextTimer;
  timers.set(id,{callback,delay});
  return id;
 },
 clearTimeout(id){timers.delete(id)},
 Date
};
vm.runInNewContext(code,sandbox,{timeout:2000});
assert.equal(typeof handler,'function','guard registers a capturing click listener');
const notice=body.children.find(node=>node.id==='anwar-click-guard-notice');
assert.ok(notice,'guard creates a single accessible warning notice');
assert.equal(notice.attributes.role,'alert','warning is announced to assistive technology');

function tap({trusted=true,detail=1,target=insideTarget}={}){
 const event={
  isTrusted:trusted,
  detail,
  target,
  defaultPrevented:false,
  stopped:false,
  preventDefault(){this.defaultPrevented=true},
  stopImmediatePropagation(){this.stopped=true}
 };
 handler(event);
 return event;
}

// Keyboard-generated and synthetic clicks must remain unaffected.
assert.equal(tap({trusted:false}).defaultPrevented,false,'script-generated clicks are not counted or blocked');
assert.equal(tap({detail:0}).defaultPrevented,false,'keyboard and assistive-technology activation is exempt');
assert.equal(tap({target:outsideTarget}).defaultPrevented,false,'events outside the page body are ignored');

// Ten pointer taps in the rolling window are allowed.
for(let i=0;i<10;i++){
 now=i*100;
 const event=tap();
 assert.equal(event.defaultPrevented,false,'tap '+(i+1)+' of 10 is allowed');
}

// The 11th tap is prevented and does not reach the page click handlers.
now=1000;
const eleventh=tap();
assert.equal(eleventh.defaultPrevented,true,'the 11th rapid tap is prevented');
assert.equal(eleventh.stopped,true,'the 11th rapid tap cannot reach delegated or button click handlers');
assert.equal(notice.style.opacity,'1','the anti-repeat warning becomes visible');

// Further repeated taps are suppressed for the complete cooldown.
now=2500;
assert.equal(tap().defaultPrevented,true,'repeated taps remain blocked during cooldown');
assert.equal(notice.style.opacity,'1','one warning remains visible rather than spawning repeated notices');

// Normal interaction resumes after the cooldown.
now=6000;
assert.equal(tap().defaultPrevented,false,'clicking resumes after the cooldown');
console.log('Click guard checks passed: burst limit, cooldown, keyboard exemption, and trusted-event handling.');
