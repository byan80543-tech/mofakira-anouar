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

  // Valid transcription upload reaches the bound Cloudflare AI model once.
  let modelCalls = 0;
  const aiEnv = {
    ...baseEnv(),
    AI: {
      async run(model, input) {
        modelCalls += 1;
        assert.equal(model, "@cf/openai/whisper-large-v3-turbo");
        assert.equal(input.task, "transcribe");
        assert.ok(typeof input.audio === "string" && input.audio.length > 0);
        return { transcription_info: { text: "هذا نص عربي تجريبي", word_count: 4 } };
      }
    }
  };
  const audioForm = new FormData();
  audioForm.append("audio", new Blob([new Uint8Array([1,2,3,4])], { type: "audio/mpeg" }), "sample.mp3");
  audioForm.append("consent", "true");
  response = await worker.fetch(new Request("https://gateway.example.workers.dev/v1/transcribe", {
    method: "POST",
    headers: { Origin: "https://byan80543-tech.github.io", "CF-Connecting-IP": "192.0.2.50" },
    body: audioForm
  }), aiEnv, context);
  assert.equal(response.status, 200);
  const transcriptResult = await response.json();
  assert.equal(transcriptResult.text, "هذا نص عربي تجريبي");
  assert.equal(transcriptResult.wordCount, 4);
  assert.equal(transcriptResult.language, "");
  assert.equal(modelCalls, 1);

  // Transcription rejects missing files, unsupported formats, untrusted origins and disabled AI.
  const missingForm = new FormData();
  missingForm.append("consent", "true");
  response = await worker.fetch(new Request("https://gateway.example.workers.dev/v1/transcribe", {
    method: "POST", headers: { Origin: "https://byan80543-tech.github.io", "CF-Connecting-IP": "192.0.2.51" }, body: missingForm
  }), aiEnv, context);
  assert.equal(response.status, 400);
  const unsupportedForm = new FormData();
  unsupportedForm.append("audio", new Blob(["not audio"], { type: "text/plain" }), "notes.txt");
  unsupportedForm.append("consent", "true");
  response = await worker.fetch(new Request("https://gateway.example.workers.dev/v1/transcribe", {
    method: "POST", headers: { Origin: "https://byan80543-tech.github.io", "CF-Connecting-IP": "192.0.2.52" }, body: unsupportedForm
  }), aiEnv, context);
  assert.equal(response.status, 415);
  const videoForm = new FormData();
  videoForm.append("audio", new Blob([new Uint8Array([1])], { type: "video/mp4" }), "video.mp4");
  videoForm.append("consent", "true");
  response = await worker.fetch(new Request("https://gateway.example.workers.dev/v1/transcribe", {
    method: "POST", headers: { Origin: "https://byan80543-tech.github.io", "CF-Connecting-IP": "192.0.2.55" }, body: videoForm
  }), aiEnv, context);
  assert.equal(response.status, 415, "video containers are rejected even when they may contain audio");
  const noConsentForm = new FormData();
  noConsentForm.append("audio", new Blob([new Uint8Array([1])], { type: "audio/mpeg" }), "a.mp3");
  response = await worker.fetch(new Request("https://gateway.example.workers.dev/v1/transcribe", {
    method: "POST", headers: { Origin: "https://byan80543-tech.github.io", "CF-Connecting-IP": "192.0.2.56" }, body: noConsentForm
  }), aiEnv, context);
  assert.equal(response.status, 400, "server rejects transcription without explicit consent");
  const blockedOriginForm = new FormData();
  blockedOriginForm.append("audio", new Blob([new Uint8Array([1])], { type: "audio/mpeg" }), "a.mp3");
  response = await worker.fetch(new Request("https://gateway.example.workers.dev/v1/transcribe", {
    method: "POST", headers: { Origin: "https://evil.example", "CF-Connecting-IP": "192.0.2.53" }, body: blockedOriginForm
  }), aiEnv, context);
  assert.equal(response.status, 403);
  const disabledAiEnv = { ...baseEnv(), AI: undefined };
  response = await worker.fetch(new Request("https://gateway.example.workers.dev/v1/transcribe", {
    method: "POST", headers: { Origin: "https://byan80543-tech.github.io", "CF-Connecting-IP": "192.0.2.54" }, body: (() => { const f = new FormData(); f.append("audio", new Blob([new Uint8Array([1])], { type: "audio/mpeg" }), "a.mp3"); return f; })()
  }), disabledAiEnv, context);
  assert.equal(response.status, 503);

  // The Durable Object validates transcription-only buckets and enforces daily caps.
  sql.exec("UPDATE rate_state SET data = ? WHERE id = 1", '{"global":[],"transcription":[],"clients":{}}');
  updateCalls = 0;
  const transcribeRequest = clientKey => new Request("https://rate-limit.internal/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientKey, buckets: ["total", "client", "transcribe-global", "transcribe"] })
  });
  const dailyClient = "c".repeat(64);
  for (let i = 0; i < 3; i += 1) {
    last = await limiter.fetch(transcribeRequest(dailyClient));
    assert.equal(last.status, 200);
  }
  last = await limiter.fetch(transcribeRequest(dailyClient));
  assert.equal(last.status, 429, "a fourth transcription per IP is blocked in the daily window");
  assert.equal((await last.json()).bucket, "transcribe");
  for (let i = 0; i < 7; i += 1) {
    last = await limiter.fetch(transcribeRequest((100 + i).toString(16).padStart(64, "0")));
    assert.equal(last.status, 200);
  }
  last = await limiter.fetch(transcribeRequest("d".repeat(64)));
  assert.equal(last.status, 429, "the 11th daily transcription is blocked globally");
  assert.equal((await last.json()).bucket, "transcribe-global");

  console.log("API gateway checks passed: origin, allowlist, cache, edge/IP limits, transcription upload, AI binding and daily quotas.");
} finally {
  globalThis.fetch = originalFetch;
  Object.defineProperty(globalThis, "crypto", { value: originalCrypto, configurable: true, writable: true });
  Date.now = originalDateNow;
  if (oldCaches === undefined) delete globalThis.caches;
  else globalThis.caches = oldCaches;
}
