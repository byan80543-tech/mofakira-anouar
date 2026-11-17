/* Cache only local app shell; remote audio, APIs and fonts are never cached. */
'use strict';
const CACHE_NAME='anwar-shell-2026-11-17-v2';
const APP_BASE=new URL('./',self.registration.scope);
const SHELL_ASSETS=['./','./index.html','./manifest.webmanifest','./file_00000000670481f4ad879246afe6bae2.png','./icon-192.png','./icon-512.png','./vendor/jspdf.umd.min.js','./assets/royal-rose-closed.svg','./assets/royal-rose-open.svg','./assets/tulip-cutout.svg'];
self.addEventListener('install',event=>{event.waitUntil((async()=>{const cache=await caches.open(CACHE_NAME);await cache.addAll(SHELL_ASSETS);await self.skipWaiting()})())});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(key=>key.startsWith('anwar-shell-')&&key!==CACHE_NAME).map(key=>caches.delete(key)));await self.clients.claim()})())});
async function networkFirst(request){
 const cache=await caches.open(CACHE_NAME);
 try{const response=await fetch(request);if(response&&response.ok&&response.type==='basic')await cache.put(request,response.clone());return response}
 catch(error){const cached=await cache.match(request,{ignoreSearch:true})||await cache.match(APP_BASE.href);if(cached)return cached;return new Response('مفكرة أنوار غير متاحة دون اتصال بعد أول زيارة ناجحة.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}})}
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
 if(request.mode==='navigate'){event.respondWith(networkFirst(request));return}
 // External streaming/audio/API hosts remain network-only.
 event.respondWith(cacheFirst(request));
});
