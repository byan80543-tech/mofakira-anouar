import fs from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const htmlAudit=JSON.parse(execFileSync('python3',[new URL('./html_inspector.py',import.meta.url).pathname,new URL('../index.html',import.meta.url).pathname],{encoding:'utf8'}));
const securityHeaders=fs.readFileSync(new URL('../SECURITY-HEADERS.md',import.meta.url),'utf8');
const deployedHeaders=fs.readFileSync(new URL('../_headers',import.meta.url),'utf8');
const core=fs.readFileSync(new URL('../app-core.js',import.meta.url),'utf8');
const gatewayConfig=fs.readFileSync(new URL('../api-gateway-config.js',import.meta.url),'utf8');
const cspContent=htmlAudit.csp_meta;
assert.ok(cspContent,'an enforced document CSP meta policy is present');
const directives=new Map(cspContent.split(';').map(part=>{
  const tokens=part.trim().split(/\s+/);
  return [tokens.shift(),tokens];
}));
const requireDirective=(name,...required)=>{
  const actual=directives.get(name);
  assert.ok(actual,'CSP directive '+name+' exists');
  for(const item of required)assert.ok(actual.includes(item),name+' permits '+item);
  return actual;
};
requireDirective('default-src',"'none'");
requireDirective('base-uri',"'self'");
requireDirective('object-src',"'none'");
requireDirective('form-action',"'self'");
const html2canvasIntegrity='sha512-BNaRQnYJYiPSqHHDb58B0yaPfCu+Wgds8Gp/gU33kqBtgNS4tSPHuGibyoeqMV/TJlSKda6FXzoEyYGjTe+vXA==';
const qrcodeIntegrity='sha512-CNgIRecGo7nphbeZ04Sc13ka07paqdeTu0WR1IM4kNcpmBAUSHSQX0FslNhTDadL4O5SAGapGt4FodqL8My0mA==';
const html2canvasHash="'"+html2canvasIntegrity+"'";
const qrcodeHash="'"+qrcodeIntegrity+"'";
const scriptSources=requireDirective('script-src',"'self'",html2canvasHash,qrcodeHash);
assert.deepEqual([...scriptSources].sort(),["'self'",html2canvasHash,qrcodeHash].sort(),'only local scripts and the two exact pinned CDN artifacts are permitted');
assert.match(core,/script\.integrity=integrity;script\.crossOrigin='anonymous';script\.referrerPolicy='no-referrer'/,
 'dynamically loaded third-party scripts set SRI before insertion');
assert.match(core,/loadScriptOnce\('https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/html2canvas\/1\.4\.1\/html2canvas\.min\.js','sha512-BNaRQnYJYiPSqHHDb58B0yaPfCu\+Wgds8Gp\/gU33kqBtgNS4tSPHuGibyoeqMV\/TJlSKda6FXzoEyYGjTe\+vXA=='\)/,
 'the only external script is loaded with the hash trusted by CSP');
assert.match(core,/loadScriptOnce\('https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/qrcodejs\/1\.0\.0\/qrcode\.min\.js','sha512-CNgIRecGo7nphbeZ04Sc13ka07paqdeTu0WR1IM4kNcpmBAUSHSQX0FslNhTDadL4O5SAGapGt4FodqL8My0mA=='\)/,
 'the QR helper is loaded with its own hash trusted by CSP');
assert.ok(!scriptSources.includes("'unsafe-inline'"),'script-src does not allow arbitrary inline JavaScript');
assert.ok(!scriptSources.includes("'unsafe-eval'"),'script-src does not allow eval');
const inlineScripts=htmlAudit.inline_scripts;
const hashSources=scriptSources.filter(source=>/^'sha256-[A-Za-z0-9+/]+=*'$/.test(source));
assert.equal(inlineScripts.length,0,'all JavaScript runs from external files; no inline scripts are permitted');
assert.equal(hashSources.length,0,'no inline script hashes are required when no inline scripts exist');
for(let i=0;i<inlineScripts.length;i++){
 const digest=createHash('sha256').update(inlineScripts[i],'utf8').digest('base64');
 const source="'sha256-"+digest+"'";
 assert.ok(hashSources.includes(source),'inline script '+(i+1)+' matches its CSP hash');
 assert.ok(securityHeaders.includes(source),'security header deployment guide contains the current inline script hash '+(i+1));
 assert.ok(deployedHeaders.includes(source),'deployed Cloudflare _headers contains the current inline script hash '+(i+1));
}
const styleSources=requireDirective('style-src',"'self'","'unsafe-inline'",'https://fonts.googleapis.com');
assert.ok(styleSources.includes("'unsafe-inline'"),'inline styles remain supported intentionally');
requireDirective('img-src',"'self'",'data:','blob:','https://upload.wikimedia.org');
requireDirective('font-src',"'self'",'data:','https://fonts.gstatic.com');
const gatewayMatch=gatewayConfig.match(/globalThis[.]ANWAR_API_GATEWAY_BASE[ ]*=[ ]*["']([^"']*)["'][ ]*;/);
assert.ok(gatewayMatch,'the API gateway configuration is explicit');
const gatewayBase=gatewayMatch[1].trim();
const gatewaySources=[];
if(gatewayBase){
 const gatewayUrl=new URL(gatewayBase);
 assert.equal(gatewayUrl.protocol,'https:','the optional API gateway must use HTTPS');
 assert.match(gatewayUrl.hostname,/^anwar-api-gateway[.][a-z0-9-]+[.]workers[.]dev$/,'the optional API gateway must use its exact approved Worker host');
 assert.equal(gatewayUrl.pathname,'/','the API gateway origin must not include a path');
 assert.equal(gatewayUrl.search,'','the API gateway origin must not include a query');
 assert.equal(gatewayUrl.hash,'','the API gateway origin must not include a fragment');
 gatewaySources.push(gatewayUrl.origin);
}
const expectedConnectSources=["'self'",'https://www.mp3quran.net',...gatewaySources];
const pageConnectSources=requireDirective('connect-src',...expectedConnectSources);
assert.deepEqual([...pageConnectSources].sort(),[...expectedConnectSources].sort(),'connect-src permits only the same origin, the Quran catalogue API, and an explicitly configured exact gateway origin');
requireDirective('media-src',"'self'",'https:','blob:');
requireDirective('frame-src',"'self'",'blob:');
requireDirective('worker-src',"'self'",'blob:');
requireDirective('manifest-src',"'self'");
assert.ok(directives.has('upgrade-insecure-requests'),'insecure subresource requests are upgraded');

const cspIndex=html.indexOf('http-equiv="Content-Security-Policy"');
const firstResource=Math.min(...['<link ','<script','<style'].map(token=>{
 const position=html.indexOf(token);
 return position<0?Number.MAX_SAFE_INTEGER:position;
}));
assert.ok(cspIndex>=0&&cspIndex<firstResource,'CSP appears before the first resource-bearing element');
assert.equal(htmlAudit.referrer_meta,'strict-origin-when-cross-origin','a conservative referrer policy is declared');
assert.ok(!cspContent.includes('frame-ancestors')&&!cspContent.includes('report-uri')&&!cspContent.includes('report-to'),'header-only CSP directives are not presented as active meta controls');
const deployedCsp=deployedHeaders.match(/Content-Security-Policy:\s*([^\n]+)/);
assert.ok(deployedCsp,'Cloudflare _headers includes a CSP response header');
const deployedDirectives=new Map(deployedCsp[1].split(';').map(part=>{
 const tokens=part.trim().split(/\s+/);
 return [tokens.shift(),tokens];
}));
const deployedConnectSources=deployedDirectives.get('connect-src');
assert.ok(deployedConnectSources,'Cloudflare response CSP includes connect-src');
assert.deepEqual(
 [...deployedConnectSources].sort(),
 [...pageConnectSources].sort(),
 'Cloudflare response connect-src must match the page policy so the HTTP header does not silently block required APIs'
);
const deployedScriptSources=deployedDirectives.get('script-src');
assert.ok(deployedScriptSources,'Cloudflare response CSP includes script-src');
assert.deepEqual([...deployedScriptSources].sort(),[...scriptSources].sort(),'Cloudflare response script-src must exactly match the page allowlist');
for(const item of hashSources)assert.ok(deployedCsp[1].includes(item),'Cloudflare response CSP includes '+item);
assert.ok(deployedCsp[1].includes(html2canvasHash),'Cloudflare response CSP includes the exact html2canvas SRI hash');
assert.ok(deployedCsp[1].includes(qrcodeHash),'Cloudflare response CSP includes the exact qrcodejs SRI hash');
const hstsHeader=deployedHeaders.split('\n').find(line=>line.trim().startsWith('Strict-Transport-Security:'));
assert.equal(hstsHeader?.trim(),'Strict-Transport-Security: max-age=31536000','Cloudflare response headers enable one-year HSTS for this host only, without includeSubDomains or preload');
console.log('CSP checks passed: required network origins match across page and Cloudflare response policies; inline scripts and eval remain blocked.');
