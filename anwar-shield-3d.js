/* ANWAR SHIELD 3D v0.1 — local input threat gate.
 * Scans transient input only; never transmits or stores entered content.
 * This is a first defensive layer, not a replacement for contextual output encoding or server-side controls.
 */
(function installAnwarShield(root){
 'use strict';
 if(root.AnwarShield3D)return;
 const VERSION='0.1.0';
 const BLACKLIST=[
  {id:'xss-event-handler',level:'known',re:/<\\s*(?:script|iframe|object|embed|svg|math)\\b|\\bon[a-z]{3,}\\s*=\\s*(?:["']|[a-z])/i},
  {id:'javascript-url',level:'known',re:/\\b(?:javascript|vbscript)\\s*:/i},
  {id:'html-data-execution',level:'known',re:/data\\s*:\\s*text\\/html/i},
  {id:'sql-destructive-or-tautology',level:'known',re:/\\b(?:union\\s+select|or\\s+1\\s*=\\s*1|drop\\s+table|truncate\\s+table|information_schema)\\b/i},
  {id:'shell-chain',level:'known',re:/(?:;|&&|\\|\\|)\\s*(?:curl|wget|bash|sh|powershell|cmd(?:\\.exe)?|nc|netcat)\\b/i},
  {id:'template-expression',level:'review',re:/\\$\\{\\s*(?:constructor|process|require|globalThis)|<%[=\\s]|\\{\\{\\s*(?:constructor|__proto__)/i},
  {id:'encoded-executable-payload',level:'review',re:/(?:%3c\\s*script|%3c\\s*img|&#x?0*3c;?\\s*script|\\\\x3c\\\\x73\\\\x63\\\\x72\\\\x69\\\\x70\\\\x74)/i}
 ];
 const lastValue=new WeakMap();
 function normalize(value){
  return String(value??'').normalize('NFKC')
   .replace(/[\\u200B-\\u200F\\u202A-\\u202E\\u2060\\uFEFF]/g,'')
   .replace(/[\\uFF1C]/g,'<').replace(/[\\uFF1E]/g,'>')
   .replace(/\\s+/g,' ').trim();
 }
 function inspect(value){
  const text=normalize(value);
  for(const rule of BLACKLIST){if(rule.re.test(text))return {blocked:rule.level==='known',status:rule.level,id:rule.id};}
  return {blocked:false,status:'clean',id:null};
 }
 function report(result){
  const event=new CustomEvent('anwar-shield-detection',{detail:{version:VERSION,id:result.id,status:result.status}});
  root.dispatchEvent(event);
 }
 function onPaste(event){
  const text=event.clipboardData&&event.clipboardData.getData('text/plain');
  if(typeof text!=='string'||!text)return;
  const result=inspect(text);
  if(result.blocked){event.preventDefault();event.stopImmediatePropagation();report(result);notify('تم منع إدخال نمط هجومي معروف.');}
  else if(result.status==='review'){event.preventDefault();event.stopImmediatePropagation();report(result);notify('عُزل الإدخال للاشتباه ويحتاج إلى مراجعة قبل السماح به.');}
 }
 function onBeforeInput(event){
  if(!event.data)return;
  const result=inspect(event.data);
  if(result.blocked||result.status==='review'){
   event.preventDefault();event.stopImmediatePropagation();report(result);
   notify(result.blocked?'تم منع إدخال نمط هجومي معروف.':'إدخال مشبوه: أُلغي قبل إدراجه.');
  }
 }
 function onInput(event){
  const el=event.target;
  if(!el||!('value'in el))return;
  const result=inspect(el.value);
  if(result.blocked||result.status==='review'){
   const prior=lastValue.get(el)||'';
   el.value=prior;
   el.dispatchEvent(new Event('input',{bubbles:true}));
   report(result);
   notify('أُزيل الإدخال المشبوه من الحقل.');
  }else lastValue.set(el,el.value);
 }
 let toastTimer;
 function notify(message){
  let node=document.getElementById('anwar-shield-notice');
  if(!node){node=document.createElement('div');node.id='anwar-shield-notice';node.setAttribute('role','status');node.setAttribute('aria-live','polite');node.style.cssText='position:fixed;z-index:2147483647;inset:auto 12px 18px;max-width:520px;margin:auto;padding:12px 16px;border-radius:12px;background:#182b3d;color:#fff;text-align:center;font:600 14px Tahoma,sans-serif;box-shadow:0 4px 18px #0004';document.body.appendChild(node);}
  node.textContent=message;node.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{node.hidden=true;},3500);
 }
 document.addEventListener('paste',onPaste,true);
 document.addEventListener('beforeinput',onBeforeInput,true);
 document.addEventListener('input',onInput,true);
 root.AnwarShield3D=Object.freeze({version:VERSION,inspect:function(value){const r=inspect(value);return Object.freeze({blocked:r.blocked,status:r.status,id:r.id});}});
})(globalThis);
