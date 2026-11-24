import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

const root=process.cwd();
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const htmlAudit=JSON.parse(execFileSync('python3',[path.join(root,'scripts/html_inspector.py'),path.join(root,'index.html')],{encoding:'utf8'}));
const appCore=fs.readFileSync(path.join(root,'app-core.js'),'utf8');
const prayerTimes=fs.readFileSync(path.join(root,'prayer-times.js'),'utf8');
const tasbihController=fs.readFileSync(path.join(root,'tasbih-controller.js'),'utf8');
const protectiveAdhkar=fs.readFileSync(path.join(root,'protective-adhkar.js'),'utf8');
const poetryDictation=fs.readFileSync(path.join(root,'poetry-dictation.js'),'utf8');
const appSource=html+String.fromCharCode(10)+appCore;
const serviceWorker=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
const vaultCrypto=fs.readFileSync(path.join(root,'vault-crypto.js'),'utf8');
const vaultDeviceUnlock=fs.readFileSync(path.join(root,'vault-device-unlock.js'),'utf8');
const toolbarBackNavigation=fs.readFileSync(path.join(root,'toolbar-back-navigation.js'),'utf8');
const apiGatewayConfig=fs.readFileSync(path.join(root,'api-gateway-config.js'),'utf8');
const apiGatewayWorker=fs.readFileSync(path.join(root,'workers/anwar-api-gateway/src/index.mjs'),'utf8');
const apiGatewayWrangler=fs.readFileSync(path.join(root,'workers/anwar-api-gateway/wrangler.toml'),'utf8');
const apiGatewayReadme=fs.readFileSync(path.join(root,'workers/anwar-api-gateway/README.md'),'utf8');
const apiGatewayDeployWorkflow=fs.readFileSync(path.join(root,'.github/workflows/deploy-anwar-api-gateway.yml'),'utf8');
const clickGuard=fs.readFileSync(path.join(root,'click-guard.js'),'utf8');
const floatingPanels=fs.readFileSync(path.join(root,'floating-panels.js'),'utf8');
const floatingPanelsCss=fs.readFileSync(path.join(root,'floating-panels.css'),'utf8');
const iconGenerator=fs.readFileSync(path.join(root,'scripts/generate-pwa-icons.py'),'utf8');
const failures=[];
const ok=(condition,message)=>{if(!condition)failures.push(message);else console.log('PASS',message)};

const iconTouchStyleStart=html.indexOf('<style id="anwar-unified-icon-touch-v1">');
const iconTouchStyleEnd=html.indexOf('</style>',iconTouchStyleStart);
const iconTouchStyle=html.slice(iconTouchStyleStart,iconTouchStyleEnd);
ok(iconTouchStyleStart>=0 && iconTouchStyle.includes('-webkit-tap-highlight-color:rgba(201,169,106,.22)!important;') && iconTouchStyle.includes('outline:2px solid rgba(201,169,106,.46)!important;') && iconTouchStyle.includes('filter:brightness(.97) saturate(1.08);') && iconTouchStyle.includes(':has(svg)') && iconTouchStyle.includes(':has(img)') && iconTouchStyle.includes('[aria-disabled="true"]') && iconTouchStyle.includes("#lessonPlay"),'interactive icon controls use a consistent soft-gold touch highlight and pressed ring without targeting disabled buttons');

try{new vm.Script(tasbihController,{filename:'tasbih-controller.js'});ok(true,'standalone tasbih controller JavaScript syntax is valid')}catch(error){failures.push('tasbih-controller.js: '+error.message)}
try{new vm.Script(poetryDictation,{filename:'poetry-dictation.js'});ok(true,'standalone poetry dictation controller JavaScript syntax is valid')}catch(error){failures.push('poetry-dictation.js: '+error.message)}
try{new vm.Script(protectiveAdhkar,{filename:'protective-adhkar.js'});ok(true,'protective adhkar data JavaScript syntax is valid')}catch(error){failures.push('protective-adhkar.js: '+error.message)}
try{new vm.Script(floatingPanels,{filename:'floating-panels.js'});ok(true,'floating panel controller JavaScript syntax is valid')}catch(error){failures.push('floating-panels.js: '+error.message)}
ok(html.includes('id="sp"')&&html.includes('id="speakRead"'),'poetry dictation and spoken reading have separate toolbar controls');
ok(html.indexOf('<script src="./poetry-dictation.js')<html.indexOf('<script src="./app-core.js'),'poetry dictation controller loads before the notebook application');
ok(appCore.includes("else if(id==='sp')togglePoetryDictation()")&&appCore.includes("else if(id==='speakRead')speakText()"),'dictation and speech playback are routed to their own actions');
ok(appCore.includes('function appendPoetryDictationText')&&appCore.includes('touch();'),'dictated final speech is inserted into the current editable note and triggers persistence');
ok(appCore.includes('function poetryDictationCellForNode')&&appCore.includes('function poetryDictationRangeInCell')&&appCore.includes('poetryDictationRangeInCell(saved)'),
 'poetry dictation restores the last saved caret inside a verse cell when toolbar focus moves away');
ok(appCore.includes('function advancePoetryDictationCell()') && appCore.includes('function schedulePoetryDictationAdvance()') && appCore.includes('},1000);') && appCore.includes('clearPoetryDictationAdvanceTimer();'), 'poetry dictation advances between hemistichs after a one-second pause and cancels stale timers');
ok(appCore.includes("if(cur.paper==='poetry'&&!pg.querySelector('.v'))insertPoetryVerse();")&&appCore.includes('saved=range.cloneRange();'),
 'poetry dictation creates a verse row when needed and keeps every committed phrase anchored in its current cell');
ok(serviceWorker.includes("'./poetry-dictation.js'")&&/const CACHE_NAME='anwar-shell-[0-9]{4}-[0-9]{2}-[0-9]{2}-v[0-9]+';/.test(serviceWorker),'poetry dictation is part of the versioned offline app shell');

ok(appCore.includes('window.AnwarRenderAdhkar=function(){return renderProtectiveAdhkar();}') && appCore.includes('window.AnwarShowOwnerPanel=function(which)'), 'notebook exposes narrow bridges for direct protection rendering and owner/publication selection');
ok(html.includes('class="protective-page-title">أذكار التحصين</h2>') && !html.includes('adhkarAdminDialog') && !html.includes('id="morningTab"') && !html.includes('id="eveningTab"'),'the adhkar screen is a blank personal page without preset or owner-library tabs');
ok(appCore.includes("window.AnwarRenderAdhkar('protection')") && appCore.includes('function renderProtectiveAdhkar()') && appCore.includes('customAdhkar:cleanCustomAdhkar(d.customAdhkar)'), 'the dashboard opens the personal adhkar renderer and persists visitor-owned entries');
const adhkarRenderer=appCore.slice(appCore.indexOf('function renderProtectiveAdhkar()'),appCore.indexOf('window.AnwarRenderAdhkar=function()'));
ok(adhkarRenderer.includes("fontButton.dataset.adhkarFontPicker='true'") && appCore.includes('function setAdhkarFont(form,value)') && appCore.includes('font:safeFontName(item.font)') && appCore.includes('S.customAdhkar.push({id,text,font,ts:Date.now()})'),'adhkar font selection is safe, selectable, and saved per entry');
ok(html.includes('id="adhkarFontDialog"') && html.includes('id="adhkarFontOptions"') && appCore.includes('function openAdhkarFontDialog(form)') && appCore.includes('dialog.showModal()') && adhkarRenderer.includes("fontButton.addEventListener('click',()=>openAdhkarFontDialog(form))") && clickGuard.includes('#adhkarFontDialog') && clickGuard.includes('#adhkarContent .adhkar-font-picker'),'adhkar font selection uses a dedicated searchable dialog and bypasses the global click cooldown');
ok(appCore.includes('function makeAdhkarNotice(text,key,className)') && appCore.includes('function dismissAdhkarNotice(button,key)') && appCore.includes("localStorage.setItem('anwar_adhkar_notice_'+noticeKey,'dismissed')") && appCore.includes("localStorage.getItem('anwar_adhkar_notice_'+key)==='dismissed'") && appCore.includes("document.addEventListener('click',event=>") && appCore.includes("target.closest('.adhkar-note-dismiss[data-dismiss-adhkar-notice]')") && appCore.includes('dismissAdhkarNotice(button,button.dataset.dismissAdhkarNotice)') && appCore.includes('},true);'), 'adhkar guidance notices use one reliable delegated dismiss handler and remain hidden on this device');
ok(appCore.includes('S.customAdhkar.push({id,text,font,ts:Date.now()})') && appCore.includes('save();form.reset()') && appCore.includes('body.textContent=item.text') && !adhkarRenderer.includes('titleInput') && !adhkarRenderer.includes('titleLabel'), 'visitors can save adhkar and their selected font through one safe text field within notebook persistence');
ok(protectiveAdhkar.includes('Object.freeze([])') && !protectiveAdhkar.includes('صحيح البخاري 3371'), 'the starter adhkar collection is deliberately empty');
ok(html.includes('./protective-adhkar.js') && html.indexOf('<script src="./protective-adhkar.js')<html.indexOf('<script src="./app-core.js'), 'the empty adhkar starter file loads before the personal renderer');
ok(serviceWorker.includes("'./protective-adhkar.js'") && /const CACHE_NAME='anwar-shell-[0-9]{4}-[0-9]{2}-[0-9]{2}-v[0-9]+';/.test(serviceWorker), 'protective adhkar data is included in the versioned offline shell');
ok(!appCore.includes("const $=id=>document.getElementById(id),panel=$('tasbihPanel')"), 'tasbih runtime is removed from the delayed notebook initializer');
ok(tasbihController.includes('window.AnwarTasbihController=Object.freeze({') && tasbihController.includes('open(){') && tasbihController.includes('panel.hidden=false') && !tasbihController.includes('ownerDialog') && !tasbihController.includes('ownerPanel'), 'standalone tasbih controller opens directly without depending on ownership navigation');
ok(appCore.includes("if(name==='tasbih')") && appCore.includes('controller.open()') && appCore.includes("if(name==='adhkar'&&typeof window.AnwarRenderAdhkar==='function')") && appCore.includes("window.AnwarRenderAdhkar('protection')"), 'dedicated dashboard cards open tasbih directly and load the unified protection collection');
ok(tasbihController.includes("preferences.set('tasbih'") && tasbihController.includes("preferences.subscribe(saved=>"), 'tasbih settings remain integrated with encrypted private preferences');
ok(tasbihController.includes("removeButton.addEventListener('click'") && tasbihController.includes("restoreButton.addEventListener('click'") && tasbihController.includes("customAdd.addEventListener('click'"), 'custom dhikr add, remove and official restore actions are wired');
ok(tasbihController.includes("voiceButton.addEventListener('click'") && tasbihController.includes('bestSpeechText(result,voiceTargetPhrase)') && tasbihController.includes('countPhraseMatches(liveText,voiceTargetPhrase)') && tasbihController.includes('voiceResultSegments') && tasbihController.includes('freshBatch') && tasbihController.includes("const speechLanguages=['ar-MA','ar-SA','ar']") && tasbihController.includes('voiceFallbackPending') && tasbihController.includes('scheduleVoiceRestart') && !tasbihController.includes('voiceTranscript') && !html.includes('tasbihVoiceTranscript') && !html.includes('anwar-tasbih-transcript'), 'Arabic speech recognition counts repetitions without rendering or saving recognized text');
ok(html.includes('id="anwar-tasbih-touch-polish-v1"') && html.includes('-webkit-tap-highlight-color:transparent'), 'tasbih touch feedback suppresses the blue tap highlight while retaining keyboard focus');
ok(html.includes('id="tasbihBeads"') && html.includes('id="tasbihMinus"') && html.includes('id="tasbihTap"') && html.includes('id="tasbihReset"') && html.includes('id="anwar-tasbih-royal-layout-v1"'), 'the royal bead ring and compact decrement, increment and reset controls remain present');
ok(tasbihController.includes('function normalizeDhikrKey(value)') && tasbihController.includes('officialKeys.has(normalizeDhikrKey(optionText(option)))') && !tasbihController.includes('tasbih-dhikr-card-text'), 'tasbih entries are normalized and legacy copies/full-text repeats are not shown twice');
ok(tasbihController.includes('const progress=index/32;') && tasbihController.includes('(240-(progress*120))*Math.PI/180') && tasbihController.includes("panel.classList.toggle('tasbih-choosing-dhikr',expanded)"), 'tasbih beads are arranged as a one-sided draped strand following the sixth reference');
const ownerDialogStart=html.indexOf('<dialog id="ownerDialog">');
const ownerDialogEnd=html.indexOf('</dialog>',ownerDialogStart);
const ownerDialogHtml=html.slice(ownerDialogStart,ownerDialogEnd);
const ownerTabsStart=ownerDialogHtml.indexOf('<div class="owner-tabs">');
const ownerPanelStart=ownerDialogHtml.indexOf('<section id="ownerPanel"');
const ownerTabs=ownerDialogHtml.slice(ownerTabsStart,ownerPanelStart);
const adhkarPageStart=html.indexOf('<section id="anwarAdhkarPage"');
const tasbihPageStart=html.indexOf('<section id="anwarTasbihPage"');
const adhkarPageHtml=html.slice(adhkarPageStart,tasbihPageStart);
const tasbihPageHtml=html.slice(tasbihPageStart);
ok(ownerTabs.includes('id="ownerTab"') && ownerTabs.includes('id="shareTab"') && !ownerTabs.includes('id="adhkarTab"'), 'ownership dialog contains only ownership and publication tabs');
ok(!ownerDialogHtml.includes('id="adhkarPanel"') && !ownerDialogHtml.includes('id="tasbihPanel"'), 'adhkar and tasbih are no longer embedded in the ownership dialog');
ok(adhkarPageHtml.includes('id="adhkarPanel"') && adhkarPageHtml.includes('class="protective-page-title">أذكار التحصين</h2>') && adhkarPageHtml.includes('id="adhkarContent"') && !adhkarPageHtml.includes('morningTab') && !adhkarPageHtml.includes('eveningTab'), 'the dedicated adhkar page opens the unified protection collection without separate period tabs');
ok(tasbihPageHtml.includes('id="tasbihPanel"') && tasbihPageHtml.includes('id="tasbihCount"') && tasbihPageHtml.includes('id="tasbihVoice"') && tasbihPageHtml.includes('id="tasbihThemePicker"'), 'the dedicated tasbih page keeps the existing counter, voice and theme controls');
ok(html.includes('data-anwar-service="adhkar"') && html.includes('aria-controls="anwarAdhkarPage"') && html.includes('data-anwar-service="tasbih"') && html.includes('aria-controls="anwarTasbihPage"'), 'the home dashboard exposes separate adhkar and tasbih cards');
ok(html.includes('id="anwar-tasbih-sixth-reference-v1"') && html.includes('aspect-ratio:1 / 1!important') && html.includes('class="tasbih-reset-housing"') && html.includes('class="tasbih-inner-dhikr-frame"'), 'tasbih follows the sixth reference with a circular dhikr face and integrated reset housing');
ok(html.includes('id="tasbihCustomDhikrInput"') && html.includes('placeholder="أو اكتب ذكراً خاصاً هنا"') && html.includes('id="tasbihAddCustomDhikr"'), 'the dhikr chooser contains a simple framed manual entry field');
const dhikrChooserStart=html.indexOf('id="tasbihDhikrListPanel"');
const manualDhikrField=html.indexOf('class="tasbih-inner-dhikr-frame"',dhikrChooserStart);
const tasbihFaceStart=html.indexOf('class="anwar-tasbih-counter anwar-tasbih-sixth-face"');
ok(manualDhikrField>dhikrChooserStart && manualDhikrField<tasbihFaceStart, 'manual dhikr input is inside the expanded chooser, not the clock face');
ok((html.match(/id="tasbihPhrase"/g)||[]).length===1, 'the selected dhikr text has a single canonical DOM node');
ok(html.includes('id="tasbihMinus" class="tasbih-minus-control"') && html.includes('id="tasbihReset" class="anwar-tasbih-reset"') && html.includes('id="tasbihRemoveDhikr" class="tasbih-management-remove"'), 'the integrated reset, decrement and list-management controls remain available');
ok((html.match(/id="tasbihRemoveDhikr"/g)||[]).length===1, 'the tasbih delete action has one unique control in the dhikr manager');
ok(!html.includes('id="adhkarTab"') && !html.includes('id="adhkarTasbihToggle"'), 'obsolete ownership-tab and intermediate tasbih launcher are removed');
ok(html.includes('id="tasbihClockDial"') && html.includes('id="tasbihHourHand"') && html.includes('id="tasbihMinuteHand"') && html.includes('id="tasbihSecondHand"') && html.includes('id="tasbihElapsedTime"') && html.includes('id="anwar-tasbih-real-clock-v1"'), 'the tasbih interface retains its live analog clock and hidden session-time state');
ok(html.includes('id="anwar-tasbih-clean-analog-face-v1"') && /\.tasbih-elapsed-readout\s*\{\s*display:none!important;\s*\}/.test(html), 'the obsolete digital elapsed-time overlay is removed from the clock face');
ok(html.includes('id="anwar-tasbih-visible-clock-hands-v2"') && /\.tasbih-hour-hand\s*\{[^}]*height:25%/s.test(html) && /\.tasbih-minute-hand\s*\{[^}]*height:36%/s.test(html), 'the analog hour and minute hands are visibly sized on the clock face');
ok(/\.tasbih-count-tap\s*\{[^}]*top:50%[^}]*z-index:8/s.test(html), 'the small central count medallion sits above the hand pivot');
ok(/\.tasbih-selected-phrase\s*\{[\s\S]*?clip:rect\(0,0,0,0\)!important;/.test(html), 'the selected dhikr stays in the controller but no longer floats above the analog dial');
ok(html.includes('id="tasbihClockNumbers"') && html.includes('id="anwar-tasbih-original-clock-engine-v1"') && tasbihController.includes('function renderClockNumbers()') && tasbihController.includes('for(let i=1;i<=12;i++)'), 'the clock uses the original number-wrapper algorithm with a twelve-number HTML fallback');
ok(html.includes('id="anwar-tasbih-smooth-sweep-v1"') && /\.tasbih-clock-hand\s*\{transition:none!important\}/.test(html), 'CSS transitions are disabled so frame-by-frame hand positions do not lag');
ok(tasbihController.includes('function animateClockFrame()') && tasbihController.includes('requestClockFrame(animateClockFrame)') && tasbihController.includes('function startClockAnimation()'), 'the clock uses a continuous requestAnimationFrame loop while its panel is active');
ok(tasbihController.includes("document.addEventListener('visibilitychange'") && tasbihController.includes("window.addEventListener('pagehide'"), 'the live clock loop pauses when hidden and is cleaned up on page exit');
ok((html.match(/class="tasbih-number-wrapper" style="transform:rotate\(/g)||[]).length===12 && tasbihController.includes('function renderClockTicks()') && tasbihController.includes('i<60'), 'the classic clock contains twelve fallback numerals and builds sixty tick marks');
ok(tasbihController.includes("hourHand.setAttribute('transform','rotate('+hourDeg+' 50 50)')") && tasbihController.includes("minuteHand.setAttribute('transform','rotate('+minuteDeg+' 50 50)')") && tasbihController.includes("secondHand.setAttribute('transform','rotate('+secondDeg+' 50 50)')"), 'all three SVG hands rotate around the exact centre of the dial');
ok(html.includes('class="tasbih-clock-hands-svg"') && html.includes('viewBox="0 0 100 100"') && html.includes('id="tasbihHandCenterGradient"'), 'the hands have explicit SVG geometry and visible gold/emerald gradients');
ok(html.includes('id="anwar-tasbih-svg-hands-v1"') && html.includes('z-index:6!important') && html.includes('z-index:8!important'), 'the SVG hands remain above dial markings and below the central count medallion');
const clockDialStart=html.indexOf('<div class="tasbih-clock-dial"');
const clockDialEnd=html.indexOf('\n      </div>\n      <div class="tasbih-elapsed-readout"',clockDialStart);
ok(clockDialStart>=0 && clockDialEnd>clockDialStart && html.slice(clockDialStart,clockDialEnd).includes('id="tasbihCounterControl"'), 'the live tasbih count is centered inside the analog clock dial');
ok(tasbihController.includes('function updateClockUi(now)') && tasbihController.includes('function animateClockFrame()') && tasbihController.includes('requestClockFrame(animateClockFrame)') && tasbihController.includes('elapsedMs:currentElapsedMs()'), 'clock hands follow local time and elapsed session duration is saved through encrypted preferences');
const tasbihScript=htmlAudit.script_sources.find(src=>src.startsWith('./tasbih-controller.js?v='));
ok(!!tasbihScript && serviceWorker.includes("'./tasbih-controller.js'") && /const CACHE_NAME='anwar-shell-[0-9]{4}-[0-9]{2}-[0-9]{2}-v[0-9]+';/.test(serviceWorker), 'standalone tasbih controller is versioned and precached for offline use');
ok(htmlAudit.script_sources.some(src=>src.startsWith('./poetry-dictation.js')) && serviceWorker.includes("'./poetry-dictation.js'") && appCore.includes('window.AnwarPoetryDictation'), 'poetry dictation controller is versioned and precached for offline use');

ok(manifest.name==='مفكرة أنوار' && manifest.short_name==='مفكرة أنوار','PWA name and short_name');
ok(manifest.start_url==='/mofakira-anouar/' && manifest.scope==='/mofakira-anouar/','GitHub Pages start_url and scope');
ok(appSource.includes('rel="manifest" href="manifest.webmanifest'),'HTML references the current manifest path');
ok(appSource.includes('href="icon-192.png') && appSource.includes('sizes="192x192"'),'browser favicon uses the sharpened 192px PNG');
ok(appSource.includes('<link rel="apple-touch-icon" href="icon-192.png'),'Apple touch icon uses the sharpened 192px PNG');
ok(!appSource.includes('file_00000000670481f4ad879246afe6bae2.png'),'the oversized source icon is not loaded by the page');
ok(!manifest.icons.some(i=>String(i.src).includes('file_00000000670481f4ad879246afe6bae2.png')),'manifest excludes the oversized source icon');
ok(appSource.includes('id="bookToolPanel"') && appSource.includes('id="bookToolContent" hidden'),'book creation is compact and collapsed inside the tools panel');
ok(appSource.includes("setBookToolExpanded($('bookToolContent').hidden,true)"),'book panel toggle opens and closes correctly');
ok(html.includes('<link rel="stylesheet" href="./floating-panels.css') && html.includes('<script src="./floating-panels.js') && html.includes('defer></script>'),'floating panel styles and controller are loaded from same-origin files');
const offlineShellVersion=serviceWorker.match(/const CACHE_NAME='anwar-shell-(\d{4}-\d{2}-\d{2})-v(\d+)';/);
ok(serviceWorker.includes("'./floating-panels.js'") && serviceWorker.includes("'./floating-panels.css'") && offlineShellVersion && Number.isInteger(Number(offlineShellVersion[2])),'floating panel code and styles are included in the updated offline app shell');
ok(floatingPanels.includes('pointerdown') && floatingPanels.includes('pointermove') && floatingPanels.includes('pointercancel') && floatingPanels.includes('setPointerCapture'),'floating panels use pointer capture for reliable touch and mouse drag/resize');
ok(floatingPanels.includes('function panelKey(menu,index)') && floatingPanels.includes('raw.length>4096') && floatingPanels.includes('visualViewport'),'floating panel preferences use stable keys, bounded parsing and viewport-aware positioning');
ok(!floatingPanels.includes('innerHTML') && !floatingPanels.includes('eval(') && !floatingPanels.includes('new Function('),'floating panel UI does not use HTML injection or dynamic code execution');
ok(clickGuard.includes('.adhkar-note-dismiss') && clickGuard.includes('#adhkarContent .protective-entry-menu'), 'the click-burst guard does not block protection-page actions');
ok(appCore.includes("dialog.id='adhkarPersonalManager'") && appCore.includes('function openPersonalAdhkarManager()') && adhkarRenderer.includes("manage.textContent='إدارة الأذكار المحفوظة ('") && adhkarRenderer.includes('card.append(body);fragment.append(card)') && !adhkarRenderer.includes('protective-entry-menu'), 'saved adhkar cards remain clean while edit and delete actions live in a separate management dialog');
ok(floatingPanelsCss.includes('>.rib-pop.is-floating-panel[hidden]{display:none!important}'),'hidden tool content remains hidden when floating-panel display styles are active');

const ribbonViewportStart=html.indexOf('<style id="anwar-ribbon-viewport-safe-v2">');
const ribbonViewportEnd=html.indexOf('</style>',ribbonViewportStart);
const ribbonViewportFix=ribbonViewportStart>=0&&ribbonViewportEnd>ribbonViewportStart
 ?html.slice(ribbonViewportStart,ribbonViewportEnd):'';
ok(
 ribbonViewportFix.includes('@media (max-width:800px)') &&
 ribbonViewportFix.includes('position:fixed!important') &&
 ribbonViewportFix.includes('left:max(10px,env(safe-area-inset-left,0px))!important') &&
 ribbonViewportFix.includes('right:max(10px,env(safe-area-inset-right,0px))!important') &&
 ribbonViewportFix.includes('width:auto!important') &&
 ribbonViewportFix.includes('transform:none!important') &&
 ribbonViewportFix.includes('overflow-y:auto!important') &&
 ribbonViewportFix.includes('z-index:200000!important'),
 'all mobile editor tool panels stay inside physical viewport edges and remain scrollable'
);

ok(appSource.includes('id="ownerBtn"') && !appSource.includes('id="newBookTool"'),'ownership shortcut remains in the tools panel without the old book shortcut');
ok(!appSource.includes('<dialog id="bookDialog">'),'book creation no longer consumes a separate modal');
ok(appSource.includes('loadFontStylesheets(false)') && appSource.includes('loadFontStylesheets(true)'),'font packs are deferred until after initial render or opened on demand');
ok(appSource.includes('id="paperStyleBtn"') && appSource.includes('id="paperStylePanel"'),'paper style selector is present in the toolbar');
ok(['plain','ruled','poetry','framed'].every(style=>appSource.includes('data-paper="'+style+'"')),'all four paper layouts are available');
ok(appSource.includes("paper:['plain','ruled','poetry','framed'].includes(n.paper)"),'paper layout is stored per note');
ok(appSource.includes("paper:['plain','ruled','poetry','framed'].includes(v.paper)"),'paper layout is preserved in history snapshots');
ok(appSource.includes('#pg.paper-ruled') && appSource.includes('#pg.paper-framed') && appSource.includes('#pg.paper-poetry .v'),'paper style CSS includes ruled, framed, and split-verse layouts');
ok(appSource.includes("e.key==='Tab'") && appSource.includes("e.key==='Enter'&&!e.shiftKey"),'poetry layout supports keyboard navigation between hemistichs');
ok(appSource.includes("else if(id==='vs'&&cur)insertPoetryVerse()"),'verse button inserts structured split-hemistich rows');
ok(appSource.includes('id="paperStyleBtn"') && appSource.includes('id="paperStylePanel"'),'paper style selector is present in the toolbar');
ok(['plain','ruled','poetry','framed'].every(style=>appSource.includes('data-paper="'+style+'"')),'all four paper layouts are available');
ok(appSource.includes("paper:['plain','ruled','poetry','framed'].includes(n.paper)"),'paper layout is stored per note');
ok(appSource.includes("paper:['plain','ruled','poetry','framed'].includes(v.paper)"),'paper layout is preserved in history snapshots');
ok(appSource.includes("applyPaperClass(n.paper)"),'opening a note restores its saved paper layout');
ok(appSource.includes("e.key==='Tab'") && appSource.includes("e.key==='Enter'&&!e.shiftKey"),'poetry layout supports keyboard navigation between hemistichs');
ok(appSource.includes("else if(id==='vs'&&cur)insertPoetryVerse()"),'verse button inserts structured split-hemistich rows');
ok(appSource.includes('paper-export paper-') && appSource.includes('paper-export.paper-poetry .v{'),'selected paper layout is preserved in PDF and HTML exports');
ok(appSource.includes('grid-template-columns:max-content max-content') && appSource.includes('width:max-content'),'long poem hemistich frames expand to their text width');
ok(appSource.includes('white-space:pre;overflow-wrap:normal;word-break:normal;hyphens:none'),'long hemistichs never wrap or break inside their frame');
ok(appSource.includes('#pg.paper-poetry{overflow-x:auto'),'poetry page supports horizontal scrolling on narrow screens');
ok(appSource.includes("size:v.size,paper:v.paper||'plain'"),'restoring a previous version restores its paper layout too');

ok(appSource.includes('async function ensurePdfLibraries()'),'PDF libraries load only when PDF export is requested');
ok(appSource.includes('async function makeQR()'),'QR library loads only when QR generation is requested');
ok(!htmlAudit.script_sources.some(src=>/(html2canvas|qrcodejs|jspdf)/i.test(src)),'heavy PDF and QR libraries are not loaded by static script tags');
ok(!appSource.includes('Object.hasOwn('),'storage normalization avoids unsupported Object.hasOwn calls');
ok(appSource.includes('src="./vault-crypto.js'),'the local vault crypto helper is loaded by the notebook');
ok(appSource.includes('src="./vault-storage.js') && serviceWorker.includes("'./vault-storage.js'"),'verified IndexedDB vault storage is loaded and precached for offline use');
ok(appSource.includes('id="vaultGate"') && appSource.includes('id="vaultLockBtn"'),'password gate and manual vault lock controls are present');

ok(appSource.includes('id="anwar-toolbar-spacing-and-palette-cycle-v2"') && appSource.includes('.tb{gap:4px!important}'),'toolbar icons keep a small, consistent gap');
ok(appSource.includes("const palettes=[") && appSource.includes("button.addEventListener('click',()=>{") && appSource.includes("S.palette=palettes[(index+1+palettes.length)%palettes.length][0]"),'palette icon cycles directly through the six saved interface colors on every click');
ok(appSource.includes("#palettePanel{display:none!important}") && !appSource.includes('setPaletteOpen(open,returnFocus=false)'),'palette cycle does not open a color selection panel');
const paletteCycleStart=appCore.indexOf("(function(){\n const button=$('paletteBtn')");
const paletteCycleEnd=appCore.indexOf("})();",paletteCycleStart);
const paletteCycleCode=appCore.slice(paletteCycleStart,paletteCycleEnd);
ok(paletteCycleStart>=0 && paletteCycleCode.includes("S.palette=palettes[(index+1+palettes.length)%palettes.length][0]") && !paletteCycleCode.includes("panel.classList.toggle('open')") && appSource.includes("#palettePanel{display:none!important}"),'palette icon cycles colors directly without opening the former popup');

ok(appSource.includes('src="toolbar-back-navigation.js"'),'contextual back-navigation helper is loaded by the notebook');
ok(appSource.includes('<script src="api-gateway-config.js"></script>'),'optional API gateway configuration loads before app interaction');
ok(apiGatewayConfig.includes('ANWAR_API_GATEWAY_BASE') && apiGatewayConfig.includes('= \"\";'),'API gateway endpoint defaults to disabled until its deployed URL is configured');
ok(appSource.includes('https://*.workers.dev') && apiGatewayWorker.includes('export class IpRateLimiter'),'CSP permits the future Worker endpoint and the gateway exports its Durable Object limiter');
ok(apiGatewayWorker.includes('CF-Connecting-IP') && apiGatewayWorker.includes('idFromName("anwar-api-gateway-global-rate-limiter")') && apiGatewayWorker.includes('Retry-After'),'API gateway applies global and per-IP limits in one Durable Object call');
ok(apiGatewayWorker.includes('IP_HASH_SECRET') && apiGatewayWorker.includes('name: "HMAC"'),'IP rate-limit keys use a Cloudflare-only HMAC secret instead of storing raw IP addresses');
ok(apiGatewayWorker.includes('total: { limit: 50') && apiGatewayWorker.includes('client: { limit: 30'),'gateway stays within its daily free-tier accepted-request budget and per-IP ceiling');
ok(apiGatewayWorker.includes('SELECT data FROM rate_state WHERE id = 1') && apiGatewayWorker.includes('UPDATE rate_state SET data = ? WHERE id = 1'),'rate limiter persists all counters in one atomic SQLite row update per accepted request');
ok(apiGatewayWorker.includes('env.EDGE_LIMITER.limit') && apiGatewayWorker.includes('edgeDecision.success'),'gateway applies an edge rate check before the strict global Durable Object check');
ok(apiGatewayDeployWorkflow.includes('workflow_dispatch:') && apiGatewayDeployWorkflow.includes('cloudflare/wrangler-action@v4'),'Cloudflare Worker deployment is manual and uses the official Wrangler GitHub Action');
ok(apiGatewayDeployWorkflow.includes('CLOUDFLARE_API_TOKEN') && apiGatewayDeployWorkflow.includes('CLOUDFLARE_ACCOUNT_ID') && apiGatewayDeployWorkflow.includes('IP_HASH_SECRET'),'deployment reads Cloudflare credentials and HMAC key only from repository secrets');

ok(apiGatewayWorker.includes('ALLOWED_COUNTRY_CODES') && !apiGatewayWorker.includes('searchParams.get("url")'),'API gateway restricts country parameters and does not expose an open URL proxy');
ok(!apiGatewayWorker.includes('TRANSCRIPTION_MODEL') && !apiGatewayWorker.includes('/v1/transcribe') && !apiGatewayWorker.includes('env.AI.run') && !apiGatewayWrangler.includes('[ai]'),'API gateway no longer exposes an audio transcription route or binds Workers AI');
ok(!apiGatewayWorker.includes('transcribe-global') && !apiGatewayWorker.includes('RATE_POLICIES.transcribe') && !apiGatewayReadme.includes('/v1/youtube-transcript'),'retired audio/YouTube transcription routes and their dedicated quotas are absent from the active gateway');
ok(apiGatewayWorker.includes('!allowedOrigins.includes(origin)') && apiGatewayWorker.includes('ALLOWED_ORIGINS'),'API gateway reflects CORS only for exact configured production origins');

ok(appSource.includes('<script src="click-guard.js" defer></script>'),'click-burst guard is loaded as a same-origin deferred script');
ok(fs.readFileSync(path.join(root,'service-worker.js'),'utf8').includes("'./click-guard.js'"),'service worker precaches the click-burst guard for offline use');
ok(clickGuard.includes("doc.addEventListener('click',handleClick,true)") && clickGuard.includes('MAX_CLICKS=10') && clickGuard.includes('WINDOW_MS=2000') && clickGuard.includes('COOLDOWN_MS=5000'),'click guard enforces the 10-click rolling-window limit and five-second cooldown');
try{new vm.Script(clickGuard,{filename:'click-guard.js'});ok(true,'click-burst guard JavaScript syntax is valid')}catch(error){failures.push('click-guard.js: '+error.message)}


ok(appSource.includes('id="anwar-wordmark-legibility-v1"') && appSource.includes("font-family:'Cairo',Tahoma,sans-serif!important") && appSource.includes('font-weight:700!important'),'brand wordmark uses a clear bold Arabic sans-serif face');
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
ok(appSource.includes('id="bkp"') && appSource.includes('aria-controls="dg"') && appSource.includes('class="b bkp-tool"') && appSource.includes('نسخة مشفرة') && appSource.includes("else if(id==='bkp'){openEncryptedBackupDialog()}"),'in-content encrypted backup button keeps its label, dialog target and existing click action');
const iconPolishStart=html.indexOf('<style id="toolbar-icon-polish-v1">');
const iconPolishEnd=html.indexOf('</style>',iconPolishStart);
const iconPolish=html.slice(iconPolishStart,iconPolishEnd);
ok(iconPolish.includes('.tb #vaultLockBtn') && !iconPolish.includes('#bkp'),'top toolbar icon polish includes the lock and excludes the relocated backup control');
ok(appSource.includes('#rib .bkp-tool svg') && appSource.includes('#rib .bkp-tool:focus-visible'),'relocated backup control has a consistent in-panel icon and keyboard focus treatment');
const accessibleControlIds=['prn','pdf','vs','sp','fo','ip','pn','cy','hist','dl'];
ok(accessibleControlIds.every(id=>htmlAudit.elements.some(element=>element.attrs.id===id&&(element.attrs['aria-label']||element.attrs.title))),'editor action icons have readable accessible names or titles');
ok(toolbarBackNavigation.includes("paletteButton.setAttribute('aria-expanded'") && toolbarBackNavigation.includes("radioButton.setAttribute('aria-pressed'") && toolbarBackNavigation.includes('إيقاف إذاعة القرآن مؤقتًا'),'toolbar controls keep palette and Quran playback states accessible');

try{new vm.Script(toolbarBackNavigation,{filename:'toolbar-back-navigation.js'});ok(true,'contextual back-navigation helper JavaScript syntax is valid')}catch(error){failures.push('toolbar-back-navigation.js: '+error.message)}
ok(appSource.includes('const VAULT_IDLE_LOCK_MS=0;') && appSource.includes('document.addEventListener(eventName,recordVaultActivity,true)'),'free-use mode disables automatic inactivity locking while retaining the manual-lock activity hooks');
ok(appSource.includes("VAULT_MODE_KEY='anwar_vault_mode_v1'") && appSource.includes("if(mode==='encrypted'&&savedVault===null&&savedBackup===null)"),'vault startup respects the saved free/encrypted mode and never bypasses a missing encrypted vault');
ok(appSource.includes("if(!vaultKey||!vaultTemplate){") && appSource.includes("showVaultGate('setup'"),'manual lock from free mode opens the optional encryption setup');
ok(appSource.includes('function persistPlainSnapshot(plaintext)') && appSource.includes("localStorage.setItem(VAULT_MODE_KEY,'plain')") && appSource.includes("localStorage.setItem(VAULT_MODE_KEY,'encrypted')"),'free and encrypted modes are explicitly persisted after verified storage writes');
ok(appSource.includes('flushPrivatePreferenceSave();') && appSource.includes("if(typeof flushPendingEdit==='function')flushPendingEdit(false);") && appSource.includes('await vaultSaveQueue;') && appSource.includes("showVaultGate('setup'"),'manual encryption setup flushes pending edits and waits for the save queue before closing free mode');
ok(/async function cancelVaultSetup\(\)[\s\S]*?await persistPlainSnapshot\(JSON\.stringify\(S\)\)/.test(appSource),'continuing without encryption verifies and persists the plaintext snapshot before reopening');
const workerSource=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
const workerCacheName=workerSource.match(/const CACHE_NAME='(anwar-shell-\d{4}-\d{2}-\d{2}-v\d+)';/);
ok(!!workerCacheName && Number(workerCacheName[1].split('-v').pop())>=1,'service worker uses a dated, monotonically versioned app-shell cache key');
ok(appSource.includes('id="vaultCancelSetupBtn"') && appSource.includes('id="vaultDisableEncryptionBtn"'),'the gate offers continue-free and disable-encryption actions');
ok(appSource.includes('AnwarPrivatePreferences.normalize(d.preferences)') && appSource.includes('preferences:globalThis.AnwarPrivatePreferences.normalize({})'),'radio, reader and tasbih preferences are part of the encrypted vault state');
ok(appSource.includes('function importLegacyPrivatePreferences(base)') && appSource.includes('function clearLegacyPrivatePreferences()'),'legacy plaintext preferences have explicit migration and cleanup paths');
ok(!appSource.includes("localStorage.setItem('anwar_reader_advance'") && !appSource.includes("localStorage.setItem(countKey") && !appSource.includes("localStorage.setItem(dhikrKey"),'active reader and tasbih controls do not write plaintext preferences');
ok(appSource.includes("AnwarPrivatePreferences.set('readerAdvance'") && appSource.includes("AnwarPrivatePreferences.set('radio'") && tasbihController.includes("preferences.set('tasbih'"),'radio, reader and standalone tasbih changes are routed into encrypted preference state');
ok(/if\(savedVault!==null\|\|savedBackup!==null\)/.test(appSource),'startup can unlock from an encrypted backup when the primary vault is missing');
ok(/function save\(\)\s*\{[\s\S]*?persistVaultSnapshot\(snapshot\)/.test(appSource) && /async function persistVaultSnapshot\(plaintext\)\s*\{[\s\S]*?AnwarVaultCrypto\.encryptWithKey/.test(appSource),'notebook saves queue snapshots through encrypted vault persistence');
ok(appSource.includes('snapshot.notes.length>2500') && appSource.includes('snapshot.notes.some(noteContentTooLarge)') && appSource.includes('parsed.notes.some(noteContentTooLarge)') && appSource.includes('function noteContentTooLarge(note)'),'startup restore and encrypted saves share the same safe legacy-note size guard');
ok(appSource.includes("if(S.notes.length>=2500){toast("),'the UI blocks creation beyond the restore-supported 2500-note limit');
ok(vaultCrypto.includes("CIPHER='AES-256-GCM'") && vaultCrypto.includes("ITERATIONS=600000"),'vault helper pins AES-GCM and the approved PBKDF2 work factor');
ok(appSource.includes('vault-device-unlock.js') && appSource.includes('id="vaultDeviceUnlock"') && appSource.includes('id="vaultDeviceSetupDialog"'),'platform-authenticator quick unlock is wired into the encrypted vault gate');
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

const duplicateIds=htmlAudit.ids.filter((id,i)=>htmlAudit.ids.indexOf(id)!==i);
ok(duplicateIds.length===0,'HTML IDs are unique');

const inlineScripts=htmlAudit.inline_scripts;
const scriptCount=inlineScripts.length;
for(let i=0;i<inlineScripts.length;i++){
  try{new vm.Script(inlineScripts[i],{filename:`inline-script-${i+1}.js`})}
  catch(error){failures.push(`inline script ${i+1}: ${error.message}`)}
}
ok(scriptCount===0,'application HTML contains no inline JavaScript');
try{new vm.Script(appCore,{filename:'app-core.js'});ok(true,'extracted application bundle syntax is valid')}catch(error){failures.push('app-core.js: '+error.message+' '+String(error.stack||'').split('\\n').slice(0,3).join(' '))}
ok(appCore.includes('const LIST_PAGE_SIZE=50;') && appCore.includes('listRenderLimit+=LIST_PAGE_SIZE') && appCore.includes('archiveRenderLimit+=LIST_PAGE_SIZE'),'main list and archive use progressive 50-item rendering');
ok(iconGenerator.includes("ImageFilter.UnsharpMask") && iconGenerator.includes("radius=0.7, percent=125, threshold=2"),'192px launcher icon receives a controlled sharpening pass after downsampling');
ok(appSource.includes("icon-192.png") && appSource.includes("type:'image/png'"),'media artwork uses the crisp PNG icon instead of the compressed JPEG');
ok(appSource.includes("function scheduleRadioWarmup()") && appSource.includes("scheduleRadioWarmup();\n   if(!reciterUiReady)") && !appSource.includes(" scheduleRadioWarmup();\n rb.addEventListener"),'radio metadata warmup starts only after the visitor opens the radio panel');
ok(appSource.includes("setTimeout(()=>renderList(true),90)") && appSource.includes("setTimeout(()=>renderArchive(true),120)"),'note and archive searches are lightly debounced to reduce repeated rendering');
ok(appSource.includes("const matching=q?candidates.filter(n=>") && appSource.includes("matching.slice(0,listRenderLimit)"),'main note search uses bounded list rendering and only extracts text when searching');ok(appSource.includes("function openSafeBlobTab(url){") && appSource.includes("try{opened.opener=null}catch(error){}") && !appSource.includes("window.open(url,'_blank','noopener')"),'blob documents use a safe popup flow without a null-return false negative');
const socialFunction=fs.readFileSync(path.join(root,'functions/index.js'),'utf8');
ok(socialFunction.includes(".on('meta[property=\"og:title\"]'") && socialFunction.includes('head.onEndTag(endTag =>') && socialFunction.includes('endTag.before(SOCIAL_META, { html: true })'),'Cloudflare social metadata is injected only when a page has no Open Graph title');
const qualityWorkflow=fs.readFileSync(path.join(root,'.github/workflows/quality.yml'),'utf8');
ok(qualityWorkflow.includes('wrangler@4.164.0') && !qualityWorkflow.includes('wrangler@latest'),'quality dry-run pins the Wrangler version used by deployment');
ok(appSource.includes("content-visibility:auto;contain-intrinsic-size:auto 76px"),'off-screen note cards skip unnecessary painting');
const appCorePreload=htmlAudit.preload_scripts.find(href=>href.includes('app-core.js?v='));
const appCoreScript=htmlAudit.script_sources.find(src=>src.includes('app-core.js?v='));
ok(!!appCorePreload && !!appCoreScript && appCorePreload===appCoreScript && appCore.length>200000,'main application bundle is externally loaded and preload/script cache versions match');
ok(!html.includes('id="transcriptTool"') && !html.includes('id="transcriptAudioFile"') && !html.includes('id="transcriptGenerate"') && !html.includes('anwar-transcript-editor-v1') && !appCore.includes('async function transcribeAudioFile()') && !appCore.includes('function parseCaptionFile') && !appCore.includes('function formatTranscriptText'),'the audio-to-text panel, caption importer and transcript editor have been removed from the active notebook');
ok(appCore.includes('function transcriptWordTableXml') && appCore.includes('note.transcriptRows'),'legacy transcript tables remain exportable from previously saved notes');
ok(html.includes('id="tasbihVoice"') && !html.includes('id="tasbihVoiceTranscript"') && !html.includes('anwar-tasbih-transcript') && html.includes('id="sp"') && appCore.includes("else if(id==='sp')togglePoetryDictation()") && appCore.includes('function appendPoetryDictationText'), 'tasbih voice counting has no transcript UI and poetry dictation remains separate');
ok(appSource.includes("backdrop-filter:none;-webkit-backdrop-filter:none"),'vault startup overlay avoids an expensive full-screen blur');


try{new vm.Script(prayerTimes,{filename:'prayer-times.js'});ok(true,'prayer-times controller JavaScript syntax is valid')}catch(error){failures.push('prayer-times.js: '+error.message)}
ok(html.includes('id="anwarServiceHome"') && ['adhan','quran','radio','lessons'].every(service=>html.includes('data-anwar-service="'+service+'"')) && html.includes('id="anwarQuranPage"') && html.includes('id="anwarRadioPage"') && html.includes('id="anwarLessonsPage"'),'service dashboard exposes separate prayer, Quran, live radio and lesson sections');
ok(prayerTimes.includes("document.getElementById('anwarPrayerMount')") && prayerTimes.includes('prayerMount.append(card)'),'prayer times retain their original card and mount it in the dashboard home');
ok(appCore.includes('Anwar service dashboard') && appCore.includes('function returnToServiceHome()') && appCore.includes('function handleServicePopState(event)') && appCore.includes('SERVICE_HISTORY_KEY') && appCore.includes("button.dataset.anwarService"),'service dashboard keeps a hierarchical in-app and browser history for religious sections');
ok(toolbarBackNavigation.includes("document.querySelector('#rd .anwar-service-page:not([hidden])')") && toolbarBackNavigation.includes('cancelEdit.click()') && toolbarBackNavigation.includes("servicePage.querySelector('[data-anwar-service-back]')") && toolbarBackNavigation.includes("byId('liveStationModal')") && toolbarBackNavigation.includes('prayerSettings.open = false'),'toolbar back unwinds nested religious controls before leaving the service dashboard');
ok(html.includes('class="morocco-flag-icon"') && (html.match(/class="morocco-flag-icon"/g)||[]).length===2 && !html.includes('owner-pen-icon') && html.includes('fill="#c1272d"') && html.includes('stroke="#006233"'),'the ownership shortcut and panel use the Moroccan flag disk');
const ownerStyleStart=html.lastIndexOf('/* قرص الملكية المغربي: العلم نفسه هو الأيقونة');
const ownerStyleEnd=html.indexOf('</style>',ownerStyleStart);
const ownerFinalCss=html.slice(ownerStyleStart,ownerStyleEnd);
ok(ownerStyleStart>=0 && ownerFinalCss.includes('padding:0!important') && ownerFinalCss.includes('border:0!important') && ownerFinalCss.includes('background:transparent!important') && ownerFinalCss.includes('width:34px!important;height:34px!important') && ownerFinalCss.includes('transform:none!important') && !ownerFinalCss.includes('rotate('),'the last ownership CSS rule removes the extra blue circle and keeps the flag centered at full size');
ok(html.includes('class="protective-page-title">أذكار التحصين</h2>') && !html.includes('id="morningTab"') && !html.includes('id="eveningTab"') && !html.includes('id="protectionTab"'),'the adhkar screen is a single unified protection page without duplicate period tabs');
ok(appCore.includes("window.AnwarRenderAdhkar('protection')") && appCore.includes('window.AnwarRenderAdhkar=function(){return renderProtectiveAdhkar();}') && appCore.includes('schedulePoetryDictationAdvance()'),'the adhkar card opens the personal editor and poetry dictation has timed hemistich navigation');
ok(html.includes('id="reciterGrid"') && html.includes('id="surahPickerButton"') && html.includes('id="liveRadioPlay"') && html.includes('id="lessonHub"') && html.includes('id="lessonPlay"'),'original Quran reader, live-radio and lesson playback controls remain present');
 ok(appCore.includes('let reciterDisplayLimit=72,reciterUiReady=false;') && appCore.includes("$('rq').addEventListener('input',()=>{reciterDisplayLimit=72;fill()})") && appCore.includes("$('reciterMore').addEventListener('click',()=>{reciterDisplayLimit+=36;fill()})"),'Quran reciter catalog initially renders 72 entries like the reference and expands by 36 entries on demand');
ok(html.includes('id="rb" class="radio-toolbar-toggle"') && html.includes('<svg class="radio-toolbar-icon"') && appCore.includes("rb.setAttribute('aria-pressed',String(on))") && !appCore.includes('rb.textContent='),'home radio toggle keeps its inline radio icon and updates playback state without replacing the SVG');
ok(html.includes('.reciter-play::before,#lessonPlay::before') && !html.includes('.reciter-play::before::before') && !html.includes('.reciter-play[data-playing="true"]::before[data-playing="true"]::before') && appCore.includes('pp.dataset.playing=String(on)'),'reciter and central Quran playback icons use valid selectors and reflect the playing state');


ok(appCore.includes("sectionTitles.find(title=>title.textContent.includes('القرآن الكريم'))") && appCore.includes("sectionTitles.find(title=>title.textContent.includes('الإذاعات المباشرة'))"),'radio and Quran headings are selected by their own labels rather than DOM order');
ok(html.includes('id="liveRadioStatus"') && /id="liveStationPicker"[^>]*aria-haspopup="dialog"/.test(html) && appCore.includes("const stationModal=$('liveStationModal')") && /<select id="rl"[^>]*hidden/.test(html) && html.includes('تشغيل المحطة المختارة'),'live-radio page exposes the custom accessible tulip-card station picker and playback status');
ok(appCore.includes('const stations=[],seen=new Set()') && appCore.includes('stations.push({name:') && appCore.includes('select.replaceChildren(fragment)') && appCore.includes("safeHttpsURL(item&&item.url)") && appCore.includes('if(select.value)return Promise.resolve(select.options.length)'),'live-radio catalogue preserves every unique safe station and does not mistake its placeholder for loaded data');
ok(appCore.includes("activePlaybackKind==='live'&&!au.paused") && appCore.includes('إيقاف البث مؤقتًا') && appCore.includes('متابعة البث'),'live-radio selection, pause and resume are handled without interrupting Quran-reader state');
ok(!html.includes('id="anwarCountryReaders"') && !html.includes('id="reciterCountry"') && !html.includes('id="reciterCountryModal"') && !html.includes('id="countryRandomPlay"') && !appCore.includes('countryDirectory') && !appCore.includes('countrySelect'),'the Quran section no longer contains the redundant country directory, modal, selector or random-reciter path');


ok(prayerTimes.includes("launcher.setAttribute('aria-expanded',String(details.open))") && appCore.includes("button.setAttribute('aria-expanded',String(Boolean(settings&&settings.open)))"),'Adhan tile exposes the expanded state of its actual settings disclosure');

const deployWorkflow=fs.readFileSync(path.join(root,'.github/workflows/deploy-cloudflare-pages.yml'),'utf8');
const securityHeaders=fs.readFileSync(path.join(root,'_headers'),'utf8');
ok(deployWorkflow.includes('cp _headers dist/_headers'),'Cloudflare Pages receives _headers at the deployment output root');
ok(deployWorkflow.includes('test -s dist/_headers') && deployWorkflow.includes("grep -q \"frame-ancestors 'none'\" dist/_headers"),'deployment fails closed if the root security header file is missing or incomplete');
ok(!deployWorkflow.includes('cp _headers dist/mofakira-anouar/_headers'),'security headers are not misplaced inside the nested PWA directory');
ok(deployWorkflow.includes('workflow_run:') && deployWorkflow.includes('Quality checks') && deployWorkflow.includes("github.event.workflow_run.conclusion == 'success'"),'automatic Cloudflare production deployment waits for a successful Quality checks run');
ok(deployWorkflow.includes('github.event.workflow_run.head_sha'),'Cloudflare deployment checks out the exact commit that CI validated');

ok(securityHeaders.includes("frame-ancestors 'none'") && securityHeaders.includes('X-Frame-Options: DENY'),'HTTP headers prevent cross-origin framing');
ok(securityHeaders.includes('X-Content-Type-Options: nosniff') && securityHeaders.includes('Referrer-Policy: strict-origin-when-cross-origin'),'HTTP headers set MIME-sniffing and referrer protections');
ok(securityHeaders.includes('Permissions-Policy: camera=(), geolocation=(), microphone=(self)'),'HTTP Permissions-Policy disables unused camera and location access');
ok(securityHeaders.includes("Content-Security-Policy:") && securityHeaders.includes("script-src 'self' https://cdnjs.cloudflare.com") && securityHeaders.includes('upgrade-insecure-requests'),'HTTP CSP response header is present and retains the secure resource policy; exact inline hashes are checked by test-csp.mjs');

if(failures.length){
  console.error('\nValidation failed:');
  for(const failure of failures)console.error('-',failure);
  process.exitCode=1;
}else console.log('All repository static checks passed.');
