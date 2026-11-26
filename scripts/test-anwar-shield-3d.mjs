import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../anwar-shield-3d.js',import.meta.url),'utf8');
const listeners={};
const document={addEventListener(type,fn){listeners[type]=fn;},body:{appendChild(){}},getElementById(){return null;},createElement(){return{setAttribute(){},style:{}};}};
const sandbox={document,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},dispatchEvent(){},decodeURIComponent,setTimeout(){return 1;},clearTimeout(){},WeakMap,Object,String,Array,RegExp};
sandbox.globalThis=sandbox;vm.runInNewContext(source,sandbox,{filename:'anwar-shield-3d.js'});
const shield=sandbox.AnwarShield3D;
test('version',()=>assert.equal(shield.version,'0.4.0'));
test('blocks isolated attack vocabulary',()=>{for(const s of ['XSS','xss','SQL Injection','RCE','CSRF','SSRF','XXE','SSTI','LFI','RFI','Path Traversal','Prototype Pollution','Phishing','Reverse Shell'])assert.equal(shield.inspect(s).status,'blocked',s);});
test('blocks standalone executable terms',()=>{for(const s of ['javascript','vbscript','eval','document.cookie','innerHTML','onerror'])assert.equal(shield.inspect(s).status,'blocked',s);});
test('blocks common XSS and malicious URLs',()=>{for(const s of ['<script>alert(1)</script>','<img src=x onerror=alert(1)>','javascript:alert(1)','<svg onload=alert(1)>','https://example.test/?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E','https://example.test/%2e%2e/%2e%2e/etc/passwd'])assert.equal(shield.inspect(s).status,'blocked',s);});
test('blocks SSRF local-target URLs',()=>{for(const s of ['http://127.0.0.1/admin','http://169.254.169.254/latest/meta-data/','http://192.168.1.10/'])assert.equal(shield.inspect(s).status,'blocked',s);});
test('blocks common SQL injection',()=>{for(const s of ["' OR 1=1 --",'UNION SELECT password FROM users','DROP TABLE users','information_schema.tables','SELECT * FROM users WHERE id=1; WAITFOR DELAY'])assert.equal(shield.inspect(s).status,'blocked',s);});
test('blocks command injection chains',()=>{for(const s of ['hello; curl https://bad.example','$(bash -c id)','text && powershell -enc AAA'])assert.equal(shield.inspect(s).status,'blocked',s);});
test('blocks XML, NoSQL and header injection',()=>{for(const s of ['<!DOCTYPE x SYSTEM "file:///etc/passwd">','{"$ne":null}','%0d%0aLocation:%20https://evil.test'])assert.equal(shield.inspect(s).status,'blocked',s);});
test('routes template and prototype patterns to review',()=>{assert.equal(shield.inspect('$'+'{constructor.constructor("return process")()}').status,'review');assert.equal(shield.inspect('__proto__.polluted = true').status,'review');});
test('detects encoded executable markup',()=>{assert.equal(shield.inspect('%3Cscript%3Ealert(1)%3C/script%3E').status,'blocked');assert.equal(shield.inspect('&#x3c;script&#x3e;alert(1)').status,'blocked');});
test('keeps ordinary Arabic creative text and remembrance clean',()=>{for(const s of ['السلام عليكم ورحمة الله وبركاته','كتبت اليوم قصيدة عن المطر والحنين.','أستغفر الله العظيم وأتوب إليه','اللهم صل وسلم على نبينا محمد','يا ليل الصب متى غده'])assert.equal(shield.inspect(s).status,'clean',s);});
test('normalizes zero-width characters',()=>assert.equal(shield.inspect('java\u200Bscript:alert(1)').status,'blocked'));

test('purges XSS immediately when the final character is typed',()=>{
 const target={tagName:'input',type:'text',value:'',selectionStart:0,selectionEnd:0,
  setRangeText(text,start,end){this.value=this.value.slice(0,start)+text+this.value.slice(end);this.selectionStart=this.selectionEnd=start;},
  setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;},dispatchEvent(){return true;}};
 for(const ch of 'XSS'){
  let prevented=false;
  const event={target,data:ch,inputType:'insertText',preventDefault(){prevented=true;},stopImmediatePropagation(){}};
  listeners.beforeinput(event);
  if(!prevented){const p=target.selectionStart;target.value=target.value.slice(0,p)+ch+target.value.slice(target.selectionEnd);target.selectionStart=target.selectionEnd=p+ch.length;listeners.input({target});}
 }
 assert.equal(target.value,'','the completed forbidden word and its typed prefix are removed');
});
test('purges a forbidden term without deleting clean Arabic before it',()=>{
 const target={tagName:'input',type:'text',value:'هذه قصيدة XSS',selectionStart:13,selectionEnd:13,
  setRangeText(text,start,end){this.value=this.value.slice(0,start)+text+this.value.slice(end);this.selectionStart=this.selectionEnd=start;},
  setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;},dispatchEvent(){return true;}};
 let prevented=false;
 listeners.beforeinput({target,data:' ',inputType:'insertText',preventDefault(){prevented=true;},stopImmediatePropagation(){}});
 assert.equal(prevented,true);
 assert.equal(target.value,'هذه قصيدة ','the Arabic prose is preserved while the forbidden term is purged');
});
test('paste interception remains active after keystroke hardening',()=>{
 let prevented=false;
 listeners.paste({target:{tagName:'input',type:'text',value:'',selectionStart:0,selectionEnd:0},clipboardData:{getData(){return'XSS';}},preventDefault(){prevented=true;},stopImmediatePropagation(){}});
 assert.equal(prevented,true);
});
