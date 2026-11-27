const ALLOWED_COUNTRY_CODES = new Set([
  "SA", "EG", "MA", "IQ", "YE", "SY", "PS", "KW", "AE", "QA", "DZ",
  "LY", "BH", "JO", "SD", "TN", "OM", "MR", "LB", "SO", "DJ", "KM"
]);

const RATE_POLICIES = Object.freeze({
  // 50/min caps accepted traffic at 72,000 requests/day, below the 100,000/day
  // Free-tier request allowance, leaving room for normal retries and preflights.
  total: { limit: 50, windowMs: 60_000 },
  client: { limit: 30, windowMs: 60_000 },
  catalog: { limit: 20, windowMs: 60_000 },
  "country-list": { limit: 8, windowMs: 60_000 },
  "country-profile": { limit: 12, windowMs: 60_000 },
  "admin-login": { limit: 20, windowMs: 15 * 60_000 },
  // Bound authenticated owner actions as well, including after a token leak.
  "admin-api": { limit: 20, windowMs: 60_000 }
});

const CACHE_TTLS = Object.freeze({
  reciters: 3600,
  radios: 1800,
  countryList: 600,
  countryProfile: 900
});

const MAX_UPSTREAM_BYTES = 4 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 7_000;

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders
    }
  });
}

function withCors(response, origin, extraHeaders = {}) {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Vary", "Origin");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  for (const [name, value] of Object.entries(extraHeaders)) {
    headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function errorResponse(message, status, origin, headers = {}) {
  return withCors(json({ error: message }, status, headers), origin);
}

function resolveRoute(url) {
  if (url.pathname === "/v1/reciters") {
    if (url.searchParams.size !== 0) return { error: "معاملات غير مسموحة." };
    const upstream = new URL("/api/v3/reciters", "https://www.mp3quran.net");
    upstream.searchParams.set("language", "ar");
    return {
      bucket: "catalog",
      upstream,
      cacheTtl: CACHE_TTLS.reciters,
      maxBytes: MAX_UPSTREAM_BYTES,
      kind: "reciters"
    };
  }

  if (url.pathname === "/v1/radios") {
    if (url.searchParams.size !== 0) return { error: "معاملات غير مسموحة." };
    const upstream = new URL("/api/v3/radios", "https://www.mp3quran.net");
    upstream.searchParams.set("language", "ar");
    return {
      bucket: "catalog",
      upstream,
      cacheTtl: CACHE_TTLS.radios,
      maxBytes: MAX_UPSTREAM_BYTES,
      kind: "radios"
    };
  }

  if (url.pathname === "/v1/country/list") {
    if ([...url.searchParams.keys()].some(key => !["nationality", "page"].includes(key))) {
      return { error: "معاملات غير مسموحة." };
    }
    const country = url.searchParams.get("nationality");
    const pageText = url.searchParams.get("page") || "1";
    const page = Number(pageText);
    if (url.searchParams.getAll("nationality").length !== 1 ||
        url.searchParams.getAll("page").length > 1 ||
        !ALLOWED_COUNTRY_CODES.has(country) ||
        !/^\d{1,3}$/.test(pageText) ||
        !Number.isInteger(page) || page < 1 || page > 100) {
      return { error: "البلد أو رقم الصفحة غير صالح." };
    }
    const upstream = new URL("https://way2quran.com/ar/reciters");
    upstream.searchParams.set("nationality", country);
    if (page > 1) upstream.searchParams.set("currentPage", String(page));
    return {
      bucket: "country-list",
      upstream,
      cacheTtl: CACHE_TTLS.countryList,
      maxBytes: 3 * 1024 * 1024,
      kind: "html"
    };
  }

  if (url.pathname === "/v1/country/profile") {
    if ([...url.searchParams.keys()].some(key => key !== "slug")) {
      return { error: "معاملات غير مسموحة." };
    }
    const slug = url.searchParams.get("slug") || "";
    if (url.searchParams.getAll("slug").length !== 1 ||
        !/^[a-z0-9-]{1,100}$/i.test(slug)) {
      return { error: "معرّف صفحة القارئ غير صالح." };
    }
    const upstream = new URL("https://way2quran.com");
    upstream.pathname = "/ar/reciters/" + slug;
    return {
      bucket: "country-profile",
      upstream,
      cacheTtl: CACHE_TTLS.countryProfile,
      maxBytes: 3 * 1024 * 1024,
      kind: "html"
    };
  }

  return null;
}

async function hmacClientKey(ip, secret) {
  if (!secret || secret.length < 32) {
    throw new Error("IP_HASH_SECRET must contain at least 32 characters");
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode("anwar-api-gateway-v1|" + ip)
  );
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function checkLimits(namespace, clientKey, routeBucket, extra = {}) {
  const id = namespace.idFromName("anwar-api-gateway-global-rate-limiter");
  const stub = namespace.get(id);
  const buckets = ["total", "client", routeBucket];
  const response = await stub.fetch("https://rate-limit.internal/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientKey, buckets, ...extra })
  });
  if (!response.ok && response.status !== 429) {
    throw new Error("Rate limiter unavailable");
  }
  return response.json();
}

function isAllowedUpstreamHost(hostname) {
  return hostname === "www.mp3quran.net" ||
    hostname === "mp3quran.net" ||
    hostname === "way2quran.com" ||
    hostname === "www.way2quran.com";
}

function isJsonUpstreamHost(hostname) {
  return hostname === "mp3quran.net" || hostname === "www.mp3quran.net";
}

function validateUpstreamUrl(target) {
  if (!(target instanceof URL)) {
    throw new Error("Upstream URL must be parsed before use");
  }
  const safe = new URL(target.href);
  if (safe.protocol !== "https:" ||
      !isAllowedUpstreamHost(safe.hostname) ||
      safe.username ||
      safe.password ||
      safe.port ||
      safe.hash) {
    throw new Error("Upstream URL is not allowlisted");
  }
  return safe;
}

async function fetchSameOriginOnly(target) {
  let current = validateUpstreamUrl(target);

  for (let hop = 0; hop < 3; hop += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(current.href, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: isJsonUpstreamHost(current.hostname)
            ? "application/json"
            : "text/html"
        }
      });
    } finally {
      clearTimeout(timer);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("Location");
      if (!location) throw new Error("Upstream redirect without a location");
      const next = validateUpstreamUrl(new URL(location, current));
      current = next;
      continue;
    }
    return response;
  }

  throw new Error("Too many upstream redirects");
}

async function readTextWithLimit(response, maxBytes) {
  const advertisedLength = Number(response.headers.get("Content-Length") || 0);
  if (advertisedLength > maxBytes) {
    try { await response.body?.cancel(); } catch {}
    throw new Error("Upstream response too large");
  }

  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      try { await reader.cancel(); } catch {}
      throw new Error("Upstream response too large");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

async function readClientIpHash(request, env) {
  const ip = request.headers.get("CF-Connecting-IP");
  if (!ip || ip.length > 80) return null;
  return hmacClientKey(ip, String(env.IP_HASH_SECRET || ""));
}

async function applyRateLimits(request, env, routeBucket, extra = {}) {
  if (!env.IP_LIMITER) throw new Error("IP limiter binding missing");
  const clientKey = await readClientIpHash(request, env);
  if (!clientKey) throw new Error("Client IP unavailable");

  const result = await checkLimits(env.IP_LIMITER, clientKey, routeBucket, extra);
  if (!result.allowed) {
    return {
      blocked: true,
      retryAfter: Math.max(1, Number(result.retryAfter) || 1)
    };
  }
  return { blocked: false };
}

export class IpRateLimiter {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    ctx.blockConcurrencyWhile(() => {
      ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS rate_state (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          data TEXT NOT NULL
        );
        INSERT OR IGNORE INTO rate_state(id, data)
          VALUES(1, '{"global":[],"clients":{}}');
      `);
    });
  }

  async fetch(request) {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: "Invalid limiter request" }, 400);
    }

    const clientKey = payload && payload.clientKey;
    const buckets = payload && payload.buckets;
    const failureOnly = payload && payload.failureOnly === true;
    const failed = payload && payload.failed === true;
    const validRouteBuckets = new Set(["catalog", "country-list", "country-profile", "admin-login", "admin-api"]);
    const validShape = Array.isArray(buckets) &&
      buckets.length === 3 &&
      buckets[0] === "total" &&
      buckets[1] === "client" &&
      validRouteBuckets.has(buckets[2]);
    if (typeof clientKey !== "string" || !/^[a-f0-9]{64}$/.test(clientKey) || !validShape ||
        (failureOnly && buckets[2] !== "admin-login") ||
        (payload.failureOnly !== undefined && typeof payload.failureOnly !== "boolean") ||
        (payload.failed !== undefined && typeof payload.failed !== "boolean") ||
        (failureOnly && payload.failed === undefined)) {
      return json({ error: "Invalid rate-limit request" }, 400);
    }

    const now = Date.now();
    const cutoff = now - 60_000;

    // SQL operations are synchronous. No await occurs between SELECT and UPDATE,
    // so the read/check/write sequence is atomic within this single-threaded object.
    const rows = this.ctx.storage.sql.exec(
      "SELECT data FROM rate_state WHERE id = 1"
    ).toArray();
    let state;
    try {
      state = JSON.parse(rows[0]?.data || '{"global":[],"clients":{}}');
      // Drop counters left by the retired audio transcription route.
      delete state.transcription;
    } catch {
      throw new Error("Rate-limit state is corrupted");
    }

    state.global = Array.isArray(state.global)
      ? state.global.filter(timestamp => Number.isFinite(timestamp) && timestamp > cutoff)
      : [];
    if (!state.clients || typeof state.clients !== "object" || Array.isArray(state.clients)) {
      state.clients = {};
    }

    // The global ceiling bounds active client entries to at most 50 per minute.
    for (const [key, value] of Object.entries(state.clients)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        delete state.clients[key];
        continue;
      }
      delete value.transcribe;
      // Purge legacy adhkar visitor counters; public reads no longer use per-visitor identifiers.
      delete value["adhkar-read"];
      delete value["adhkar-suggestions"];
      for (const bucket of ["client", "catalog", "country-list", "country-profile", "admin-login", "admin-api"]) {
        const windowMs = RATE_POLICIES[bucket]?.windowMs || 60_000;
        const bucketCutoff = now - windowMs;
        value[bucket] = Array.isArray(value[bucket])
          ? value[bucket].filter(timestamp => Number.isFinite(timestamp) && timestamp > bucketCutoff)
          : [];
      }
      if (!Object.values(value).some(entries => Array.isArray(entries) && entries.length)) {
        delete state.clients[key];
      }
    }

    const client = state.clients[clientKey] || {
      client: [],
      catalog: [],
      "country-list": [],
      "country-profile": [],
      "admin-login": [],
      "admin-api": [],
    };
    const routeBucket = buckets[2];
    const checks = [
      { bucket: "total", timestamps: state.global, policy: RATE_POLICIES.total },
      { bucket: "client", timestamps: client.client, policy: RATE_POLICIES.client },
      { bucket: routeBucket, timestamps: client[routeBucket], policy: RATE_POLICIES[routeBucket] }
    ];

    for (const check of checks) {
      if (check.timestamps.length >= check.policy.limit) {
        const oldest = check.timestamps[0] || now;
        const retryAfter = Math.max(1, Math.ceil((oldest + check.policy.windowMs - now) / 1000));
        return json({
          allowed: false,
          retryAfter,
          bucket: check.bucket
        }, 429, { "Retry-After": String(retryAfter) });
      }
    }

    state.global.push(now);
    client.client.push(now);
    // Count only failed owner-login attempts in the 20-attempt security window.
    // Successful logins still consume the general client/global request budgets.
    if (routeBucket !== "admin-login" || !failureOnly || failed) {
      client[routeBucket].push(now);
    }
    state.clients[clientKey] = client;
    this.ctx.storage.sql.exec(
      "UPDATE rate_state SET data = ? WHERE id = 1",
      JSON.stringify(state)
    );

    return json({
      allowed: true,
      remaining: Math.max(0, RATE_POLICIES.total.limit - state.global.length)
    });
  }
}




const ADHKAR_STORE_NAME = "anwar-protective-adhkar-v1";
const ADHKAR_SESSION_SECONDS = 20 * 60;
const ADHKAR_BODY_LIMIT = 24 * 1024;

function cleanText(value, maxLength, required = false) {
  if (typeof value !== "string") return required ? null : "";
  const cleaned = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  if (required && !cleaned) return null;
  return cleaned.length > maxLength ? null : cleaned;
}

function normalizeHttpsUrl(value) {
  if (value == null || value === "") return "";
  if (typeof value !== "string" || value.length > 500) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.hash) return null;
    return url.href;
  } catch {
    return null;
  }
}

function normalizeDhikr(value, options = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const id = options.id || (options.keepId ? cleanText(value.id, 80, true) : crypto.randomUUID());
  if (typeof id !== "string" || !/^[a-z0-9-]{1,80}$/i.test(id)) return null;
  const group = cleanText(value.group, 80, true);
  const title = cleanText(value.title, 120, true);
  const text = cleanText(value.text, 5000, true);
  const source = cleanText(value.source, 240, Boolean(options.requireSource));
  const occasion = cleanText(value.occasion || "", 300, false);
  const sourceUrl = normalizeHttpsUrl(value.sourceUrl || "");
  const kind = value.kind === "note" ? "note" : "dhikr";
  const count = value.count == null || value.count === "" ? null : Number(value.count);
  if (!group || !title || !text || source === null || occasion === null || sourceUrl === null) return null;
  if (count !== null && (!Number.isSafeInteger(count) || count < 1 || count > 100000)) return null;
  return { id, group, title, text, count, occasion, source, sourceUrl, kind };
}

async function readJsonBody(request, limit = ADHKAR_BODY_LIMIT) {
  const advertisedHeader = request.headers.get("Content-Length");
  const advertisedLength = advertisedHeader === null ? 0 : Number(advertisedHeader);
  if (Number.isFinite(advertisedLength) && advertisedLength > limit) return null;
  if (!Number.isSafeInteger(limit) || limit < 1 || !request.body) return null;

  // Read at most the configured byte limit. Do not call request.text() here:
  // chunked requests can omit Content-Length and otherwise force full buffering.
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || !Number.isSafeInteger(value.byteLength)) return null;
      total += value.byteLength;
      if (total > limit) {
        try { await reader.cancel("Request body exceeds the configured limit"); } catch {}
        return null;
      }
      chunks.push(value);
    }

    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const raw = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  } finally {
    try { reader.releaseLock(); } catch {}
  }
}

function encodeBase64Url(bytes) {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
  try {
    const binary = atob(padded);
    return Uint8Array.from(binary, char => char.charCodeAt(0));
  } catch {
    return null;
  }
}

async function signAdminPayload(payload, secret) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return encodeBase64Url(signature);
}

function constantTimeEqual(left, right) {
  const a = new TextEncoder().encode(String(left));
  const b = new TextEncoder().encode(String(right));
  const length = Math.max(a.length, b.length);
  let difference = a.length ^ b.length;
  for (let index = 0; index < length; index += 1) difference |= (a[index] || 0) ^ (b[index] || 0);
  return difference === 0;
}

async function issueAdminSession(secret) {
  const payload = encodeBase64Url(new TextEncoder().encode(JSON.stringify({
    v: 1, scope: "adhkar-admin",
    exp: Math.floor(Date.now() / 1000) + ADHKAR_SESSION_SECONDS,
    nonce: crypto.randomUUID()
  })));
  return payload + "." + await signAdminPayload(payload, secret);
}

async function verifyAdminSession(request, secret) {
  if (!secret || secret.length < 32) return false;
  const header = request.headers.get("Authorization") || "";
  const match = /^Bearer ([A-Za-z0-9_.-]{20,2048})$/.exec(header);
  if (!match) return false;
  const [payload, signature, extra] = match[1].split(".");
  if (!payload || !signature || extra !== undefined) return false;
  const expected = await signAdminPayload(payload, secret);
  if (!constantTimeEqual(expected, signature)) return false;
  const bytes = decodeBase64Url(payload);
  if (!bytes) return false;
  try {
    const data = JSON.parse(new TextDecoder().decode(bytes));
    return data.v === 1 && data.scope === "adhkar-admin" &&
      Number.isSafeInteger(data.exp) && data.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function adhkarStoreStub(env) {
  if (!env.ADHKAR_STORE) throw new Error("ADHKAR_STORE binding missing");
  return env.ADHKAR_STORE.get(env.ADHKAR_STORE.idFromName(ADHKAR_STORE_NAME));
}

async function callAdhkarStore(env, path, method = "GET", body = undefined) {
  const init = { method, headers: { "Content-Type": "application/json" } };
  if (body !== undefined) init.body = JSON.stringify(body);
  return adhkarStoreStub(env).fetch(new Request("https://adhkar.internal" + path, init));
}

async function rateLimitedAdhkar(request, env, bucket, origin) {
  try {
    const result = await applyRateLimits(request, env, bucket);
    if (result.blocked) return errorResponse("تم تجاوز الحد المسموح. حاول لاحقًا.", 429, origin, {
      "Retry-After": String(result.retryAfter)
    });
    return null;
  } catch {
    return errorResponse("خدمة الحماية غير متاحة مؤقتًا.", 503, origin);
  }
}

function isAdhkarApiPath(pathname) {
  return pathname === "/v1/adhkar" ||
    pathname === "/v1/admin/session" ||
    pathname === "/v1/admin/adhkar" ||
    pathname === "/v1/admin/adhkar/initialize" ||
    /^\/v1\/admin\/adhkar\/[a-z0-9-]{1,80}$/i.test(pathname);
}

/**
 * Server-side route policy: an absent path is denied, and a known path only
 * accepts its explicitly listed methods. This is an access-control boundary,
 * not a substitute for the owner-session check inside handleAdhkarApi.
 */
function resolveGatewayAccess(pathname) {
  const routes = {
    "/v1/reciters": ["GET"],
    "/v1/radios": ["GET"],
    "/v1/country/list": ["GET"],
    "/v1/country/profile": ["GET"],
    "/v1/adhkar": ["GET"],
    "/v1/admin/session": ["POST"],
    "/v1/admin/adhkar": ["GET", "POST", "PUT"],
    "/v1/admin/adhkar/initialize": ["POST"]
  };
  if (Object.hasOwn(routes, pathname)) {
    return { methods: routes[pathname], access: pathname.startsWith("/v1/admin/") ? "owner" : "public" };
  }
  if (/^\/v1\/admin\/adhkar\/[a-z0-9-]{1,80}$/i.test(pathname)) {
    return { methods: ["DELETE"], access: "owner" };
  }
  return null;
}

async function handleAdhkarApi(request, url, env, origin) {
  if (!isAdhkarApiPath(url.pathname)) return null;
  const method = request.method;
  const path = url.pathname;
  if (url.search) return errorResponse("لا تُقبل معاملات إضافية لهذا المسار.", 400, origin);
  const adminSecret = String(env.ADHKAR_ADMIN_SECRET || "");
  if (!env.ADHKAR_STORE) return errorResponse("مخزن مكتبة الأذكار غير مهيأ.", 503, origin);

  // Public reads are rate-limited per network at Cloudflare's edge. The raw
  // address is immediately HMAC-pseudonymized; the app stores no visitor profile,
  // IP address, cookie, or per-visitor activity history.
  if (path === "/v1/adhkar" && method === "GET") {
    let edgeDecision;
    try {
      if (!env.EDGE_LIMITER || String(env.IP_HASH_SECRET || "").length < 32) {
        throw new Error("Edge rate limiter or HMAC secret missing");
      }
      const clientAddress = request.headers.get("CF-Connecting-IP") || "unknown";
      const edgeKey = await signAdminPayload("adhkar-public-read:" + clientAddress, env.IP_HASH_SECRET);
      edgeDecision = await env.EDGE_LIMITER.limit({ key: edgeKey });
    } catch {
      return errorResponse("خدمة قراءة مكتبة الأذكار غير متاحة مؤقتًا.", 503, origin);
    }
    if (!edgeDecision.success) {
      return errorResponse("تجاوزت المكتبة حد الطلبات العام. حاول بعد قليل.", 429, origin, {
        "Retry-After": "60"
      });
    }
    try {
      return withCors(await callAdhkarStore(env, "/entries"), origin);
    } catch {
      return errorResponse("تعذر تحميل مكتبة الأذكار.", 503, origin);
    }
  }

  if (path === "/v1/admin/session" && method === "POST") {
    if (adminSecret.length < 32) return errorResponse("دخول الإدارة غير مهيأ على الخادم.", 503, origin);
    const body = await readJsonBody(request, 4096);
    const validPassword = !!(body && typeof body.password === "string" &&
      Array.from(body.password).length <= 128 &&
      new TextEncoder().encode(body.password).byteLength <= 512 &&
      constantTimeEqual(body.password, adminSecret));
    let loginDecision;
    try {
      loginDecision = await applyRateLimits(request, env, "admin-login", {
        failureOnly: true,
        failed: !validPassword
      });
    } catch {
      return errorResponse("خدمة الحماية غير متاحة مؤقتًا.", 503, origin);
    }
    if (loginDecision.blocked) return errorResponse("تم تجاوز 20 محاولة دخول فاشلة خلال 15 دقيقة من هذا الاتصال. حاول بعد انتهاء المهلة.", 429, origin, {
      "Retry-After": String(loginDecision.retryAfter)
    });
    if (!validPassword) return errorResponse("تعذر التحقق من رمز الإدارة.", 401, origin);
    try {
      const token = await issueAdminSession(adminSecret);
      return withCors(json({ token, expiresIn: ADHKAR_SESSION_SECONDS }), origin, { "Cache-Control": "no-store" });
    } catch {
      return errorResponse("تعذر إنشاء جلسة الإدارة.", 503, origin);
    }
  }

  // Every write or administrative read requires a valid owner-only session.
  const authenticated = await verifyAdminSession(request, adminSecret);
  if (!authenticated) return errorResponse("هذه العملية متاحة لصاحب المفكرة فقط.", 401, origin);

  // A signed token is not a reason to skip resource controls. Keep owner API
  // traffic bounded per IP and globally, and fail closed if the limiter is down.
  const adminLimited = await rateLimitedAdhkar(request, env, "admin-api", origin);
  if (adminLimited) return adminLimited;

  try {
    if (path === "/v1/admin/adhkar" && method === "GET") {
      return withCors(await callAdhkarStore(env, "/entries"), origin);
    }
    if (path === "/v1/admin/adhkar/initialize" && method === "POST") {
      const body = await readJsonBody(request);
      if (!body || !Array.isArray(body.entries) || body.entries.length < 1 || body.entries.length > 200) {
        return errorResponse("القائمة الأولية غير صالحة.", 400, origin);
      }
      const entries = body.entries.map(item => normalizeDhikr(item, { keepId: true }));
      if (entries.some(item => !item) || new Set(entries.map(item => item.id)).size !== entries.length) {
        return errorResponse("تحتوي القائمة الأولية على ذكر غير صالح أو معرّف مكرر.", 400, origin);
      }
      return withCors(await callAdhkarStore(env, "/initialize", "POST", { entries }), origin);
    }
    if (path === "/v1/admin/adhkar" && method === "POST") {
      const body = await readJsonBody(request);
      const entry = normalizeDhikr(body, { requireSource: true });
      if (!entry) return errorResponse("أدخل نص الذكر ومصدره الصحيح قبل النشر.", 400, origin);
      return withCors(await callAdhkarStore(env, "/entry", "POST", entry), origin);
    }
    if (path === "/v1/admin/adhkar" && method === "PUT") {
      const body = await readJsonBody(request);
      const entry = body && normalizeDhikr(body, { id: body.id, keepId: true, requireSource: true });
      if (!entry) return errorResponse("أدخل نص الذكر ومصدره الصحيح قبل الحفظ.", 400, origin);
      return withCors(await callAdhkarStore(env, "/entry", "PUT", entry), origin);
    }
    const entryDelete = /^\/v1\/admin\/adhkar\/([a-z0-9-]{1,80})$/i.exec(path);
    if (entryDelete && method === "DELETE") {
      return withCors(await callAdhkarStore(env, "/entry/" + encodeURIComponent(entryDelete[1]), "DELETE"), origin);
    }
    return errorResponse("طريقة الطلب غير مسموحة لهذا المسار.", 405, origin);
  } catch {
    return errorResponse("تعذر إتمام عملية إدارة المكتبة.", 503, origin);
  }
}

export class AdhkarStore {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    ctx.blockConcurrencyWhile(() => {
      ctx.storage.sql.exec(
        "CREATE TABLE IF NOT EXISTS adhkar_entries (id TEXT PRIMARY KEY, group_name TEXT NOT NULL, title TEXT NOT NULL, text TEXT NOT NULL, count INTEGER, occasion TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT '', source_url TEXT NOT NULL DEFAULT '', kind TEXT NOT NULL DEFAULT 'dhikr', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);" +
        "CREATE TABLE IF NOT EXISTS adhkar_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);" +
        "INSERT OR IGNORE INTO adhkar_meta(key, value) VALUES('initialized', '0');" +
        "DROP TABLE IF EXISTS adhkar_suggestions;"
      );
    });
  }

  json(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
    });
  }

  initialized() {
    const rows = this.ctx.storage.sql.exec("SELECT value FROM adhkar_meta WHERE key = 'initialized'").toArray();
    return rows[0]?.value === "1";
  }

  mapEntry(row) {
    return {
      id: row.id,
      group: row.group_name,
      title: row.title,
      text: row.text,
      count: row.count == null ? null : Number(row.count),
      occasion: row.occasion || "",
      source: row.source || "",
      sourceUrl: row.source_url || "",
      kind: row.kind === "note" ? "note" : "dhikr"
    };
  }

  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (path === "/entries" && method === "GET") {
      const rows = this.ctx.storage.sql.exec(
        "SELECT id, group_name, title, text, count, occasion, source, source_url, kind FROM adhkar_entries ORDER BY rowid ASC"
      ).toArray();
      return this.json({ initialized: this.initialized(), entries: rows.map(row => this.mapEntry(row)) });
    }

    if (path === "/initialize" && method === "POST") {
      if (this.initialized()) return this.json({ error: "already_initialized" }, 409);
      const body = await request.json();
      if (!Array.isArray(body.entries) || body.entries.length < 1 || body.entries.length > 200) {
        return this.json({ error: "invalid_initial_entries" }, 400);
      }
      const now = new Date().toISOString();
      for (const item of body.entries) {
        this.ctx.storage.sql.exec(
          "INSERT INTO adhkar_entries (id, group_name, title, text, count, occasion, source, source_url, kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          item.id, item.group, item.title, item.text, item.count, item.occasion,
          item.source, item.sourceUrl, item.kind, now, now
        );
      }
      this.ctx.storage.sql.exec("UPDATE adhkar_meta SET value = '1' WHERE key = 'initialized'");
      return this.json({ initialized: true, count: body.entries.length });
    }

    if (path === "/entry" && (method === "POST" || method === "PUT")) {
      if (!this.initialized()) return this.json({ error: "initialize_library_first" }, 409);
      const item = await request.json();
      const now = new Date().toISOString();
      this.ctx.storage.sql.exec(
        "INSERT INTO adhkar_entries (id, group_name, title, text, count, occasion, source, source_url, kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET group_name=excluded.group_name, title=excluded.title, text=excluded.text, count=excluded.count, occasion=excluded.occasion, source=excluded.source, source_url=excluded.source_url, kind=excluded.kind, updated_at=excluded.updated_at",
        item.id, item.group, item.title, item.text, item.count, item.occasion,
        item.source, item.sourceUrl, item.kind, now, now
      );
      this.ctx.storage.sql.exec("UPDATE adhkar_meta SET value = '1' WHERE key = 'initialized'");
      return this.json({ saved: true, entry: item });
    }

    const deleteEntry = /^\/entry\/([a-z0-9-]{1,80})$/i.exec(path);
    if (deleteEntry && method === "DELETE") {
      this.ctx.storage.sql.exec("DELETE FROM adhkar_entries WHERE id = ?", deleteEntry[1]);
      return this.json({ deleted: true });
    }

    return this.json({ error: "not_found" }, 404);
  }
}

export default {
  async fetch(request, env, ctx) {
    const configuredOrigins = String(env.ALLOWED_ORIGINS || env.ALLOWED_ORIGIN || "");
    const allowedOrigins = configuredOrigins.split(",").map(value => value.trim()).filter(Boolean);
    const origin = request.headers.get("Origin") || "";

    if (!origin || !allowedOrigins.includes(origin)) {
      return json({ error: "Origin not allowed" }, 403);
    }

    const url = new URL(request.url);
    const access = resolveGatewayAccess(url.pathname);
    if (!access) return errorResponse("المسار غير موجود.", 404, origin);

    const allowedMethods = [...access.methods, "OPTIONS"];
    if (request.method === "OPTIONS") {
      return withCors(new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Methods": allowedMethods.join(", "),
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "600",
          "Cache-Control": "no-store"
        }
      }), origin, {
        "Access-Control-Allow-Methods": allowedMethods.join(", "),
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "600"
      });
    }

    if (!access.methods.includes(request.method)) {
      return errorResponse("طريقة الطلب غير مسموحة لهذا المسار.", 405, origin, {
        Allow: allowedMethods.join(", ")
      });
    }

    const adhkarResponse = await handleAdhkarApi(request, url, env, origin);
    if (adhkarResponse) return adhkarResponse;

    const route = resolveRoute(url);
    if (!route) return errorResponse("المسار غير موجود.", 404, origin);
    if (route.error) return errorResponse(route.error, 400, origin);

    let edgeDecision;
    try {
      if (!env.EDGE_LIMITER) throw new Error("Edge rate limiter binding missing");
      edgeDecision = await env.EDGE_LIMITER.limit({ key: "anwar-api-gateway" });
    } catch {
      return errorResponse("بوابة تحديد المعدل الطرفية غير متاحة مؤقتًا.", 503, origin);
    }
    if (!edgeDecision.success) {
      return errorResponse(
        "تم تجاوز الحد الطرفي للطلبات. انتظر قليلًا ثم أعد المحاولة.",
        429,
        origin,
        { "Retry-After": "60" }
      );
    }

    let decision;
    try {
      decision = await applyRateLimits(request, env, route.bucket);
    } catch {
      // Fail closed: never bypass rate limiting if the limiter is unavailable.
      return errorResponse("بوابة الحماية غير متاحة مؤقتًا. حاول لاحقًا.", 503, origin);
    }
    if (decision.blocked) {
      return errorResponse(
        "تم تجاوز الحد المسموح للطلبات. انتظر قليلًا ثم أعد المحاولة.",
        429,
        origin,
        { "Retry-After": String(decision.retryAfter) }
      );
    }

    const cache = globalThis.caches?.default;
    const cacheKey = new Request(request.url, { method: "GET" });
    if (cache) {
      try {
        const hit = await cache.match(cacheKey);
        if (hit) return withCors(hit, origin, { "X-Anwar-Gateway-Cache": "HIT" });
      } catch {}
    }

    let upstream;
    try {
      upstream = await fetchSameOriginOnly(route.upstream);
      if (upstream.status === 429) {
        const retry = upstream.headers.get("Retry-After") || "30";
        return errorResponse(
          "مصدر البيانات طلب تخفيف الضغط. حاول لاحقًا.",
          429,
          origin,
          { "Retry-After": retry }
        );
      }
      if (!upstream.ok) {
        return errorResponse("تعذّر جلب البيانات من المصدر.", 502, origin);
      }

      const contentType = String(upstream.headers.get("Content-Type") || "").toLowerCase();
      if (route.kind === "html" && !contentType.includes("text/html")) {
        return errorResponse("استجابة المصدر ليست صفحة HTML صالحة.", 502, origin);
      }
      if (route.kind !== "html" && !contentType.includes("json")) {
        return errorResponse("استجابة مصدر البيانات ليست JSON صالحًا.", 502, origin);
      }

      const body = await readTextWithLimit(upstream, route.maxBytes);
      if (route.kind === "html") {
        if (body.length < 300) {
          return errorResponse("استجابة المصدر أقصر من الحد المتوقع.", 502, origin);
        }
      } else {
        let parsed;
        try { parsed = JSON.parse(body); } catch {
          return errorResponse("بيانات المصدر غير قابلة للتحليل.", 502, origin);
        }
        const expected = route.kind === "reciters" ? parsed.reciters : parsed.radios;
        if (!Array.isArray(expected)) {
          return errorResponse("بنية بيانات المصدر غير متوقعة.", 502, origin);
        }
      }

      const cacheControl = "public, max-age=300, s-maxage=" + route.cacheTtl;
      const response = new Response(body, {
        status: 200,
        headers: {
          "Content-Type": route.kind === "html"
            ? "text/html; charset=utf-8"
            : "application/json; charset=utf-8",
          "Cache-Control": cacheControl,
          "X-Content-Type-Options": "nosniff"
        }
      });
      if (cache) {
        const put = cache.put(cacheKey, response.clone()).catch(() => {});
        if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(put);
      }
      return withCors(response, origin, { "X-Anwar-Gateway-Cache": "MISS" });
    } catch {
      return errorResponse("تعذّر الاتصال بمصدر البيانات ضمن المهلة.", 502, origin);
    }
  }
};
