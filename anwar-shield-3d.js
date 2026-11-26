/* ANWAR SHIELD 3D v0.3.0 — strict Arabic creative-space input gate; defense in depth only. */
(function(root){
 'use strict';
 if(root.AnwarShield3D&&root.AnwarShield3D.version==='0.3.0')return;
 const VERSION='0.3.0',MAX=200000;
 const RULES=[
 /* Explicit product policy: this notebook is for Arabic creativity and remembrance,
    so names of attack classes are blocked even when pasted as isolated words. */
 {id:'known-attack-vocabulary',status:'blocked',re:/\b(?:xss|cross[\s_-]*site[\s_-]*scripting|sql[\s_-]*injection|sqli|nosql[\s_-]*injection|command[\s_-]*injection|os[\s_-]*command[\s_-]*injection|shell[\s_-]*injection|code[\s_-]*injection|remote[\s_-]*code[\s_-]*execution|rce|csrf|cross[\s_-]*site[\s_-]*request[\s_-]*forgery|ssrf|server[\s_-]*side[\s_-]*request[\s_-]*forgery|xxe|xml[\s_-]*external[\s_-]*entity|ssti|server[\s_-]*side[\s_-]*template[\s_-]*injection|lfi|local[\s_-]*file[\s_-]*inclusion|rfi|remote[\s_-]*file[\s_-]*inclusion|path[\s_-]*traversal|directory[\s_-]*traversal|prototype[\s_-]*pollution|ldap[\s_-]*injection|xpath[\s_-]*injection|crlf[\s_-]*injection|header[\s_-]*injection|html[\s_-]*injection|template[\s_-]*injection|deserialization[\s_-]*attack|insecure[\s_-]*deserialization|open[\s_-]*redirect|clickjacking|session[\s_-]*fixation|credential[\s_-]*stuffing|brute[\s_-]*force|reverse[\s_-]*shell|webshell|shellcode|keylogger|phishing|ransomware|malware|exploit(?:ation)?|zero[\s_-]*day)\b/i},
 {id:'standalone-executable-terms',status:'blocked',re:/\b(?:javascript|vbscript|eval|document\.cookie|innerhtml|outerhtml|onerror|onload|onmouseover|onfocus|onanimationstart)\b/i},
 {id:'xss-dangerous-element',status:'blocked',re:/<\s*(?:script|iframe|object|embed|applet|svg|math|link|meta)\\b/i},
 {id:'xss-event-handler',status:'blocked',re:/\\bon[a-z]{3,}\\s*=\\s*(?:\"[^\"]*\"|'[^']*'|[^\\s>]+)/i},
 {id:'xss-javascript-url',status:'blocked',re:/\\b(?:javascript|vbscript)\\s*:/i},
 {id:'xss-html-data-url',status:'blocked',re:/\\bdata\\s*:\\s*text\\/html/i},
 {id:'dangerous-uri-scheme',status:'blocked',re:/\\b(?:file|gopher|dict)\\s*:\\s*\\/\\//i},
 {id:'xss-html-injection',status:'blocked',re:/<\\/?(?:img|video|audio|source|form|input|button)\\b[^>]*>/i},
 {id:'xss-css-execution',status:'blocked',re:/\\bexpression\\s*\\(|url\\s*\\(\\s*[\"']?\\s*(?:javascript|vbscript|data\\s*:\\s*text\\/html)\\s*:/i},
 {id:'malicious-complete-url',status:'blocked',re:/https?:\\/\\/[^\\s<>\"']{0,2000}(?:%3c\\s*(?:script|svg|iframe)|<\\s*(?:script|svg|iframe)|javascript%3a|vbscript%3a|%0d%0a|%2e%2e(?:%2f|\\/)|\\.\\.\\/|(?:onerror|onload)%3d)/i},
 {id:'ssrf-local-target-url',status:'blocked',re:/https?:\\/\\/(?:localhost|127(?:\\.\\d{1,3}){3}|0\\.0\\.0\\.0|169\\.254\\.169\\.254|10(?:\\.\\d{1,3}){3}|192\\.168(?:\\.\\d{1,3}){2}|172\\.(?:1[6-9]|2\\d|3[01])(?:\\.\\d{1,3}){2})(?::\\d+)?(?:[/?#]|$)/i},
 {id:'sql-union-select',status:'blocked',re:/\\bunion\\s+(?:all\\s+)?select\\b/i},
 {id:'sql-tautology',status:'blocked',re:/(?:'|\")?\\s*(?:or|and)\\s*(?:'|\")?\\d+(?:'|\")?\\s*=\\s*(?:'|\")?\\d+/i},
 {id:'sql-destructive',status:'blocked',re:/\\b(?:drop|truncate|alter)\\s+(?:table|database)\\b|\\bdelete\\s+from\\b/i},
 {id:'sql-metadata-probe',status:'blocked',re:/\\binformation_schema\\b|\\bpg_catalog\\b/i},
 {id:'sql-comment-or-time-probe',status:'blocked',re:/\\b(?:sleep|benchmark)\\s*\\(|\\bwaitfor\\s+delay\\b|\\/\\*[\\s\\S]{0,120}?\\*\\//i},
 {id:'nosql-operator-injection',status:'blocked',re:/(?:\\$|％|＄)\\s*(?:where|ne|gt|gte|lt|lte|regex|exists|expr)\\b|\\b\\$where\\b/i},
 {id:'ldap-xpath-injection',status:'blocked',re:/(?:\\*\\)\\s*\\(\\s*(?:uid|cn|objectclass)\\s*=|\\]\\s*\\|\\s*\\|\\s*\\[|\\bor\\s+1\\s*=\\s*1\\s*\\])/i},
 {id:'xml-external-entity',status:'blocked',re:/<!\\s*(?:DOCTYPE|ENTITY)\\b[\\s\\S]{0,500}?(?:SYSTEM|PUBLIC)\\b/i},
 {id:'path-traversal',status:'blocked',re:/(?:\\.\\.\\/|\\.\\.\\\\|%2e%2e(?:%2f|%5c|\\/|\\\\)|%252e%252e(?:%252f|%255c)|%c0%ae%c0%ae)/i},
 {id:'crlf-header-injection',status:'blocked',re:/(?:%0d%0a|\\\\r\\\\n|\\r\\n)(?:[a-z0-9-]{2,40}\\s*:|location\\s*:)/i},
 {id:'command-chain',status:'blocked',re:/(?:;|&&|\\|\\|)\\s*(?:curl|wget|bash|sh|zsh|powershell|pwsh|cmd(?:\\.exe)?|nc|netcat|python(?:3)?|perl|ruby)\\b/i},
 {id:'command-substitution',status:'blocked',re:/\\$\\(\\s*(?:curl|wget|bash|sh|powershell|cmd|nc|python|perl|ruby)\\b|\\x60(?:curl|wget|bash|sh|powershell|cmd|nc)\\b/i},
 {id:'powershell-obfuscation',status:'blocked',re:/\\b(?:powershell|pwsh)\\b[^\\n]{0,100}\\s-(?:enc|encodedcommand|e)\\b/i},
 {id:'template-injection',status:'review',re:/\\$\\{\\s*(?:constructor|process|require|globalThis|this\\b)|<%[=!]?\\s*[\\s\\S]{0,80}?%>|\\{\\{\\s*(?:constructor|__proto__|7\\s*\\*\\s*7)/i},
 {id:'prototype-pollution',status:'review',re:/(?:__proto__|prototype\\s*\\[?\\s*[\"']?constructor|constructor\\s*\\[\\s*[\"']?prototype)/i},
 {id:'encoded-executable-markup',status:'review',re:/(?:%3c\\s*(?:script|svg|iframe)|&#x0*3c;?\\s*(?:script|svg)|\\\\x3c\\\\x73\\\\x63\\\\x72\\\\x69\\\\x70\\\\x74)/i},
 {id:'suspicious-control-sequence',status:'review',re:/[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]/}
 ];
 function decode(s){return s.replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&colon;/gi,':').replace(/&#(?:x0*3a|0*58);?/gi,':').replace(/&#(?:x0*3c|0*60);?/gi,'<').replace(/&#(?:x0*3e|0*62);?/gi,'>');}
 function normalize(v){let s=String(v==null?'':v).slice(0,MAX);try{s=s.normalize('NFKC');}catch(_){}s=s.replace(/[\\u200B-\\u200F\\u202A-\\u202E\\u2060\\uFEFF]/g,'').replace(/[\\uFF1C]/g,'<').replace(/[\\uFF1E]/g,'>').replace(/[\\uFF1A]/g,':');let d=s;for(let i=0;i<2;i++){const n=decode(d);if(n===d)break;d=n;}try{for(let i=0;i<2;i++){const n=decodeURIComponent(d.replace(/\\+/g,'%2B'));if(n===d)break;d=n;}}catch(_){}return(s+'\\n'+d).slice(0,MAX*2);}
 function inspect(v){const s=normalize(v);for(const r of RULES){r.re.lastIndex=0;if(r.re.test(s))return Object.freeze({blocked:r.status==='blocked',status:r.status,id:r.id,version:VERSION});}return Object.freeze({blocked:false,status:'clean',id:null,version:VERSION});}
 function report(r,source){if(typeof root.CustomEvent==='function'&&typeof root.dispatchEvent==='function')root.dispatchEvent(new root.CustomEvent('anwar-shield-detection',{detail:{version:VERSION,id:r.id,status:r.status,source:source||'input'}}));}
 function notify(r){if(!root.document||!root.document.body)return;let n=root.document.getElementById('anwar-shield-notice');if(!n){n=root.document.createElement('div');n.id='anwar-shield-notice';n.setAttribute('role','status');n.setAttribute('aria-live','polite');n.style.cssText='position:fixed;z-index:2147483647;inset:auto 12px 18px;max-width:520px;margin:auto;padding:12px 16px;border-radius:12px;background:#182b3d;color:#fff;text-align:center;font:600 14px Tahoma,sans-serif;box-shadow:0 4px 18px #0004';root.document.body.appendChild(n);}n.textContent=r.status==='blocked'?'منع الدرع نمطاً هجومياً معروفاً.':'أوقف الدرع إدخالاً غير مألوف للمراجعة؛ لم يُحفظ.';n.hidden=false;if(notify.timer)root.clearTimeout(notify.timer);notify.timer=root.setTimeout(function(){n.hidden=true;},3500);}
 function field(t){if(!t||t.disabled||t.readOnly)return false;const tag=String(t.tagName||'').toLowerCase();if(tag==='textarea')return true;if(tag!=='input')return t.isContentEditable===true;return['text','search','url','tel'].includes(String(t.type||'text').toLowerCase());}
 const safe=new WeakMap();
 function reject(t,r,src){t.value=safe.has(t)?safe.get(t):'';report(r,src);notify(r);}
 function before(e){if(!field(e.target)||typeof e.data!=='string'||!e.data)return;const r=inspect(e.data);if(r.status==='clean')return;e.preventDefault();e.stopImmediatePropagation();report(r,'beforeinput');notify(r);}
 function paste(e){if(!field(e.target))return;const v=e.clipboardData&&e.clipboardData.getData?e.clipboardData.getData('text/plain'):'';if(!v)return;const r=inspect(v);if(r.status==='clean')return;e.preventDefault();e.stopImmediatePropagation();report(r,'paste');notify(r);}
 function input(e){const t=e.target;if(!field(t))return;const v=typeof t.value==='string'?t.value:'';const r=inspect(v);if(r.status!=='clean')reject(t,r,'input');else safe.set(t,v);}
 function change(e){const t=e.target;if(!field(t))return;const r=inspect(t.value);if(r.status!=='clean')reject(t,r,'change');else safe.set(t,t.value);}
 function submit(e){const f=e.target;if(!f||!f.elements)return;for(const t of Array.from(f.elements)){if(!field(t))continue;const r=inspect(t.value);if(r.status!=='clean'){e.preventDefault();e.stopImmediatePropagation();reject(t,r,'submit');return;}}}
 if(root.document&&root.document.addEventListener){root.document.addEventListener('beforeinput',before,true);root.document.addEventListener('paste',paste,true);root.document.addEventListener('input',input,true);root.document.addEventListener('change',change,true);root.document.addEventListener('submit',submit,true);}
 root.AnwarShield3D=Object.freeze({version:VERSION,inspect,normalize});
})(globalThis);
