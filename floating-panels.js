/* Accessible floating panels for the Anwar writing toolbar. */
(function(root){
 'use strict';

 const STORAGE_KEY='anwar_floating_panels_v1';
 const EDGE=8,MIN_WIDTH=220,MIN_HEIGHT=150,MAX_STORED_COORD=10000;
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 const number=(value,fallback)=>Number.isFinite(value)?value:fallback;

 function clampRect(rect,viewport,edge=EDGE){
  const left=number(viewport.left,0),top=number(viewport.top,0);
  const widthAvailable=Math.max(1,number(viewport.width,1)-edge*2);
  const heightAvailable=Math.max(1,number(viewport.height,1)-edge*2);
  const minWidth=Math.min(MIN_WIDTH,widthAvailable);
  const minHeight=Math.min(MIN_HEIGHT,heightAvailable);
  const width=clamp(number(rect.width,Math.min(460,widthAvailable)),minWidth,widthAvailable);
  const height=clamp(number(rect.height,Math.min(340,heightAvailable)),minHeight,heightAvailable);
  return {
   left:clamp(number(rect.left,left+(number(viewport.width,1)-width)/2),left+edge,left+number(viewport.width,1)-width-edge),
   top:clamp(number(rect.top,top+(number(viewport.height,1)-height)/2),top+edge,top+number(viewport.height,1)-height-edge),
   width,height
  };
 }

 function intersectViewport(workspace,screen){
  if(!workspace||!screen||!Number.isFinite(workspace.left)||!Number.isFinite(workspace.top)||
   !Number.isFinite(workspace.right)||!Number.isFinite(workspace.bottom))return screen;
  const left=Math.max(screen.left,workspace.left);
  const top=Math.max(screen.top,workspace.top);
  const right=Math.min(screen.left+screen.width,workspace.right);
  const bottom=Math.min(screen.top+screen.height,workspace.bottom);
  if(right-left<Math.min(MIN_WIDTH+EDGE*2,screen.width)||bottom-top<Math.min(MIN_HEIGHT+EDGE*2,screen.height))return screen;
  return {left,top,width:right-left,height:bottom-top};
 }

 function normalizeSavedLayout(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const keys=['x','y','width','height'];
  if(!keys.every(key=>Number.isFinite(value[key])))return null;
  return {
   x:clamp(value.x,-MAX_STORED_COORD,MAX_STORED_COORD),
   y:clamp(value.y,-MAX_STORED_COORD,MAX_STORED_COORD),
   width:clamp(value.width,MIN_WIDTH,1200),
   height:clamp(value.height,MIN_HEIGHT,1200)
  };
 }

 root.AnwarFloatingPanelMath=Object.freeze({clampRect,normalizeSavedLayout,intersectViewport});
 const doc=root.document;
 if(!doc||!doc.getElementById)return;

 const rib=doc.getElementById('rib');
 if(!rib)return;
 const menus=Array.from(rib.querySelectorAll('.rib-menu'));
 if(!menus.length)return;
 const panelByMenu=new WeakMap();
 let floatingLayer=null;
 function getFloatingLayer(){
  if(floatingLayer&&floatingLayer.isConnected)return floatingLayer;
  floatingLayer=doc.createElement('div');
  floatingLayer.id='anwar-floating-panels-layer';
  floatingLayer.setAttribute('aria-label','النوافذ العائمة لأدوات المفكرة');
  (doc.body||doc.documentElement).append(floatingLayer);
  return floatingLayer;
 }
 function getPanel(menu){
  return panelByMenu.get(menu)||menu.querySelector(':scope > .rib-pop');
 }
 function panelKey(menu,index){
  const summary=menu.querySelector(':scope > summary');
  return menu.id||summary?.getAttribute('aria-label')||String(index);
 }
 const requestFrame=typeof root.requestAnimationFrame==='function'
  ?root.requestAnimationFrame.bind(root)
  :callback=>root.setTimeout(callback,16);
 const normalRects=new WeakMap();
 let layouts=readLayouts();

 function viewport(){
  /* Keep floating tools inside the writing surface, not across the page. */
  const vv=root.visualViewport;
  const screen={left:vv&&Number.isFinite(vv.offsetLeft)?vv.offsetLeft:0,
   top:vv&&Number.isFinite(vv.offsetTop)?vv.offsetTop:0,
   width:vv&&Number.isFinite(vv.width)&&vv.width>0?vv.width:(doc.documentElement.clientWidth||root.innerWidth||1),
   height:vv&&Number.isFinite(vv.height)&&vv.height>0?vv.height:(doc.documentElement.clientHeight||root.innerHeight||1)};
  const area=doc.getElementById('area');
  const rect=area&&area.getBoundingClientRect();
  if(!rect||rect.width<=0||rect.height<=0)return screen;
  /* Intersect the writing workspace with the actually visible mobile viewport. */
  return intersectViewport({
   left:rect.left+(area.clientLeft||0),top:rect.top+(area.clientTop||0),
   right:rect.right-(area.clientLeft||0),bottom:rect.bottom-(area.clientTop||0)
  },screen);
 }

 function readLayouts(){
  try{
   const raw=root.localStorage&&root.localStorage.getItem(STORAGE_KEY);
   if(!raw||raw.length>4096)return Object.create(null);
   const parsed=JSON.parse(raw);
   if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return Object.create(null);
   const result=Object.create(null);
   for(let index=0;index<menus.length;index++){
    const key=panelKey(menus[index],index);
   const item=normalizeSavedLayout(parsed[String(key)]);
    if(item)result[String(key)]=item;
   }
   return result;
  }catch(_error){return Object.create(null)}
 }

 function writeLayouts(){
  try{
   if(root.localStorage)root.localStorage.setItem(STORAGE_KEY,JSON.stringify(layouts));
  }catch(_error){}
 }

 function measure(panel){
  const rect=panel.getBoundingClientRect();
  return {left:rect.left,top:rect.top,width:rect.width,height:rect.height};
 }

 function applyRect(panel,rect){
  const bounded=clampRect(rect,viewport());
  panel.style.setProperty('--anwar-fp-left',Math.round(bounded.left)+'px');
  panel.style.setProperty('--anwar-fp-top',Math.round(bounded.top)+'px');
  panel.style.setProperty('--anwar-fp-width',Math.round(bounded.width)+'px');
  panel.style.setProperty('--anwar-fp-height',Math.round(bounded.height)+'px');
  panel.classList.add('is-floating-panel');
  return bounded;
 }

 function saveLayout(panel,key,rect){
  const current=rect||measure(panel);
  const vv=viewport();
  layouts[String(key)]={
   x:Math.round(current.left-vv.left),
   y:Math.round(current.top-vv.top),
   width:Math.round(current.width),
   height:Math.round(current.height)
  };
  writeLayouts();
 }

 function savedRect(key){
  const item=layouts[String(key)];
  if(!item)return null;
  const vv=viewport();
  return clampRect({
   left:vv.left+item.x,top:vv.top+item.y,width:item.width,height:item.height
  },vv);
 }

 function defaultRect(panel,reset=false){
  const vv=viewport(),measured=measure(panel);
  const width=reset?Math.min(340,vv.width-EDGE*2):Math.min(Math.max(measured.width,Math.min(280,vv.width-EDGE*2)),vv.width-EDGE*2,540);
  const height=reset?Math.min(280,vv.height*0.52,vv.height-EDGE*2):Math.min(Math.max(measured.height,Math.min(220,vv.height*0.46)),vv.height-EDGE*2,Math.min(380,vv.height*0.72));
  return clampRect({
   left:vv.left+(vv.width-width)/2,
   top:vv.top+(vv.height-height)/2,
   width,height
  },vv);
 }

 function makeButton(label,title,className,handler){
  const button=doc.createElement('button');
  button.type='button';
  button.className=className;
  button.textContent=label;
  button.title=title;
  button.setAttribute('aria-label',title);
  button.addEventListener('click',event=>{
   event.preventDefault();event.stopPropagation();handler();
  });
  return button;
 }

 function setButtonState(panel){
  const minButton=panel.querySelector('.fp-minimize');
  const maxButton=panel.querySelector('.fp-maximize');
  const minimized=panel.classList.contains('is-minimized');
  const maximized=panel.classList.contains('is-maximized');
  if(minButton){
   minButton.textContent=minimized?'▢':'−';
   minButton.title=minimized?'استعادة الإطار':'تصغير الإطار';
   minButton.setAttribute('aria-label',minButton.title);
   minButton.setAttribute('aria-pressed',String(minimized));
  }
  if(maxButton){
   maxButton.textContent=maximized?'❐':'□';
   maxButton.title=maximized?'استعادة الحجم السابق':'توسيع الإطار';
   maxButton.setAttribute('aria-label',maxButton.title);
   maxButton.setAttribute('aria-pressed',String(maximized));
  }
 }

 function restoreNormal(panel,key){
  const rect=normalRects.get(panel)||savedRect(key)||defaultRect(panel);
  panel.classList.remove('is-minimized','is-maximized');
  normalRects.delete(panel);
  applyRect(panel,rect);
  setButtonState(panel);
  return rect;
 }

 function minimize(panel,key){
  if(panel.classList.contains('is-minimized')){
   const rect=restoreNormal(panel,key);
   saveLayout(panel,key,rect);
   return;
  }
  if(panel.classList.contains('is-maximized'))restoreNormal(panel,key);
  normalRects.set(panel,measure(panel));
  panel.classList.add('is-minimized');
  panel.style.setProperty('--anwar-fp-min-height','54px');
  panel.style.setProperty('--anwar-fp-height','54px');
  setButtonState(panel);
 }

 function maximize(panel,key){
  if(panel.classList.contains('is-maximized')){
   const rect=restoreNormal(panel,key);
   saveLayout(panel,key,rect);
   return;
  }
  if(panel.classList.contains('is-minimized'))restoreNormal(panel,key);
  normalRects.set(panel,measure(panel));
  const vv=viewport();
  panel.classList.add('is-maximized');
  applyRect(panel,{
   left:vv.left+EDGE,top:vv.top+EDGE,
   width:vv.width-EDGE*2,height:vv.height-EDGE*2
  });
  setButtonState(panel);
 }

 function resetPanel(panel,key){
  panel.classList.remove('is-minimized','is-maximized');
  normalRects.delete(panel);
  const rect=defaultRect(panel,true);
  applyRect(panel,rect);
  setButtonState(panel);
  saveLayout(panel,key,rect);
 }

 function addKeyboardMove(bar,panel,key){
  bar.addEventListener('keydown',event=>{
   if(event.target!==bar)return;
   const deltas={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
   const direction=deltas[event.key];
   if(!direction)return;
   event.preventDefault();
   const current=measure(panel),step=event.shiftKey?40:16;
   const rect=applyRect(panel,{
    ...current,left:current.left+direction[0]*step,top:current.top+direction[1]*step
   });
   saveLayout(panel,key,rect);
  });
 }

 function attachDrag(bar,panel,key){
  let drag=null;
  bar.addEventListener('pointerdown',event=>{
   if(event.target.closest('button')||event.button!==0||!event.isPrimary)return;
   drag={pointerId:event.pointerId,x:event.clientX,y:event.clientY,rect:measure(panel)};
   try{bar.setPointerCapture(event.pointerId)}catch(_error){}
   event.preventDefault();
  });
  bar.addEventListener('pointermove',event=>{
   if(!drag||event.pointerId!==drag.pointerId)return;
   applyRect(panel,{
    ...drag.rect,
    left:drag.rect.left+event.clientX-drag.x,
    top:drag.rect.top+event.clientY-drag.y
   });
   event.preventDefault();
  });
  const finish=event=>{
   if(!drag||(event&&event.pointerId!==drag.pointerId))return;
   const rect=applyRect(panel,measure(panel));
   drag=null;
   saveLayout(panel,key,rect);
  };
  bar.addEventListener('pointerup',finish);
  bar.addEventListener('pointercancel',finish);
  bar.addEventListener('lostpointercapture',finish);
  addKeyboardMove(bar,panel,key);
 }

 function attachResize(handle,panel,key){
  let resize=null;
  handle.addEventListener('pointerdown',event=>{
   if(event.button!==0||!event.isPrimary)return;
   resize={pointerId:event.pointerId,x:event.clientX,y:event.clientY,rect:measure(panel)};
   try{handle.setPointerCapture(event.pointerId)}catch(_error){}
   event.preventDefault();event.stopPropagation();
  });
  handle.addEventListener('pointermove',event=>{
   if(!resize||event.pointerId!==resize.pointerId)return;
   const vv=viewport();
   const maxWidth=Math.max(Math.min(MIN_WIDTH,vv.width-EDGE*2),vv.width-EDGE*2);
   const maxHeight=Math.max(Math.min(MIN_HEIGHT,vv.height-EDGE*2),vv.height-EDGE*2);
   const rect=applyRect(panel,{
    ...resize.rect,
    width:clamp(resize.rect.width+event.clientX-resize.x,Math.min(MIN_WIDTH,vv.width-EDGE*2),maxWidth),
    height:clamp(resize.rect.height+event.clientY-resize.y,Math.min(MIN_HEIGHT,vv.height-EDGE*2),maxHeight)
   });
   event.preventDefault();event.stopPropagation();
   panel._anwarCurrentResizeRect=rect;
  });
  const finish=event=>{
   if(!resize||event&&event.pointerId!==resize.pointerId)return;
   const rect=applyRect(panel,panel._anwarCurrentResizeRect||measure(panel));
   delete panel._anwarCurrentResizeRect;
   resize=null;
   saveLayout(panel,key,rect);
  };
  handle.addEventListener('pointerup',finish);
  handle.addEventListener('pointercancel',finish);
  handle.addEventListener('lostpointercapture',finish);
  handle.addEventListener('keydown',event=>{
   const steps={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
   const direction=steps[event.key];
   if(!direction)return;
   event.preventDefault();
   const current=measure(panel),step=event.shiftKey?40:16,vv=viewport();
   const rect=applyRect(panel,{
    ...current,
    width:clamp(current.width+direction[0]*step,Math.min(MIN_WIDTH,vv.width-EDGE*2),vv.width-EDGE*2),
    height:clamp(current.height+direction[1]*step,Math.min(MIN_HEIGHT,vv.height-EDGE*2),vv.height-EDGE*2)
   });
   saveLayout(panel,key,rect);
  });
 }

 function ensurePanelUI(menu,panel,key){
  if(panel.dataset.floatPanelReady==='true')return;
  const summary=menu.querySelector(':scope > summary');
  const title=(summary&&(summary.getAttribute('aria-label')||summary.textContent.trim()))||'أدوات المفكرة';

  const head=doc.createElement('div');
  head.className='float-panel-head';

  const drag=doc.createElement('div');
  drag.className='float-panel-drag';
  drag.tabIndex=0;
  drag.setAttribute('role','group');
  drag.setAttribute('aria-roledescription','مقبض تحريك');
  drag.setAttribute('aria-label','مقبض تحريك '+title+'؛ اسحب أو استخدم الأسهم');
  drag.setAttribute('aria-keyshortcuts','ArrowLeft ArrowRight ArrowUp ArrowDown');
  const grip=doc.createElement('span');
  grip.className='float-panel-grip';
  grip.setAttribute('aria-hidden','true');
  grip.textContent='⋮⋮';
  const heading=doc.createElement('strong');
  heading.className='float-panel-title';
  heading.textContent=title;
  drag.append(grip,heading);

  const actions=doc.createElement('span');
  actions.className='float-panel-actions';
  const minimizeButton=makeButton('−','تصغير الإطار','fp-minimize',()=>minimize(panel,key));
  const maximizeButton=makeButton('□','توسيع الإطار','fp-maximize',()=>maximize(panel,key));
  const resetButton=makeButton('↺','إعادة الموضع والحجم الافتراضيين','fp-reset',()=>resetPanel(panel,key));
  const closeButton=makeButton('×','إغلاق اللوحة','fp-close',()=>{
   menu.open=false;
   if(summary)summary.focus();
  });
  actions.append(minimizeButton,maximizeButton,resetButton,closeButton);
  head.append(drag,actions);

  const content=doc.createElement('div');
  content.className='float-panel-content';
  while(panel.firstChild)content.append(panel.firstChild);

  const resize=doc.createElement('button');
  resize.type='button';
  resize.className='float-panel-resize';
  resize.textContent='⤢';
  resize.title='اسحب لتغيير الحجم؛ استخدم الأسهم';
  resize.setAttribute('aria-label','تغيير حجم الإطار');
  resize.setAttribute('aria-keyshortcuts','ArrowLeft ArrowRight ArrowUp ArrowDown');

  panel.append(head,content,resize);
  panel.dataset.floatPanelKey=String(key);
  panel.dataset.floatPanelReady='true';
  attachDrag(drag,panel,key);
  attachResize(resize,panel,key);
 }

 function activate(menu,key){
  const panel=getPanel(menu);
  if(!panel)return;
  ensurePanelUI(menu,panel,key);
  getFloatingLayer().append(panel);
  if(panel.dataset.floatPanelActive==='true')return;
  const restored=savedRect(key);
  const target=restored||defaultRect(panel);
  applyRect(panel,target);
  panel.dataset.floatPanelActive='true';
  setButtonState(panel);
  normalRects.delete(panel);
 }

 function deactivate(menu,key){
  const panel=getPanel(menu);
  if(!panel||panel.dataset.floatPanelActive!=='true')return;
  let rect=measure(panel);
  if(panel.classList.contains('is-minimized')||panel.classList.contains('is-maximized')){
   rect=restoreNormal(panel,key);
  }
  saveLayout(panel,key,rect);
  panel.dataset.floatPanelActive='false';
  menu.append(panel);
 }

 function handleMenuToggle(menu,key){
  if(menu.open){
   menus.forEach(other=>{if(other!==menu&&other.open)other.open=false});
   requestFrame(()=>requestFrame(()=>{
    if(menu.open)activate(menu,key);
   }));
  }else{
   deactivate(menu,key);
  }
 }

 function keepActiveInsideViewport(){
  const vv=viewport();
  menus.forEach((menu,index)=>{
   if(!menu.open)return;
   const key=panelKey(menu,index);
   const panel=getPanel(menu);
   if(!panel||panel.dataset.floatPanelActive!=='true')return;
   if(panel.classList.contains('is-maximized')){
    applyRect(panel,{left:vv.left+EDGE,top:vv.top+EDGE,width:vv.width-EDGE*2,height:vv.height-EDGE*2});
   }else if(panel.classList.contains('is-minimized')){
    const base=normalRects.get(panel)||measure(panel);
    applyRect(panel,{...base,height:54});
   }else{
    const rect=applyRect(panel,measure(panel));
    saveLayout(panel,key,rect);
   }
  });
 }

 menus.forEach((menu,index)=>{
  const key=panelKey(menu,index);
  menu.addEventListener('toggle',()=>handleMenuToggle(menu,key));
  const panel=menu.querySelector(':scope > .rib-pop');
  if(panel){panelByMenu.set(menu,panel);ensurePanelUI(menu,panel,index);}
 });
 if(typeof root.MutationObserver==='function'){
  const observer=new root.MutationObserver(records=>{
   for(const record of records){
    if(record.type!=='attributes'||record.attributeName!=='open')continue;
    const menu=record.target;
    const index=menus.indexOf(menu);
    if(index>=0)handleMenuToggle(menu,panelKey(menu,index));
   }
  });
  menus.forEach(menu=>observer.observe(menu,{attributes:true,attributeFilter:['open']}));
 }
 root.addEventListener('resize',keepActiveInsideViewport);
 root.addEventListener('orientationchange',()=>requestFrame(keepActiveInsideViewport));
 if(root.visualViewport){
  root.visualViewport.addEventListener('resize',keepActiveInsideViewport);
  root.visualViewport.addEventListener('scroll',keepActiveInsideViewport);
 }
 doc.addEventListener('keydown',event=>{
  if(event.key!=='Escape')return;
  const activeMenu=menus.find(menu=>menu.open);
  if(!activeMenu)return;
  event.preventDefault();
  event.stopPropagation();
  const summary=activeMenu.querySelector(':scope > summary');
  activeMenu.open=false;
  if(summary)requestFrame(()=>summary.focus());
 },true);
})(window);