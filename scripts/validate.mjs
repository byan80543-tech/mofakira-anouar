import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root=process.cwd();
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
const vaultCrypto=fs.readFileSync(path.join(root,'vault-crypto.js'),'utf8');
const vaultDeviceUnlock=fs.readFileSync(path.join(root,'vault-device-unlock.js'),'utf8');
const toolbarBackNavigation=fs.readFileSync(path.join(root,'toolbar-back-navigation.js'),'utf8');
const apiGatewayConfig=fs.readFileSync(path.join(root,'api-gateway-config.js'),'utf8');
const apiGatewayWorker=fs.readFileSync(path.join(root,'workers/anwar-api-gateway/src/index.mjs'),'utf8');
const apiGatewayDeployWorkflow=fs.readFileSync(path.join(root,'.github/workflows/deploy-anwar-api-gateway.yml'),'utf8');
const clickGuard=fs.readFileSync(path.join(root,'click-guard.js'),'utf8');
const iconGenerator=fs.readFileSync(path.join(root,'scripts/generate-pwa-icons.py'),'utf8');
const failures=[];
const ok=(condition,message)=>{if(!condition)failures.push(message);else console.log('PASS',message)};

ok(manifest.name==='مفكرة أنوار' && manifest.short_name==='مفكرة أنوار','PWA name and short_name');
ok(manifest.start_url==='/mofakira-anouar/' && manifest.scope==='/mofakira-anouar/','GitHub Pages start_url and scope');
ok(html.includes('rel="manifest" href="manifest.webmanifest'),'HTML references the current manifest path');
ok(html.includes('href="icon-192.png?v=20261118-clarity1" sizes="192x192"'),'browser favicon uses the sharpened 192px PNG');
ok(html.includes('<link rel="apple-touch-icon" href="icon-192.png?v=20261118-clarity1"'),'Apple touch icon uses the sharpened 192px PNG');
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
ok(html.includes('src="./vault-crypto.js?v=20261118-2"'),'the local vault crypto helper is loaded by the notebook');
ok(html.includes('id="vaultGate"') && html.includes('id="vaultLockBtn"'),'password gate and manual vault lock controls are present');

ok(html.includes('id="anwar-toolbar-spacing-and-palette-cycle-v2"') && html.includes('.tb{gap:4px!important}'),'toolbar icons keep a small, consistent gap');
ok(html.includes("const palettes=[") && html.includes("button.addEventListener('click',()=>{") && html.includes("S.palette=palettes[(index+1+palettes.length)%palettes.length][0]"),'palette icon cycles directly through the six saved interface colors on every click');
ok(html.includes("#palettePanel{display:none!important}") && !html.includes('setPaletteOpen(open,returnFocus=false)'),'palette cycle does not open a color selection panel');
const paletteCycleStart=html.indexOf("(function(){\n const button=$('paletteBtn')");
const paletteCycleEnd=html.indexOf("})();",paletteCycleStart);
const paletteCycleCode=html.slice(paletteCycleStart,paletteCycleEnd);
ok(paletteCycleStart>=0 && paletteCycleCode.includes("S.palette=palettes[(index+1+palettes.length)%palettes.length][0]") && !paletteCycleCode.includes("panel.classList.toggle('open')") && html.includes("#palettePanel{display:none!important}"),'palette icon cycles colors directly without opening the former popup');

ok(html.includes('src="toolbar-back-navigation.js"'),'contextual back-navigation helper is loaded by the notebook');
ok(html.includes('<script src="api-gateway-config.js"></script>'),'optional API gateway configuration loads before app interaction');
ok(apiGatewayConfig.includes('ANWAR_API_GATEWAY_BASE') && apiGatewayConfig.includes('= \"\";'),'API gateway endpoint defaults to disabled until its deployed URL is configured');
ok(html.includes('https://*.workers.dev') && apiGatewayWorker.includes('export class IpRateLimiter'),'CSP permits the future Worker endpoint and the gateway exports its Durable Object limiter');
ok(apiGatewayWorker.includes('CF-Connecting-IP') && apiGatewayWorker.includes('idFromName("anwar-api-gateway-global-rate-limiter")') && apiGatewayWorker.includes('Retry-After'),'API gateway applies global and per-IP limits in one Durable Object call');
ok(apiGatewayWorker.includes('IP_HASH_SECRET') && apiGatewayWorker.includes('name: "HMAC"'),'IP rate-limit keys use a Cloudflare-only HMAC secret instead of storing raw IP addresses');
ok(apiGatewayWorker.includes('total: { limit: 50') && apiGatewayWorker.includes('client: { limit: 30'),'gateway stays within its daily free-tier accepted-request budget and per-IP ceiling');
ok(apiGatewayWorker.includes('SELECT data FROM rate_state WHERE id = 1') && apiGatewayWorker.includes('UPDATE rate_state SET data = ? WHERE id = 1'),'rate limiter persists all counters in one atomic SQLite row update per accepted request');
ok(apiGatewayWorker.includes('env.EDGE_LIMITER.limit') && apiGatewayWorker.includes('edgeDecision.success'),'gateway applies an edge rate check before the strict global Durable Object check');
ok(apiGatewayDeployWorkflow.includes('workflow_dispatch:') && apiGatewayDeployWorkflow.includes('cloudflare/wrangler-action@v4'),'Cloudflare Worker deployment is manual and uses the official Wrangler GitHub Action');
ok(apiGatewayDeployWorkflow.includes('CLOUDFLARE_API_TOKEN') && apiGatewayDeployWorkflow.includes('CLOUDFLARE_ACCOUNT_ID') && apiGatewayDeployWorkflow.includes('IP_HASH_SECRET'),'deployment reads Cloudflare credentials and HMAC key only from repository secrets');

ok(apiGatewayWorker.includes('ALLOWED_COUNTRY_CODES') && !apiGatewayWorker.includes('searchParams.get("url")'),'API gateway restricts country parameters and does not expose an open URL proxy');

ok(html.includes('<script src="click-guard.js" defer></script>'),'click-burst guard is loaded as a same-origin deferred script');
ok(fs.readFileSync(path.join(root,'service-worker.js'),'utf8').includes("'./click-guard.js'"),'service worker precaches the click-burst guard for offline use');
ok(clickGuard.includes("doc.addEventListener('click',handleClick,true)") && clickGuard.includes('MAX_CLICKS=10') && clickGuard.includes('WINDOW_MS=2000') && clickGuard.includes('COOLDOWN_MS=5000'),'click guard enforces the 10-click rolling-window limit and five-second cooldown');
try{new vm.Script(clickGuard,{filename:'click-guard.js'});ok(true,'click-burst guard JavaScript syntax is valid')}catch(error){failures.push('click-guard.js: '+error.message)}


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
ok(html.includes('const VAULT_IDLE_LOCK_MS=0;') && html.includes('document.addEventListener(eventName,recordVaultActivity,true)'),'free-use mode disables automatic inactivity locking while retaining the manual-lock activity hooks');
ok(html.includes("VAULT_MODE_KEY='anwar_vault_mode_v1'") && html.includes("if(mode==='encrypted'&&savedVault===null&&savedBackup===null)"),'vault startup respects the saved free/encrypted mode and never bypasses a missing encrypted vault');
ok(html.includes("if(!vaultKey||!vaultTemplate){") && html.includes("showVaultGate('setup'"),'manual lock from free mode opens the optional encryption setup');
ok(html.includes('function persistPlainSnapshot(plaintext)') && html.includes("localStorage.setItem(VAULT_MODE_KEY,'plain')") && html.includes("localStorage.setItem(VAULT_MODE_KEY,'encrypted')"),'free and encrypted modes are explicitly persisted after verified storage writes');
ok(html.includes('flushPrivatePreferenceSave();') && html.includes("if(typeof flushPendingEdit==='function')flushPendingEdit(false);") && html.includes('await vaultSaveQueue;') && html.includes("showVaultGate('setup'"),'manual encryption setup flushes pending edits and waits for the save queue before closing free mode');
ok(/async function cancelVaultSetup\(\)[\s\S]*?await persistPlainSnapshot\(JSON\.stringify\(S\)\)/.test(html),'continuing without encryption verifies and persists the plaintext snapshot before reopening');
const workerSource=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
const workerCacheName=workerSource.match(/const CACHE_NAME='(anwar-shell-\d{4}-\d{2}-\d{2}-v\d+)';/);
ok(!!workerCacheName && Number(workerCacheName[1].split('-v').pop())>=1,'service worker uses a dated, monotonically versioned app-shell cache key');
ok(html.includes('id="vaultCancelSetupBtn"') && html.includes('id="vaultDisableEncryptionBtn"'),'the gate offers continue-free and disable-encryption actions');
ok(html.includes('AnwarPrivatePreferences.normalize(d.preferences)') && html.includes('preferences:globalThis.AnwarPrivatePreferences.normalize({})'),'radio, reader and tasbih preferences are part of the encrypted vault state');
ok(html.includes('function importLegacyPrivatePreferences(base)') && html.includes('function clearLegacyPrivatePreferences()'),'legacy plaintext preferences have explicit migration and cleanup paths');
ok(!html.includes("localStorage.setItem('anwar_reader_advance'") && !html.includes("localStorage.setItem(countKey") && !html.includes("localStorage.setItem(dhikrKey"),'active reader and tasbih controls do not write plaintext preferences');
ok(html.includes("AnwarPrivatePreferences.set('readerAdvance'") && html.includes("AnwarPrivatePreferences.set('radio'") && html.includes("privatePreferences.set('tasbih'"),'radio, reader and tasbih changes are routed into encrypted preference state');
ok(/if\(savedVault!==null\|\|savedBackup!==null\)/.test(html),'startup can unlock from an encrypted backup when the primary vault is missing');
ok(/function save\(\)\s*\{[\s\S]*?persistVaultSnapshot\(snapshot\)/.test(html) && /async function persistVaultSnapshot\(plaintext\)\s*\{[\s\S]*?AnwarVaultCrypto\.encryptWithKey/.test(html),'notebook saves queue snapshots through encrypted vault persistence');
ok(html.includes('snapshot.notes.length>2500') && html.includes('(typeof note.html===\'string\'?note.html:note.text).length>450000'),'encrypted saves enforce the same note-count and note-size limits as startup restore');
ok(html.includes("if(S.notes.length>=2500){toast("),'the UI blocks creation beyond the restore-supported 2500-note limit');
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
ok(iconGenerator.includes("ImageFilter.UnsharpMask") && iconGenerator.includes("radius=0.7, percent=125, threshold=2"),'192px launcher icon receives a controlled sharpening pass after downsampling');
ok(html.includes("icon-192.png?v=20261118-clarity1") && html.includes("type:'image/png'"),'media artwork uses the crisp PNG icon instead of the compressed JPEG');
ok(html.includes("function scheduleRadioWarmup()") && html.includes("scheduleRadioWarmup();\n   if(!reciterUiReady)") && !html.includes(" scheduleRadioWarmup();\n rb.addEventListener"),'radio metadata warmup starts only after the visitor opens the radio panel');
ok(html.includes("setTimeout(renderList,90)") && html.includes("setTimeout(renderArchive,120)"),'note and archive searches are lightly debounced to reduce repeated rendering');
ok(html.includes("const q=$('q').value.trim().toLocaleLowerCase(),items=[];") && html.includes("String(n.title||'')+' '+body).toLocaleLowerCase().includes(q)"),'main note search is case-insensitive for Latin titles and body text');
ok(html.includes("function openSafeBlobTab(url){") && html.includes("try{opened.opener=null}catch(error){}") && !html.includes("window.open(url,'_blank','noopener')"),'blob documents use a safe popup flow without a null-return false negative');
const socialFunction=fs.readFileSync(path.join(root,'functions/index.js'),'utf8');
ok(socialFunction.includes(".on('meta[property=\"og:title\"]'") && socialFunction.includes('head.onEndTag(endTag =>') && socialFunction.includes('endTag.before(SOCIAL_META, { html: true })'),'Cloudflare social metadata is injected only when a page has no Open Graph title');
const qualityWorkflow=fs.readFileSync(path.join(root,'.github/workflows/quality.yml'),'utf8');
ok(qualityWorkflow.includes('wrangler@4.164.0') && !qualityWorkflow.includes('wrangler@latest'),'quality dry-run pins the Wrangler version used by deployment');
ok(html.includes("content-visibility:auto;contain-intrinsic-size:auto 76px"),'off-screen note cards skip unnecessary painting');
ok(html.includes("backdrop-filter:none;-webkit-backdrop-filter:none"),'vault startup overlay avoids an expensive full-screen blur');


const deployWorkflow=fs.readFileSync(path.join(root,'.github/workflows/deploy-cloudflare-pages.yml'),'utf8');
const securityHeaders=fs.readFileSync(path.join(root,'_headers'),'utf8');
ok(deployWorkflow.includes('cp _headers dist/_headers'),'Cloudflare Pages receives _headers at the deployment output root');
ok(deployWorkflow.includes('test -s dist/_headers') && deployWorkflow.includes("grep -q \"frame-ancestors 'none'\" dist/_headers"),'deployment fails closed if the root security header file is missing or incomplete');
ok(!deployWorkflow.includes('cp _headers dist/mofakira-anouar/_headers'),'security headers are not misplaced inside the nested PWA directory');
ok(securityHeaders.includes("frame-ancestors 'none'") && securityHeaders.includes('X-Frame-Options: DENY'),'HTTP headers prevent cross-origin framing');
ok(securityHeaders.includes('X-Content-Type-Options: nosniff') && securityHeaders.includes('Referrer-Policy: strict-origin-when-cross-origin'),'HTTP headers set MIME-sniffing and referrer protections');
ok(securityHeaders.includes('Permissions-Policy: camera=(), geolocation=(), microphone=(self)'),'HTTP Permissions-Policy disables unused camera and location access');
ok(securityHeaders.includes("Content-Security-Policy:") && securityHeaders.includes("script-src 'self' https://cdnjs.cloudflare.com") && securityHeaders.includes('upgrade-insecure-requests'),'HTTP CSP response header is present and retains the secure resource policy; exact inline hashes are checked by test-csp.mjs');

if(failures.length){
  console.error('\nValidation failed:');
  for(const failure of failures)console.error('-',failure);
  process.exitCode=1;
}else console.log('All repository static checks passed.');
