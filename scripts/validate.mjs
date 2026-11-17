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
ok(html.includes('file_00000000670481f4ad879246afe6bae2.png?v=20261116-5'),'browser favicon uses the original high-resolution PNG');
ok(html.includes('<link rel="apple-touch-icon" href="file_00000000670481f4ad879246afe6bae2.png?v=20261116-5"'),'Apple touch icon uses the original high-resolution PNG');
ok(!html.includes('Object.hasOwn('),'storage normalization avoids unsupported Object.hasOwn calls');

const originalIcon='file_00000000670481f4ad879246afe6bae2.png';
const declared=(manifest.icons??[]).find(i=>i.src.split('?')[0]===originalIcon && i.sizes==='1536x1536' && i.type==='image/png');
ok(!!declared,'manifest declares the original 1536x1536 PNG icon');
ok(fs.existsSync(path.join(root,originalIcon)),'original high-resolution icon file exists');

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
