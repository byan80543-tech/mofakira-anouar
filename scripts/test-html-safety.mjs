import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../app-core.js',import.meta.url),'utf8');
const worker=fs.readFileSync(new URL('../workers/anwar-api-gateway/src/index.mjs',import.meta.url),'utf8');

function section(source,startMarker,endMarker,label){
  const start=source.indexOf(startMarker);
  const end=source.indexOf(endMarker,start);
  assert.notEqual(start,-1,label+' start exists');
  assert.notEqual(end,-1,label+' end exists');
  return source.slice(start,end);
}

const plainText=section(app,'function htmlToPlainText(value){','const notePlainTextCache','plain HTML to text');
assert.ok(!plainText.includes('DOMParser'));
assert.ok(!plainText.includes('innerHTML'));
const textParser=vm.runInNewContext('(()=>{'+plainText+';return htmlToPlainText})()');
assert.equal(
  textParser('<div>بيت &amp; معنى</div><div>سطر&nbsp;ثانٍ</div><script>alert(1)</script><br>نهاية'),
  'بيت & معنى\nسطر ثانٍ\nنهاية'
);
assert.equal(textParser('&lt;script&gt;نص ظاهر&lt;/script&gt;'),'<script>نص ظاهر</script>');
const recordText=section(app,'function notePlainText(note){','function recordsText','record HTML to text');
assert.ok(recordText.includes("plain(note.html||'')"));
assert.ok(!recordText.includes('.innerHTML='));

const fileImport=section(app,'async function handleBookFile(file){','function showOwnerPanel(','HTML and text file import');
assert.ok(!fileImport.includes('DOMParser'));
assert.ok(fileImport.includes('insertImportedText(plain(source),name)'));

const importedText=section(app,'function insertImportedText(text,filename){','async function handleBookFile(file){','plain text import');
assert.ok(importedText.includes('document.createDocumentFragment()'));
assert.ok(importedText.includes('block.textContent=line'));
assert.ok(importedText.includes('range.insertNode(fragment)'));
assert.ok(!importedText.includes('innerHTML'));
assert.ok(!importedText.includes("execCommand('insertHTML'"));

const gatewayValidator=section(app,'function trustedAnwarGatewayBase(){','function safeHttpsURL(','trusted Worker hostname validation');
assert.ok(!gatewayValidator.includes('.endsWith('));
const gatewayFor=value=>vm.runInNewContext(gatewayValidator+';trustedAnwarGatewayBase()',{
  ANWAR_API_GATEWAY_BASE:value,
  URL
});
assert.equal(gatewayFor('https://anwar-api-gateway.account.workers.dev'),'https://anwar-api-gateway.account.workers.dev');
assert.equal(gatewayFor('https://lookalike-anwar-api-gateway.account.workers.dev'),'');
assert.equal(gatewayFor('https://anwar-api-gateway.account.workers.dev.attacker.test'),'');
assert.equal(gatewayFor('https://anwar-api-gateway.account.workers.dev/path'),'');
assert.equal(gatewayFor('http://anwar-api-gateway.account.workers.dev'),'');

const countryRequest=section(app,'function resolveCountryRequest(value){','function dedupeCountryRows(rows){','country source URL validation');
assert.ok(countryRequest.includes("allowedOrigins=new Set([base.origin,'https://www.way2quran.com'])"));
assert.ok(countryRequest.includes("source.username||source.password||source.port||source.hash"));
assert.ok(app.includes("u.username||u.password||u.port||u.hash||u.search"),'country profile links reject URL credentials, ports, fragments and unexpected query parameters');
assert.ok(countryRequest.includes("new URL('/v1/country/list',gateway)"));
assert.ok(countryRequest.includes("new URL('/v1/country/profile',gateway)"));
assert.ok(countryRequest.includes("apiUrl.searchParams.set('nationality',code)"));
assert.ok(countryRequest.includes("apiUrl.searchParams.set('slug',slug)"));
assert.ok(!countryRequest.includes('gateway+route'));

const countryFetch=section(app,'async function fetchCountryHtml(url,externalSignal){','function dedupeCountryRows(rows){','country fetch URLs');
assert.ok(countryFetch.includes("new URL('/raw','https://api.allorigins.win')"));
assert.ok(countryFetch.includes("new URL('/','https://corsproxy.io')"));
assert.ok(countryFetch.includes("searchParams.set('url',sourceUrl)"));
assert.ok(!countryFetch.includes("body.includes('/ar/reciters')"));
assert.ok(!countryFetch.includes("body.includes('media.way2quran.com')"));
assert.ok(!countryFetch.includes('encodeURIComponent(url)'));
assert.ok(!countryFetch.includes("'https://api.allorigins.win/raw?url='+"));

const upstreamValidator=section(worker,'function validateUpstreamUrl(target) {','async function fetchSameOriginOnly(target) {','upstream URL validation');
for(const token of ['safe.protocol !== "https:"',"safe.username","safe.password","safe.port","safe.hash","isAllowedUpstreamHost(safe.hostname)"]){
  assert.ok(upstreamValidator.includes(token), 'upstream validator enforces '+token);
}
assert.ok(worker.includes('validateUpstreamUrl(new URL(location, current))'));
assert.ok(worker.includes('isJsonUpstreamHost(current.hostname)'));
assert.ok(!worker.includes('current.hostname.endsWith("mp3quran.net")'));
assert.ok(!worker.includes('body.includes("/ar/reciters")'));
assert.ok(!worker.includes('body.includes("media.way2quran.com")'));
assert.ok(worker.includes('fetchSameOriginOnly(route.upstream)'));
assert.ok(!worker.includes('new URL(route.upstream)'));
assert.ok(!worker.includes('"https://way2quran.com/ar/reciters/" + slug'));

console.log('HTML and URL safety regression tests passed.');
