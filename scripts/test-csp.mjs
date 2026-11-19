import fs from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const securityHeaders=fs.readFileSync(new URL('../SECURITY-HEADERS.md',import.meta.url),'utf8');
const deployedHeaders=fs.readFileSync(new URL('../_headers',import.meta.url),'utf8');
const cspTag=html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)">/i);
assert.ok(cspTag,'an enforced document CSP meta policy is present');
const directives=new Map(cspTag[1].split(';').map(part=>{
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
const scriptSources=requireDirective('script-src',"'self'",'https://cdnjs.cloudflare.com');
assert.ok(!scriptSources.includes("'unsafe-inline'"),'script-src does not allow arbitrary inline JavaScript');
assert.ok(!scriptSources.includes("'unsafe-eval'"),'script-src does not allow eval');
const inlineScripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(match=>!/\bsrc\s*=/i.test(match[1]));
const hashSources=scriptSources.filter(source=>/^'sha256-[A-Za-z0-9+/]+=*'$/.test(source));
assert.equal(hashSources.length,inlineScripts.length,'each inline script has one allowlisted SHA-256 hash');
for(let i=0;i<inlineScripts.length;i++){
 const digest=createHash('sha256').update(inlineScripts[i][2],'utf8').digest('base64');
 const source="'sha256-"+digest+"'";
 assert.ok(hashSources.includes(source),'inline script '+(i+1)+' matches its CSP hash');
 assert.ok(securityHeaders.includes(source),'security header deployment guide contains the current inline script hash '+(i+1));
 assert.ok(deployedHeaders.includes(source),'deployed Cloudflare _headers contains the current inline script hash '+(i+1));
}
const styleSources=requireDirective('style-src',"'self'","'unsafe-inline'",'https://fonts.googleapis.com');
assert.ok(styleSources.includes("'unsafe-inline'"),'inline styles remain supported intentionally');
requireDirective('img-src',"'self'",'data:','blob:','https://upload.wikimedia.org');
requireDirective('font-src',"'self'",'data:','https://fonts.gstatic.com');
requireDirective('connect-src',"'self'",'https://www.mp3quran.net','https://api.allorigins.win','https://corsproxy.io');
requireDirective('media-src',"'self'",'https:','blob:');
requireDirective('frame-src',"'self'",'blob:');
requireDirective('worker-src',"'self'",'blob:');
requireDirective('manifest-src',"'self'");
assert.ok(directives.has('upgrade-insecure-requests'),'insecure subresource requests are upgraded');

const cspIndex=html.indexOf(cspTag[0]);
const firstResource=Math.min(...['<link ','<script','<style'].map(token=>{
 const position=html.indexOf(token);
 return position<0?Number.MAX_SAFE_INTEGER:position;
}));
assert.ok(cspIndex>=0&&cspIndex<firstResource,'CSP appears before the first resource-bearing element');
assert.ok(/<meta\s+name="referrer"\s+content="strict-origin-when-cross-origin"\s*>/i.test(html),'a conservative referrer policy is declared');
assert.ok(!/frame-ancestors|report-uri|report-to/i.test(cspTag[1]),'header-only CSP directives are not presented as active meta controls');
const deployedCsp=deployedHeaders.match(/Content-Security-Policy:\s*([^\n]+)/);
assert.ok(deployedCsp,'Cloudflare _headers includes a CSP response header');
for(const item of hashSources)assert.ok(deployedCsp[1].includes(item),'Cloudflare response CSP includes '+item);
console.log('CSP checks passed: '+inlineScripts.length+' inline scripts are hash-pinned in HTML, Cloudflare headers and documentation; script-src has no unsafe-inline or unsafe-eval.');
