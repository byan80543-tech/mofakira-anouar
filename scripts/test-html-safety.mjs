import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app-core.js',import.meta.url),'utf8');
const worker=fs.readFileSync(new URL('../workers/anwar-api-gateway/src/index.mjs',import.meta.url),'utf8');

function section(source,startMarker,endMarker,label){
  const start=source.indexOf(startMarker);
  const end=source.indexOf(endMarker,start);
  assert.notEqual(start,-1,label+' start exists');
  assert.notEqual(end,-1,label+' end exists');
  return source.slice(start,end);
}

const plainText=section(app,'function plain(h){','const notePlainTextCache','plain HTML to text');
assert.ok(plainText.includes("new DOMParser().parseFromString(san(h),'text/html')"));
assert.ok(!plainText.includes('.innerHTML='));
const recordText=section(app,'function notePlainText(note){','function recordsText','record HTML to text');
assert.ok(recordText.includes("plain(note.html||'')"));
assert.ok(!recordText.includes('.innerHTML='));

const importedText=section(app,'function insertImportedText(text,filename){','async function handleBookFile(file){','plain text import');
assert.ok(importedText.includes('document.createDocumentFragment()'));
assert.ok(importedText.includes('block.textContent=line'));
assert.ok(importedText.includes('range.insertNode(fragment)'));
assert.ok(!importedText.includes('innerHTML'));
assert.ok(!importedText.includes("execCommand('insertHTML'"));

const countryRequest=section(app,'function resolveCountryRequest(value){','function dedupeCountryRows(rows){','country source URL validation');
assert.ok(countryRequest.includes("allowedOrigins=new Set([base.origin,'https://www.way2quran.com'])"));
assert.ok(countryRequest.includes("source.username||source.password||source.port||source.hash"));
assert.ok(countryRequest.includes("new URL('/v1/country/list',gateway)"));
assert.ok(countryRequest.includes("new URL('/v1/country/profile',gateway)"));
assert.ok(countryRequest.includes("apiUrl.searchParams.set('nationality',code)"));
assert.ok(countryRequest.includes("apiUrl.searchParams.set('slug',slug)"));
assert.ok(!countryRequest.includes('gateway+route'));

const countryFetch=section(app,'async function fetchCountryHtml(url,externalSignal){','function dedupeCountryRows(rows){','country fetch URLs');
assert.ok(countryFetch.includes("new URL('/raw','https://api.allorigins.win')"));
assert.ok(countryFetch.includes("new URL('/','https://corsproxy.io')"));
assert.ok(countryFetch.includes("searchParams.set('url',sourceUrl)"));
assert.ok(!countryFetch.includes('encodeURIComponent(url)'));
assert.ok(!countryFetch.includes("'https://api.allorigins.win/raw?url='+"));

const upstreamValidator=section(worker,'function validateUpstreamUrl(target){','async function fetchSameOriginOnly(target){','upstream URL validation');
for(const token of ['safe.protocol !== "https:"',"safe.username","safe.password","safe.port","safe.hash","isAllowedUpstreamHost(safe.hostname)"]){
  assert.ok(upstreamValidator.includes(token), 'upstream validator enforces '+token);
}
assert.ok(worker.includes('validateUpstreamUrl(new URL(location, current))'));
assert.ok(worker.includes('fetchSameOriginOnly(route.upstream)'));
assert.ok(!worker.includes('new URL(route.upstream)'));
assert.ok(!worker.includes('"https://way2quran.com/ar/reciters/" + slug'));

console.log('HTML and URL safety regression tests passed.');
