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

  // Exercise the one-row Durable Object limiter using a fake KV storage adapter.
  const store = new Map();
  let gets = 0;
  let puts = 0;
  const fakeStorage = {
    async get(key) {
      gets += 1;
      const value = store.get(key);
      return value === undefined ? undefined : structuredClone(value);
    },
    async put(key, value) {
      puts += 1;
      store.set(key, structuredClone(value));
    }
  };
  const limiter = new IpRateLimiter({ storage: fakeStorage }, {});
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
  assert.equal(puts, 8, "blocked requests do not write storage");

  last = await limiter.fetch(limiterRequest(clientB));
  assert.equal(last.status, 200, "a second IP has an independent allowance");

  const stateBefore = await fakeStorage.get("anwar-rate-state-v1");
  assert.ok(stateBefore && Array.isArray(stateBefore.global));
  assert.equal(puts, 9);
  assert.ok(gets >= puts);

  now += 60_001;
  last = await limiter.fetch(limiterRequest(clientA));
  assert.equal(last.status, 200, "the IP is allowed again after the sliding window expires");
  const stateAfter = await fakeStorage.get("anwar-rate-state-v1");
  assert.ok(!stateAfter.clients[clientB], "expired client entries are pruned");
  assert.equal(puts, 10, "one write persists all updated counters");

  // The global 50/min ceiling applies across many distinct IP addresses.
  await fakeStorage.put("anwar-rate-state-v1", { global: [], clients: {} });
  puts = 0;
  for (let i = 0; i < 50; i += 1) {
    last = await limiter.fetch(limiterRequest(i.toString(16).padStart(64, "0"), "catalog"));
    assert.equal(last.status, 200, "global allowance accepts request " + (i + 1));
  }
  last = await limiter.fetch(limiterRequest("f".repeat(64), "catalog"));
  assert.equal(last.status, 429, "the 51st global request in the same window is blocked");
  assert.equal((await last.json()).bucket, "total");
  assert.equal(puts, 50, "the rejected 51st request does not add a storage write");

  console.log("API gateway checks passed: origin, allowlist, cache, edge and IP limits, one-row storage, and global sliding window.");
} finally {
  globalThis.fetch = originalFetch;
  Object.defineProperty(globalThis, "crypto", { value: originalCrypto, configurable: true, writable: true });
  Date.now = originalDateNow;
  if (oldCaches === undefined) delete globalThis.caches;
  else globalThis.caches = oldCaches;
}
