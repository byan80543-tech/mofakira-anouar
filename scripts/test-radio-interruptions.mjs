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
assert.ok(playBody.includes('radioShouldPlay=true'),'starting playback records the visitor intent');
assert.ok(!playBody.includes("lesson.pause()")&&!playBody.includes('__anwarStopCountryAudio'),'starting the radio does not stop other in-app audio');
assert.ok(!toggleBody.includes('__anwarStopCountryAudio'),'toggling the radio does not stop other players');
assert.ok(toggleBody.includes('radioShouldPlay=false'),'manual pause clears the resume intent');

assert.ok(radio.includes('function syncRadioDucking()'),'radio ducking helper exists');
assert.ok(radio.includes('anotherAudioIsPlaying?0.28:1'),'radio is lowered, not paused, while another in-app audio element plays');
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
assert.ok(preload&&script&&preload[1]===script[1]&&script[1].endsWith('20261119-11'),'preload and script use the same new bundle version');
assert.ok(worker.includes("const CACHE_NAME='anwar-shell-2026-11-19-v93';"),'service worker cache is bumped for the updated app shell');

console.log('PASS radio continues while lesson and country audio play');
console.log('PASS radio volume is ducked temporarily and restored after competing audio stops');
console.log('PASS manual pause and sleep timer do not trigger automatic resume');
console.log('PASS foreground return can resume radio after a browser interruption');
