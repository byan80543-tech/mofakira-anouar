/* Independent one-tap palette for the Protective Adhkar page.
 * Kept separate from the private notebook renderer so visual preferences
 * cannot affect the saved-dhikr writing form or its font picker.
 */
(() => {
 'use strict';
 const page=document.getElementById('anwarAdhkarPage');
 const button=document.getElementById('adhkarPageThemeToggle');
 if(!page||!button)return;
 const STORAGE_KEY='anwar_adhkar_page_theme';
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
  const stored=localStorage.getItem(STORAGE_KEY);
  if(THEMES.some(theme=>theme.id===stored))current=stored;
 }catch(error){
  console.warn('تعذّر استرجاع لون صفحة الأذكار',error);
 }
 const apply=()=>{
  const theme=THEMES.find(item=>item.id===current)||THEMES[0];
  page.dataset.adhkarTheme=theme.id;
  button.setAttribute('aria-label','تغيير لون صفحة الأذكار. اللون الحالي: '+theme.label);
  button.title='تغيير لون صفحة الأذكار — الحالي: '+theme.label;
 };
 apply();
 button.addEventListener('click',()=>{
  const index=THEMES.findIndex(theme=>theme.id===current);
  current=THEMES[(index+1)%THEMES.length].id;
  apply();
  try{localStorage.setItem(STORAGE_KEY,current)}
  catch(error){console.warn('تعذّر حفظ لون صفحة الأذكار',error);}
 });
})();
