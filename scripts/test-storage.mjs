import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const between=(start,end)=>{
  const a=html.indexOf(start),b=html.indexOf(end,a);
  if(a<0||b<0)throw new Error('Missing source block: '+start);
  return html.slice(a,b);
};
const extracted=[
  between('function cleanNote(n){','function createNoteId(){'),
  between('function showStorageRecoveryNotice(','function exportStorageRecovery()'),
  between('function save(){','function toast(')
].join('\n');

function makeHarness(initial={}){
  const values=new Map(Object.entries(initial).map(([k,v])=>[k,String(v)]));
  const storage={
    failKey:null,
    getItem(key){return values.has(key)?values.get(key):null},
    setItem(key,value){
      if(this.failKey===key)throw new Error('simulated storage failure');
      values.set(key,String(value));
    },
    values
  };
  const elements={
    storageRecoveryNotice:{
      hidden:true,
      querySelector(selector){return selector==='strong'?this.heading:this.description},
      heading:{textContent:''},
      description:{textContent:''}
    },
    exportRecovery:{disabled:false},
    startFresh:{hidden:true}
  };
  const messages=[];
  const sandbox={
    console:{warn(){},error(){}},
    Date,Math,JSON,Set,Number,String,Array,Object,Error,
    TYPES:{poem:'قصيدة',text:'نص',idea:'فكرة'},
    FONTS:['Amiri','Tajawal'],
    hasOwn:(o,k)=>Object.prototype.hasOwnProperty.call(o,k),
    esc:s=>String(s??'').replace(/[&<>]/g,''),
    san:s=>String(s??''),
    safeFontName:v=>typeof v==='string'&&['Amiri','Tajawal'].includes(v)?v:'Amiri',
    localStorage:storage,
    S:{notes:[],theme:'',palette:'blue',wallColor:'mist',paperColor:'white',days:[]},
    cur:null,tm:null,pendingBefore:null,
    storageRecoveryBlocked:false,storageRecoveryRaw:null,storageRecoveryExported:false,
    $:id=>elements[id]||(elements[id]={hidden:false,disabled:false}),
    toast:m=>messages.push(String(m)),
    confirm:()=>true,
    openNote(){},theme(){},chips(){}
  };
  vm.runInNewContext(extracted+"\nthis.api={load,save,startFreshNotebook,snapshot:()=>({S,storageRecoveryBlocked,storageRecoveryRaw,storageRecoveryExported})};",sandbox,{timeout:3000});
  return {api:sandbox.api,storage,elements,messages};
}
const assert=(condition,message)=>{
  if(!condition)throw new Error('FAIL: '+message);
  console.log('PASS:',message);
};
const note=(id,title='اختبار',html='<div>نص تجريبي</div>')=>({
  id,title,type:'poem',html,pin:false,ts:1700000000000,font:'Amiri',size:20,history:[]
});
const state=(...notes)=>JSON.stringify({
  notes,theme:'',palette:'blue',wallColor:'mist',paperColor:'white',days:[]
});
let h;

h=makeHarness({'anwar_v1':state(note('n1'))});
h.api.load();
assert(h.api.snapshot().S.notes.length===1&&h.api.snapshot().S.notes[0].id==='n1','valid primary storage loads');

h=makeHarness({'anwar_v1':'{broken-json','anwar_v1_backup_v2':state(note('backup'))});
h.api.load();
assert(h.api.snapshot().S.notes[0]?.id==='backup','corrupt primary falls back to backup');
assert(JSON.parse(h.storage.getItem('anwar_v1')).notes[0].id==='backup','restored backup repairs the primary key');

h=makeHarness({'anwar_v1_backup_v2':state(note('orphan-backup'))});
h.api.load();
assert(h.api.snapshot().S.notes[0]?.id==='orphan-backup','missing primary key restores backup');

h=makeHarness({'anwar_v1':JSON.stringify({notes:[null,'bad',false]}),'anwar_v1_backup_v2':state(note('clean-backup'))});
h.api.load();
assert(h.api.snapshot().S.notes[0]?.id==='clean-backup','all-invalid notes trigger backup fallback');

h=makeHarness({'anwar_v1':state(null,note('valid-row'))});
h.api.load();
assert(h.api.snapshot().S.notes.length===1&&h.api.snapshot().S.notes[0].id==='valid-row','invalid row is skipped while valid rows survive');

h=makeHarness();
h.api.load();
assert(h.api.snapshot().S.notes.length===0&&!h.api.snapshot().storageRecoveryBlocked,'no stored data is treated as first launch');

h=makeHarness({
  anwar_v1:'corrupt',
  anwar_v1_backup_v2:'also-corrupt',
  anwar_library_saved_v1:JSON.stringify(['saved-book']),
  anwar_rd:JSON.stringify({r:'reader',n:12,m:'l'})
});
h.api.load();
assert(!h.elements.startFresh.hidden,'fresh-start action is shown for damaged data');
h.api.startFreshNotebook();
assert(!h.api.snapshot().storageRecoveryBlocked&&h.api.snapshot().S.notes.length===0,'fresh start clears recovery lock');
assert(h.storage.getItem('anwar_library_saved_v1')===JSON.stringify(['saved-book']),'fresh start preserves saved library items');
assert(h.storage.getItem('anwar_rd')===JSON.stringify({r:'reader',n:12,m:'l'}),'fresh start preserves radio state');

h=makeHarness();
h.api.snapshot().S.notes.push(note('saved'));
assert(h.api.save()===true,'save reports success when primary storage is writable');
assert(JSON.parse(h.storage.getItem('anwar_v1')).notes[0].id==='saved','save writes the primary state');
assert(JSON.parse(h.storage.getItem('anwar_v1_backup_v2')).notes[0].id==='saved','save refreshes the secondary backup');

h=makeHarness();
h.storage.failKey='anwar_v1_backup_v2';
h.api.snapshot().S.notes.push(note('primary-only'));
assert(h.api.save()===true&&JSON.parse(h.storage.getItem('anwar_v1')).notes[0].id==='primary-only','primary save remains successful when secondary backup is unavailable');

h=makeHarness();
h.storage.failKey='anwar_v1';
assert(h.api.save()===false,'unwritable primary storage reports a failed save');

console.log('\nAll storage regression tests passed.');
