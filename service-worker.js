/* Cache only the local app shell; remote audio and APIs remain network-only.
 * Bump CACHE_NAME for each published release.
 */
'use strict';
const CACHE_NAME='anwar-shell-2026-11-18-v52';
const APP_BASE=new URL('./',self.registration.scope);
const SHELL_ASSETS=['./','./index.html','./manifest.webmanifest','./vault-crypto.js','./vault-device-unlock.js','./toolbar-back-navigation.js','./update-notice-v2.js','./update-notice-v2.css','./assets/royal-rose-closed.svg','./assets/royal-rose-open.svg','./assets/tulip-cutout.svg'];
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(CACHE_NAME);
  await cache.addAll(SHELL_ASSETS);
  // Deliberately do not call skipWaiting here; the visitor must approve the update.
 })());
});
self.addEventListener('message',event=>{
 if(!event.data||event.data.type!=='ANOUAR_ACTIVATE_UPDATE')return;
 const sourceUrl=event.source&&event.source.url;
 if(!sourceUrl)return;
 let source;
 try{source=new URL(sourceUrl)}catch(error){return}
 if(source.origin!==self.location.origin||!source.pathname.startsWith(APP_BASE.pathname))return;
 event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>key.startsWith('anwar-shell-')&&key!==CACHE_NAME).map(key=>caches.delete(key)));
  await self.clients.claim();
 })());
});
async function networkFirst(request){
 const cache=await caches.open(CACHE_NAME);
 try{
  const response=await fetch(request);
  if(response&&response.ok&&response.type==='basic')await cache.put(request,response.clone());
  return response;
 }catch(error){
  const cached=await cache.match(request,{ignoreSearch:true})||
   await cache.match(APP_BASE.href)||
   await cache.match(new URL('index.html',APP_BASE).href);
  if(cached)return cached;
  return new Response('مفكرة أنوار غير متاحة دون اتصال بعد أول زيارة ناجحة.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
 }
}
async function cacheFirst(request){
 const cache=await caches.open(CACHE_NAME),cached=await cache.match(request,{ignoreSearch:true});
 if(cached)return cached;
 const response=await fetch(request);
 if(response&&response.ok&&response.type==='basic')await cache.put(request,response.clone());
 return response;
}
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin||!url.pathname.startsWith(APP_BASE.pathname))return;
 if(request.mode==='navigate'){event.respondWith(networkFirst(request));return}
 // Keep update-checker code fresh even while the previous worker controls this page.
 if(/\/(update-notice-v2\.js|update-notice-v2\.css)$/.test(url.pathname)){
  event.respondWith(networkFirst(request));
  return;
 }
 event.respondWith(cacheFirst(request));
});
