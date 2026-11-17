import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const code=fs.readFileSync(new URL('../service-worker.js',import.meta.url),'utf8');
const scopeUrl='https://example.test/mofakira-anouar/';
const listeners=new Map();
const store=new Map();

class TestResponse{
  constructor(body,init={}){this.body=String(body);this.status=init.status??200;this.type=init.type??'basic';this.headers=init.headers??{};this.ok=this.status>=200&&this.status<300}
  clone(){return new TestResponse(this.body,{status:this.status,type:this.type,headers:this.headers})}
  async text(){return this.body}
}
const absolute=input=>new URL(typeof input==='string'?input:input.url,scopeUrl).href;
const makeCache=()=>({
  async addAll(items){for(const item of items)store.set(absolute(item),new TestResponse('cached:'+item))},
  async match(request,options={}){
    const target=absolute(request);
    if(store.has(target))return store.get(target).clone();
    if(options.ignoreSearch){
      const wanted=new URL(target);
      for(const [key,value] of store){const candidate=new URL(key);if(candidate.origin===wanted.origin&&candidate.pathname===wanted.pathname)return value.clone()}
    }
    return undefined;
  },
  async put(request,response){store.set(absolute(request),response.clone())}
});
const caches={
  async open(name){if(!store.has('__cache-name:'+name))store.set('__cache-name:'+name,true);return cacheObjects.get(name)||createAndSave(name)},
  async keys(){return [...cacheObjects.keys()]},
  async delete(name){return cacheObjects.delete(name)}
};
const cacheObjects=new Map();
function createAndSave(name){const cache=makeCache();cacheObjects.set(name,cache);return cache}
cacheObjects.set('anwar-shell-old',makeCache());
cacheObjects.set('unrelated-cache',makeCache());

let skipWaitingCalled=false,clientsClaimed=false,online=true,networkCalls=0;
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
  return new TestResponse('network:'+absolute(request));
};
vm.runInNewContext(code,{self,caches,URL,fetch,Response:TestResponse,console},{timeout:3000});

const installEvent={promise:null,waitUntil(p){this.promise=p}};
listeners.get('install')(installEvent);
await installEvent.promise;
assert.equal(skipWaitingCalled,true,'install calls skipWaiting');
assert.equal(store.get(absolute('./index.html'))?.body,'cached:./index.html','install precaches the local HTML shell');
assert.equal(store.get(absolute('./manifest.webmanifest'))?.body,'cached:./manifest.webmanifest','install precaches the web manifest');

const activateEvent={promise:null,waitUntil(p){this.promise=p}};
listeners.get('activate')(activateEvent);
await activateEvent.promise;
assert.equal(cacheObjects.has('anwar-shell-old'),false,'activate deletes previous Anwar shell caches');
assert.equal(cacheObjects.has('unrelated-cache'),true,'activate preserves caches owned by other applications');
assert.equal(clientsClaimed,true,'activate claims controlled clients');

const onLineNavigation={request:{url:new URL('online-route/',scopeUrl).href,method:'GET',mode:'navigate'},response:null,respondWith(p){this.response=p}};
listeners.get('fetch')(onLineNavigation);
assert.ok(onLineNavigation.response,'same-origin navigation is intercepted');
const onlineResponse=await onLineNavigation.response;
assert.match(await onlineResponse.text(),/^network:/,'navigation uses the network when available');

online=false;
const offlineNavigation={request:{url:new URL('offline-route/',scopeUrl).href,method:'GET',mode:'navigate'},response:null,respondWith(p){this.response=p}};
listeners.get('fetch')(offlineNavigation);
const offlineResponse=await offlineNavigation.response;
assert.equal(await offlineResponse.text(),'cached:./','offline navigation falls back to the cached application shell');

const callsBeforeAsset=networkCalls;
const cachedAsset={request:{url:new URL('index.html?revision=next',scopeUrl).href,method:'GET',mode:'cors'},response:null,respondWith(p){this.response=p}};
listeners.get('fetch')(cachedAsset);
assert.equal(await (await cachedAsset.response).text(),'cached:./index.html','same-origin static assets are served from cache first');
assert.equal(networkCalls,callsBeforeAsset,'cache-first asset hit does not call the network');

const externalAudio={request:{url:'https://audio.example.test/live.mp3',method:'GET',mode:'cors'},response:null,respondWith(p){this.response=p}};
listeners.get('fetch')(externalAudio);
assert.equal(externalAudio.response,null,'external audio is left network-only');

const postRequest={request:{url:new URL('api/write',scopeUrl).href,method:'POST',mode:'cors'},response:null,respondWith(p){this.response=p}};
listeners.get('fetch')(postRequest);
assert.equal(postRequest.response,null,'non-GET requests are not intercepted');

console.log('All service-worker lifecycle, cache and offline fallback tests passed.');
