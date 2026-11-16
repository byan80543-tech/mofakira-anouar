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
ok(html.includes('manifest.webmanifest?v=20261116-4'),'HTML references the versioned manifest');
ok(html.includes('icon-144.jpg?v=20261116-4'),'browser and Apple touch icons reference the current blue brand icon');
ok(!html.includes('Object.hasOwn('),'storage normalization avoids unsupported Object.hasOwn calls');

const required=[
  {size:'192x192',src:'icon-192.svg',width:192},
  {size:'512x512',src:'icon-512.svg',width:512}
];
for(const entry of required){
  const declared=(manifest.icons??[]).find(i=>i.sizes===entry.size && i.type==='image/svg+xml' && i.src.split('?')[0]===entry.src);
  ok(!!declared,`manifest declares ${entry.size} SVG icon`);
  const file=path.join(root,entry.src);
  ok(fs.existsSync(file),`manifest icon exists: ${entry.src}`);
  if(fs.existsSync(file)){
    const svg=fs.readFileSync(file,'utf8');
    ok(svg.includes(`width="${entry.width}"`) && svg.includes(`height="${entry.width}"`) && svg.includes(`viewBox="0 0 ${entry.width} ${entry.width}"`),`${entry.size} SVG dimensions match the manifest`);
    ok(svg.includes('data:image/jpeg;base64,') && !/href=["']https?:/i.test(svg),`${entry.size} SVG embeds the brand artwork without remote image requests`);
  }
}
const fallback=(manifest.icons??[]).find(i=>i.src.split('?')[0]==='icon-144.jpg' && i.type==='image/jpeg');
ok(!!fallback,'raster browser-icon fallback is declared');
if(fallback){
  const raster=path.join(root,'icon-144.jpg');
  ok(fs.existsSync(raster),'raster fallback file exists');
  if(fs.existsSync(raster)){
    const bytes=fs.readFileSync(raster);
    ok(bytes[0]===0xff && bytes[1]===0xd8,'raster fallback is a JPEG image');
  }
}

const ids=[...html.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map(m=>m[1]);
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
