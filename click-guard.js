/* Anwar notebook click-burst guard.
 * Allows up to 10 trusted pointer clicks in a rolling 2-second window.
 * The 11th click starts a short local cooldown; keyboard activation is exempt.
 */
(function installAnwarClickGuard(root){
 'use strict';
 const doc=root.document;
 const body=doc&&doc.body;
 if(!body||typeof doc.addEventListener!=='function'||typeof doc.createElement!=='function')return;

 const MAX_CLICKS=10;
 const WINDOW_MS=2000;
 const COOLDOWN_MS=5000;
 const NOTICE_MS=2400;
 let clickTimes=[];
 let cooldownUntil=0;
 let noticeTimer=null;

 const notice=doc.createElement('div');
 notice.id='anwar-click-guard-notice';
 notice.setAttribute('role','alert');
 notice.setAttribute('aria-live','assertive');
 notice.textContent='تم إيقاف النقر المتكرر مؤقتًا. انتظر 5 ثوانٍ ثم حاول مجددًا.';
 Object.assign(notice.style,{
  position:'fixed',
  zIndex:'2147483000',
  left:'50%',
  bottom:'calc(22px + env(safe-area-inset-bottom, 0px))',
  transform:'translateX(-50%)',
  width:'max-content',
  maxWidth:'92vw',
  boxSizing:'border-box',
  padding:'11px 16px',
  border:'1px solid #d8bd7c',
  borderRadius:'14px',
  background:'#123b61',
  color:'#fff',
  boxShadow:'0 5px 20px rgba(0,0,0,.24)',
  font:'600 13px/1.7 Tahoma, sans-serif',
  textAlign:'center',
  direction:'rtl',
  opacity:'0',
  pointerEvents:'none',
  transition:'opacity .16s ease'
 });
 body.appendChild(notice);

 function clock(){
  return root.performance&&typeof root.performance.now==='function'
   ?root.performance.now()
   :Date.now();
 }
 function cancelClick(event){
  event.preventDefault();
  event.stopImmediatePropagation();
 }
 function showNotice(){
  notice.style.opacity='1';
  if(noticeTimer!==null)root.clearTimeout(noticeTimer);
  noticeTimer=root.setTimeout(()=>{
   notice.style.opacity='0';
   noticeTimer=null;
  },NOTICE_MS);
 }
 function handleClick(event){
  if(!event||event.isTrusted!==true||event.detail===0)return;
  const target=event.target;
  if(!target||!body.contains(target)||target===notice||
     (typeof notice.contains==='function'&&notice.contains(target)))return;

  const timestamp=clock();
  if(timestamp<cooldownUntil){
   cancelClick(event);
   return;
  }

  clickTimes=clickTimes.filter(time=>timestamp-time<WINDOW_MS);
  clickTimes.push(timestamp);

  // The first ten taps are allowed. The 11th is blocked and starts the cooldown.
  if(clickTimes.length>MAX_CLICKS){
   clickTimes.length=0;
   cooldownUntil=timestamp+COOLDOWN_MS;
   cancelClick(event);
   showNotice();
  }
 }
 doc.addEventListener('click',handleClick,true);
})(globalThis);
