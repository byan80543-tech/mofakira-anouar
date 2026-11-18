import assert from "node:assert/strict";
import worker, { IpRateLimiter } from "../workers/anwar-api-gateway/src/index.mjs";

const originalFetch = globalThis.fetch;
const originalDateNow = Date.now;
const oldCaches = globalThis.caches;
let upstreamCalls = [];
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
  const counters = new Map();
  return {
    counters,
    idFromName(name) { return { name }; },
    get(id) {
      return {
        async fetch(request) {
          const { bucket } = await request.json();
          counters.set(bucket, (counters.get(bucket) || 0) + 1);
          if (bucket === denyBucket) {
            return new Response(JSON.stringify({ allowed: false, retryAfter: 17 }), {
              status: 429,
              headers: { "Content-Type": "application/json" }
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
  // The public gateway accepts only the exact website origin.
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ reciters: [{ name: "قارئ" }] }), {
      headers: { "Content-Type": "application/json" }
    });
  };

  let response = await worker.fetch(
    new Request("https://gateway.example.workers.dev/v1/reciters", {
      headers: { Origin: "https://attacker.example", "CF-Connecting-IP": "192.0.2.10" }
    }),
    baseEnv(),
    context
  );
  assert.equal(response.status, 403, "unknown browser origin is rejected");
  assert.equal(calls, 0, "rejected origin never reaches an upstream");

  // A valid catalog request is proxied once and cached.
  const env = baseEnv();
  response = await worker.fetch(request("/v1/reciters"), env, context);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://byan80543-tech.github.io");
  assert.equal(response.headers.get("X-Anwar-Gateway-Cache"), "MISS");
  assert.equal(calls, 1);
  await Promise.all(context.waits.splice(0));

  response = await worker.fetch(request("/v1/reciters"), env, context);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("X-Anwar-Gateway-Cache"), "HIT");
  assert.equal(calls, 1, "cache hit does not call MP3Quran again");

  // Unknown routes and arbitrary proxy parameters are rejected before fetch.
  response = await worker.fetch(request("/proxy?url=https://evil.example"), env, context);
  assert.equal(response.status, 404);
  response = await worker.fetch(request("/v1/country/list?nationality=MA&page=1&url=https://evil.example"), env, context);
  assert.equal(response.status, 400);
  response = await worker.fetch(request("/v1/country/list?nationality=ZZ&page=1"), env, context);
  assert.equal(response.status, 400);
  response = await worker.fetch(request("/v1/country/profile?slug=..%2F..%2Fevil"), env, context);
  assert.equal(response.status, 400);
  assert.equal(calls, 1, "invalid routes never reach an upstream");

  // Method restrictions and upstream host allowlisting.
  response = await worker.fetch(new Request("https://gateway.example.workers.dev/v1/radios", {
    method: "POST",
    headers: { Origin: "https://byan80543-tech.github.io", "CF-Connecting-IP": "192.0.2.10" }
  }), env, context);
  assert.equal(response.status, 405);

  // The global/route limiter can stop requests before the upstream call.
  const deniedEnv = { ...baseEnv(), IP_LIMITER: makeLimiter({ denyBucket: "country-list" }) };
  response = await worker.fetch(request("/v1/country/list?nationality=MA&page=1"), deniedEnv, context);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "17");
  assert.equal(calls, 1, "rate limited request does not contact an upstream");

  // Exercise the Durable Object's sliding-window limiter with a small fake SQLite adapter.
  const hits = [];
  const sql = {
    exec(statement, ...args) {
      if (statement.includes("CREATE TABLE") || statement.includes("CREATE INDEX")) {
        return { toArray: () => [] };
      }
      if (statement.startsWith("DELETE FROM rate_hits WHERE bucket = ?")) {
        const [bucket, cutoff] = args;
        for (let i = hits.length - 1; i >= 0; i -= 1) {
          if (hits[i].bucket === bucket && hits[i].created_at <= cutoff) hits.splice(i, 1);
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
      if (statement.startsWith("SELECT COUNT(*)")) {
        const [bucket] = args;
        const selected = hits.filter(hit => hit.bucket === bucket);
        return { toArray: () => [{ total: selected.length, oldest: selected[0]?.created_at ?? null }] };
      }
      if (statement.startsWith("INSERT INTO rate_hits")) {
        const [bucket, created_at] = args;
        hits.push({ bucket, created_at });
        return { toArray: () => [] };
      }
      throw new Error("Unexpected SQL in fake adapter: " + statement);
    }
  };
  const fakeCtx = {
    storage: {
      sql,
      async setAlarm() {}
    },
    blockConcurrencyWhile(callback) { callback(); }
  };
  const limiter = new IpRateLimiter(fakeCtx, {});
  const limiterRequest = () => new Request("https://rate-limit.internal/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bucket: "country-list" })
  });

  let last;
  for (let i = 0; i < 12; i += 1) {
    last = await limiter.fetch(limiterRequest());
    if (i < 12) {
      assert.equal(last.status, 200, "first 12 country-list requests are accepted");
    }
    now += 1;
  }
  last = await limiter.fetch(limiterRequest());
  assert.equal(last.status, 429, "13th country-list request is blocked");
  assert.ok(Number(last.headers.get("Retry-After")) > 0);
  now += 60_001;
  last = await limiter.fetch(limiterRequest());
  assert.equal(last.status, 200, "requests are allowed again after the sliding window expires");

  console.log("API gateway checks passed: strict origin, allowlisted routes, cache, 429 limit, and Durable Object sliding window.");
} finally {
  globalThis.fetch = originalFetch;
  Date.now = originalDateNow;
  if (oldCaches === undefined) delete globalThis.caches;
  else globalThis.caches = oldCaches;
}
