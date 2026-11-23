/* Fast local app-shell delivery with background navigation refresh.
 * Bump CACHE_NAME for each published release so the approved worker precaches
 * the matching HTML, update checker and local assets before activation.
 */
'use strict';
const CACHE_NAME='anwar-shell-2026-11-23-v172';
const APP_BASE=new URL('./',self.registration.scope);
const SHELL_ASSETS=[
 './index.html',
 './manifest.webmanifest',
 './app-core.js',
 './adhkar-page-theme.js',
 './ibtihalat-radio.js',
 './ibtihalat-radio.css',
 './prayer-times.js',
 './prayer-card-design.css',
 './poetry-dictation.js',
 './protective-adhkar.js',
 './tasbih-controller.js',
 './official-adhkar.js',
 './vault-crypto.js',
 './vault-storage.js',
 './vault-device-unlock.js',
 './toolbar-back-navigation.js',
 './api-gateway-config.js',
 './click-guard.js',
 './floating-panels.js',
 './floating-panels.css',
 './update-notice-v2.js',
 './update-notice-v2.css',
 './assets/royal-rose-closed.svg',
 './assets/royal-rose-open.svg',
 './assets/tulip-cutout.svg',
 './assets/tasbih-backdrop.svg',
 './assets/tasbih-medallion.svg',
 './assets/tasbih-mosque-emblem.svg'
];

self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(CACHE_NAME);
  await cache.addAll(SHELL_ASSETS);
  // Do not skip waiting: the visitor approves the update after pending edits are saved.
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

async function findCachedNavigation(cache,request){
 return await cache.match(request,{ignoreSearch:true})||
  await cache.match(APP_BASE.href)||
  await cache.match(new URL('index.html',APP_BASE).href);
}

async function refreshNavigation(request){
 const response=await fetch(request);
 if(response&&response.ok&&response.type==='basic'){
  try{
   const cache=await caches.open(CACHE_NAME);
   await cache.put(request,response.clone());
  }catch(error){
   // A cache write failure must never block a successful page response.
  }
 }
 return response;
}

async function cacheFirst(request){
 const cache=await caches.open(CACHE_NAME);
 const cached=await cache.match(request,{ignoreSearch:true});
 if(cached)return cached;
 const response=await fetch(request);
 if(response&&response.ok&&response.type==='basic'){
  try{await cache.put(request,response.clone())}catch(error){}
 }
 return response;
}

self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin||!url.pathname.startsWith(APP_BASE.pathname))return;

 if(request.mode==='navigate'){
  const cachePromise=caches.open(CACHE_NAME);
  const cachedPromise=cachePromise.then(cache=>findCachedNavigation(cache,request));
  // Start the network refresh after the cache lookup, but never make the
  // visitor wait for it when a usable page is already stored locally.
  const refreshPromise=cachedPromise.then(()=>refreshNavigation(request));
  event.waitUntil(refreshPromise.then(()=>undefined).catch(()=>undefined));
  event.respondWith((async()=>{
   const cached=await cachedPromise;
   if(cached)return cached;
   try{
    const fresh=await refreshPromise;
    if(fresh)return fresh;
   }catch(error){}
   return new Response('مفكرة أنوار غير متاحة دون اتصال بعد أول زيارة ناجحة.',{
    status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}
   });
  })());
  return;
 }

 // The update checker and its stylesheet are part of the versioned local
 // shell. The new worker precaches them; do not block every page load on a
 // separate network request for these render-critical resources.
 event.respondWith(cacheFirst(request));
});
