# CSP ورؤوس HTTP — مفكرة أنوار

## حالة النشر الحالية

الموقع الحالي منشور على GitHub Pages في `byan80543-tech.github.io/mofakira-anouar/`. أضاف المشروع سياسة CSP نافذة عبر عنصر meta مبكر في `index.html`، لكن GitHub Pages لا يتيح للمستودع ضبط استجابات HTTP برؤوس مخصصة. ملف اسمه `_headers` في المستودع لا يفعّل الرؤوس على GitHub Pages.

### ما يطبقه المستند حالياً

- `default-src 'none'` لمنع المصادر غير المصرح بها افتراضياً.
- `script-src` يسمح بملفات JavaScript المحلية ومكتبة CDN الضرورية وبصمات SHA-256 الدقيقة للكتل المضمنة الأربع. لا يسمح بـ`unsafe-inline` أو `unsafe-eval`.
- `style-src` يسمح بـ`unsafe-inline` لأن الصفحة تستخدم أنماط CSS مضمنة؛ هذا الاستثناء لا يمتد إلى JavaScript.
- تقييد صور وخطوط وواجهات اتصال ووسائط وإطارات وعاملات التطبيق وفق مصادر الوظائف الحالية.
- `Referrer-Policy` عبر meta بقيمة `strict-origin-when-cross-origin`.

كلما تغير نص أي كتلة JavaScript مضمنة يجب تحديث بصمتها في CSP. يفحص `scripts/test-csp.mjs` البصمات في CI حتى لا تصبح السياسة قديمة بصمت.

## ما لا تستطيع meta فرضه

وفق مواصفة CSP، لا يدعم تسليم CSP عبر meta توجيهات `frame-ancestors` و`sandbox` و`report-uri`، ولا يدعم وضع `Content-Security-Policy-Report-Only`. لهذا لا تمنع السياسة الحالية تضمين الموقع داخل iframe من خلال `frame-ancestors`. كما لا يمكن لـmeta إضافة رؤوس HTTP مثل:

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Permissions-Policy`
- `Strict-Transport-Security`
- `Content-Security-Policy-Report-Only` مع نقطة تجميع تقارير

ولا ينبغي وصف هذه الرؤوس بأنها مفعّلة على الموقع الحالي.

## طريق تفعيل الرؤوس الكاملة

يلزم استخدام استضافة ثابتة أو CDN يتحكم في استجابات HTTP، مثل Cloudflare Pages، أو وضع نطاق مخصص خلف CDN موثوق يدعم الرؤوس. تدعم Cloudflare Pages ملف `_headers` في مجلد الأصول المنشورة. عند الانتقال إليها، يمكن استخدام نموذج مثل الآتي بعد اختبار التطبيق على عنوان Pages الجديد:

```text
/*
  Content-Security-Policy: default-src 'none'; base-uri 'self'; object-src 'none'; form-action 'self'; frame-ancestors 'none'; script-src 'self' https://cdnjs.cloudflare.com 'sha256-2hfKs02QbjOqbW6nnlUKK5v0Kmtok9HTIOsEYOV9f0A=' 'sha256-4giI+ESUJtIatupQ0GRa19vnQYslezSh4XuPQ1lOMX8=' 'sha256-wYI6hHRUO1S/JI5u1R/fnK9fHzj/6IglQ1+CY82F1Co=' 'sha256-QYwkkTcnQ+I/GO9GzNxZiLL3+C66HISY56P+LRrjBz0='; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https://upload.wikimedia.org; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://www.mp3quran.net https://api.allorigins.win https://corsproxy.io https://*.workers.dev; media-src 'self' https: blob:; frame-src 'self' blob:; worker-src 'self' blob:; manifest-src 'self'; upgrade-insecure-requests
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), geolocation=(), microphone=(self), autoplay=(self), fullscreen=(self)
```

هذه عينة انتقال وليست إعداداً فعالاً حالياً. يضاف `frame-ancestors 'none'` إلى نسخة ترويسة HTTP لأنها غير مدعومة في meta. لا تضف HSTS أو `includeSubDomains` إلا بعد التأكد من أن النطاق وكل نطاقاته الفرعية تعمل حصراً عبر HTTPS. يجب اختبار فتح الكتب وPDF والصوت وخطوط Google وSpeech Recognition بعد الانتقال.

## مراجع تقنية

- GitHub Pages community discussion: https://github.com/orgs/community/discussions/54257
- W3C CSP Level 3 — meta restrictions: https://www.w3.org/TR/CSP3/
- MDN CSP implementation and meta fallback: https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/CSP
- Cloudflare Pages custom headers: https://developers.cloudflare.com/pages/configuration/headers/
