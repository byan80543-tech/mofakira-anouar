import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html=fs.readFileSync(new URL('../app-core.js',import.meta.url),'utf8');
const readme=fs.readFileSync(new URL('../README.md',import.meta.url),'utf8');
assert.ok(readme.includes('يقفل المحتوى المشفر تلقائياً عند انتقال المفكرة إلى الخلفية أو مغادرتها'),
  'project documentation describes immediate background locking');
assert.ok(readme.includes('بعد خمس دقائق من عدم النشاط الموثوق'),
  'project documentation describes the five-minute idle-lock policy');
const start=html.indexOf('const VAULT_IDLE_LOCK_MS=5*60*1000;');
const end=html.indexOf('function showVaultGate(mode,message){',start);
assert.ok(start>=0&&end>start,'vault inactivity lock helpers are present');
const source=html.slice(start,end);

function makeHarness(){
  let now=0,nextId=0,lockCalls=0;
  const timers=new Map();
  const clock={get now(){return now}};
  class FakeDate extends Date{static now(){return now}}
  const sandbox={
    Date:FakeDate,
    setTimeout(callback,delay){
      const id=++nextId;timers.set(id,{callback,due:now+delay});return id;
    },
    clearTimeout(id){timers.delete(id)},
    vaultUnlocked:true,
    lockVault(){lockCalls++;sandbox.vaultUnlocked=false},
    console
  };
  vm.runInNewContext(source+'\nthis.api={recordVaultActivity,enforceVaultIdleLock,clearVaultIdleTimer};',sandbox,{timeout:3000});
  function advance(ms,runDue=true){
    now+=ms;
    if(!runDue)return;
    let ran=true;
    while(ran){
      ran=false;
      for(const [id,timer] of [...timers]){
        if(timer.due<=now){
          timers.delete(id);timer.callback();ran=true;
        }
      }
    }
  }
  return {api:sandbox.api,sandbox,advance,clock,get lockCalls(){return lockCalls},get timerCount(){return timers.size}};
}

let h=makeHarness();
h.api.recordVaultActivity();
assert.equal(h.timerCount,1,'trusted activity arms the five-minute inactivity timer');
h.advance(5*60*1000-1);
assert.equal(h.lockCalls,0,'vault stays open immediately before the inactivity threshold');
h.advance(1);
assert.equal(h.lockCalls,1,'vault locks after five minutes without activity');

h=makeHarness();
h.api.recordVaultActivity({isTrusted:false});
assert.equal(h.timerCount,0,'synthetic activity cannot extend an authenticated session');

h=makeHarness();
h.api.recordVaultActivity();
h.advance(4*60*1000);
h.api.recordVaultActivity();
h.advance(2*60*1000);
assert.equal(h.lockCalls,0,'new trusted activity resets the inactivity deadline');
h.advance(3*60*1000);
assert.equal(h.lockCalls,1,'the reset deadline eventually locks the vault');

h=makeHarness();
h.sandbox.vaultUnlocked=false;
h.api.recordVaultActivity();
assert.equal(h.timerCount,0,'locked vault does not arm an inactivity timer');

console.log('Five-minute inactivity locking and trusted-activity reset tests passed.');
