import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import worker, { IpRateLimiter } from "../workers/anwar-api-gateway/src/index.mjs";

const originalFetch = globalThis.fetch;
const originalCrypto = globalThis.crypto;
const oldCaches = globalThis.caches;
Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true, writable: true });
let now = 1_000_000;
const originalDateNow = Date.now;
Date.now = () => now;

const cacheEntries = new Map();
globalThis.caches = {
  default: {
    async match(request) {
      const hit = cacheEntries.get(request.url);
      return hit ? hit.clone() : undefined;
    },
    async put(request, response) {
      cacheEntries.set(request.url, response.clone());
    }
  }
};

function makeLimiter({ denyBucket = null } = {}) {
  const calls = [];
  const bucketsSeen = [];
  return {
    calls,
    bucketsSeen,
    idFromName(name) { return { name }; },
    get(id) {
      calls.push(id.name);
      return {
        async fetch(input, init) {
          const request = input instanceof Request ? input : new Request(input, init);
          const payload = await request.json();
          bucketsSeen.push(payload.buckets);
          if (payload.buckets.includes(denyBucket)) {
            return new Response(JSON.stringify({ allowed: false, retryAfter: 17 }), {
              status: 429,
              headers: { "Content-Type": "application/json", "Retry-After": "17" }
            });
          }
          return new Response(JSON.stringify({ allowed: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        }
      };
    }
  };
}

const context = {
  waits: [],
  waitUntil(promise) { this.waits.push(promise); }
};
const baseEnv = () => ({
  ALLOWED_ORIGIN: "https://byan80543-tech.github.io",
  IP_HASH_SECRET: "test-secret-only-for-unit-tests-32-characters-minimum",
  EDGE_LIMITER: { async limit() { return { success: true }; } },
  IP_LIMITER: makeLimiter()
});
const request = (path, options = {}) => new Request("https://gateway.example.workers.dev" + path, {
  method: options.method || "GET",
  headers: {
    Origin: "https://byan80543-tech.github.io",
    "CF-Connecting-IP": "192.0.2.10",
    ...(options.headers || {})
  }
});

try {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ reciters: [{ name: "قارئ" }] }), {
      headers: { "Content-Type": "application/json" }
    });
  };

  // Strict origin: a rejected request never reaches the upstream.
  let response = await worker.fetch(
    new Request("https://gateway.example.workers.dev/v1/reciters", {
      headers: { Origin: "https://attacker.example", "CF-Connecting-IP": "192.0.2.10" }
    }),
    baseEnv(),
    context
  );
  assert.equal(response.status, 403);
  assert.equal(calls, 0);

  // Edge binding rejects before the Durable Object and upstream.
  const edgeBlockedEnv = {
    ...baseEnv(),
    EDGE_LIMITER: { async limit() { return { success: false }; } },
    IP_LIMITER: makeLimiter()
  };
  response = await worker.fetch(request("/v1/reciters"), edgeBlockedEnv, context);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "60");
  assert.equal(edgeBlockedEnv.IP_LIMITER.calls.length, 0);
  assert.equal(calls, 0);

  // A valid catalog request checks all scopes in one Durable Object request.
  const env = baseEnv();
  response = await worker.fetch(request("/v1/reciters"), env, context);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://byan80543-tech.github.io");
  assert.equal(response.headers.get("X-Anwar-Gateway-Cache"), "MISS");
  assert.equal(calls, 1);
  assert.deepEqual(env.IP_LIMITER.bucketsSeen[0], ["total", "client", "catalog"]);
  assert.equal(env.IP_LIMITER.calls.length, 1);
  assert.equal(env.IP_LIMITER.calls[0], "anwar-api-gateway-global-rate-limiter");
  await Promise.all(context.waits.splice(0));

  response = await worker.fetch(request("/v1/reciters"), env, context);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("X-Anwar-Gateway-Cache"), "HIT");
  assert.equal(calls, 1, "cache hit does not call upstream again");

  // Arbitrary URLs, unknown routes, duplicate parameters and invalid slugs are rejected.
  response = await worker.fetch(request("/proxy?url=https://evil.example"), env, context);
  assert.equal(response.status, 404);
  response = await worker.fetch(request("/v1/country/list?nationality=MA&page=1&url=https://evil.example"), env, context);
  assert.equal(response.status, 400);
  response = await worker.fetch(request("/v1/country/list?nationality=ZZ&page=1"), env, context);
  assert.equal(response.status, 400);
  response = await worker.fetch(request("/v1/country/list?nationality=MA&nationality=EG&page=1"), env, context);
  assert.equal(response.status, 400);
  response = await worker.fetch(request("/v1/country/profile?slug=..%2F..%2Fevil"), env, context);
  assert.equal(response.status, 400);
  response = await worker.fetch(request("/v1/country/profile?slug=reader-one&slug=reader-two"), env, context);
  assert.equal(response.status, 400);
  assert.equal(calls, 1, "invalid routes never reach an upstream");

  response = await worker.fetch(new Request("https://gateway.example.workers.dev/v1/radios", {
    method: "POST",
    headers: { Origin: "https://byan80543-tech.github.io", "CF-Connecting-IP": "192.0.2.10" }
  }), env, context);
  assert.equal(response.status, 405);

  // A validated country route accepts HTML based on route and content type,
  // without treating URL-looking substrings inside response text as host proof.
  globalThis.fetch = async () => new Response("<html>" + "x".repeat(400) + "</html>", {
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });
  response = await worker.fetch(request("/v1/country/list?nationality=MA&page=1"), env, context);
  assert.equal(response.status, 200, "valid country HTML response does not depend on URL substrings");
  await Promise.all(context.waits.splice(0));

  // A redirect may only stay on explicitly approved upstream hosts.
  let redirectCalls = 0;
  globalThis.fetch = async () => {
    redirectCalls += 1;
    if (redirectCalls === 1) {
      return new Response(null, {
        status: 302,
        headers: { Location: "https://attacker.way2quran.com/ar/reciters/reader-one" }
      });
    }
    return new Response("<html>" + "x".repeat(400) + "/ar/reciters</html>", {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  };
  response = await worker.fetch(request("/v1/country/profile?slug=reader-one"), baseEnv(), context);
  assert.equal(response.status, 502, "redirect to an unapproved nested subdomain is rejected");
  assert.equal(redirectCalls, 1, "unapproved redirect is rejected before the second network request");

  // Approved host names are still rejected when a redirect embeds user credentials.
  redirectCalls = 0;
  globalThis.fetch = async () => {
    redirectCalls += 1;
    return new Response(null, {
      status: 302,
      headers: { Location: "https://user:secret@way2quran.com/ar/reciters/reader-one" }
    });
  };
  response = await worker.fetch(request("/v1/country/profile?slug=reader-one"), baseEnv(), context);
  assert.equal(response.status, 502, "credentialed redirect URLs are rejected");
  assert.equal(redirectCalls, 1, "credentialed redirect is blocked before a follow-up request");

  // A route-specific 429 blocks before contacting a provider.
  const deniedEnv = { ...baseEnv(), IP_LIMITER: makeLimiter({ denyBucket: "country-list" }) };
  response = await worker.fetch(request("/v1/country/list?nationality=MA&page=1"), deniedEnv, context);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "17");
  assert.equal(calls, 1);

  // A missing HMAC secret fails closed.
  const noSecretEnv = { ...baseEnv(), IP_HASH_SECRET: "" };
  response = await worker.fetch(request("/v1/reciters"), noSecretEnv, context);
  assert.equal(response.status, 503);
  assert.equal(calls, 1);

  // Exercise the one-row Durable Object limiter using a fake SQLite adapter.
  let dbState = null;
  let selectCalls = 0;
  let updateCalls = 0;
  const sql = {
    exec(statement, ...args) {
      if (statement.includes("CREATE TABLE IF NOT EXISTS rate_state")) {
        dbState ??= '{"global":[],"clients":{}}';
        return { toArray: () => [] };
      }
      if (statement.startsWith("SELECT data FROM rate_state")) {
        selectCalls += 1;
        return { toArray: () => dbState === null ? [] : [{ data: dbState }] };
      }
      if (statement.startsWith("UPDATE rate_state SET data = ?")) {
        updateCalls += 1;
        dbState = args[0];
        return { toArray: () => [] };
      }
      throw new Error("Unexpected limiter SQL: " + statement);
    }
  };
  const fakeCtx = {
    storage: { sql },
    blockConcurrencyWhile(callback) { callback(); }
  };
  const limiter = new IpRateLimiter(fakeCtx, {});
  const limiterRequest = (clientKey, routeBucket = "country-list") => new Request("https://rate-limit.internal/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientKey, buckets: ["total", "client", routeBucket] })
  });

  const clientA = "a".repeat(64);
  const clientB = "b".repeat(64);
  let last;
  for (let i = 0; i < 8; i += 1) {
    last = await limiter.fetch(limiterRequest(clientA));
    assert.equal(last.status, 200, "first eight country-list requests from one IP are accepted");
  }
  last = await limiter.fetch(limiterRequest(clientA));
  assert.equal(last.status, 429, "ninth country-list request from one IP is blocked");
  assert.equal((await last.json()).bucket, "country-list");
  assert.equal(updateCalls, 8, "blocked requests do not write the SQLite state row");

  last = await limiter.fetch(limiterRequest(clientB));
  assert.equal(last.status, 200, "a second IP has an independent allowance");

  let persisted = JSON.parse(dbState);
  assert.ok(Array.isArray(persisted.global));
  assert.equal(updateCalls, 9, "one SQLite row update persists all counters");
  assert.ok(selectCalls >= updateCalls);

  now += 60_001;
  last = await limiter.fetch(limiterRequest(clientA));
  assert.equal(last.status, 200, "the IP is allowed again after the sliding window expires");
  persisted = JSON.parse(dbState);
  assert.ok(!persisted.clients[clientB], "expired client entries are pruned");
  assert.equal(updateCalls, 10, "one row update persists the new state");

  // The global 50/min ceiling applies across many distinct IP addresses.
  sql.exec("UPDATE rate_state SET data = ? WHERE id = 1", '{"global":[],"clients":{}}');
  updateCalls = 0;
  for (let i = 0; i < 50; i += 1) {
    last = await limiter.fetch(limiterRequest(i.toString(16).padStart(64, "0"), "catalog"));
    assert.equal(last.status, 200, "global allowance accepts request " + (i + 1));
  }
  last = await limiter.fetch(limiterRequest("f".repeat(64), "catalog"));
  assert.equal(last.status, 429, "the 51st global request in the same window is blocked");
  assert.equal((await last.json()).bucket, "total");
  assert.equal(updateCalls, 50, "the rejected 51st request does not update the SQLite row");

  // The retired audio transcription endpoint is no longer exposed.
  response = await worker.fetch(new Request("https://gateway.example.workers.dev/v1/transcribe", {
    method: "POST",
    headers: { Origin: "https://byan80543-tech.github.io", "CF-Connecting-IP": "192.0.2.60" }
  }), baseEnv(), context);
  assert.equal(response.status, 404, "the removed audio transcription endpoint returns not found");


  // Authenticated owner endpoints remain rate-limited even with a valid signed token.
  const adminSecret = "owner-test-secret-32-characters-minimum";
  const adminStoreCalls = [];
  const adminStore = {
    idFromName(name) { return { name }; },
    get(id) {
      return {
        async fetch(input, init) {
          const storeRequest = input instanceof Request ? input : new Request(input, init);
          adminStoreCalls.push({ path: new URL(storeRequest.url).pathname, method: storeRequest.method });
          return new Response(JSON.stringify({ initialized: true, entries: [] }), {
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
          });
        }
      };
    }
  };
  const adminEnv = {
    ...baseEnv(),
    ADHKAR_ADMIN_SECRET: adminSecret,
    ADHKAR_STORE: adminStore
  };
  const loginRequest = new Request("https://gateway.example.workers.dev/v1/admin/session", {
    method: "POST",
    headers: {
      Origin: "https://byan80543-tech.github.io",
      "CF-Connecting-IP": "192.0.2.44",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ password: adminSecret })
  });
  const loginResponse = await worker.fetch(loginRequest, adminEnv, context);
  assert.equal(loginResponse.status, 200, "the valid owner secret creates a short-lived signed session");
  const session = await loginResponse.json();
  assert.equal(typeof session.token, "string");
  assert.ok(session.token.length > 20);

  const ownerRead = () => request("/v1/admin/adhkar", {
    method: "GET",
    headers: { Authorization: "Bearer " + session.token }
  });
  const ownerReadResponse = await worker.fetch(ownerRead(), adminEnv, context);
  assert.equal(ownerReadResponse.status, 200, "the signed owner token can read the private management view");
  assert.deepEqual(adminStoreCalls.at(-1), { path: "/entries", method: "GET" });
  assert.deepEqual(
    adminEnv.IP_LIMITER.bucketsSeen.at(-1),
    ["total", "client", "admin-api"],
    "authenticated owner operations use the dedicated admin-api bucket"
  );

  const deniedAdminEnv = {
    ...adminEnv,
    IP_LIMITER: makeLimiter({ denyBucket: "admin-api" })
  };
  const callsBeforeDeniedAdmin = adminStoreCalls.length;
  const deniedOwnerRead = await worker.fetch(ownerRead(), deniedAdminEnv, context);
  assert.equal(deniedOwnerRead.status, 429, "owner management calls are blocked when the admin API bucket is exhausted");
  assert.equal(deniedOwnerRead.headers.get("Retry-After"), "17");
  assert.equal(adminStoreCalls.length, callsBeforeDeniedAdmin, "rate-limited management requests never reach the data store");

  const forgedOwnerRead = await worker.fetch(request("/v1/admin/adhkar", {
    method: "GET",
    headers: { Authorization: "Bearer " + "x".repeat(48) }
  }), adminEnv, context);
  assert.equal(forgedOwnerRead.status, 401, "a forged bearer token cannot reach the management store");
  assert.equal(adminStoreCalls.length, callsBeforeDeniedAdmin, "invalid owner tokens are rejected before store access");

  // Chunked/streamed bodies without Content-Length are bounded while reading.
  let oversizedBodyCancelled = false;
  const oversizedStream = new ReadableStream({
    pull(controller) {
      controller.enqueue(new TextEncoder().encode('{"password":"' + "x".repeat(5000) + '"}'));
    },
    cancel() { oversizedBodyCancelled = true; }
  });
  const oversizedLogin = new Request("https://gateway.example.workers.dev/v1/admin/session", {
    method: "POST",
    headers: {
      Origin: "https://byan80543-tech.github.io",
      "CF-Connecting-IP": "192.0.2.44",
      "Content-Type": "application/json"
    },
    body: oversizedStream,
    duplex: "half"
  });
  assert.equal(oversizedLogin.headers.has("Content-Length"), false, "the oversized-body test omits Content-Length");
  const oversizedResponse = await worker.fetch(oversizedLogin, adminEnv, context);
  assert.equal(oversizedResponse.status, 401, "an oversized streamed login body is rejected");
  assert.equal(oversizedBodyCancelled, true, "the Worker cancels the body stream as soon as its byte limit is exceeded");

  // The Durable Object accepts the dedicated admin-api bucket and persists it.
  sql.exec("UPDATE rate_state SET data = ? WHERE id = 1", '{"global":[],"clients":{}}');
  last = await limiter.fetch(limiterRequest("c".repeat(64), "admin-api"));
  assert.equal(last.status, 200, "the Durable Object accepts the dedicated admin-api bucket");
  persisted = JSON.parse(dbState);
  assert.ok(Array.isArray(persisted.clients["c".repeat(64)]["admin-api"]));

  // Twenty owner-login attempts are allowed per IP in a 15-minute sliding window.
  sql.exec("UPDATE rate_state SET data = ? WHERE id = 1", '{"global":[],"clients":{}}');
  for (let i = 0; i < 20; i += 1) {
    last = await limiter.fetch(limiterRequest("d".repeat(64), "admin-login"));
    assert.equal(last.status, 200, "owner login attempt " + (i + 1) + " is within the 20-attempt window");
  }
  last = await limiter.fetch(limiterRequest("d".repeat(64), "admin-login"));
  assert.equal(last.status, 429, "the 21st owner login attempt in the 15-minute window is blocked");
  assert.equal((await last.json()).bucket, "admin-login");
  now += 15 * 60_000 + 1;
  last = await limiter.fetch(limiterRequest("d".repeat(64), "admin-login"));
  assert.equal(last.status, 200, "the owner IP is allowed again after the login window expires");

  // Passwords above 128 Unicode code points are rejected by the Worker.
  const longUnicodeLogin = new Request("https://gateway.example.workers.dev/v1/admin/session", {
    method: "POST",
    headers: {
      Origin: "https://byan80543-tech.github.io",
      "CF-Connecting-IP": "192.0.2.45",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ password: "😀".repeat(129) })
  });
  const longUnicodeResponse = await worker.fetch(longUnicodeLogin, adminEnv, context);
  assert.equal(longUnicodeResponse.status, 401, "oversized Unicode owner passwords are rejected");

  // The Durable Object no longer accepts transcription-only daily quota buckets.
  const obsoleteQuotaRequest = new Request("https://rate-limit.internal/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientKey: "e".repeat(64),
      buckets: ["total", "client", "transcribe-global", "transcribe"]
    })
  });
  const obsoleteQuotaResponse = await limiter.fetch(obsoleteQuotaRequest);
  assert.equal(obsoleteQuotaResponse.status, 400, "transcription-only rate-limit buckets are rejected");

  console.log("API gateway checks passed: origin, allowlist, SSRF redirects, bounded request bodies, owner-token authentication, admin/API rate limits, cache and retired endpoint.");
} finally {
  globalThis.fetch = originalFetch;
  Object.defineProperty(globalThis, "crypto", { value: originalCrypto, configurable: true, writable: true });
  Date.now = originalDateNow;
  if (oldCaches === undefined) delete globalThis.caches;
  else globalThis.caches = oldCaches;
}
