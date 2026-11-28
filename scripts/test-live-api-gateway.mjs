import assert from "node:assert/strict";

const rawBase = String(process.env.ANWAR_API_GATEWAY_BASE || "").trim();
assert.ok(rawBase, "ANWAR_API_GATEWAY_BASE is required for the live gateway smoke test");

const base = new URL(rawBase);
const labels = base.hostname.toLowerCase().split(".");
assert.equal(base.protocol, "https:", "the gateway must use HTTPS");
assert.equal(labels.length, 4, "the gateway hostname must have exactly four labels");
assert.equal(labels[0], "anwar-api-gateway", "unexpected Worker name");
assert.equal(labels[2], "workers", "unexpected Workers host");
assert.equal(labels[3], "dev", "unexpected Workers host");
assert.match(labels[1], /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/, "invalid account subdomain");
assert.equal(base.username, "", "credentials are forbidden in the gateway URL");
assert.equal(base.password, "", "credentials are forbidden in the gateway URL");
assert.equal(base.port, "", "non-default ports are forbidden");
assert.equal(base.pathname, "/", "only the Worker origin may be configured");
assert.equal(base.search, "", "query strings are forbidden in the Worker origin");
assert.equal(base.hash, "", "fragments are forbidden in the Worker origin");

const ORIGIN = "https://mofakira-anouar.pages.dev";
const failures = [];
const results = [];
const log = value => console.log(JSON.stringify(value));

async function request(path, { origin = ORIGIN, method = "GET", headers = {} } = {}) {
  return fetch(new URL(path, base).href, {
    method,
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
    headers: {
      ...(origin === null ? {} : { Origin: origin }),
      Accept: "application/json",
      ...headers
    }
  });
}

async function expect(id, callback) {
  try {
    const details = await callback();
    results.push({ id, passed: true, ...details });
    log({ id, passed: true, ...details });
  } catch (error) {
    failures.push(id + ": " + (error?.stack || String(error)));
    results.push({ id, passed: false, error: String(error) });
    log({ id, passed: false, error: String(error) });
  }
}

function assertTrustedCors(response) {
  assert.equal(response.headers.get("access-control-allow-origin"), ORIGIN);
  assert.equal(response.headers.get("access-control-allow-credentials"), null);
  assert.equal(response.headers.get("vary")?.toLowerCase(), "origin");
}

await expect("reciter-catalog", async () => {
  const response = await request("/v1/reciters");
  assert.equal(response.status, 200);
  assertTrustedCors(response);
  assert.match(response.headers.get("content-type") || "", /application\/json/i);
  const data = await response.json();
  assert.ok(data && Array.isArray(data.reciters), "expected a reciters array");
  return { status: response.status, records: data.reciters.length };
});

await expect("radio-catalog", async () => {
  const response = await request("/v1/radios");
  assert.equal(response.status, 200);
  assertTrustedCors(response);
  assert.match(response.headers.get("content-type") || "", /application\/json/i);
  const data = await response.json();
  assert.ok(data && Array.isArray(data.radios), "expected a radios array");
  return { status: response.status, stations: data.radios.length };
});

await expect("public-adhkar-read", async () => {
  const response = await request("/v1/adhkar");
  assert.equal(response.status, 200);
  assertTrustedCors(response);
  assert.match(response.headers.get("content-type") || "", /application\/json/i);
  const data = await response.json();
  assert.equal(typeof data.initialized, "boolean");
  assert.ok(Array.isArray(data.entries), "expected the public entries array");
  return { status: response.status, initialized: data.initialized, entries: data.entries.length };
});

await expect("admin-read-requires-owner-session", async () => {
  const response = await request("/v1/admin/adhkar");
  assert.equal(response.status, 401, "an unsigned visitor must not read the owner library");
  assertTrustedCors(response);
  return { status: response.status };
});

await expect("admin-write-requires-owner-session", async () => {
  const response = await request("/v1/admin/adhkar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  assert.equal(response.status, 401, "an unsigned visitor must not write the owner library");
  assertTrustedCors(response);
  return { status: response.status };
});

await expect("trusted-admin-preflight-is-scoped", async () => {
  const response = await request("/v1/admin/adhkar", {
    method: "OPTIONS",
    headers: {
      "Access-Control-Request-Method": "GET",
      "Access-Control-Request-Headers": "authorization,content-type"
    }
  });
  assert.equal(response.status, 204);
  assertTrustedCors(response);
  const methods = response.headers.get("access-control-allow-methods") || "";
  assert.ok(methods.includes("GET") && methods.includes("POST") && methods.includes("PUT"));
  assert.ok(!methods.includes("DELETE"), "collection route must not expose DELETE");
  return { status: response.status, methods };
});

await expect("untrusted-origin-is-denied", async () => {
  const response = await request("/v1/reciters", { origin: "https://attacker.invalid" });
  assert.equal(response.status, 403);
  assert.notEqual(response.headers.get("access-control-allow-origin"), "https://attacker.invalid");
  return { status: response.status };
});

await expect("unknown-route-is-denied", async () => {
  const response = await request("/v1/admin/users");
  assert.equal(response.status, 404);
  return { status: response.status };
});

await expect("method-substitution-is-denied", async () => {
  const response = await request("/v1/reciters", { method: "POST" });
  assert.equal(response.status, 405);
  assert.match(response.headers.get("allow") || "", /GET/);
  return { status: response.status, allow: response.headers.get("allow") };
});

await expect("client-supplied-upstream-url-is-denied", async () => {
  const response = await request("/v1/reciters?url=https%3A%2F%2Fattacker.invalid");
  assert.equal(response.status, 400);
  return { status: response.status };
});

await expect("invalid-country-is-denied", async () => {
  const response = await request("/v1/country/list?nationality=ZZ&page=1");
  assert.equal(response.status, 400);
  return { status: response.status };
});

await expect("path-traversal-slug-is-denied", async () => {
  const response = await request("/v1/country/profile?slug=..%2F..%2Fadmin");
  assert.equal(response.status, 400);
  return { status: response.status };
});

const summary = {
  gateway: base.origin,
  checks: results.length,
  passed: results.filter(item => item.passed).length,
  failed: failures.length
};
log({ kind: "LIVE_API_GATEWAY_SUMMARY", ...summary });
if (failures.length) {
  console.error("LIVE_API_GATEWAY_RESULT FAIL");
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("LIVE_API_GATEWAY_RESULT PASS");
}
