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
  "transcribe-global": { limit: 10, windowMs: 86_400_000 },
  transcribe: { limit: 3, windowMs: 86_400_000 }
});

const CACHE_TTLS = Object.freeze({
  reciters: 3600,
  radios: 1800,
  countryList: 600,
  countryProfile: 900
});

const MAX_UPSTREAM_BYTES = 4 * 1024 * 1024;
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 7_000;
const TRANSCRIPTION_MODEL = "@cf/openai/whisper-large-v3-turbo";
const AUDIO_EXTENSIONS = new Set([
  "aac", "amr", "flac", "m4a", "m4b", "mp3", "mpga", "mpeg",
  "oga", "ogg", "opus", "wav", "wave", "webm", "3gp", "mp4"
]);
const AUDIO_MIME_TYPES = new Set([
  "audio/aac", "audio/amr", "audio/flac", "audio/mp3", "audio/mpeg",
  "audio/mp4", "audio/mp4a-latm", "audio/ogg", "audio/opus",
  "audio/wav", "audio/wave", "audio/webm", "audio/x-aac",
  "audio/x-m4a", "audio/x-wav", "application/ogg"
]);

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
    if (url.searchParams.getAll("slug").length !== 1 ||
        !/^[a-z0-9-]{1,100}$/i.test(slug)) {
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

async function checkLimits(namespace, clientKey, routeBucket) {
  const id = namespace.idFromName("anwar-api-gateway-global-rate-limiter");
  const stub = namespace.get(id);
  const buckets = routeBucket === "transcribe"
    ? ["total", "client", "transcribe-global", "transcribe"]
    : ["total", "client", routeBucket];
  const response = await stub.fetch("https://rate-limit.internal/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientKey, buckets })
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

async function fetchSameOriginOnly(target) {
  if (target.protocol !== "https:" || !isAllowedUpstreamHost(target.hostname) || target.port) {
    throw new Error("Upstream host is not allowlisted");
  }
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
          Accept: current.hostname.endsWith("mp3quran.net")
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
      if (next.protocol !== "https:" || next.port || !isAllowedUpstreamHost(next.hostname)) {
        throw new Error("Redirect to an unapproved upstream host rejected");
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

async function readClientIpHash(request, env) {
  const ip = request.headers.get("CF-Connecting-IP");
  if (!ip || ip.length > 80) return null;
  return hmacClientKey(ip, String(env.IP_HASH_SECRET || ""));
}

async function applyRateLimits(request, env, routeBucket) {
  if (!env.IP_LIMITER) throw new Error("IP limiter binding missing");
  const clientKey = await readClientIpHash(request, env);
  if (!clientKey) throw new Error("Client IP unavailable");

  const result = await checkLimits(env.IP_LIMITER, clientKey, routeBucket);
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
      const validRouteBuckets = new Set(["catalog", "country-list", "country-profile"]);
    const validShape = Array.isArray(buckets) && (
      (buckets.length === 3 && buckets[0] === "total" && buckets[1] === "client" && validRouteBuckets.has(buckets[2])) ||
      (buckets.length === 4 && buckets[0] === "total" && buckets[1] === "client" && buckets[2] === "transcribe-global" && buckets[3] === "transcribe")
    );
    if (typeof clientKey !== "string" || !/^[a-f0-9]{64}$/.test(clientKey) || !validShape) {
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
      state = JSON.parse(rows[0]?.data || '{"global":[],"transcription":[],"clients":{}}');
    } catch {
      throw new Error("Rate-limit state is corrupted");
    }

    state.global = Array.isArray(state.global)
      ? state.global.filter(timestamp => Number.isFinite(timestamp) && timestamp > cutoff)
      : [];
    const dailyCutoff = now - 86_400_000;
    state.transcription = Array.isArray(state.transcription)
      ? state.transcription.filter(timestamp => Number.isFinite(timestamp) && timestamp > dailyCutoff)
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
      for (const bucket of ["client", "catalog", "country-list", "country-profile", "transcribe"]) {
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
      transcribe: []
    };
    const isTranscription = buckets.length === 4 &&
      buckets[0] === "total" && buckets[1] === "client" &&
      buckets[2] === "transcribe-global" && buckets[3] === "transcribe";
    const validOrdinaryBuckets = buckets.length === 3 &&
      buckets[0] === "total" && buckets[1] === "client" &&
      ["catalog", "country-list", "country-profile"].includes(buckets[2]);
    if (!isTranscription && !validOrdinaryBuckets) {
      return json({ error: "Invalid rate-limit request" }, 400);
    }
    const routeBucket = isTranscription ? "transcribe" : buckets[2];
    const checks = [
      { bucket: "total", timestamps: state.global, policy: RATE_POLICIES.total },
      { bucket: "client", timestamps: client.client, policy: RATE_POLICIES.client },
      ...(isTranscription ? [
        { bucket: "transcribe-global", timestamps: state.transcription, policy: RATE_POLICIES["transcribe-global"] },
        { bucket: "transcribe", timestamps: client.transcribe, policy: RATE_POLICIES.transcribe }
      ] : [
        { bucket: routeBucket, timestamps: client[routeBucket], policy: RATE_POLICIES[routeBucket] }
      ])
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
    client[routeBucket].push(now);
    if (isTranscription) state.transcription.push(now);
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


function bytesToBase64(bytes) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function isSupportedAudioFile(file) {
  const extension = String(file.name || "").split(".").pop().toLowerCase();
  const mime = String(file.type || "").toLowerCase();
  return AUDIO_EXTENSIONS.has(extension) || AUDIO_MIME_TYPES.has(mime);
}

async function transcribeAudio(request, env, origin) {
  if (!env.AI || typeof env.AI.run !== "function") {
    return errorResponse("خدمة التفريغ السحابي غير مفعّلة على الخادم بعد.", 503, origin);
  }

  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > MAX_AUDIO_BYTES + 128_000) {
    return errorResponse("حجم الملف يتجاوز الحد المسموح وهو 8 ميغابايت.", 413, origin);
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return errorResponse("تعذّرت قراءة الملف المرفوع. أعد اختيار الملف وحاول مجددًا.", 400, origin);
  }

  const file = form.get("audio");
  if (!file || typeof file.arrayBuffer !== "function" || typeof file.size !== "number") {
    return errorResponse("لم يصل ملف صوتي. اختر ملفًا صوتيًا أولًا.", 400, origin);
  }
  if (file.size <= 0) {
    return errorResponse("الملف الصوتي فارغ.", 400, origin);
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return errorResponse("حجم الملف يتجاوز الحد المسموح وهو 8 ميغابايت.", 413, origin);
  }
  if (!isSupportedAudioFile(file)) {
    return errorResponse("صيغة الصوت غير مدعومة. استخدم MP3 أو M4A أو WAV أو OGG أو WEBM أو FLAC.", 415, origin);
  }

  try {
    const audioBytes = new Uint8Array(await file.arrayBuffer());
    if (!audioBytes.length || audioBytes.length > MAX_AUDIO_BYTES) {
      return errorResponse("تعذّر التحقق من حجم الملف الصوتي.", 413, origin);
    }
    const result = await env.AI.run(TRANSCRIPTION_MODEL, {
      audio: bytesToBase64(audioBytes),
      task: "transcribe"
    });
    const transcriptionInfo = result?.transcription_info;
    const text = typeof transcriptionInfo?.text === "string" ? transcriptionInfo.text.trim() : "";
    if (!text || text.length > 250_000) {
      return errorResponse("لم يُنتج محرك التفريغ نصًا صالحًا. جرّب ملفًا أوضح وأقصر.", 502, origin);
    }
    const detectedLanguage = String(transcriptionInfo?.language || "").slice(0, 24);
    const wordCount = Number.isFinite(Number(transcriptionInfo?.word_count))
      ? Math.max(0, Number(transcriptionInfo.word_count))
      : text.split(/\s+/).filter(Boolean).length;
    return withCors(json({ text, language: detectedLanguage, wordCount }, 200), origin);
  } catch {
    // Never log or persist audio bytes or transcription contents.
    return errorResponse("تعذّر إتمام التفريغ الصوتي الآن. حاول بملف أصغر أو أعد المحاولة لاحقًا.", 502, origin);
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

    if (request.method === "OPTIONS") {
      return withCors(new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "600",
          "Cache-Control": "no-store"
        }
      }), origin, {
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "600"
      });
    }

    const url = new URL(request.url);

    if (request.method === "POST") {
      if (url.pathname !== "/v1/transcribe" || url.search) {
        if (!url.search && resolveRoute(url)) {
          return errorResponse("طريقة الطلب غير مسموحة.", 405, origin, { Allow: "GET, OPTIONS" });
        }
        return errorResponse("المسار غير موجود.", 404, origin);
      }

      let edgeDecision;
      try {
        if (!env.EDGE_LIMITER) throw new Error("Edge rate limiter binding missing");
        edgeDecision = await env.EDGE_LIMITER.limit({ key: "anwar-api-gateway" });
      } catch {
        return errorResponse("بوابة تحديد المعدل الطرفية غير متاحة مؤقتًا.", 503, origin);
      }
      if (!edgeDecision.success) {
        return errorResponse("تم تجاوز الحد الطرفي للطلبات. انتظر قليلًا ثم أعد المحاولة.", 429, origin, { "Retry-After": "60" });
      }

      let decision;
      try {
        decision = await applyRateLimits(request, env, "transcribe");
      } catch {
        return errorResponse("بوابة الحماية غير متاحة مؤقتًا. حاول لاحقًا.", 503, origin);
      }
      if (decision.blocked) {
        return errorResponse("بلغت حد التفريغ اليومي المسموح. حاول في وقت لاحق.", 429, origin, {
          "Retry-After": String(decision.retryAfter)
        });
      }

      return transcribeAudio(request, env, origin);
    }

    if (request.method !== "GET") {
      return errorResponse("طريقة الطلب غير مسموحة.", 405, origin, { Allow: "GET, POST, OPTIONS" });
    }

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
