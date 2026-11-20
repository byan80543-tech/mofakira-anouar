import assert from 'node:assert/strict';
import worker from '../workers/anwar-api-gateway/src/index.mjs';

const ADMIN_SECRET = 'anwar-admin-test-secret-'.padEnd(64, 'x');
const allowedOrigin = 'https://mofakira-anouar.pages.dev';
const routeBuckets = [];
const official = [];
const suggestions = [];
let initialized = false;

const fakeStore = {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const json = (data, status = 200) => new Response(JSON.stringify(data), {
      status, headers: { 'Content-Type': 'application/json' }
    });
    if (path === '/entries' && method === 'GET') return json({ initialized, entries: official });
    if (path === '/initialize' && method === 'POST') {
      if (initialized) return json({ error: 'already_initialized' }, 409);
      const body = await request.json();
      official.push(...body.entries);
      initialized = true;
      return json({ initialized: true, count: official.length });
    }
    if (path === '/suggestions' && method === 'POST') {
      suggestions.push(await request.json());
      return json({ accepted: true });
    }
    if (path === '/suggestions' && method === 'GET') return json({ suggestions });
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
    const approve = /^\/suggestion\/([^/]+)\/approve$/.exec(path);
    if (approve && method === 'POST') {
      if (!initialized) return json({ error: 'initialize_library_first' }, 409);
      const itemIndex = suggestions.findIndex(item => item.id === approve[1]);
      if (itemIndex < 0) return json({ error: 'suggestion_not_found' }, 404);
      const item = suggestions[itemIndex];
      if (!item.source) return json({ error: 'source_required_before_approval' }, 400);
      const body = await request.json();
      const published = { ...item, id: body.entryId };
      delete published.createdAt;
      official.push(published);
      suggestions.splice(itemIndex, 1);
      return json({ approved: true, entry: published });
    }
    const reject = /^\/suggestion\/([^/]+)\/reject$/.exec(path);
    if (reject && method === 'POST') {
      const index = suggestions.findIndex(item => item.id === reject[1]);
      if (index >= 0) suggestions.splice(index, 1);
      return json({ rejected: true });
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
      routeBuckets.push(body.buckets[2]);
      return new Response(JSON.stringify({ allowed: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
  })
};

const env = {
  ALLOWED_ORIGINS: allowedOrigin,
  IP_HASH_SECRET: 'ip-hash-test-secret'.padEnd(64, 's'),
  ADHKAR_ADMIN_SECRET: ADMIN_SECRET,
  IP_LIMITER: ipLimiter,
  ADHKAR_STORE: { idFromName: name => name, get: () => fakeStore }
};

function request(path, method = 'GET', body, token, origin = allowedOrigin) {
  const headers = {
    Origin: origin,
    'CF-Connecting-IP': '203.0.113.17'
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = 'Bearer ' + token;
  return new Request('https://gateway.example.workers.dev' + path, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body)
  });
}

async function call(path, method = 'GET', body, token, origin) {
  return worker.fetch(request(path, method, body, token, origin), env, {});
}

let response = await call('/v1/adhkar');
assert.equal(response.status, 200, 'public readers can fetch the approved library');
let data = await response.json();
assert.equal(data.initialized, false, 'an uninitialized store is clearly marked');
assert.deepEqual(data.entries, [], 'the public endpoint returns no pending proposals');

response = await call('/v1/adhkar/suggestions', 'POST', {
  group: 'التحصين اليومي',
  title: 'اقتراح أول',
  text: 'نص ذكر مقترح للاختبار',
  count: 3,
  occasion: 'صباحًا',
  source: 'مرجع تجريبي',
  sourceUrl: 'https://example.org/reference'
});
assert.equal(response.status, 202, 'a valid anonymous visitor suggestion is accepted');

response = await call('/v1/adhkar/suggestions', 'POST', {
  group: 'التحصين اليومي',
  title: 'رابط مرفوض',
  text: 'يجب رفض رابط غير آمن',
  source: 'مرجع',
  sourceUrl: 'javascript:alert(1)'
});
assert.equal(response.status, 400, 'non-HTTPS source links are rejected');

response = await call('/v1/admin/suggestions');
assert.equal(response.status, 401, 'pending suggestions are not publicly readable');

response = await call('/v1/admin/session', 'POST', { password: 'wrong-password' });
assert.equal(response.status, 401, 'incorrect admin passwords do not issue a session');

response = await call('/v1/admin/session', 'POST', { password: ADMIN_SECRET });
assert.equal(response.status, 200, 'the configured owner secret creates a session');
data = await response.json();
assert.ok(data.token && data.expiresIn === 1200, 'the admin session is signed and short-lived');
const token = data.token;

response = await call('/v1/admin/suggestions', 'GET', undefined, token);
assert.equal(response.status, 200, 'the owner can read the private moderation queue');
data = await response.json();
assert.equal(data.suggestions.length, 1, 'the suggestion is visible only in the owner queue');
assert.equal('email' in data.suggestions[0], false, 'the queue contains no contributor email');
assert.equal('name' in data.suggestions[0], false, 'the queue contains no contributor name');
assert.equal('ip' in data.suggestions[0], false, 'the queue contains no raw IP address');

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
assert.equal(response.status, 200, 'the owner can initialize the shared library once');

response = await call('/v1/admin/adhkar/initialize', 'POST', {
  entries: [{ id: 'seed-2', group: 'g', title: 't', text: 'x', source: 's' }]
}, token);
assert.equal(response.status, 409, 'the initial import cannot overwrite the existing library');

response = await call('/v1/admin/suggestions', 'GET', undefined, token);
data = await response.json();
const proposalId = data.suggestions[0].id;

response = await call('/v1/admin/suggestions/' + proposalId + '/approve', 'POST', {}, token);
assert.equal(response.status, 200, 'the owner can approve a sourced proposal');
data = await response.json();
assert.equal(data.approved, true, 'approval publishes the proposal');
assert.equal('createdAt' in data.entry, false, 'publication drops internal submission metadata');
assert.equal(suggestions.length, 0, 'the private queue entry is removed after approval');

response = await call('/v1/adhkar');
data = await response.json();
assert.equal(data.entries.length, 2, 'public readers receive only the seed and approved item');
assert.ok(!JSON.stringify(data).includes('contributor'), 'public data does not contain a contributor identity');

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
assert.ok(added, 'manual official entries persist in the shared store');

response = await call('/v1/admin/adhkar/' + added.id, 'DELETE', undefined, token);
assert.equal(response.status, 200, 'the owner can remove an official entry for every visitor');
assert.equal(official.some(item => item.id === added.id), false, 'deleted official entries are removed from the public store');

response = await call('/v1/admin/adhkar', 'GET', undefined, token, 'https://attacker.example');
assert.equal(response.status, 403, 'unapproved origins are rejected before any admin data is returned');

response = await call('/v1/admin/suggestions', 'GET', undefined);
assert.equal(response.status, 401, 'closing the admin session by losing the token protects the queue');

assert.ok(routeBuckets.includes('adhkar-read'), 'public reads are rate limited');
assert.ok(routeBuckets.includes('adhkar-suggestions'), 'visitor submissions are rate limited');
assert.ok(routeBuckets.includes('admin-login'), 'admin login attempts are rate limited');

console.log('Adhkar workflow tests passed: private queue, owner session, approval, public publishing, deletion and rate limits.');
