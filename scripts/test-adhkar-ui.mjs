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

assert.ok(html.includes('id="adhkarSuggestOpen"') && html.includes('id="adhkarAdminOpen"'),
  'the unified protection page exposes both proposal and owner controls');
assert.ok(html.includes('id="adhkarSuggestionDialog"') && html.includes('id="adhkarAdminDialog"'),
  'suggestion and admin forms are separate dialogs');
assert.ok(html.includes('name="group"') && html.includes('name="title"') && html.includes('name="text"'),
  'the suggestion form captures the dhikr content');
const suggestionFormStart = html.indexOf('<form id="adhkarSuggestionForm"');
const suggestionFormEnd = html.indexOf('</form>', suggestionFormStart);
const suggestionForm = html.slice(suggestionFormStart, suggestionFormEnd);
assert.doesNotMatch(suggestionForm, /<input[^>]+name="(?:email|phone|name|fullName|userId)"|<input[^>]+type="email"/i,
  'the visitor suggestion form does not request identity details');
assert.ok(html.includes('لا نطلب اسمك أو بريدك أو رقم هاتفك'),
  'the UI explains the anonymous contribution policy');

assert.ok(client.includes("credentials: 'omit'") && client.includes("referrerPolicy: 'no-referrer'"),
  'API requests omit credentials and referrers');
assert.ok(client.includes("headers.Authorization = 'Bearer ' + options.token"),
  'admin operations require an explicit bearer session token');
assert.doesNotMatch(client, /localStorage|sessionStorage|indexedDB|document.cookie/,
  'admin session tokens are not persisted in browser storage');
assert.equal(client.includes('.innerHTML'), false,
  'visitor-provided text is never inserted as HTML');
assert.ok(client.includes('node.textContent = String(text || \'\')'),
  'admin content is rendered as inert text');
assert.ok(client.includes('window.confirm('),
  'public deletion and moderation require explicit owner confirmation');
assert.ok(client.includes('window.AnwarSetProtectiveAdhkar'),
  'online approved items update the existing protective-adhkar renderer');

assert.ok(core.includes('window.AnwarSetProtectiveAdhkar=function(items)') &&
  core.includes('window.AnwarGetProtectiveAdhkar=function()'),
  'the app exposes a validated bridge for the local and shared official list');
assert.ok(worker.includes('export class AdhkarStore') &&
  worker.includes('CREATE TABLE IF NOT EXISTS adhkar_suggestions') &&
  worker.includes('CREATE TABLE IF NOT EXISTS adhkar_entries'),
  'the worker stores pending suggestions separately from approved entries');
assert.ok(worker.includes('verifyAdminSession') &&
  worker.includes('source_required_before_approval'),
  'the server verifies signed owner sessions and rejects unsourced approvals');
assert.ok(!worker.includes('submitter_email') && !worker.includes('submitter_name') &&
  !worker.includes('submitter_phone'),
  'the private store schema has no contributor identity fields');
assert.ok(wrangler.includes('name = "ADHKAR_STORE"') &&
  wrangler.includes('[exports.AdhkarStore]') &&
  wrangler.includes('storage = "sqlite"'),
  'the private store is a dedicated SQLite-backed Durable Object');
assert.ok(deploy.includes('ADHKAR_ADMIN_SECRET') && deploy.includes('secrets: |'),
  'the deployment workflow injects the admin secret as a Worker secret');
assert.ok(serviceWorker.includes("'./adhkar-management.js'") &&
  serviceWorker.includes('anwar-shell-2026-11-20-v121'),
  'the management module is included in the offline shell and cache version is bumped');

console.log('Adhkar UI privacy and offline integration tests passed.');
