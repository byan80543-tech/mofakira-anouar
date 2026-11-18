import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root=process.cwd();
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
const vaultCrypto=fs.readFileSync(path.join(root,'vault-crypto.js'),'utf8');
const vaultDeviceUnlock=fs.readFileSync(path.join(root,'vault-device-unlock.js'),'utf8');
const failures=[];
const ok=(condition,message)=>{if(!condition)failures.push(message);else console.log('PASS',message)};

ok(manifest.name==='مفكرة أنوار' && manifest.short_name==='مفكرة أنوار','PWA name and short_name');
ok(manifest.start_url==='/mofakira-anouar/' && manifest.scope==='/mofakira-anouar/','GitHub Pages start_url and scope');
ok(html.includes('rel="manifest" href="manifest.webmanifest'),'HTML references the current manifest path');
ok(html.includes('href="icon-192.png?v=20261117-1" sizes="192x192"'),'browser favicon uses the optimized 192px PNG');
ok(html.includes('<link rel="apple-touch-icon" href="icon-192.png?v=20261117-1"'),'Apple touch icon uses the optimized 192px PNG');
ok(!html.includes('file_00000000670481f4ad879246afe6bae2.png'),'the oversized source icon is not loaded by the page');
ok(!manifest.icons.some(i=>String(i.src).includes('file_00000000670481f4ad879246afe6bae2.png')),'manifest excludes the oversized source icon');
ok(html.includes('id="bookToolPanel"') && html.includes('id="bookToolContent" hidden'),'book creation is compact and collapsed inside the tools panel');
ok(html.includes("setBookToolExpanded($('bookToolContent').hidden,true)"),'book panel toggle opens and closes correctly');
ok(html.includes('id="ownerBtn"') && !html.includes('id="newBookTool"'),'ownership shortcut remains in the tools panel without the old book shortcut');
ok(!html.includes('<dialog id="bookDialog">'),'book creation no longer consumes a separate modal');
ok(html.includes('loadFontStylesheets(false)') && html.includes('loadFontStylesheets(true)'),'font packs are deferred until after initial render or opened on demand');
ok(html.includes('id="paperStyleBtn"') && html.includes('id="paperStylePanel"'),'paper style selector is present in the toolbar');
ok(['plain','ruled','poetry','framed'].every(style=>html.includes('data-paper="'+style+'"')),'all four paper layouts are available');
ok(html.includes("paper:['plain','ruled','poetry','framed'].includes(n.paper)"),'paper layout is stored per note');
ok(html.includes("paper:['plain','ruled','poetry','framed'].includes(v.paper)"),'paper layout is preserved in history snapshots');
ok(html.includes('#pg.paper-ruled') && html.includes('#pg.paper-framed') && html.includes('#pg.paper-poetry .v'),'paper style CSS includes ruled, framed, and split-verse layouts');
ok(html.includes("e.key==='Tab'") && html.includes("e.key==='Enter'&&!e.shiftKey"),'poetry layout supports keyboard navigation between hemistichs');
ok(html.includes("else if(id==='vs'&&cur)insertPoetryVerse()"),'verse button inserts structured split-hemistich rows');
ok(html.includes('id="paperStyleBtn"') && html.includes('id="paperStylePanel"'),'paper style selector is present in the toolbar');
ok(['plain','ruled','poetry','framed'].every(style=>html.includes('data-paper="'+style+'"')),'all four paper layouts are available');
ok(html.includes("paper:['plain','ruled','poetry','framed'].includes(n.paper)"),'paper layout is stored per note');
ok(html.includes("paper:['plain','ruled','poetry','framed'].includes(v.paper)"),'paper layout is preserved in history snapshots');
ok(html.includes("applyPaperClass(n.paper)"),'opening a note restores its saved paper layout');
ok(html.includes("e.key==='Tab'") && html.includes("e.key==='Enter'&&!e.shiftKey"),'poetry layout supports keyboard navigation between hemistichs');
ok(html.includes("else if(id==='vs'&&cur)insertPoetryVerse()"),'verse button inserts structured split-hemistich rows');
ok(html.includes('paper-export paper-') && html.includes('paper-export.paper-poetry .v{'),'selected paper layout is preserved in PDF and HTML exports');
ok(html.includes('grid-template-columns:max-content max-content') && html.includes('width:max-content'),'long poem hemistich frames expand to their text width');
ok(html.includes('white-space:pre;overflow-wrap:normal;word-break:normal;hyphens:none'),'long hemistichs never wrap or break inside their frame');
ok(html.includes('#pg.paper-poetry{overflow-x:auto'),'poetry page supports horizontal scrolling on narrow screens');
ok(html.includes("size:v.size,paper:v.paper||'plain'"),'restoring a previous version restores its paper layout too');

ok(html.includes('async function ensurePdfLibraries()'),'PDF libraries load only when PDF export is requested');
ok(html.includes('async function makeQR()'),'QR library loads only when QR generation is requested');
ok(!/<script\b[^>]*\bsrc\s*=\s*["'][^"']*(?:html2canvas|qrcodejs|jspdf)/i.test(html),'heavy PDF and QR libraries are not loaded by static script tags');
ok(!html.includes('Object.hasOwn('),'storage normalization avoids unsupported Object.hasOwn calls');
ok(html.includes('src="./vault-crypto.js?v=20261117-1"'),'the local vault crypto helper is loaded by the notebook');
ok(html.includes('id="vaultGate"') && html.includes('id="vaultLockBtn"'),'password gate and manual vault lock controls are present');
ok(html.includes('const VAULT_IDLE_LOCK_MS=5*60*1000;') && html.includes('document.addEventListener(eventName,recordVaultActivity,true)'),'vault automatically locks after five minutes of inactivity and tracks user interaction');
ok(/if\(savedVault!==null\|\|savedBackup!==null\)/.test(html),'startup can unlock from an encrypted backup when the primary vault is missing');
ok(/function save\(\)\s*\{[\s\S]*?persistVaultSnapshot\(snapshot\)/.test(html) && /async function persistVaultSnapshot\(plaintext\)\s*\{[\s\S]*?AnwarVaultCrypto\.encryptWithKey/.test(html),'notebook saves queue snapshots through encrypted vault persistence');
ok(vaultCrypto.includes("CIPHER='AES-256-GCM'") && vaultCrypto.includes("ITERATIONS=600000"),'vault helper pins AES-GCM and the approved PBKDF2 work factor');
ok(html.includes('vault-device-unlock.js?v=20261118-1') && html.includes('id="vaultDeviceUnlock"') && html.includes('id="vaultDeviceSetupDialog"'),'device-bound quick unlock is wired into the encrypted vault gate');
ok(vaultDeviceUnlock.includes("HKDF") && vaultDeviceUnlock.includes("AES-GCM") && vaultDeviceUnlock.includes("extensions:{prf:{eval:{first:salt}}}"),'device helper derives an authenticated wrapping key from the WebAuthn PRF extension');
ok(vaultDeviceUnlock.includes("userVerification:'required'") && vaultDeviceUnlock.includes("authenticatorAttachment:'platform'"),'device helper requires platform user verification');
try{new vm.Script(vaultDeviceUnlock,{filename:'vault-device-unlock.js'});ok(true,'device unlock helper JavaScript syntax is valid')}catch(error){failures.push('vault-device-unlock.js: '+error.message)}

try{new vm.Script(vaultCrypto,{filename:'vault-crypto.js'});ok(true,'vault cryptography helper JavaScript syntax is valid')}catch(error){failures.push('vault-crypto.js: '+error.message)}

const iconSizes=new Set((manifest.icons??[]).flatMap(icon=>String(icon.sizes??'').split(/\s+/)));
ok(iconSizes.has('192x192'),'manifest declares a 192x192 PWA icon');
ok(iconSizes.has('512x512'),'manifest declares a 512x512 PWA icon');
for(const icon of manifest.icons??[]){
  const iconPath=String(icon.src??'').split('?')[0];
  ok(!!iconPath&&fs.existsSync(path.join(root,iconPath)),`manifest icon exists: ${iconPath}`);
}

const ids=[...html.matchAll(/(?:^|\s)id\s*=\s*["']([^"']+)["']/gim)].map(m=>m[1]);
const duplicateIds=ids.filter((id,i)=>ids.indexOf(id)!==i);
ok(duplicateIds.length===0,'HTML IDs are unique');

let scriptCount=0;
for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)){
  if(/\bsrc\s*=/.test(match[1]))continue;
  scriptCount++;
  try{new vm.Script(match[2],{filename:`inline-script-${scriptCount}.js`})}
  catch(error){failures.push(`inline script ${scriptCount}: ${error.message}`)}
}
ok(scriptCount>0,'inline JavaScript blocks discovered');
if(failures.length){
  console.error('\nValidation failed:');
  for(const failure of failures)console.error('-',failure);
  process.exitCode=1;
}else console.log('All repository static checks passed.');
