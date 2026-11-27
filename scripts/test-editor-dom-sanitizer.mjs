import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../editor-dom-sanitizer.js', import.meta.url), 'utf8');
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage();
  await page.setContent('<!doctype html><html><body><div id="pg" contenteditable="true"></div></body></html>');
  await page.addScriptTag({ content: source });

  const result = await page.evaluate(async () => {
    window.__anwarSanitizerCanary = 0;
    const editor = document.querySelector('#pg');
    const observer = window.AnwarEditorDomSanitizer.observe(editor);

    editor.innerHTML =
      '<p onclick="window.__anwarSanitizerCanary++" style="color:red;background-image:url(javascript:alert(1))">نص آمن</p>' +
      '<img src="broken:" onerror="window.__anwarSanitizerCanary++">' +
      '<svg onload="window.__anwarSanitizerCanary++"><circle></circle></svg>' +
      '<script>window.__anwarSanitizerCanary++</script>' +
      '<iframe srcdoc="<script>parent.__anwarSanitizerCanary++</script>"></iframe>' +
      '<a href="javascript:window.__anwarSanitizerCanary++">رابط غير آمن</a>' +
      '<div class="v" onclick="window.__anwarSanitizerCanary++"><span>صدر البيت</span><span>عجز البيت</span></div>';

    const immediatelyAfterInnerHTML = {
      activeNodes: editor.querySelectorAll('img,svg,script,iframe,object,embed,math,a,[onerror],[onload],[onclick],[srcdoc]').length,
      canary: window.__anwarSanitizerCanary
    };
    editor.insertAdjacentHTML('beforeend',
      '<img src="broken:" onerror="window.__anwarSanitizerCanary++"><a href="javascript:window.__anwarSanitizerCanary++">رابط آخر</a>');
    const immediatelyAfterAdjacentHTML = {
      activeNodes: editor.querySelectorAll('img,a,[onerror],[href^="javascript:" i]').length,
      canary: window.__anwarSanitizerCanary
    };

    await new Promise(resolve => setTimeout(resolve, 0));

    const paragraph = editor.querySelector('p');
    if (paragraph) paragraph.setAttribute('onmouseover', 'window.__anwarSanitizerCanary++');
    if (paragraph) paragraph.setAttribute('style', 'color:blue; background-image:url(https://invalid.example/x)');
    await new Promise(resolve => setTimeout(resolve, 0));

    const activeNodes = editor.querySelectorAll(
      'img,svg,script,iframe,object,embed,math,a,[onerror],[onload],[onclick],[onmouseover],[srcdoc],[href^="javascript:" i]'
    ).length;
    const unsafeAttributes = Array.from(editor.querySelectorAll('*'))
      .flatMap(element => Array.from(element.attributes || []))
      .filter(attribute => /^on/i.test(attribute.name) || /javascript:|url\s*\(/i.test(attribute.value)).length;
    const style = paragraph ? paragraph.getAttribute('style') : null;
    const verse = editor.querySelector('div.v');
    const state = {
      immediatelyAfterInnerHTML,
      immediatelyAfterAdjacentHTML,
      activeNodes,
      unsafeAttributes,
      canary: window.__anwarSanitizerCanary,
      textPreserved: editor.textContent.includes('نص آمن') &&
        editor.textContent.includes('رابط غير آمن') &&
        editor.textContent.includes('صدر البيت') &&
        editor.textContent.includes('عجز البيت'),
      verseClassPreserved: !!verse && verse.className === 'v',
      safeColorPreserved: !!style && style.includes('color:blue'),
      unsafeStyleRemoved: !style || !/url\s*\(/i.test(style)
    };
    observer.disconnect();
    return state;
  });

  assert.equal(result.immediatelyAfterInnerHTML.activeNodes, 0, 'innerHTML sink must sanitize synchronously before markup enters the editor');
  assert.equal(result.immediatelyAfterInnerHTML.canary, 0, 'no canary may execute during innerHTML assignment');
  assert.equal(result.immediatelyAfterAdjacentHTML.activeNodes, 0, 'insertAdjacentHTML sink must sanitize synchronously');
  assert.equal(result.immediatelyAfterAdjacentHTML.canary, 0, 'no canary may execute during adjacent HTML insertion');
  assert.equal(result.activeNodes, 0, 'active HTML elements/links must not remain in the editor');
  assert.equal(result.unsafeAttributes, 0, 'event and executable URL/style attributes must be removed');
  assert.equal(result.canary, 0, 'no XSS canary may execute');
  assert.equal(result.textPreserved, true, 'ordinary text must remain readable');
  assert.equal(result.verseClassPreserved, true, 'poetry verse-row class must remain available');
  assert.equal(result.safeColorPreserved, true, 'safe formatting must remain available');
  assert.equal(result.unsafeStyleRemoved, true, 'unsafe CSS declarations must be removed');

  console.log(JSON.stringify({ kind: 'editor-dom-sanitizer', status: 'PASS', ...result }));
} finally {
  await browser.close();
}
