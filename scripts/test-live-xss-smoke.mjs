import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const target = process.env.ANWAR_TARGET_URL ||
  'https://mofakira-anouar.pages.dev/mofakira-anouar/';
const baseOrigin = new URL(target).origin;
const vectors = [
  '<script>alert(1)</script>',
  '<img src=x onerror="window.__ANWAR_XSS_CANARY__=true">',
  '<svg onload="window.__ANWAR_XSS_CANARY__=true"></svg>',
  '<iframe src="javascript:alert(1)"></iframe>',
  'javascript:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'https://example.test/?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E',
  'https://example.test/%2e%2e/%2e%2e/probe',
  '%3Csvg%20onload%3Dalert(1)%3E',
  'XSS',
  'SQL injection',
  'تجاوز الحماية',
  'سرقة الجلسة'
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const failures = [];
const results = [];

try {
  // Prevent optional third-party resources from being contacted during this
  // input-only smoke test. The target application itself remains live.
  await page.route('**/*', route => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.origin !== baseOrigin) return route.abort();
    return route.continue();
  });

  await page.addInitScript(() => {
    window.__ANWAR_XSS_CANARY__ = false;
  });

  const response = await page.goto(target, {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });
  assert(response, 'The live page did not return a navigation response.');
  assert(response.ok(), 'Live page returned HTTP ' + response.status() + '.');

  const headers = await response.allHeaders();
  console.log('LIVE_TARGET ' + page.url());
  console.log('HTTP_STATUS ' + response.status());
  console.log('CSP_PRESENT ' + Boolean(headers['content-security-policy']));

  // This browser context starts empty. The app requires a local vault setup
  // before private editing; create a disposable test-only vault in this isolated
  // browser profile so no real user data or remote account is touched.
  const gate = page.locator('#vaultGate');
  if (await gate.isVisible()) {
    const temporaryPassphrase = 'Anwar-Live-Smoke-Only-2026!NoReuse';
    await page.locator('#vaultPassword').fill(temporaryPassphrase);
    await page.locator('#vaultPasswordConfirm').fill(temporaryPassphrase);
    await page.locator('#vaultForm').evaluate(form => form.requestSubmit());
    await gate.waitFor({ state: 'hidden', timeout: 30000 });
  }

  const editor = page.locator('#pg');
  await editor.waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForFunction(
    () => window.AnwarShield3D && typeof window.AnwarShield3D.inspect === 'function',
    { timeout: 15000 }
  );

  const focusEditor = async () => editor.evaluate(element => {
    element.focus();
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  });

  // Never click Save or export. All test-only storage remains in this temporary
  // browser context and is discarded when Chromium closes.

  for (const payload of vectors) {
    const paste = await page.evaluate(value => {
      const editorElement = document.querySelector('#pg');
      editorElement.replaceChildren();
      const data = new DataTransfer();
      data.setData('text/plain', value);
      const event = new ClipboardEvent('paste', {
        clipboardData: data,
        bubbles: true,
        cancelable: true
      });
      editorElement.dispatchEvent(event);
      return {
        prevented: event.defaultPrevented,
        text: editorElement.textContent || '',
        activeElements: editorElement.querySelectorAll(
          'script, img, svg, iframe, object, embed, math'
        ).length
      };
    }, payload);

    const pasteBlocked = paste.prevented && paste.text === '' &&
      paste.activeElements === 0;
    results.push({ mode: 'paste', payload, blocked: pasteBlocked });
    if (!pasteBlocked) {
      failures.push('Paste was not fully rejected: ' + JSON.stringify(payload));
    }

    await editor.evaluate(element => { element.replaceChildren(); });
    await focusEditor();
    await page.keyboard.insertText(payload);
    await page.waitForTimeout(80);

    const typed = await editor.evaluate(element => ({
      text: element.textContent || '',
      activeElements: element.querySelectorAll(
        'script, img, svg, iframe, object, embed, math'
      ).length
    }));
    const canary = await page.evaluate(() => window.__ANWAR_XSS_CANARY__ === true);
    const typingBlocked = typed.text === '' && typed.activeElements === 0;
    results.push({
      mode: 'typing',
      payload,
      blocked: typingBlocked,
      activeElements: typed.activeElements,
      canary
    });
    if (!typingBlocked) {
      failures.push(
        'Typing filter did not fully reject payload (markup remained inert unless canary fired): ' +
        JSON.stringify(payload) + '; text=' + JSON.stringify(typed.text)
      );
    }
    if (canary) failures.push('XSS canary executed for ' + JSON.stringify(payload));

    await editor.evaluate(element => { element.replaceChildren(); });
  }

  const benign = 'هذه ملاحظة أدبية عادية عن المطر والقصيدة.';
  await focusEditor();
  await page.keyboard.insertText(benign);
  await page.waitForTimeout(80);
  const benignText = await editor.textContent();
  const benignPass = benignText === benign;
  results.push({ mode: 'benign-control', blocked: !benignPass, text: benignText });
  if (!benignPass) failures.push('The benign Arabic writing control was unexpectedly blocked.');

  console.log('PROBES_TOTAL ' + results.length);
  console.log('PROBES_BLOCKED ' + results.filter(r => r.blocked).length);
  for (const result of results) {
    console.log('PROBE ' + JSON.stringify(result));
  }

  // Clear the ephemeral test editor and browser storage before closing.
  await page.evaluate(() => {
    const element = document.querySelector('#pg');
    if (element) element.replaceChildren();
    try { localStorage.clear(); } catch {}
    try { sessionStorage.clear(); } catch {}
  });

  assert.equal(failures.length, 0, failures.join('\n'));
  console.log('LIVE_XSS_SMOKE_RESULT PASS');
} catch (error) {
  console.error('LIVE_XSS_SMOKE_RESULT FAIL');
  console.error(error?.stack || String(error));
  process.exitCode = 1;
} finally {
  await browser.close();
}
