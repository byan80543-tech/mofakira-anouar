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
  between('function exportStorageRecovery(){','function save(){'),
  between('function save(){','function toast('),
  between('function plain(h){','const notePlainTextCache='),
  between('let pendingBefore=null;','function saveSel(){'),
  between('function openNote(n){','function applyPaperClass(style){')
].join('\n');

function makeHarness(initial={}){
  const values=new Map(Object.entries(initial).map(([k,v])=>[k,String(v)]));
  const storage={
    failKey:null,failGetKey:null,writeCount:0,
    getItem(key){if(this.failGetKey===key)throw new Error('simulated storage read failure');return values.has(key)?values.get(key):null},
    setItem(key,value){
      if(this.failKey===key)throw new Error('simulated storage failure');
      this.writeCount++;
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
    startFresh:{hidden:true},
    restoreBackup:{hidden:true},
    retryStorageAccess:{hidden:false},
    storageRecoveryTitle:{textContent:''},
    storageRecoveryMessage:{textContent:''}
  };
  const messages=[],download={blob:null,anchor:null,appended:null};
  class FakeBlob{constructor(parts,options={}){this.parts=parts;this.type=options.type||''}}
  const fakeURL={createObjectURL(blob){download.blob=blob;return 'blob:anwar-recovery'},revokeObjectURL(url){download.revoked=url}};
  const fakeDocument={
    createElement(tag){
      if(tag==='div'){
        const node={textContent:'',get innerText(){return this.textContent}};
        Object.defineProperty(node,'innerHTML',{set(value){this.textContent=String(value??'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ')}});
        return node;
      }
      const anchor={tagName:tag,clicked:false,removed:false,click(){this.clicked=true},remove(){this.removed=true}};
      download.anchor=anchor;return anchor;
    },
    body:{append(anchor){download.appended=anchor}}
  };
  const sandbox={
    console:{warn(){},error(){}},
    Date,Math,JSON,Set,Number,String,Array,Object,Error,Blob:FakeBlob,URL:fakeURL,document:fakeDocument,
    setTimeout(){return 1},
    TYPES:{poem:'قصيدة',text:'نص',idea:'فكرة'},
    FONTS:['Amiri','Tajawal'],
    hasOwn:(o,k)=>Object.prototype.hasOwnProperty.call(o,k),
    esc:s=>String(s??'').replace(/[&<>]/g,''),
    san:s=>String(s??''),
    safeFontName:v=>typeof v==='string'&&['Amiri','Tajawal'].includes(v)?v:'Amiri',
    localStorage:storage,
    S:{notes:[],theme:'',palette:'blue',wallColor:'mist',paperColor:'white',days:[]},
    cur:null,draftNote:null,tm:null,pendingBefore:null,
    pg:{innerHTML:'',style:{},focus(){},classList:{add(){},remove(){}}},
    clearTimeout(){},iso:d=>d.toISOString().slice(0,10),info(){},
    createNoteId:(()=>{let id=0;return()=>String(++id)})(),
    applyPaperClass(){},
    storageRecoveryBlocked:false,storageRecoveryRaw:null,storageRecoveryExported:false,storageRecoveryMode:'none',storageRecoveryBackupAvailable:false,
    $:id=>elements[id]||(elements[id]={hidden:false,disabled:false,value:'',textContent:'',style:{},classList:{add(){},remove(){}},setAttribute(){}}),
    toast:m=>messages.push(String(m)),
    confirm:()=>true,
    theme(){},chips(){},renderList(){}
  };
  vm.runInNewContext(extracted+"\nthis.api={load,save,startFreshNotebook,retryStorageAccess,restoreStorageBackup,exportStorageRecovery,snapshot:()=>({S,storageRecoveryBlocked,storageRecoveryRaw,storageRecoveryExported,storageRecoveryMode,storageRecoveryBackupAvailable}),\n      activateEdit:(note,previous,html)=>{cur=note;pendingBefore=previous;pg.innerHTML=html},\n      draftState:()=>({cur,draftNote,notes:S.notes}),touch,newNote,openNote,flushPendingEdit};",sandbox,{timeout:3000});
  return {api:sandbox.api,storage,elements,messages,sandbox,download};
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
assert(h.api.snapshot().storageRecoveryBlocked&&h.api.snapshot().storageRecoveryRaw==='{broken-json','corrupt primary enters recovery without losing its raw value');
assert(h.storage.getItem('anwar_v1')==='{broken-json','corrupt primary is not overwritten automatically');
assert(!h.elements.restoreBackup.hidden,'a valid backup is offered for explicit recovery');
h.api.restoreStorageBackup();
assert(h.storage.getItem('anwar_v1')==='{broken-json','backup restore is blocked until raw export');
h.api.exportStorageRecovery();
assert(h.download.blob.parts.join('')==='{broken-json'&&h.download.blob.type==='application/json;charset=utf-8'&&h.download.anchor.download==='anwar-storage-recovery-raw.json'&&h.download.anchor.clicked&&h.api.snapshot().storageRecoveryExported,'raw recovery export creates and clicks a downloadable Blob');
h.api.restoreStorageBackup();
assert(!h.api.snapshot().storageRecoveryBlocked&&JSON.parse(h.storage.getItem('anwar_v1')).notes[0].id==='backup','valid backup restores only after raw export');

h=makeHarness({'anwar_v1_backup_v2':state(note('orphan-backup'))});
h.api.load();
assert(h.api.snapshot().S.notes[0]?.id==='orphan-backup','missing primary key restores backup');

h=makeHarness({'anwar_v1':JSON.stringify({notes:[null,'bad',false]}),'anwar_v1_backup_v2':state(note('clean-backup'))});
h.api.load();
assert(h.api.snapshot().storageRecoveryBlocked&&h.api.snapshot().storageRecoveryBackupAvailable,'an all-invalid primary is held for recovery while a valid backup is offered');
h.api.exportStorageRecovery();
assert(h.download.blob.parts.join('')===h.api.snapshot().storageRecoveryRaw&&h.download.anchor.clicked,'invalid primary recovery export downloads its raw value');
h.api.restoreStorageBackup();
assert(h.api.snapshot().S.notes[0]?.id==='clean-backup','explicit backup restore recovers all-invalid primary after raw export');

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
assert(h.api.snapshot().storageRecoveryBlocked&&h.storage.getItem('anwar_v1')==='corrupt','fresh start cannot overwrite damaged data before raw export');
h.api.exportStorageRecovery();
assert(h.download.anchor.clicked&&h.api.snapshot().storageRecoveryExported,'fresh-start path requires an actual raw export action');
h.api.startFreshNotebook();
assert(!h.api.snapshot().storageRecoveryBlocked&&h.api.snapshot().S.notes.length===0,'fresh start clears recovery lock after raw export');
assert(h.storage.getItem('anwar_library_saved_v1')===JSON.stringify(['saved-book']),'fresh start preserves saved library items');
assert(h.storage.getItem('anwar_rd')===JSON.stringify({r:'reader',n:12,m:'l'}),'fresh start preserves radio state');

h=makeHarness();
h.storage.failGetKey='anwar_v1';
h.api.load();
assert(h.api.snapshot().storageRecoveryBlocked&&h.api.snapshot().storageRecoveryMode==='unavailable','blocked localStorage access is distinct from corrupt JSON');
h.storage.failGetKey=null;
assert(h.api.retryStorageAccess()===true&&!h.api.snapshot().storageRecoveryBlocked,'retry succeeds when browser storage access returns');

h=makeHarness({'anwar_v1_backup_v2':state(note('retry-backup'))});
h.storage.failGetKey='anwar_v1';
h.api.load();
const writesBeforeRetry=h.storage.writeCount;
h.storage.failGetKey=null;
assert(h.api.retryStorageAccess()===true&&h.api.snapshot().S.notes[0]?.id==='retry-backup','retry loads a valid backup when the primary key is absent');
assert(h.storage.getItem('anwar_v1')===null&&h.storage.writeCount===writesBeforeRetry,'retry remains read-only and does not rewrite the missing primary record');

h=makeHarness({'anwar_v1_backup_v2':''});
h.api.load();
assert(h.api.snapshot().storageRecoveryBlocked&&h.api.snapshot().storageRecoveryRaw==='','an empty backup value is treated as corrupt data, not as a missing backup');

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


h=makeHarness();
const edited=note('debounced','قبل التعديل','<div>النص القديم</div>');
h.api.snapshot().S.notes.push(edited);
h.api.activateEdit(edited,{
  title:'قبل التعديل',type:'poem',html:'<div>النص القديم</div>',ts:1700000000000,font:'Amiri',size:20
},'<div>آخر كتابة</div>');
edited.title='بعد التعديل';
assert(h.api.flushPendingEdit(false)===true,'pending edit flush reports a successful save');
const flushed=JSON.parse(h.storage.getItem('anwar_v1')).notes[0];
assert(flushed.html==='<div>آخر كتابة</div>'&&flushed.title==='بعد التعديل','latest editor content and title are saved before navigation');
assert(flushed.history.length===1&&flushed.history[0].html==='<div>النص القديم</div>','flush preserves the previous version in note history');

// A fresh note remains an in-memory draft until the writer enters actual text.
h=makeHarness();
h.api.newNote();
const openedDraft=h.api.draftState();
assert(openedDraft.notes.length===0,'new note does not enter the saved work list immediately');
assert(h.storage.writeCount===0,'opening new note does not write to storage');
assert(openedDraft.draftNote===openedDraft.cur&&!!openedDraft.draftNote,'new note is held as the active temporary draft');
assert(h.api.flushPendingEdit(false)===true&&h.api.draftState().notes.length===0&&h.storage.writeCount===0,'leaving an untouched draft does not create or save an empty note');
h.api.openNote(null);
assert(h.api.draftState().cur===null&&h.api.draftState().draftNote===null&&h.api.draftState().notes.length===0,'closing an untouched draft discards it from the active editor');

h=makeHarness();
h.api.newNote();
h.api.draftState().cur.title='عنوان فقط';
assert(h.api.flushPendingEdit(false)===true&&h.api.draftState().notes.length===0&&h.storage.writeCount===0,'a title without body text is not stored as a blank work');
h.api.openNote(null);
assert(h.api.draftState().notes.length===0,'a title-only draft disappears when closed');

h=makeHarness();
h.api.newNote();
h.sandbox.pg.innerHTML='<div>بدأت القصيدة هنا</div>';
h.api.touch();
assert(h.api.draftState().notes.length===0&&h.api.draftState().draftNote!==null,'typed content remains a pending draft until the save boundary');
assert(h.api.flushPendingEdit(false)===true,'first written draft flushes successfully');
assert(h.api.draftState().notes.length===1&&h.api.draftState().draftNote===null,'first actual body text commits the draft exactly once');
const firstSaved=JSON.parse(h.storage.getItem('anwar_v1')).notes[0];
assert(firstSaved.html==='<div>بدأت القصيدة هنا</div>'&&(firstSaved.history||[]).length===0,'first save preserves the text without creating a false empty history version');

h=makeHarness();
h.api.newNote();
h.sandbox.pg.innerHTML='<div>حرف مؤقت</div>';
h.api.touch();
h.sandbox.pg.innerHTML='';
h.api.touch();
assert(h.api.flushPendingEdit(false)===true&&h.api.draftState().notes.length===0&&h.storage.writeCount===0,'typing then erasing before autosave leaves no empty work');

console.log('\nAll storage regression tests passed.');
