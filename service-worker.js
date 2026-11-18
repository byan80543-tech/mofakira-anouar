/* Cache only local app shell; remote audio, APIs and fonts are never cached. */
'use strict';
const CACHE_NAME='anwar-shell-2026-11-18-v48';
const APP_BASE=new URL('./',self.registration.scope);
const SHELL_ASSETS=['./','./index.html','./manifest.webmanifest','./vault-crypto.js','./vault-device-unlock.js','./toolbar-back-navigation.js','./assets/royal-rose-closed.svg','./assets/royal-rose-open.svg','./assets/tulip-cutout.svg'];
self.addEventListener('install',event=>{event.waitUntil((async()=>{const cache=await caches.open(CACHE_NAME);await cache.addAll(SHELL_ASSETS);await self.skipWaiting()})())});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(key=>key.startsWith('anwar-shell-')&&key!==CACHE_NAME).map(key=>caches.delete(key)));await self.clients.claim()})())});
async function networkFirst(request,event){
 const cachePromise=caches.open(CACHE_NAME);
 const update=fetch(request).then(async response=>{
  if(response&&response.ok&&response.type==='basic'){
   const cache=await cachePromise;
   await cache.put(request,response.clone());
  }
  return response;
 });
 // Register the background refresh before the first await, so the worker stays alive.
 event.waitUntil(update.catch(()=>{}));
 const cache=await cachePromise;
 const cached=await cache.match(request,{ignoreSearch:true})||await cache.match(APP_BASE.href)||await cache.match(new URL('index.html',APP_BASE).href);
 if(cached)return cached;
 try{return await update}
 catch(error){return new Response('مفكرة أنوار غير متاحة دون اتصال بعد أول زيارة ناجحة.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}})}
}
async function cacheFirst(request){
 const cache=await caches.open(CACHE_NAME),cached=await cache.match(request,{ignoreSearch:true});
 if(cached)return cached;
 const response=await fetch(request);
 if(response&&response.ok&&response.type==='basic')await cache.put(request,response.clone());
 return response;
}
self.addEventListener('fetch',event=>{
 const request=event.request;if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin||!url.pathname.startsWith(APP_BASE.pathname))return;
 if(request.mode==='navigate'){event.respondWith(networkFirst(request,event));return}
 // External streaming/audio/API hosts remain network-only.
 event.respondWith(cacheFirst(request));
});
