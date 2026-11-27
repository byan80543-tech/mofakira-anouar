import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const code=fs.readFileSync(new URL('../service-worker.js',import.meta.url),'utf8');
const scopeUrl='https://example.test/mofakira-anouar/';
const listeners=new Map();
const store=new Map();
let networkCalls=0,fetchSequence=0,online=true,skipWaitingCalled=false,clientsClaimed=false;

class TestResponse{
 constructor(body,init={}){this.body=String(body);this.status=init.status??200;this.type=init.type??'basic';this.headers=init.headers??{};this.ok=this.status>=200&&this.status<300}
 clone(){return new TestResponse(this.body,{status:this.status,type:this.type,headers:this.headers})}
 async text(){return this.body}
}
const absolute=input=>new URL(typeof input==='string'?input:input.url,scopeUrl).href;
const makeFetchEvent=request=>({
 request,response:null,lifecycle:null,
 respondWith(p){this.response=p},
 waitUntil(p){this.lifecycle=p}
});
const makeCache=()=>({
 async addAll(items){for(const item of items)store.set(absolute(item),new TestResponse('cached:'+item))},
 async match(request,options={}){
  const target=absolute(request);
  if(store.has(target))return store.get(target).clone();
  if(options.ignoreSearch){
   const wanted=new URL(target);
   for(const [key,value] of store){
    const candidate=new URL(key);
    if(candidate.origin===wanted.origin&&candidate.pathname===wanted.pathname)return value.clone();
   }
  }
  return undefined;
 },
 async put(request,response){store.set(absolute(request),response.clone())}
});
const cacheObjects=new Map();
function createAndSave(name){const cache=makeCache();cacheObjects.set(name,cache);return cache}
const caches={
 async open(name){return cacheObjects.get(name)||createAndSave(name)},
 async keys(){return [...cacheObjects.keys()]},
 async delete(name){return cacheObjects.delete(name)}
};
cacheObjects.set('anwar-shell-old',makeCache());
cacheObjects.set('unrelated-cache',makeCache());

const self={
 registration:{scope:scopeUrl},
 location:{origin:'https://example.test'},
 addEventListener(name,handler){listeners.set(name,handler)},
 async skipWaiting(){skipWaitingCalled=true},
 clients:{async claim(){clientsClaimed=true}}
};
const fetch=async request=>{
 networkCalls++;
 if(!online)throw new Error('simulated offline');
 fetchSequence++;
 return new TestResponse('network:'+absolute(request)+':'+fetchSequence);
};
vm.runInNewContext(code,{self,caches,URL,fetch,Response:TestResponse,console},{timeout:3000});

const installEvent={promise:null,waitUntil(p){this.promise=p}};
listeners.get('install')(installEvent);
await installEvent.promise;
assert.equal(skipWaitingCalled,false,'install waits for user approval instead of calling skipWaiting');
assert.equal(store.get(absolute('./index.html'))?.body,'cached:./index.html','install precaches the local HTML shell');
assert.equal(store.get(absolute('./manifest.webmanifest'))?.body,'cached:./manifest.webmanifest','install precaches the web manifest');
assert.equal(store.get(absolute('./app-core.js'))?.body,'cached:./app-core.js','install precaches the deferred main application bundle for offline startup');
assert.equal(store.has(absolute('./poetry-dictation.js')),false,'install does not precache the inactive writing dictation controller');
assert.equal(store.get(absolute('./tasbih-controller.js'))?.body,'cached:./tasbih-controller.js','install precaches the standalone tasbih controller for offline use');
assert.equal(store.get(absolute('./protective-adhkar.js'))?.body,'cached:./protective-adhkar.js','install precaches protective adhkar data for offline use');
assert.equal(store.get(absolute('./vault-crypto.js'))?.body,'cached:./vault-crypto.js','install precaches the local vault cryptography helper');
assert.equal(store.get(absolute('./vault-device-unlock.js'))?.body,'cached:./vault-device-unlock.js','install precaches the local device unlock helper');
assert.equal(store.get(absolute('./toolbar-back-navigation.js'))?.body,'cached:./toolbar-back-navigation.js','install precaches contextual back navigation for offline use');
assert.equal(store.get(absolute('./api-gateway-config.js'))?.body,'cached:./api-gateway-config.js','install precaches the API gateway endpoint configuration for offline use');
assert.equal(store.get(absolute('./click-guard.js'))?.body,'cached:./click-guard.js','install precaches the click-burst guard for offline use');
assert.equal(store.get(absolute('./anwar-shield-3d.js'))?.body,'cached:./anwar-shield-3d.js','install precaches the notebook input threat gate for offline use');
assert.equal(store.get(absolute('./floating-panels.js'))?.body,'cached:./floating-panels.js','install precaches the floating tool panel controller for offline use');
assert.equal(store.get(absolute('./floating-panels.css'))?.body,'cached:./floating-panels.css','install precaches the floating tool panel stylesheet for offline use');
assert.equal(store.get(absolute('./update-notice-v2.js'))?.body,'cached:./update-notice-v2.js','install precaches the update checker');
assert.equal(store.get(absolute('./update-notice-v2.css'))?.body,'cached:./update-notice-v2.css','install precaches the update styling');
assert.equal(store.has(absolute('./')),false,'the duplicate root document is not downloaded during installation');

const messageEvent={data:{type:'ANOUAR_ACTIVATE_UPDATE'},source:{url:scopeUrl+'index.html'},promise:null,waitUntil(p){this.promise=p}};
listeners.get('message')(messageEvent);
await messageEvent.promise;
assert.equal(skipWaitingCalled,true,'the waiting worker activates only after in-scope client approval');

const rejectedMessage={data:{type:'ANOUAR_ACTIVATE_UPDATE'},source:{url:'https://evil.example/attack'},promise:null,waitUntil(p){this.promise=p}};
listeners.get('message')(rejectedMessage);
assert.equal(rejectedMessage.promise,null,'messages from outside the app origin are rejected');

const activateEvent={promise:null,waitUntil(p){this.promise=p}};
listeners.get('activate')(activateEvent);
await activateEvent.promise;
assert.equal(cacheObjects.has('anwar-shell-old'),false,'activate deletes previous Anwar shell caches');
assert.equal(cacheObjects.has('unrelated-cache'),true,'activate preserves caches owned by other applications');
assert.equal(clientsClaimed,true,'activate claims controlled clients');

const firstRoute=new URL('./',scopeUrl).href;
const firstNavigation=makeFetchEvent({url:firstRoute,method:'GET',mode:'navigate'});
listeners.get('fetch')(firstNavigation);
const firstResponse=await firstNavigation.response;
assert.equal(await firstResponse.text(),'cached:./index.html','the precached app shell is shown immediately on the first controlled navigation');
await firstNavigation.lifecycle;
assert.equal(store.get(firstRoute)?.body,'network:'+firstRoute+':'+fetchSequence,'the first controlled navigation refreshes the shell from the network in the background');

const onlineRoute=new URL('cached-route/',scopeUrl).href;
store.set(onlineRoute,new TestResponse('previously-cached-page'));
const cachedNavigation=makeFetchEvent({url:onlineRoute,method:'GET',mode:'navigate'});
listeners.get('fetch')(cachedNavigation);
const cachedResponse=await cachedNavigation.response;
assert.equal(await cachedResponse.text(),'previously-cached-page','repeat navigation returns the cached page without waiting for the network');
await cachedNavigation.lifecycle;
assert.equal(store.get(onlineRoute)?.body,'network:'+onlineRoute+':'+fetchSequence,'navigation refreshes the cached page in the background');

const callsBeforeOffline=networkCalls;
online=false;
const audioNetworkCalls=networkCalls;
const localAdhan=makeFetchEvent({url:new URL('assets/adhan/beautiful-adhan.ogg',scopeUrl).href,method:'GET',mode:'cors'});
listeners.get('fetch')(localAdhan);
assert.equal(await (await localAdhan.response).text(),'cached:./assets/adhan/beautiful-adhan.ogg','local adhan audio is served from precache without a network connection');
assert.equal(networkCalls,audioNetworkCalls,'offline local adhan playback does not initiate a network request');
const offlineNavigation=makeFetchEvent({url:onlineRoute,method:'GET',mode:'navigate'});
listeners.get('fetch')(offlineNavigation);
const offlineResponse=await offlineNavigation.response;
assert.equal(await offlineResponse.text(),'network:'+onlineRoute+':'+fetchSequence,'offline navigation immediately uses the latest cached page');
await offlineNavigation.lifecycle;
assert.equal(networkCalls,callsBeforeOffline+1,'offline background refresh fails once without blocking the cached response');

const offlineUnknownRoute=new URL('offline-route/',scopeUrl).href;
const latestCachedShell=store.get(new URL('./',scopeUrl).href)?.body;
const fallbackNavigation=makeFetchEvent({url:offlineUnknownRoute,method:'GET',mode:'navigate'});
listeners.get('fetch')(fallbackNavigation);
const fallbackResponse=await fallbackNavigation.response;
assert.equal(await fallbackResponse.text(),latestCachedShell,'an unknown offline route falls back to the latest cached app shell');
await fallbackNavigation.lifecycle;

online=true;
const callsBeforeAsset=networkCalls;
const cachedAsset=makeFetchEvent({url:new URL('index.html?revision=next',scopeUrl).href,method:'GET',mode:'cors'});
listeners.get('fetch')(cachedAsset);
assert.equal(await (await cachedAsset.response).text(),'cached:./index.html','same-origin static assets remain cache-first');
assert.equal(networkCalls,callsBeforeAsset,'cache-first asset hit does not call the network');

const updateScript=makeFetchEvent({url:new URL('update-notice-v2.js',scopeUrl).href,method:'GET',mode:'cors'});
listeners.get('fetch')(updateScript);
assert.equal(await (await updateScript.response).text(),'cached:./update-notice-v2.js','update JavaScript is served from the versioned local shell');
assert.equal(networkCalls,callsBeforeAsset,'render-critical update JavaScript does not block page loading on a network fetch');

const updateCss=makeFetchEvent({url:new URL('update-notice-v2.css',scopeUrl).href,method:'GET',mode:'cors'});
listeners.get('fetch')(updateCss);
assert.equal(await (await updateCss.response).text(),'cached:./update-notice-v2.css','update CSS is served from the versioned local shell');
assert.equal(networkCalls,callsBeforeAsset,'render-critical update CSS does not trigger an extra network fetch');

const lazyPdfLibrary=makeFetchEvent({url:new URL('vendor/jspdf.umd.min.js',scopeUrl).href,method:'GET',mode:'cors'});
listeners.get('fetch')(lazyPdfLibrary);
assert.match(await (await lazyPdfLibrary.response).text(),/^network:/,'on-demand PDF library can be fetched');
assert.ok(store.has(absolute('./vendor/jspdf.umd.min.js')),'on-demand PDF library is cached after first successful request');

const externalAudio=makeFetchEvent({url:'https://audio.example.test/live.mp3',method:'GET',mode:'cors'});
listeners.get('fetch')(externalAudio);
assert.equal(externalAudio.response,null,'external audio remains network-only');

const postRequest=makeFetchEvent({url:new URL('api/write',scopeUrl).href,method:'POST',mode:'cors'});
listeners.get('fetch')(postRequest);
assert.equal(postRequest.response,null,'non-GET requests are not intercepted');

console.log('Fast navigation, background refresh, cached update assets and offline fallback tests passed.');
