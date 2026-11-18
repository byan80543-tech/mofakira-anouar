# CSP ورؤوس HTTP — مفكرة أنوار

## بيئة النشر

الموقع منشور على Cloudflare Pages في:
`https://mofakira-anouar.pages.dev/`

تقرأ Cloudflare Pages ملف `_headers` من **جذر مجلد الإخراج المنشور**. لذلك ينسخ سير النشر الملف إلى `dist/_headers`، بينما توضع ملفات التطبيق في `dist/mofakira-anouar/`. لا يكفي وجود الملف داخل مجلد التطبيق الفرعي.

يفحص سير النشر وجود الملف في موضعه ويتحقق من وجود توجيه CSP و`frame-ancestors 'none'` و`X-Content-Type-Options` قبل رفع الموقع. كما تتحقق اختبارات المستودع من أن سير النشر لا يعيد وضع الملف في المجلد الفرعي.

## الرؤوس المهيأة

يحتوي `_headers` على سياسة CSP ورؤوس HTTP التالية:

- `Content-Security-Policy`: سياسة المصادر المسموحة مع بصمات SHA-256 الدقيقة للكتل البرمجية المضمنة، وإضافة `frame-ancestors 'none'` لمنع تضمين الصفحة في إطارات مواقع أخرى.
- `X-Frame-Options: DENY`: طبقة توافق إضافية لمنع التأطير.
- `X-Content-Type-Options: nosniff`: منع تخمين نوع المحتوى.
- `Referrer-Policy: strict-origin-when-cross-origin`: تقليل المعلومات المرسلة في Referer.
- `Permissions-Policy`: تعطيل الكاميرا والموقع الجغرافي، مع السماح بالميكروفون والتشغيل الصوتي وملء الشاشة ضمن الأصل نفسه فقط.
- `X-DNS-Prefetch-Control: off`.

تظل سياسة CSP الموجودة في عنصر meta داخل `index.html` طبقة إضافية. سياسة HTTP هي التي تضيف `frame-ancestors`، لأن هذا التوجيه لا يعمل عند تسليم CSP عبر meta.

## سياسة المحتوى

- `default-src 'none'` افتراضياً.
- `script-src` يسمح بملفات الأصل نفسه ومكتبة CDN الضرورية وبصمات SHA-256 المعتمدة للكتل المضمنة. لا يسمح بـ`unsafe-inline` أو `unsafe-eval` للسكريبتات.
- `style-src` يسمح بـ`unsafe-inline` بسبب الأنماط المضمنة الحالية؛ هذا لا يفتح تنفيذ JavaScript.
- تقييد الصور والخطوط والاتصالات والوسائط والإطارات والعاملات إلى المصادر اللازمة لوظائف التطبيق الحالية.
- `upgrade-insecure-requests` لترقية الموارد غير الآمنة إلى HTTPS.

كلما تغير نص أي كتلة JavaScript مضمنة يجب تحديث بصمتها في CSP. يفحص `scripts/test-csp.mjs` البصمات في CI، وتتحقق `scripts/validate.mjs` من وجود الرؤوس المطلوبة وموضع نشرها.

## ما لم نفعّله عمداً

لم نضف `Strict-Transport-Security` أو `includeSubDomains` في هذه الجولة. لا ينبغي فرض HSTS واسع النطاق قبل التأكد من جميع النطاقات الفرعية وأي نطاق مخصص مستقبلي. كما أن هذه الرؤوس لا تعني أن التطبيق اجتاز اختبار اختراق مستقلاً.

## ما يجب اختباره بعد النشر

بعد نجاح سير النشر، افحص استجابات الصفحة وملفات JavaScript وملف Service Worker من تبويب Network في Chrome، وتأكد من ظهور الرؤوس فعلياً. ثم اختبر على الهاتف:

- فتح المفكرة وفتح الخزنة وحفظ ملاحظة وإعادة فتحها.
- التصدير إلى PDF وWord وTXT وHTML.
- تشغيل الصوت وفتح قوائم القراء والخطوط.
- تثبيت PWA وتحديثها والعمل دون اتصال.
- الميكروفون وميزة الإملاء الصوتي إذا كانت مدعومة في المتصفح.

نجاح الاختبارات الآلية لا يثبت سلامة كل مسار استخدام، ولا يحل محل اختبار الهاتف أو اختبار اختراق مستقل.

## مراجع تقنية

- Cloudflare Pages custom headers: https://developers.cloudflare.com/pages/configuration/headers/
- W3C CSP Level 3 — meta restrictions: https://www.w3.org/TR/CSP3/
- MDN CSP implementation: https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/CSP
