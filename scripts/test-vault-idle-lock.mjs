import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html=fs.readFileSync(new URL('../app-core.js',import.meta.url),'utf8');
const readme=fs.readFileSync(new URL('../README.md',import.meta.url),'utf8');
assert.ok(readme.includes('القفل اليدوي هو المعتمد حالياً') && !readme.includes('التلقائي بعد خمس دقائق'),
  'project documentation must describe the current manual-only vault lock policy');
const start=html.indexOf('const VAULT_IDLE_LOCK_MS=0;');
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
h.advance(30*60*1000);
h.api.enforceVaultIdleLock();
assert.equal(h.lockCalls,0,'free-use mode never locks automatically after inactivity');
assert.equal(h.timerCount,0,'free-use mode does not create background inactivity timers');

h=makeHarness();
h.api.recordVaultActivity({isTrusted:false});
h.advance(60*60*1000);
h.api.enforceVaultIdleLock();
assert.equal(h.lockCalls,0,'synthetic activity and long idle periods do not trigger an automatic lock in free mode');

h=makeHarness();
h.sandbox.vaultUnlocked=false;
h.api.recordVaultActivity();
assert.equal(h.timerCount,0,'locked vault does not arm an inactivity timer');

console.log('All manual-lock-only free-mode inactivity tests passed.');
