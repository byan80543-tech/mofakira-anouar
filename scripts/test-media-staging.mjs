import assert from 'node:assert/strict';

const origin=process.argv[2];
assert.ok(origin,'Pass the deployed staging URL as the first argument');
const pageUrl=new URL('/mofakira-anouar/',origin);
const page=await fetch(pageUrl,{redirect:'follow',signal:AbortSignal.timeout(15000)});
assert.equal(page.status,200,'staging application page returns HTTP 200');
const html=await page.text();
const headerCsp=page.headers.get('content-security-policy')||'';
const metaCsp=html.match(/<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]+content=["']([^"']+)["']/i)?.[1]||'';
assert.ok(headerCsp.includes('media-src'),'staging response includes media-src in HTTP CSP');
assert.ok(metaCsp.includes('media-src'),'staging HTML includes document media-src');
const parse=value=>new Map(value.split(';').map(part=>{const tokens=part.trim().split(/\\s+/);return [tokens.shift(),tokens]}));
const headerMedia=parse(headerCsp).get('media-src')||[];
const metaMedia=parse(metaCsp).get('media-src')||[];
assert.deepEqual([...headerMedia].sort(),[...metaMedia].sort(),'staging HTTP and document media-src policies match');
assert.ok(!headerMedia.includes('https:'),'staging does not allow arbitrary HTTPS media');
assert.ok(headerCsp.includes('max-age=31536000'),'staging response includes the expected HSTS policy');

const probes=[
 ['MP3Quran recitation','https://server8.mp3quran.net/afs/001.mp3'],
 ['Way2Quran Warsh','https://media.way2quran.com/abdel-rahman-benmoussa/warsh-an-nafi/001.mp3'],
 ['Internet Archive ibtihalat','https://archive.org/download/20240309_20240309_1714/004%20%20%D8%A7%D9%84%D8%B4%D9%8A%D8%AE%20%D8%B3%D9%8A%D8%AF%20%D8%A7%D9%84%D9%86%D9%82%D8%B4%D8%A8%D9%86%D8%AF%D9%89%2C%20%D9%8A%D8%A7%20%D8%B1%D8%A8%20%D8%A7%D9%86%20%D8%B9%D8%B8%D9%85%D8%AA%20%D8%B0%D9%86%D9%88%D8%A8%D9%89%20%D9%83%D8%AB%D8%B1%D8%A9.mp3'],
 ['IslamHouse tawhid','https://d1.islamhouse.com/data/ar/ih_sounds/chain_01/shar7-ketab-taw7eed-al-badr/ar-01-shar7-ketab-taw7eed-al-badr.mp3'],
 ['Al-Badr lessons','https://al-badr.net/download/esound/choroohat/tsalatsatul-ushul/01.mp3'],
 ['Sabil Al-Rashad lessons','https://sabil-alrashad.com/Home/DownloadAudioFile/36'],
 ['Zine Bladi live radio','https://asmaki.ma:8000/radio.mp3']
];
const allowed=host=>host==='mp3quran.net'||host.endsWith('.mp3quran.net')||host==='media.way2quran.com'||host==='archive.org'||host.endsWith('.archive.org')||host==='d1.islamhouse.com'||host==='al-badr.net'||host.endsWith('.al-badr.net')||host==='sabil-alrashad.com'||host==='asmaki.ma';
const results=await Promise.all(probes.map(async([label,url])=>{
 try{
  const response=await fetch(url,{method:'GET',headers:{Range:'bytes=0-1'},redirect:'follow',signal:AbortSignal.timeout(18000)});
  const final=new URL(response.url);
  const result={label,status:response.status,host:final.hostname,contentType:response.headers.get('content-type')||''};
  await response.body?.cancel();
  assert.ok(allowed(final.hostname),'redirected media host is not allowlisted: '+final.hostname);
  assert.ok(response.status>=200&&response.status<400,'media probe failed: HTTP '+response.status);
  return {...result,ok:true};
 }catch(error){return {label,ok:false,error:String(error)}}
}));
for(const result of results)console.log(JSON.stringify(result));
const failures=results.filter(result=>!result.ok);
assert.equal(failures.length,0,'one or more inventoried audio providers failed live staging probes');
console.log('Media staging smoke test passed: CSP parity, HSTS, and all representative audio providers are reachable.');
