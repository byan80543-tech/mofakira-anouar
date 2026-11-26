/* Independent one-tap palette for the Protective Adhkar page.
 * Kept separate from the private notebook renderer so visual preferences
 * cannot affect the saved-dhikr writing form or its font picker.
 */
(() => {
 'use strict';
 const page=document.getElementById('anwarAdhkarPage');
 const button=document.getElementById('adhkarPageThemeToggle');
 if(!page||!button)return;
 const preferences=window.AnwarPrivatePreferences;
 const THEMES=[
  {id:'white',label:'الأبيض'},
  {id:'rose',label:'الوردي'},
  {id:'blue',label:'الأزرق'},
  {id:'yellow',label:'الأصفر'},
  {id:'purple',label:'البنفسجي'},
  {id:'gold',label:'الذهبي'}
 ];
 let current='white';
 try{
  const stored=preferences&&typeof preferences.get==='function'?preferences.get().adhkarPageTheme:'';
  if(THEMES.some(theme=>theme.id===stored))current=stored;
 }catch(error){
  console.warn('تعذّر استرجاع لون صفحة الأذكار من الخزنة المشفرة',error);
 }
 const apply=()=>{
  const theme=THEMES.find(item=>item.id===current)||THEMES[0];
  page.dataset.adhkarTheme=theme.id;
  button.setAttribute('aria-label','تغيير لون صفحة الأذكار. اللون الحالي: '+theme.label);
  button.title='تغيير لون صفحة الأذكار — الحالي: '+theme.label;
 };
 apply();
 if(preferences&&typeof preferences.subscribe==='function')preferences.subscribe(snapshot=>{
  const stored=snapshot&&snapshot.adhkarPageTheme;
  if(!THEMES.some(theme=>theme.id===stored)||stored===current)return;
  current=stored;apply();
 });
 const editorHost=page.querySelector('#adhkarContent');
 let renderRetryTimer=0;
 let renderAttempts=0;
 const ensureEditor=()=>{
  if(page.hidden){renderAttempts=0;return;}
  if(!editorHost||editorHost.querySelector('.protective-personal-form'))return;
  if(typeof window.AnwarRenderAdhkar==='function'){
   try{window.AnwarRenderAdhkar('protection');}
   catch(error){console.error('تعذّر إعادة رسم محرر أذكار التحصين',error);}
   if(editorHost.querySelector('.protective-personal-form'))return;
  }
  if(renderAttempts<60){
   renderAttempts++;
   renderRetryTimer=window.setTimeout(ensureEditor,100);
  }else if(!editorHost.querySelector('.adhkar-render-status')){
   const note=document.createElement('p');
   note.className='adhkar-render-status';
   note.setAttribute('role','status');
   note.textContent='جارٍ تهيئة محرر الأذكار. أعد فتح صفحة التحصين إن لم يظهر.';
   editorHost.append(note);
  }
 };
 const pageObserver=new MutationObserver(()=>{
  if(!page.hidden){
   renderAttempts=0;
   if(renderRetryTimer)window.clearTimeout(renderRetryTimer);
   ensureEditor();
  }else{
   if(renderRetryTimer)window.clearTimeout(renderRetryTimer);
   renderRetryTimer=0;
   renderAttempts=0;
  }
 });
 pageObserver.observe(page,{attributes:true,attributeFilter:['hidden']});
 if(!page.hidden)ensureEditor();
 button.addEventListener('click',()=>{
  const index=THEMES.findIndex(theme=>theme.id===current);
  current=THEMES[(index+1)%THEMES.length].id;
  apply();
  if(preferences&&typeof preferences.set==='function'){
   try{preferences.set('adhkarPageTheme',current)}
   catch(error){console.warn('تعذّر حفظ لون صفحة الأذكار داخل الخزنة المشفرة',error)}
  }
 });
})();
