import assert from 'node:assert/strict';

const target = process.env.ANWAR_TARGET_URL ||
  'https://mofakira-anouar.pages.dev/mofakira-anouar/';
const app = new URL(target);
if (!app.pathname.endsWith('/')) app.pathname += '/';
const origin = app.origin;
const failures = [];
const results = [];
const log = value => console.log(JSON.stringify(value));

async function request(url, options = {}) {
  return fetch(url, {
    redirect: 'follow',
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
    ...options
  });
}

function record(id, passed, details = {}) {
  results.push({ id, passed, ...details });
  if (!passed) failures.push(id + ': ' + JSON.stringify(details));
  log({ kind: 'perimeter-probe', id, passed, ...details });
}

try {
  const pageResponse = await request(app.href, {
    headers: { Accept: 'text/html' }
  });
  const headers = pageResponse.headers;
  const csp = headers.get('content-security-policy') || '';
  const xfo = headers.get('x-frame-options') || '';
  const nosniff = headers.get('x-content-type-options') || '';
  const referrer = headers.get('referrer-policy') || '';
  const permissions = headers.get('permissions-policy') || '';
  const hsts = headers.get('strict-transport-security') || '';

  record('live-page-status', pageResponse.status === 200, {
    status: pageResponse.status,
    finalUrl: pageResponse.url || app.href,
    contentType: headers.get('content-type'),
    cacheControl: headers.get('cache-control')
  });
  const cspChecks = {
    hasDefaultDeny: /(?:^|;)\s*default-src\s+'none'/i.test(csp),
    blocksObjects: /(?:^|;)\s*object-src\s+'none'/i.test(csp),
    blocksFraming: /(?:^|;)\s*frame-ancestors\s+'none'/i.test(csp),
    disallowsUnsafeEval: !/script-src[^;]*'unsafe-eval'/i.test(csp),
    disallowsUnsafeInlineScript: !/script-src[^;]*'unsafe-inline'/i.test(csp)
  };
  record('live-csp-header', Boolean(csp) && Object.values(cspChecks).every(Boolean), {
    present: Boolean(csp),
    directives: csp.split(';').map(x => x.trim()).filter(Boolean),
    ...cspChecks
  });
  record('x-frame-options', xfo.toUpperCase() === 'DENY', { value: xfo });
  record('mime-sniffing-protection', nosniff.toLowerCase() === 'nosniff', { value: nosniff });
  record('referrer-policy', referrer === 'strict-origin-when-cross-origin', { value: referrer });
  record('permissions-policy', /camera=\(\)/.test(permissions) && /geolocation=\(\)/.test(permissions), { value: permissions });
  record('hsts', /max-age=31536000/i.test(hsts) && !/includeSubDomains/i.test(hsts), { value: hsts });

  const headResponse = await request(app.href, { method: 'HEAD' });
  record('head-method', headResponse.status === 200, { status: headResponse.status });

  const publicRootFiles = ['robots.txt', 'sitemap.xml', 'privacy-security.html', 'privacy-security.json'];
  for (const file of publicRootFiles) {
    const response = await request(new URL('/' + file, origin).href);
    record('public-root-' + file, response.status === 200, {
      status: response.status,
      contentType: response.headers.get('content-type')
    });
    if (file.endsWith('.json') && response.status === 200) {
      let parsed = false;
      try { JSON.parse(await response.text()); parsed = true; } catch {}
      record('valid-json-' + file, parsed);
    }
  }

  const requiredAssets = [
    'index.html',
    'manifest.webmanifest',
    'service-worker.js',
    'app-core.js',
    'editor-dom-sanitizer.js',
    'vault-crypto.js',
    'vault-storage.js',
    'click-guard.js',
    'origin-shield.js',
    'api-gateway-config.js'
  ];
  let apiConfig = '';
  for (const file of requiredAssets) {
    const response = await request(new URL(file, app).href);
    const ok = response.status === 200;
    record('published-asset-' + file, ok, {
      status: response.status,
      contentType: response.headers.get('content-type'),
      nosniff: response.headers.get('x-content-type-options')
    });
    if (file === 'api-gateway-config.js' && ok) apiConfig = await response.text();
    if (file === 'manifest.webmanifest' && ok) {
      let manifest;
      try { manifest = JSON.parse(await response.text()); } catch {}
      const expectedScope = app.pathname;
      record('pwa-scope-boundary', Boolean(manifest) &&
        new URL(manifest.scope, origin).pathname === expectedScope &&
        new URL(manifest.start_url, origin).pathname === expectedScope, {
          scope: manifest?.scope,
          startUrl: manifest?.start_url,
          expectedScope
        });
    }
  }

  const confidentialOrNonWebPaths = [
    'android/README.md',
    'android/app/src/main/AndroidManifest.xml',
    'android/app/src/main/java/com/anwar/mofakira/MainActivity.kt',
    '_recovery/youtube-feature/index.html.before-youtube-removal',
    'scripts/test-live-input-bypass.mjs',
    '.github/workflows/quality.yml',
    'workers/anwar-api-gateway/src/index.mjs',
    'SECURITY-AUDIT.md',
    '.env',
    '.git/config',
    'wrangler.toml'
  ];
  const sourceMarkers = {
    'android/README.md': ['ANDROID-NATIVE', 'NATIVE_APP_MIGRATION', 'Kotlin'],
    'android/app/src/main/AndroidManifest.xml': ['<manifest', '<application', 'android.permission'],
    'android/app/src/main/java/com/anwar/mofakira/MainActivity.kt': ['class MainActivity', 'package com.anwar'],
    '_recovery/youtube-feature/index.html.before-youtube-removal': ['youtube-feature', 'before-youtube-removal'],
    'scripts/test-live-input-bypass.mjs': ['LIVE_INPUT_BYPASS_RESULT', 'ruleCases', "from 'playwright'"],
    '.github/workflows/quality.yml': ['name: Quality checks', 'pull_request:', 'live-xss-smoke:'],
    'workers/anwar-api-gateway/src/index.mjs': ['resolveGatewayAccess', 'ADHKAR_ADMIN_SECRET', 'export class AdhkarStore'],
    'SECURITY-AUDIT.md': ['Content-Security-Policy', 'مراجعة أمن', '## متابعة مراجعة'],
    '.env': ['CLOUDFLARE_API_TOKEN=', 'IP_HASH_SECRET=', 'OPENAI_API_KEY='],
    '.git/config': ['[core]', '[remote "origin"]'],
    'wrangler.toml': ['workers_dev =', '[[durable_objects.bindings]]', 'ALLOWED_ORIGINS']
  };
  for (const file of confidentialOrNonWebPaths) {
    const response = await request(new URL(file, app).href);
    const body = response.status === 200 ? await response.text() : '';
    const contentType = response.headers.get('content-type') || '';
    const markerList = sourceMarkers[file] || [];
    const leakedMarker = markerList.some(marker => body.includes(marker));
    const genericHtmlFallback = response.status === 200 &&
      contentType.toLowerCase().includes('text/html') &&
      body.length < 5000 && !leakedMarker;
    const safe = response.status !== 200 || genericHtmlFallback;
    record('not-published-' + file.replace(/[^a-z0-9]+/gi, '-'), safe, {
      status: response.status,
      contentType,
      bodyBytes: body.length,
      genericHtmlFallback,
      leakedMarker
    });
  }

  const traversalUrls = [
    app.href + '%2e%2e/android/README.md',
    app.href + '%252e%252e%252fandroid%252fREADME.md',
    app.href + '%2e%2e/_recovery/youtube-feature/README.md'
  ];
  for (let i = 0; i < traversalUrls.length; i++) {
    const response = await request(traversalUrls[i]);
    const body = response.status === 200 ? await response.text() : '';
    const contentType = response.headers.get('content-type') || '';
    const leaked = /AndroidManifest|NATIVE_APP_MIGRATION|youtube-feature|ANWAR_TARGET_URL|class MainActivity/i.test(body);
    const genericHtmlFallback = response.status === 200 &&
      contentType.toLowerCase().includes('text/html') &&
      body.length < 5000 && !leaked;
    record('encoded-path-traversal-' + (i + 1), !leaked && (response.status !== 200 || genericHtmlFallback), {
      status: response.status,
      leakedMarker: leaked,
      genericHtmlFallback,
      responseBytes: body.length
    });
  }

  const corsResponse = await request(new URL('api-gateway-config.js', app).href, {
    headers: { Origin: 'https://attacker.invalid', Accept: '*/*' }
  });
  const allowOrigin = corsResponse.headers.get('access-control-allow-origin');
  const allowCredentials = corsResponse.headers.get('access-control-allow-credentials');
  const safeStaticCors = allowOrigin === null ||
    (allowOrigin === '*' && String(allowCredentials).toLowerCase() !== 'true');
  record('static-public-cors-no-credentials', safeStaticCors, {
    accessControlAllowOrigin: allowOrigin,
    accessControlAllowCredentials: allowCredentials,
    classification: allowOrigin === '*' ? 'public anonymous static resource wildcard; no credentials' : 'no cross-origin grant'
  });

  const baseMatch = apiConfig.match(/ANWAR_API_GATEWAY_BASE\s*=\s*["']([^"']*)["']/);
  const gatewayBase = baseMatch ? baseMatch[1] : null;
  if (gatewayBase === '') {
    record('api-gateway-configuration', true, {
      configured: false,
      note: 'The public web config has an empty gateway URL; no live API gateway is attached to this web build.'
    });
  } else if (gatewayBase) {
    let gatewayUrl;
    try { gatewayUrl = new URL(gatewayBase); } catch {}
    const safeGateway = Boolean(gatewayUrl && gatewayUrl.protocol === 'https:' &&
      !gatewayUrl.username && !gatewayUrl.password);
    record('api-gateway-configuration', safeGateway, {
      configured: true,
      origin: safeGateway ? gatewayUrl.origin : 'invalid'
    });
    if (safeGateway) {
      const unauthorized = await request(new URL('/v1/admin/adhkar', gatewayUrl).href, {
        headers: { Origin: origin, Accept: 'application/json' }
      });
      record('admin-api-requires-authentication', unauthorized.status === 401, {
        status: unauthorized.status
      });
      const attackerCors = await request(new URL('/v1/adhkar', gatewayUrl).href, {
        headers: { Origin: 'https://attacker.invalid', Accept: 'application/json' }
      });
      record('gateway-rejects-untrusted-origin',
        attackerCors.status === 403 &&
        attackerCors.headers.get('access-control-allow-origin') !== 'https://attacker.invalid', {
          status: attackerCors.status,
          accessControlAllowOrigin: attackerCors.headers.get('access-control-allow-origin')
        });
    }
  } else {
    record('api-gateway-configuration', false, {
      configured: 'unknown',
      note: 'The public web config did not expose a parseable gateway base; inspect configuration manually.'
    });
  }

  const serviceWorkerResponse = await request(new URL('service-worker.js', app).href);
  const serviceWorkerText = serviceWorkerResponse.status === 200
    ? await serviceWorkerResponse.text()
    : '';
  const cacheName = serviceWorkerText.match(/CACHE_NAME\s*=\s*['"]([^'"]+)['"]/);
  record('service-worker-versioned-cache', Boolean(cacheName && cacheName[1].startsWith('anwar-shell-')), {
    status: serviceWorkerResponse.status,
    cacheName: cacheName?.[1] || null,
    cachesOnlyOwnShell: serviceWorkerText.includes("key.startsWith('anwar-shell-')")
  });

  const summary = {
    target: app.href,
    totalProbes: results.length,
    passed: results.filter(x => x.passed).length,
    failed: failures.length,
    gatewayConfigured: gatewayBase === '' ? false : Boolean(gatewayBase)
  };
  log({ kind: 'LIVE_PERIMETER_SUMMARY', ...summary });
  if (failures.length) {
    console.error('LIVE_PERIMETER_RESULT FAIL');
    console.error(failures.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('LIVE_PERIMETER_RESULT PASS');
  }
} catch (error) {
  console.error('LIVE_PERIMETER_RESULT ERROR');
  console.error(error?.stack || String(error));
  process.exitCode = 1;
}
