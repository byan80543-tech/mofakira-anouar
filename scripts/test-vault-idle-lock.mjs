import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
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
assert.equal(h.timerCount,1,'opening activity arms the inactivity timer');
h.advance(4*60*1000);
h.api.recordVaultActivity({isTrusted:true});
h.advance(5*60*1000-1);
assert.equal(h.lockCalls,0,'recent trusted activity postpones automatic lock');
h.advance(1);
assert.equal(h.lockCalls,1,'vault locks after five minutes without activity');

h=makeHarness();
h.api.recordVaultActivity();
h.advance(5*60*1000-1);
h.api.recordVaultActivity({isTrusted:false});
h.advance(1);
assert.equal(h.lockCalls,1,'synthetic events cannot keep the vault unlocked');

h=makeHarness();
h.api.recordVaultActivity();
h.advance(6*60*1000);
h.api.enforceVaultIdleLock();
assert.equal(h.lockCalls,1,'returning from a throttled background tab enforces overdue auto-lock');

h=makeHarness();
h.sandbox.vaultUnlocked=false;
h.api.recordVaultActivity();
assert.equal(h.timerCount,0,'locked vault does not arm an inactivity timer');

console.log('All encrypted-vault inactivity lock tests passed.');
