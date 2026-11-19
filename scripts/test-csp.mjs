import fs from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const htmlAudit=JSON.parse(execFileSync('python3',[new URL('./html_inspector.py',import.meta.url).pathname,new URL('../index.html',import.meta.url).pathname],{encoding:'utf8'}));
const securityHeaders=fs.readFileSync(new URL('../SECURITY-HEADERS.md',import.meta.url),'utf8');
const deployedHeaders=fs.readFileSync(new URL('../_headers',import.meta.url),'utf8');
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
const scriptSources=requireDirective('script-src',"'self'",'https://cdnjs.cloudflare.com');
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
requireDirective('connect-src',"'self'",'https://www.mp3quran.net','https://api.allorigins.win','https://corsproxy.io');
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
assert.ok(/<meta\s+name="referrer"\s+content="strict-origin-when-cross-origin"\s*>/i.test(html),'a conservative referrer policy is declared');
assert.ok(!cspContent.includes('frame-ancestors')&&!cspContent.includes('report-uri')&&!cspContent.includes('report-to'),'header-only CSP directives are not presented as active meta controls');
const deployedCsp=deployedHeaders.match(/Content-Security-Policy:\s*([^\n]+)/);
assert.ok(deployedCsp,'Cloudflare _headers includes a CSP response header');
for(const item of hashSources)assert.ok(deployedCsp[1].includes(item),'Cloudflare response CSP includes '+item);
console.log('CSP checks passed: no inline scripts, no unsafe-inline or unsafe-eval in script-src, and HTML/header policies remain synchronized.');
