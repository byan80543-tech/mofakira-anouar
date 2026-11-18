const ALLOWED_COUNTRY_CODES = new Set([
  "SA", "EG", "MA", "IQ", "YE", "SY", "PS", "KW", "AE", "QA", "DZ",
  "LY", "BH", "JO", "SD", "TN", "OM", "MR", "LB", "SO", "DJ", "KM"
]);

const RATE_POLICIES = Object.freeze({
  global: { limit: 120, windowMs: 60_000 },
  catalog: { limit: 30, windowMs: 60_000 },
  "country-list": { limit: 12, windowMs: 60_000 },
  "country-profile": { limit: 24, windowMs: 60_000 }
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
    return {
      bucket: "catalog",
      upstream: "https://www.mp3quran.net/api/v3/reciters?language=ar",
      cacheTtl: CACHE_TTLS.reciters,
      maxBytes: MAX_UPSTREAM_BYTES,
      kind: "reciters"
    };
  }

  if (url.pathname === "/v1/radios") {
    if (url.searchParams.size !== 0) return { error: "معاملات غير مسموحة." };
    return {
      bucket: "catalog",
      upstream: "https://www.mp3quran.net/api/v3/radios?language=ar",
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
    if (!ALLOWED_COUNTRY_CODES.has(country) ||
        !/^\d{1,3}$/.test(pageText) ||
        !Number.isInteger(page) || page < 1 || page > 100) {
      return { error: "البلد أو رقم الصفحة غير صالح." };
    }
    const upstream = new URL("https://way2quran.com/ar/reciters");
    upstream.searchParams.set("nationality", country);
    if (page > 1) upstream.searchParams.set("currentPage", String(page));
    return {
      bucket: "country-list",
      upstream: upstream.href,
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
    if (!/^[a-z0-9-]{1,100}$/i.test(slug)) {
      return { error: "معرّف صفحة القارئ غير صالح." };
    }
    return {
      bucket: "country-profile",
      upstream: "https://way2quran.com/ar/reciters/" + slug,
      cacheTtl: CACHE_TTLS.countryProfile,
      maxBytes: 3 * 1024 * 1024,
      kind: "html"
    };
  }

  return null;
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function checkLimit(namespace, clientKey, bucket) {
  const id = namespace.idFromName(clientKey);
  const stub = namespace.get(id);
  const response = await stub.fetch("https://rate-limit.internal/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bucket })
  });
  if (!response.ok && response.status !== 429) {
    throw new Error("Rate limiter unavailable");
  }
  return response.json();
}

async function fetchSameOriginOnly(target) {
  const initialOrigin = target.origin;
  let current = target;

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
          Accept: current.hostname === "www.mp3quran.net"
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
      const next = new URL(location, current);
      if (next.origin !== initialOrigin) {
        throw new Error("Cross-origin upstream redirect rejected");
      }
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

async function readClientIpHash(request) {
  const ip = request.headers.get("CF-Connecting-IP");
  if (!ip || ip.length > 80) return null;
  return sha256Hex("anwar-api-gateway-v1|" + ip);
}

async function applyRateLimits(request, env, routeBucket) {
  if (!env.IP_LIMITER) throw new Error("IP limiter binding missing");
  const clientKey = await readClientIpHash(request);
  if (!clientKey) throw new Error("Client IP unavailable");

  for (const bucket of ["global", routeBucket]) {
    const result = await checkLimit(env.IP_LIMITER, clientKey, bucket);
    if (!result.allowed) {
      return {
        blocked: true,
        retryAfter: Math.max(1, Number(result.retryAfter) || 1)
      };
    }
  }
  return { blocked: false };
}

export class IpRateLimiter {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    ctx.blockConcurrencyWhile(() => {
      ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS rate_hits (
          bucket TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_rate_hits_bucket_time
          ON rate_hits(bucket, created_at);
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

    const bucket = payload && payload.bucket;
    const policy = RATE_POLICIES[bucket];
    if (!policy) return json({ error: "Unknown rate bucket" }, 400);

    const now = Date.now();
    const cutoff = now - policy.windowMs;

    // These synchronous SQLite operations run without an await between them.
    // Durable Object input gates serialize the read/check/write sequence.
    this.ctx.storage.sql.exec(
      "DELETE FROM rate_hits WHERE bucket = ? AND created_at <= ?",
      bucket,
      cutoff
    );
    const rows = this.ctx.storage.sql.exec(
      "SELECT COUNT(*) AS total, MIN(created_at) AS oldest FROM rate_hits WHERE bucket = ?",
      bucket
    ).toArray();
    const total = Number(rows[0]?.total || 0);
    const oldest = Number(rows[0]?.oldest || now);

    if (total >= policy.limit) {
      const retryAfter = Math.max(1, Math.ceil((oldest + policy.windowMs - now) / 1000));
      return json({ allowed: false, retryAfter }, 429, { "Retry-After": String(retryAfter) });
    }

    this.ctx.storage.sql.exec(
      "INSERT INTO rate_hits(bucket, created_at) VALUES(?, ?)",
      bucket,
      now
    );

    if (typeof this.ctx.storage.setAlarm === "function") {
      await this.ctx.storage.setAlarm(now + 120_000);
    }
    return json({ allowed: true, remaining: Math.max(0, policy.limit - total - 1) });
  }

  async alarm() {
    this.ctx.storage.sql.exec(
      "DELETE FROM rate_hits WHERE created_at <= ?",
      Date.now() - 60_000
    );
  }
}

export default {
  async fetch(request, env, ctx) {
    const allowedOrigin = String(env.ALLOWED_ORIGIN || "");
    const origin = request.headers.get("Origin") || "";

    if (!allowedOrigin || origin !== allowedOrigin) {
      return json({ error: "Origin not allowed" }, 403);
    }

    if (request.method === "OPTIONS") {
      return withCors(new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Max-Age": "600",
          "Cache-Control": "no-store"
        }
      }), origin, {
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Max-Age": "600"
      });
    }

    if (request.method !== "GET") {
      return errorResponse("طريقة الطلب غير مسموحة.", 405, origin, { Allow: "GET, OPTIONS" });
    }

    const url = new URL(request.url);
    const route = resolveRoute(url);
    if (!route) return errorResponse("المسار غير موجود.", 404, origin);
    if (route.error) return errorResponse(route.error, 400, origin);

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
      upstream = await fetchSameOriginOnly(new URL(route.upstream));
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
        if (body.length < 300 ||
            (!body.includes("/ar/reciters") && !body.includes("media.way2quran.com"))) {
          return errorResponse("تعذّر التحقق من صفحة المصدر.", 502, origin);
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
