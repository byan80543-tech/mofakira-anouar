import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root = new URL('../', import.meta.url);
const html = fs.readFileSync(new URL('index.html', root), 'utf8');
const worker = fs.readFileSync(new URL('service-worker.js', root), 'utf8');
const source = fs.readFileSync(new URL('ibtihalat-radio.js', root), 'utf8');
const css = fs.readFileSync(new URL('ibtihalat-radio.css', root), 'utf8');

new vm.Script(source, { filename: 'ibtihalat-radio.js' });

assert.match(html, /id="anwarRadioPage"[\s\S]*?id="anwarIbtihalat"/, 'the devotional playlist is placed inside the radio page');
assert.match(html, /id="ibtihalatAudio"[^>]*controls[^>]*preload="none"/, 'one native player is used and does not preload the large MP3 files');
assert.match(html, /href="\.\/ibtihalat-radio\.css\?v=/, 'the player stylesheet is versioned and locally referenced');
assert.match(html, /src="\.\/ibtihalat-radio\.js\?v=/, 'the player controller is versioned and locally referenced');
assert.equal((html.match(/data-ibtihalat-track=/g) || []).length, 2, 'exactly two selected recordings are shown');
assert.match(html, /يا رب إن عظمت ذنوبي/, 'the first selection is present');
assert.match(html, /أغيب وذو اللطائف لا يغيب/, 'the second selection is present and correctly named');
assert.match(html, /الملف 004/, 'the first recording is attributed to archive file 004');
assert.match(html, /الملف 007/, 'the second recording is attributed to archive file 007');
assert.match(html, /archive\.org\/details\/20240309_20240309_1714/, 'the archive item source is linked');
const cacheVersion=worker.match(/anwar-shell-\d{4}-\d{2}-\d{2}-v(\d+)/);
assert.ok(cacheVersion&&Number(cacheVersion[1])>=143, 'the service-worker cache version is bumped for current app resources');
assert.match(worker, /'\.\/ibtihalat-radio\.js'/, 'the new player controller is precached');
assert.match(worker, /'\.\/ibtihalat-radio\.css'/, 'the new player stylesheet is precached');
assert.match(css, /#ibtihalatAudio\{display:block;width:100%/, 'the native player remains full width');
assert.doesNotMatch(source, /\b(?:eval|Function)\s*\(/, 'the player does not use dynamic code execution');
assert.doesNotMatch(source, /\.innerHTML\s*=/, 'the player does not inject HTML strings');

class FakeButton {
  constructor(trackId) {
    this.dataset = { ibtihalatTrack: trackId };
    this.listeners = new Map();
    this.attributes = new Map();
    this.mark = { textContent: '▶' };
  }
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(callback);
  }
  querySelector(selector) {
    return selector === '.anwar-ibtihalat-play' ? this.mark : null;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  async click() {
    for (const callback of this.listeners.get('click') || []) await callback();
  }
}

class FakeAudio {
  constructor() {
    this.listeners = new Map();
    this.dataset = {};
    this.src = '';
    this.paused = true;
    this.ended = false;
    this.playCount = 0;
    this.pauseCount = 0;
    this.loadCount = 0;
  }
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(callback);
  }
  fire(type) {
    for (const callback of this.listeners.get(type) || []) callback();
  }
  load() { this.loadCount++; }
  async play() {
    this.playCount++;
    this.paused = false;
    this.ended = false;
    this.fire('playing');
  }
  pause() {
    if (!this.paused) {
      this.pauseCount++;
      this.paused = true;
      this.fire('pause');
    }
  }
}

const audio = new FakeAudio();
const title = { textContent: 'اختر ابتهالاً للاستماع' };
const status = { textContent: '' };
const buttons = [new FakeButton('ya-rab'), new FakeButton('aghayb')];
const section = {
  querySelector(selector) {
    if (selector === '#ibtihalatAudio') return audio;
    if (selector === '#ibtihalatNowPlaying') return title;
    if (selector === '#ibtihalatStatus') return status;
    return null;
  },
  querySelectorAll(selector) {
    return selector === '[data-ibtihalat-track]' ? buttons : [];
  }
};
const document = {
  getElementById(id) { return id === 'anwarIbtihalat' ? section : null; }
};

vm.runInNewContext(source, { document, console });

assert.equal(audio.src, '', 'nothing starts before the visitor selects a recording');
await buttons[0].click();
assert.match(audio.src, /004%20%20/, 'the first click loads the exact file 004 filename');
assert.match(audio.src, /archive\.org\/download\/20240309_20240309_1714\//, 'audio streams directly from the selected Archive item');
assert.equal(title.textContent, 'يا رب إن عظمت ذنوبي', 'the selected recording title is announced');
assert.equal(buttons[0].getAttribute('aria-pressed'), 'true', 'the selected track is exposed accessibly');
assert.match(status.textContent, /يُشغّل الآن/, 'successful playback updates the live status');

await buttons[1].click();
assert.match(audio.src, /007%20%20/, 'the second click loads the exact file 007 filename');
assert.equal(title.textContent, 'أغيب وذو اللطائف لا يغيب', 'the second recording is labelled with the selected devotional title');
assert.equal(audio.dataset.ibtihalatTrack, 'aghayb', 'the player tracks the second selection independently');

const playsBeforePause = audio.playCount;
await buttons[1].click();
assert.equal(audio.paused, true, 'pressing the selected playing track pauses it');
assert.equal(audio.playCount, playsBeforePause, 'pausing does not start a duplicate request');

await buttons[1].click();
assert.equal(audio.paused, false, 'pressing the selected paused track resumes it');
audio.fire('error');
assert.match(status.textContent, /تعذّر تحميل/, 'a remote file error is reported clearly');
audio.ended = true;
audio.paused = true;
audio.fire('ended');
assert.match(status.textContent, /انتهى/, 'completion updates the live status without unexpectedly auto-playing another recording');

console.log('PASS: both selected recordings use their exact Archive.org source files.');
console.log('PASS: one accessible native player supports select, pause, resume, and load-error states.');
