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
ok(Array.isArray(manifest.icons) && manifest.icons.some(i=>i.sizes==='192x192'),'192x192 install icon declared');
ok(manifest.icons.some(i=>i.sizes==='512x512' && i.type==='image/svg+xml'),'512x512 scalable icon declared');

for (const icon of manifest.icons ?? []) {
  const local=icon.src.split('?')[0];
  ok(fs.existsSync(path.join(root,local)),`manifest icon exists: ${local}`);
}
const svg=fs.readFileSync(path.join(root,'icon.svg'),'utf8');
ok(/viewBox=["']0 0 512 512["']/.test(svg),'SVG icon has 512x512 viewBox');

const ids=[...html.matchAll(/\\bid\\s*=\\s*["']([^"']+)["']/gi)].map(m=>m[1]);
const duplicateIds=ids.filter((id,i)=>ids.indexOf(id)!==i);
ok(duplicateIds.length===0,'HTML IDs are unique');

let scriptCount=0;
for (const match of html.matchAll(/<script\\b([^>]*)>([\\s\\S]*?)<\\/script\\s*>/gi)) {
  if (/\\bsrc\\s*=/.test(match[1])) continue;
  scriptCount++;
  try { new vm.Script(match[2],{filename:`inline-script-${scriptCount}.js`}); }
  catch (error) { failures.push(`inline script ${scriptCount}: ${error.message}`); }
}
ok(scriptCount>0,'inline JavaScript blocks discovered');
if (failures.length) {
  console.error('\\nValidation failed:');
  for (const failure of failures) console.error('-',failure);
  process.exitCode=1;
} else console.log('All repository static checks passed.');
