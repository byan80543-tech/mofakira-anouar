import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import worker, { IpRateLimiter } from "../workers/anwar-api-gateway/src/index.mjs";

const originalFetch = globalThis.fetch;
const originalCrypto = globalThis.crypto;
Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true, writable: true });
const originalDateNow = Date.now;
const oldCaches = globalThis.caches;
let now = 1_000_000;
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
        async fetch(request) {
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

  // Strict browser origin: a rejected request never reaches an upstream.
  let response = await worker.fetch(
    new Request("https://gateway.example.workers.dev/v1/reciters", {
      headers: { Origin: "https://attacker.example", "CF-Connecting-IP": "192.0.2.10" }
    }),
    baseEnv(),
    context
  );
  assert.equal(response.status, 403);
  assert.equal(calls, 0);

  // The edge binding must reject bursts before a Durable Object call or upstream request.
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

  // One global Durable Object call checks all scopes in a single request.
  const env = baseEnv();
  response = await worker.fetch(request("/v1/reciters"), env, context);
  if (response.status !== 200) console.error("gateway first request rejected:", await response.clone().text(), "crypto.subtle:", !!globalThis.crypto?.subtle);
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
  assert.equal(calls, 1, "cache hit does not call MP3Quran again");

  // Arbitrary URLs, unknown routes, duplicate query parameters and invalid slugs are rejected.
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

  // A route-specific 429 blocks before any provider request.
  const deniedEnv = { ...baseEnv(), IP_LIMITER: makeLimiter({ denyBucket: "country-list" }) };
  response = await worker.fetch(request("/v1/country/list?nationality=MA&page=1"), deniedEnv, context);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "17");
  assert.equal(calls, 1);

  // A missing HMAC secret fails closed; it never calls the rate limiter or upstream.
  const noSecretEnv = { ...baseEnv(), IP_HASH_SECRET: "" };
  response = await worker.fetch(request("/v1/reciters"), noSecretEnv, context);
  assert.equal(response.status, 503);
  assert.equal(calls, 1);

  // Exercise global, per-IP and route sliding windows through a fake SQLite adapter.
  const hits = [];
  const sql = {
    exec(statement, ...args) {
      if (statement.includes("CREATE TABLE") || statement.includes("CREATE INDEX")) {
        return { toArray: () => [] };
      }
      if (statement.startsWith("DELETE FROM rate_hits WHERE client_key = ? AND bucket = ?")) {
        const [client_key, bucket, cutoff] = args;
        for (let i = hits.length - 1; i >= 0; i -= 1) {
          if (hits[i].client_key === client_key && hits[i].bucket === bucket && hits[i].created_at <= cutoff) hits.splice(i, 1);
        }
        return { toArray: () => [] };
      }
      if (statement.startsWith("DELETE FROM rate_hits WHERE created_at <= ?")) {
        const [cutoff] = args;
        for (let i = hits.length - 1; i >= 0; i -= 1) {
          if (hits[i].created_at <= cutoff) hits.splice(i, 1);
        }
        return { toArray: () => [] };
      }
      if (statement.startsWith("SELECT COUNT(*) AS total, MIN(created_at) AS oldest")) {
        const [client_key, bucket] = args;
        const selected = hits.filter(hit => hit.client_key === client_key && hit.bucket === bucket).sort((a,b)=>a.created_at-b.created_at);
        return { toArray: () => [{ total: selected.length, oldest: selected[0]?.created_at ?? null }] };
      }
      if (statement.startsWith("SELECT COUNT(*) AS total FROM rate_hits")) {
        return { toArray: () => [{ total: hits.length }] };
      }
      if (statement.startsWith("INSERT INTO rate_hits")) {
        const [client_key, bucket, created_at] = args;
        hits.push({ client_key, bucket, created_at });
        return { toArray: () => [] };
      }
      throw new Error("Unexpected SQL in fake adapter: " + statement);
    }
  };
  const fakeStorage = {
    alarm: null,
    sql,
    async getAlarm() { return this.alarm; },
    async setAlarm(value) { this.alarm = value; }
  };
  const fakeCtx = {
    storage: fakeStorage,
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
  for (let i = 0; i < 12; i += 1) {
    last = await limiter.fetch(limiterRequest(clientA));
    assert.equal(last.status, 200, "first 12 country-list requests from one IP are accepted");
    now += 1;
  }
  last = await limiter.fetch(limiterRequest(clientA));
  assert.equal(last.status, 429, "13th country-list request from the same IP is blocked");
  assert.ok(Number(last.headers.get("Retry-After")) > 0);

  last = await limiter.fetch(limiterRequest(clientB));
  assert.equal(last.status, 200, "a different IP keeps its own per-IP allowance");

  now += 60_001;
  last = await limiter.fetch(limiterRequest(clientA));
  assert.equal(last.status, 200, "the blocked client is allowed again after the sliding window expires");

  // The total site-wide ceiling applies even when requests come from different IPs.
  hits.length = 0;
  for (let i = 0; i < 600; i += 1) {
    last = await limiter.fetch(limiterRequest(i.toString(16).padStart(64, "0"), "catalog"));
    if (i < 600) assert.equal(last.status, 200, "global allowance accepts request " + (i + 1));
  }
  last = await limiter.fetch(limiterRequest("f".repeat(64), "catalog"));
  assert.equal(last.status, 429, "the site-wide 601st request in the same window is blocked");
  const body = await last.json();
  assert.equal(body.bucket, "total");

  console.log("API gateway checks passed: strict origin, allowlisted routes, duplicate parameter rejection, HMAC IP keys, cache, and global/per-IP sliding windows.");
} finally {
  globalThis.fetch = originalFetch;
  Object.defineProperty(globalThis, "crypto", { value: originalCrypto, configurable: true, writable: true });
  Date.now = originalDateNow;
  if (oldCaches === undefined) delete globalThis.caches;
  else globalThis.caches = oldCaches;
}
