import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root=process.cwd();
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
const failures=[];
const ok=(condition,message)=>{if(!condition)failures.push(message);else console.log('PASS',message)};

ok(manifest.name==='مفكرة أنوار' && manifest.short_name==='مفكرة أنوار','PWA name and short_name');
ok(manifest.start_url==='/mofakira-anouar/' && manifest.scope==='/mofakira-anouar/','GitHub Pages start_url and scope');
ok(html.includes('rel="manifest" href="manifest.webmanifest'),'HTML references the current manifest path');
ok(html.includes('href="icon-192.png?v=20261117-1" sizes="192x192"'),'browser favicon uses the optimized 192px PNG');
ok(html.includes('<link rel="apple-touch-icon" href="icon-192.png?v=20261117-1"'),'Apple touch icon uses the optimized 192px PNG');
ok(!html.includes('file_00000000670481f4ad879246afe6bae2.png'),'the oversized source icon is not loaded by the page');
ok(!manifest.icons.some(i=>String(i.src).includes('file_00000000670481f4ad879246afe6bae2.png')),'manifest excludes the oversized source icon');
ok(html.includes('async function ensurePdfLibraries()'),'PDF libraries load only when PDF export is requested');
ok(html.includes('async function makeQR()'),'QR library loads only when QR generation is requested');
ok(!/<script\\b[^>]*\\bsrc\\s*=\\s*["'][^"']*(?:html2canvas|qrcodejs|jspdf)/i.test(html),'heavy PDF and QR libraries are not loaded by static script tags');
ok(!html.includes('Object.hasOwn('),'storage normalization avoids unsupported Object.hasOwn calls');
const iconSizes=new Set((manifest.icons??[]).flatMap(icon=>String(icon.sizes??'').split(/\s+/)));
ok(iconSizes.has('192x192'),'manifest declares a 192x192 PWA icon');
ok(iconSizes.has('512x512'),'manifest declares a 512x512 PWA icon');
for(const icon of manifest.icons??[]){
  const iconPath=String(icon.src??'').split('?')[0];
  ok(!!iconPath&&fs.existsSync(path.join(root,iconPath)),`manifest icon exists: ${iconPath}`);
}

const ids=[...html.matchAll(/(?:^|\s)id\s*=\s*["']([^"']+)["']/gim)].map(m=>m[1]);
const duplicateIds=ids.filter((id,i)=>ids.indexOf(id)!==i);
ok(duplicateIds.length===0,'HTML IDs are unique');

let scriptCount=0;
for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)){
  if(/\bsrc\s*=/.test(match[1]))continue;
  scriptCount++;
  try{new vm.Script(match[2],{filename:`inline-script-${scriptCount}.js`})}
  catch(error){failures.push(`inline script ${scriptCount}: ${error.message}`)}
}
ok(scriptCount>0,'inline JavaScript blocks discovered');
if(failures.length){
  console.error('\nValidation failed:');
  for(const failure of failures)console.error('-',failure);
  process.exitCode=1;
}else console.log('All repository static checks passed.');
