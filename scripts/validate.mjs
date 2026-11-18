import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root=process.cwd();
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
const vaultCrypto=fs.readFileSync(path.join(root,'vault-crypto.js'),'utf8');
const vaultDeviceUnlock=fs.readFileSync(path.join(root,'vault-device-unlock.js'),'utf8');
const toolbarBackNavigation=fs.readFileSync(path.join(root,'toolbar-back-navigation.js'),'utf8');
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

ok(html.includes('id="anwar-toolbar-spacing-and-palette-cycle-v2"') && html.includes('.tb{gap:4px!important}'),'toolbar icons keep a small, consistent gap');
ok(html.includes("const palettes=[") && html.includes("button.addEventListener('click',()=>{") && html.includes("S.palette=palettes[(index+1+palettes.length)%palettes.length][0]"),'palette icon cycles directly through the six saved interface colors on every click');
ok(html.includes("#palettePanel{display:none!important}") && !html.includes('setPaletteOpen(open,returnFocus=false)'),'palette cycle does not open a color selection panel');
ok(html.includes('function setPaletteOpen(open,returnFocus=false)') && html.includes("button.setAttribute('aria-expanded',String(open))") && html.includes("e.key==='Escape'&&panel.classList.contains('open')"),'color picker click, close, Escape, and expanded accessibility states are synchronized');

ok(html.includes('src="toolbar-back-navigation.js"'),'contextual back-navigation helper is loaded by the notebook');

ok(html.includes('id="anwar-wordmark-legibility-v1"') && html.includes("font-family:'Cairo',Tahoma,sans-serif!important") && html.includes('font-weight:700!important'),'brand wordmark uses a clear bold Arabic sans-serif face');
const mobileStyleStart=html.indexOf('<style id="anwar-mobile-toolbar-fix">');
const contextualStyleStart=html.indexOf('<style id="anwar-contextual-back-and-brand-v2">',mobileStyleStart);
const mobileStyleRegion=html.slice(mobileStyleStart,contextualStyleStart);
const mobileStyleClose=mobileStyleRegion.indexOf('</style>');
const lockStyleOpen=mobileStyleRegion.indexOf('<style id="vault-lock-toolbar-position-v1">');
ok(mobileStyleClose>0 && lockStyleOpen>mobileStyleClose && mobileStyleRegion.slice(lockStyleOpen).includes('</style>'),'mobile toolbar style blocks are properly closed and not nested');
const headerToolbarStart=html.indexOf('<div class="tb">');
const headerToolbarEnd=html.indexOf('</div>',headerToolbarStart);
const headerToolbar=html.slice(headerToolbarStart,headerToolbarEnd);
const toolsLabelIndex=html.indexOf('<small>أدوات أنوار</small>');
const toolsGroupStart=html.lastIndexOf('<div class="g"><div>',toolsLabelIndex);
const toolsGroupEnd=html.indexOf('</div><small>أدوات أنوار</small>',toolsGroupStart);
const backupButtonIndex=html.indexOf('id="bkp"',toolsGroupStart);
ok(headerToolbarStart>=0 && headerToolbarEnd>headerToolbarStart && !headerToolbar.includes('id="bkp"') && backupButtonIndex>toolsGroupStart && backupButtonIndex<toolsGroupEnd,'encrypted backup icon is removed from the top bar and placed inside the Anwar tools group');
ok(html.includes('id="bkp"') && html.includes('aria-controls="dg"') && html.includes('class="b bkp-tool"') && html.includes('نسخة مشفرة') && html.includes("else if(id==='bkp'){openEncryptedBackupDialog()}"),'in-content encrypted backup button keeps its label, dialog target and existing click action');
const iconPolishStart=html.indexOf('<style id="toolbar-icon-polish-v1">');
const iconPolishEnd=html.indexOf('</style>',iconPolishStart);
const iconPolish=html.slice(iconPolishStart,iconPolishEnd);
ok(iconPolish.includes('.tb #vaultLockBtn') && !iconPolish.includes('#bkp'),'top toolbar icon polish includes the lock and excludes the relocated backup control');
ok(html.includes('#rib .bkp-tool svg') && html.includes('#rib .bkp-tool:focus-visible'),'relocated backup control has a consistent in-panel icon and keyboard focus treatment');
ok(['prn','pdf','vs','sp','fo','ip','pn','cy','hist','dl'].every(id=>new RegExp('id="'+id+'"[^>]*(?:aria-label|title)=').test(html)),'editor action icons have readable accessible names or titles');
ok(toolbarBackNavigation.includes("paletteButton.setAttribute('aria-expanded'") && toolbarBackNavigation.includes("radioButton.setAttribute('aria-pressed'") && toolbarBackNavigation.includes('إيقاف إذاعة القرآن مؤقتًا'),'toolbar controls keep palette and Quran playback states accessible');

try{new vm.Script(toolbarBackNavigation,{filename:'toolbar-back-navigation.js'});ok(true,'contextual back-navigation helper JavaScript syntax is valid')}catch(error){failures.push('toolbar-back-navigation.js: '+error.message)}
ok(html.includes('const VAULT_IDLE_LOCK_MS=5*60*1000;') && html.includes('document.addEventListener(eventName,recordVaultActivity,true)'),'vault automatically locks after five minutes of inactivity and tracks user interaction');
ok(html.includes('AnwarPrivatePreferences.normalize(d.preferences)') && html.includes('preferences:globalThis.AnwarPrivatePreferences.normalize({})'),'radio, reader and tasbih preferences are part of the encrypted vault state');
ok(html.includes('function importLegacyPrivatePreferences(base)') && html.includes('function clearLegacyPrivatePreferences()'),'legacy plaintext preferences have explicit migration and cleanup paths');
ok(!html.includes("localStorage.setItem('anwar_reader_advance'") && !html.includes("localStorage.setItem(countKey") && !html.includes("localStorage.setItem(dhikrKey"),'active reader and tasbih controls do not write plaintext preferences');
ok(html.includes("AnwarPrivatePreferences.set('readerAdvance'") && html.includes("AnwarPrivatePreferences.set('radio'") && html.includes("privatePreferences.set('tasbih'"),'radio, reader and tasbih changes are routed into encrypted preference state');
ok(/if\(savedVault!==null\|\|savedBackup!==null\)/.test(html),'startup can unlock from an encrypted backup when the primary vault is missing');
ok(/function save\(\)\s*\{[\s\S]*?persistVaultSnapshot\(snapshot\)/.test(html) && /async function persistVaultSnapshot\(plaintext\)\s*\{[\s\S]*?AnwarVaultCrypto\.encryptWithKey/.test(html),'notebook saves queue snapshots through encrypted vault persistence');
ok(vaultCrypto.includes("CIPHER='AES-256-GCM'") && vaultCrypto.includes("ITERATIONS=600000"),'vault helper pins AES-GCM and the approved PBKDF2 work factor');
ok(html.includes('vault-device-unlock.js?v=20261118-1') && html.includes('id="vaultDeviceUnlock"') && html.includes('id="vaultDeviceSetupDialog"'),'platform-authenticator quick unlock is wired into the encrypted vault gate');
ok(vaultDeviceUnlock.includes("HKDF") && vaultDeviceUnlock.includes("AES-GCM") && vaultDeviceUnlock.includes("extensions:{prf:{eval:{first:salt}}}"),'device helper derives an authenticated wrapping key from the WebAuthn PRF extension');
ok(vaultDeviceUnlock.includes("userVerification:'required'") && vaultDeviceUnlock.includes("authenticatorAttachment:'platform'"),'device helper requires platform user verification');
ok(fs.readFileSync(path.join(root,'service-worker.js'),'utf8').includes("'./vault-device-unlock.js'"),'service worker precaches the device unlock helper for offline startup');
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
