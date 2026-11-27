import assert from 'node:assert/strict';
import worker from '../workers/anwar-api-gateway/src/index.mjs';

const ADMIN_SECRET = 'anwar-owner-admin-test-secret-'.padEnd(64, 'x');
const allowedOrigin = 'https://mofakira-anouar.pages.dev';
const edgeKeys = [];
const rawPublicIp = '203.0.113.17';
const ownerRateBuckets = [];
const official = [];
let initialized = false;
let edgeAllowed = true;

const fakeStore = {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const json = (data, status = 200) => new Response(JSON.stringify(data), {
      status, headers: { 'Content-Type': 'application/json' }
    });
    if (path === '/entries' && method === 'GET') {
      return json({ initialized, entries: official });
    }
    if (path === '/initialize' && method === 'POST') {
      if (initialized) return json({ error: 'already_initialized' }, 409);
      const body = await request.json();
      official.push(...body.entries);
      initialized = true;
      return json({ initialized: true, count: official.length });
    }
    if (path === '/entry' && (method === 'POST' || method === 'PUT')) {
      if (!initialized) return json({ error: 'initialize_library_first' }, 409);
      const item = await request.json();
      const index = official.findIndex(entry => entry.id === item.id);
      if (index < 0) official.push(item);
      else official[index] = item;
      return json({ saved: true, entry: item });
    }
    const deleteEntry = /^\/entry\/([^/]+)$/.exec(path);
    if (deleteEntry && method === 'DELETE') {
      const index = official.findIndex(entry => entry.id === deleteEntry[1]);
      if (index >= 0) official.splice(index, 1);
      return json({ deleted: true });
    }
    return json({ error: 'not_found' }, 404);
  }
};

const ipLimiter = {
  idFromName: name => name,
  get: () => ({
    async fetch(input, init) {
      const request = input instanceof Request ? input : new Request(input, init);
      const body = await request.json();
      ownerRateBuckets.push(body.buckets[2]);
      return new Response(JSON.stringify({ allowed: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
  })
};

const edgeLimiter = {
  async limit({ key }) {
    edgeKeys.push(key);
    return { success: edgeAllowed };
  }
};

const env = {
  ALLOWED_ORIGINS: allowedOrigin,
  IP_HASH_SECRET: 'ip-hash-test-secret'.padEnd(64, 's'),
  ADHKAR_ADMIN_SECRET: ADMIN_SECRET,
  IP_LIMITER: ipLimiter,
  EDGE_LIMITER: edgeLimiter,
  ADHKAR_STORE: { idFromName: name => name, get: () => fakeStore }
};

function request(path, method = 'GET', body, token, origin = allowedOrigin, includeIp = true) {
  const headers = { Origin: origin };
  if (includeIp) headers['CF-Connecting-IP'] = '203.0.113.17';
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = 'Bearer ' + token;
  return new Request('https://gateway.example.workers.dev' + path, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body)
  });
}

async function call(path, method = 'GET', body, token, origin, includeIp = true) {
  return worker.fetch(request(path, method, body, token, origin, includeIp), env, {});
}

// Public reading needs no account, cookie, owner session, or persistent IP limiter.
// Cloudflare supplies the network address; the Worker immediately HMAC-pseudonymizes it.
const savedIpLimiter = env.IP_LIMITER;
env.IP_LIMITER = undefined;
let response = await call('/v1/adhkar', 'GET');
env.IP_LIMITER = savedIpLimiter;
assert.equal(response.status, 200, 'public visitors can read the official library without the app IP-limiter database');
let data = await response.json();
assert.equal(data.initialized, false, 'an empty store is clearly marked');
assert.deepEqual(data.entries, [], 'the public endpoint returns only official entries');
assert.equal(edgeKeys.length, 1, 'public reads use Cloudflare edge rate limiting');
assert.notEqual(edgeKeys[0], rawPublicIp, 'the edge limiter receives no raw IP address');
assert.equal(typeof edgeKeys[0], 'string', 'the per-network edge key is a pseudonymous HMAC');
assert.equal(ownerRateBuckets.length, 0, 'public reads do not write visitor identifiers to the app rate-limit database');
assert.equal(edgeKeys[0].length, 43, 'the edge key is a base64url HMAC, not a raw address');

edgeAllowed = false;
response = await call('/v1/adhkar', 'GET', undefined, undefined, undefined, false);
assert.equal(response.status, 429, 'the shared edge limit still protects the site from excessive public reads');
assert.equal(response.headers.get('Retry-After'), '60', 'edge throttling gives a retry delay');
edgeAllowed = true;

// All visitor write attempts are rejected; the retired suggestion API is gone.
response = await call('/v1/adhkar', 'POST', {
  group: 'التحصين', title: 'محاولة زائر', text: 'لا يسمح بالنشر العام', source: 'مرجع'
});
assert.equal(response.status, 405, 'the public read-only route rejects visitor writes at the route-policy boundary');

response = await call('/v1/adhkar/suggestions', 'POST', {
  group: 'التحصين', title: 'اقتراح', text: 'لا يستقبل الخادم اقتراحات الزوار'
});
assert.equal(response.status, 404, 'the visitor suggestion endpoint has been removed');

response = await call('/v1/admin/adhkar');
assert.equal(response.status, 401, 'the owner workspace cannot be read without an owner session');

response = await call('/v1/admin/adhkar', 'POST', {
  group: 'التحصين', title: 'محاولة نشر', text: 'غير مصرح', source: 'مرجع'
});
assert.equal(response.status, 401, 'a visitor cannot publish an official entry');

response = await call('/v1/admin/adhkar/example-entry', 'DELETE');
assert.equal(response.status, 401, 'a visitor cannot delete an official entry');

response = await call('/v1/admin/session', 'POST', { password: 'wrong-password' });
assert.equal(response.status, 401, 'incorrect owner passwords do not issue a session');

response = await call('/v1/admin/session', 'POST', { password: ADMIN_SECRET });
assert.equal(response.status, 200, 'the owner secret creates an authenticated session');
data = await response.json();
assert.ok(data.token && data.expiresIn === 1200, 'the owner session is signed and short-lived');
const token = data.token;
assert.ok(ownerRateBuckets.includes('admin-login'), 'owner login attempts are rate limited');

response = await call('/v1/admin/adhkar/initialize', 'POST', {
  entries: [{
    id: 'seed-entry',
    group: 'التحصين اليومي',
    title: 'ذكر أساسي',
    text: 'نص الذكر الأساسي',
    count: 1,
    occasion: '',
    source: 'القرآن الكريم',
    sourceUrl: 'https://quran.com',
    kind: 'dhikr'
  }]
}, token);
assert.equal(response.status, 200, 'the owner can initialize the shared official library once');

response = await call('/v1/admin/adhkar/initialize', 'POST', {
  entries: [{ id: 'seed-2', group: 'g', title: 't', text: 'x', source: 's' }]
}, token);
assert.equal(response.status, 409, 'initialization cannot overwrite the published library');

response = await call('/v1/admin/adhkar', 'POST', {
  group: 'العين والحسد',
  title: 'ذكر أضافه صاحب المفكرة',
  text: 'نص ذكر موثق',
  count: null,
  source: 'مرجع موثوق',
  sourceUrl: 'https://example.org/source',
  kind: 'dhikr'
}, token);
assert.equal(response.status, 200, 'the owner can add an official entry manually');

const added = official.find(item => item.title === 'ذكر أضافه صاحب المفكرة');
assert.ok(added, 'manual entries persist in the official store');

response = await call('/v1/admin/adhkar', 'PUT', {
  ...added,
  title: 'ذكر رسمي بعد التعديل',
  text: 'النص المصحح'
}, token);
assert.equal(response.status, 200, 'the owner can correct the wording of a published entry');
assert.equal(official.find(item => item.id === added.id).text, 'النص المصحح',
  'owner edits replace the shared official text');

response = await call('/v1/admin/adhkar/' + added.id, 'DELETE', undefined, token);
assert.equal(response.status, 200, 'the owner can remove an entry for all visitors');
assert.equal(official.some(item => item.id === added.id), false, 'deleted entries disappear from the official store');

response = await call('/v1/adhkar');
data = await response.json();
assert.equal(data.entries.length, 1, 'public readers see the current official library after owner edits');
assert.equal(data.entries[0].title, 'ذكر أساسي', 'only remaining approved entries are public');

response = await call('/v1/admin/adhkar', 'GET', undefined, token, 'https://attacker.example');
assert.equal(response.status, 403, 'unapproved origins are rejected before administration data is returned');

console.log('Owner-only adhkar tests passed: public read-only access, no visitor submissions, protected owner add/edit/delete and privacy-preserving edge limits.');
