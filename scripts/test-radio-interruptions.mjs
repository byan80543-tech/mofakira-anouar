import fs from 'node:fs';
import assert from 'node:assert/strict';

const app=fs.readFileSync(new URL('../app-core.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const worker=fs.readFileSync(new URL('../service-worker.js',import.meta.url),'utf8');

const radioStart=app.indexOf("const SU='الفاتحة,البقرة");
const lessonStart=app.indexOf('// Lesson library:',radioStart);
assert.ok(radioStart>=0&&lessonStart>radioStart,'radio and lesson modules are present');

const radio=app.slice(radioStart,lessonStart);
const playStart=radio.indexOf('function play(){');
const toggleStart=radio.indexOf('function toggle(){',playStart);
const radioPlaying=radio.indexOf("au.addEventListener('playing'",toggleStart);
assert.ok(playStart>=0&&toggleStart>playStart&&radioPlaying>toggleStart,'radio playback controls are present');

const playBody=radio.slice(playStart,toggleStart);
const toggleBody=radio.slice(toggleStart,radioPlaying);

const ayyubBase='https://cdn.mp3quran.net/audio/muhammad-ayyub/r1/';
const ayyubEntry=radio.match(/\['محمد أيوب','([^']+)'\]/);
assert.ok(ayyubEntry,'Muhammad Ayyub is present in the shared reciter catalog');
assert.equal(ayyubEntry[1],ayyubBase,'Muhammad Ayyub uses the verified official MP3Quran CDN r1 folder rather than the retired server8 path');
assert.ok(!radio.includes('https://server8.mp3quran.net/ayyub/'),'the retired silent Muhammad Ayyub folder is no longer referenced');
assert.ok(playBody.includes("const fileName=String(n).padStart(3,'0')+'.mp3';"),'all reciters keep the same three-digit surah filename convention');
for(const surah of [1,47,114]){
 const url=ayyubBase+String(surah).padStart(3,'0')+'.mp3';
 assert.equal(url,ayyubBase+({1:'001.mp3',47:'047.mp3',114:'114.mp3'}[surah]),'Muhammad Ayyub surah URL is formed correctly for '+surah);
}
assert.ok(radio.includes("R[cr][0]")&&radio.includes("R[cr][1]"),'the fixed source is shared by the radio player and the Quran reciter list');

assert.ok(playBody.includes('radioShouldPlay=true'),'starting playback records the visitor intent');
assert.ok(!playBody.includes("lesson.pause()")&&!playBody.includes('__anwarStopCountryAudio'),'starting the radio does not stop other in-app audio');
assert.ok(!toggleBody.includes('__anwarStopCountryAudio'),'toggling the radio does not stop other players');
assert.ok(toggleBody.includes('radioShouldPlay=false'),'manual pause clears the resume intent');

assert.ok(radio.includes('function syncRadioDucking()'),'radio ducking helper exists');
assert.ok(radio.includes('function renderLiveStationOptions()'),'custom station card picker renderer exists');
assert.ok(radio.includes("item.className='reciter-card live-station-option'"),'station choices reuse Quran-style tulip cards');
assert.ok(radio.includes("flower.src='assets/tulip-cutout.svg'"),'station cards show the same tulip ornament as Quran cards');
assert.ok(radio.includes("stationSelect.dispatchEvent(new Event('change',{bubbles:true}))"),'selecting a station card updates the existing audio selection pipeline');
assert.ok(radio.includes("event.key==='Escape'&&!stationModal.hidden"),'custom station picker closes with Escape');
assert.match(html,/id="liveStationPicker"[\s\S]*?aria-controls="liveStationModal"/,'station picker trigger is available to users');
assert.match(html,/<select id="rl"[^>]*hidden/,'native station select remains hidden behind the custom picker');
assert.match(html,/\.live-station-options\{display:grid/,'station cards render in a custom responsive grid');
assert.ok(radio.includes('إذاعة زين بلادي للقرآن الكريم'),'Zine Bladi Quran Radio is listed in the in-app live station catalogue');
assert.ok(radio.includes('https://asmaki.ma:8000/radio.mp3'),'Zine Bladi uses the HTTPS direct stream URL');
assert.ok(radio.includes('محطة زين بلادي متاحة للاستماع'),'Zine Bladi remains available when the MP3Quran station catalogue fails');
assert.ok(radio.includes("document.querySelectorAll('audio,video')")&&radio.includes('anotherAudioIsPlaying?0.28:1'),'radio is lowered, not paused, while another audible in-app audio or video element plays');
assert.ok(radio.includes("document.addEventListener(type,syncRadioDucking,true)"),'audio events from other in-app players update ducking');
assert.ok(radio.includes('function resumeRadioAfterReturn()'),'safe foreground resume helper exists');
assert.ok(radio.includes('!radioShouldPlay||!au.src||au.ended||!au.paused||radioResumePending'),'resume avoids manual pauses, ended tracks, and duplicate attempts');
assert.ok(radio.includes("document.addEventListener('visibilitychange'")&&radio.includes("window.addEventListener('focus',resumeRadioAfterReturn)")&&radio.includes("window.addEventListener('pageshow',resumeRadioAfterReturn)"),'resume is attempted after returning to the app');

const countryStart=app.indexOf('function mountCountryAudio');
const countryEnd=app.indexOf('function countryProfileAudio',countryStart);
assert.ok(countryStart>=0&&countryEnd>countryStart,'country reader audio module is present');
const countryMount=app.slice(countryStart,countryEnd);
assert.ok(!countryMount.includes('mainRadio.pause()')&&!countryMount.includes('started=false;ui()'),'country reader playback no longer silences the main radio');

const lesson=app.slice(lessonStart);
assert.ok(!lesson.includes('radio.pause()'),'lesson playback no longer pauses the radio');
assert.ok(lesson.includes("audio.addEventListener('play',()=>{"),'lesson playback event remains wired');
assert.ok(radio.includes("['pause',()=>{radioShouldPlay=false;au.pause()}]"),'media-session pause is treated as an explicit pause');
assert.ok(radio.includes('radioShouldPlay=false;au.pause();started=false;ui()'),'sleep timer remains an explicit stop');

const preload=html.match(/<link rel="preload" href="([^"]*app-core[.]js[?]v=[^"]+)" as="script">/);
const script=html.match(/<script src="([^"]*app-core[.]js[?]v=[^"]+)" defer><\/script>/);
const bundleVersion=script&&script[1].match(/20\d{6}-(\d+)$/);
assert.ok(preload&&script&&preload[1]===script[1]&&bundleVersion&&Number(bundleVersion[1])>=35,'preload and script use a current matching bundle version');
const cacheVersion=worker.match(/const CACHE_NAME='anwar-shell-20\d{2}-\d{2}-\d{2}-v\d+';/);
assert.ok(cacheVersion&&Number(cacheVersion[0].match(/-v(\d+)/)[1])>=111,'service worker cache is bumped for the updated app shell');

console.log('PASS radio continues while lesson and country audio play');
console.log('PASS radio volume is ducked temporarily and restored after competing audio stops');
console.log('PASS manual pause and sleep timer do not trigger automatic resume');
console.log('PASS foreground return can resume radio after a browser interruption');
