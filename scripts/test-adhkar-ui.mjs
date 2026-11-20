import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const html = read('../index.html');
const client = read('../adhkar-management.js');
const core = read('../app-core.js');
const worker = read('../workers/anwar-api-gateway/src/index.mjs');
const wrangler = read('../workers/anwar-api-gateway/wrangler.toml');
const serviceWorker = read('../service-worker.js');
const deploy = read('../.github/workflows/deploy-anwar-api-gateway.yml');

const publicPageStart = html.indexOf('<section id="anwarAdhkarPage"');
const publicPageEnd = html.indexOf('<section id="anwarTasbihPage"', publicPageStart);
const publicPage = html.slice(publicPageStart, publicPageEnd);

assert.ok(html.includes('id="adhkarAdminOpen"') && html.includes('إدارة المالك'),
  'the protection page exposes only the owner management entry');
assert.ok(html.includes('للزوار القراءة فقط') && html.includes('صاحب المفكرة وحده'),
  'the visitor-facing notice clearly states read-only access');
assert.equal(publicPage.includes('adhkarSuggestOpen'), false,
  'there is no visitor suggestion control on the protection page');
assert.equal(publicPage.includes('<form'), false,
  'the visitor-facing protection page contains no write form');
assert.doesNotMatch(html, /adhkarSuggestionDialog|adhkarSuggestionForm|adhkarPendingList|اقتراحات الزوار|اقتراح ذكر/,
  'all visitor suggestion and moderation UI has been removed');

assert.ok(html.includes('id="adhkarAdminDialog"') && html.includes('id="adhkarAdminLogin"'),
  'the owner-only admin dialog remains available');
assert.ok(html.includes('id="adhkarOfficialForm"') && html.includes('id="adhkarOfficialList"'),
  'the owner can add, edit and remove official entries');

assert.ok(client.includes("credentials: 'omit'") && client.includes("referrerPolicy: 'no-referrer'"),
  'API requests omit browser credentials and referrers');
assert.ok(client.includes("headers.Authorization = 'Bearer ' + options.token"),
  'admin operations require an explicit owner session token');
assert.doesNotMatch(client, /localStorage|sessionStorage|indexedDB|document.cookie/,
  'admin session tokens are not persisted in browser storage');
assert.equal(client.includes('suggestion'), false,
  'the client has no visitor submission or moderation code');
assert.equal(client.includes('adhkarPending'), false,
  'the client no longer loads a private visitor queue');
assert.equal(client.includes('.innerHTML'), false,
  'entry content is rendered as text, not interpreted as HTML');
assert.ok(client.includes('node.textContent = String(text || \'\')'),
  'admin-managed content is displayed as inert text');
assert.ok(client.includes('window.confirm('),
  'removing an official item requires owner confirmation');
assert.ok(client.includes('window.AnwarSetProtectiveAdhkar'),
  'published entries refresh the shared protection renderer');

assert.ok(core.includes('window.AnwarSetProtectiveAdhkar=function(items)') &&
  core.includes('window.AnwarGetProtectiveAdhkar=function()'),
  'the app exposes a validated bridge for the official local fallback');
assert.ok(worker.includes('export class AdhkarStore') &&
  worker.includes('CREATE TABLE IF NOT EXISTS adhkar_entries'),
  'the worker stores the approved official library');
assert.equal(worker.includes('CREATE TABLE IF NOT EXISTS adhkar_suggestions'), false,
  'the worker no longer creates a visitor submission table');
assert.ok(worker.includes('DROP TABLE IF EXISTS adhkar_suggestions'),
  'any legacy visitor suggestion table is deleted during store initialization');
assert.equal(worker.includes('/v1/adhkar/suggestions'), false,
  'the public suggestion API route has been removed');
assert.equal(worker.includes('/v1/admin/suggestions'), false,
  'the private moderation API route has been removed');
assert.ok(worker.includes('verifyAdminSession') &&
  worker.includes('const authenticated = await verifyAdminSession'),
  'all owner write and administration routes are authenticated on the server');
assert.ok(worker.includes('signAdminPayload("adhkar-public-read:" + clientAddress, env.IP_HASH_SECRET)'),
  'public reads use a per-network HMAC key at Cloudflare edge without persisting the IP');
assert.ok(!worker.includes('rateLimitedAdhkar(request, env, "adhkar-read"'),
  'public library reads do not use per-IP rate limiting');
assert.ok(wrangler.includes('name = "ADHKAR_STORE"') &&
  wrangler.includes('[exports.AdhkarStore]') &&
  wrangler.includes('storage = "sqlite"'),
  'the official library is held in a dedicated SQLite-backed Durable Object');
assert.ok(deploy.includes('ADHKAR_ADMIN_SECRET') && deploy.includes('secrets: |'),
  'the owner credential is injected as a server-side Worker secret');
assert.ok(serviceWorker.includes("'./adhkar-management.js'") &&
  serviceWorker.includes('anwar-shell-2026-11-20-v123'),
  'the owner management module remains in the offline shell');

console.log('Owner-only adhkar UI, privacy and offline integration tests passed.');
