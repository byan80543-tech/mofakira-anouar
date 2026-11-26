/* Privacy gate for speech recognition.
 * Audio capture is permitted only when the browser exposes the standard
 * processLocally control AND the on-device availability API. No remote fallback,
 * model installation, or automatic download is permitted.
 */
(function installAnwarLocalSpeech(root){
 'use strict';
 function getConstructor(){
  return root.SpeechRecognition||root.webkitSpeechRecognition||null;
 }
 function supported(){
  const Recognition=getConstructor();
  return typeof Recognition==='function'&&
   typeof Recognition.available==='function'&&
   !!Recognition.prototype&&
   'processLocally' in Recognition.prototype;
 }
 function create(language){
  const Recognition=getConstructor();
  if(!supported())throw new Error('حمايةً لخصوصيتك، أوقفنا الميكروفون لأن هذا المتصفح لا يضمن معالجة الكلام على الجهاز نفسه. يمكنك متابعة الكتابة والعد اليدوي.');
  const session=new Recognition();
  if(!session||typeof session.start!=='function'||typeof session.stop!=='function'||!('processLocally' in session)){
   throw new Error('واجهة التعرف المحلي غير مكتملة؛ لم نبدأ الميكروفون.');
  }
  session.processLocally=true;
  if(session.processLocally!==true){
   throw new Error('تعذّر فرض المعالجة الصوتية المحلية؛ لم نبدأ الميكروفون.');
  }
  if(typeof language==='string'&&language.trim())session.lang=language.trim();
  return session;
 }
 root.AnwarLocalSpeech=Object.freeze({supported,create});
})(typeof window!=='undefined'?window:globalThis);
