# CSP ورؤوس HTTP — مفكرة أنوار

## بيئة النشر

الموقع منشور على Cloudflare Pages في مسار التطبيق:
`https://mofakira-anouar.pages.dev/mofakira-anouar/`

يحوّل رابط الجذر `https://mofakira-anouar.pages.dev/` الزائر إلى مسار التطبيق. يبقى نطاق المصادقة (WebAuthn RP ID) هو المضيف `mofakira-anouar.pages.dev`، بينما مسار URL لا يشارك التخزين مع مواقع من أصول مختلفة.

تقرأ Cloudflare Pages ملف `_headers` من **جذر مجلد الإخراج المنشور**. لذلك ينسخ سير النشر الملف إلى `dist/_headers`، بينما توضع ملفات التطبيق في `dist/mofakira-anouar/`. لا يكفي وجود الملف داخل مجلد التطبيق الفرعي.

يفحص سير النشر وجود الملف في موضعه ويتحقق من وجود توجيه CSP و`frame-ancestors 'none'` و`X-Content-Type-Options` قبل رفع الموقع. كما تتحقق اختبارات المستودع من أن سير النشر لا يعيد وضع الملف في المجلد الفرعي.

## الرؤوس المهيأة

يحتوي `_headers` على سياسة CSP ورؤوس HTTP التالية:

- `Content-Security-Policy`: سياسة المصادر المسموحة، ولا تسمح بتنفيذ JavaScript مضمن أو `eval`، مع إضافة `frame-ancestors 'none'` لمنع تضمين الصفحة في إطارات مواقع أخرى.
- `X-Frame-Options: DENY`: طبقة توافق إضافية لمنع التأطير.
- `X-Content-Type-Options: nosniff`: منع تخمين نوع المحتوى.
- `Referrer-Policy: strict-origin-when-cross-origin`: تقليل المعلومات المرسلة في Referer.
- `Permissions-Policy`: تعطيل الكاميرا والموقع الجغرافي، مع السماح بالميكروفون والتشغيل الصوتي وملء الشاشة ضمن الأصل نفسه فقط.
- `X-DNS-Prefetch-Control: off`.

تظل سياسة CSP الموجودة في عنصر meta داخل `index.html` طبقة إضافية. سياسة HTTP هي التي تضيف `frame-ancestors`، لأن هذا التوجيه لا يعمل عند تسليم CSP عبر meta.

## سياسة المحتوى

- `default-src 'none'` افتراضياً.
- `script-src` يسمح بملفات الأصل نفسه وبصمتي SRI محددتين (`sha512`) لملف html2canvas 1.4.1 وملف qrcodejs 1.0.0 فقط. يجب أن يحمل كل سكربت خارجي قيمة `integrity` المطابقة و`crossorigin=anonymous`؛ لا يُسمح بنطاق cdnjs كامل ولا بـ`unsafe-inline` أو `unsafe-eval` للسكريبتات.
- `style-src` يسمح بـ`unsafe-inline` بسبب الأنماط المضمنة الحالية؛ هذا لا يفتح تنفيذ JavaScript.
- تقييد الصور والخطوط والاتصالات والوسائط والإطارات والعاملات إلى المصادر اللازمة لوظائف التطبيق الحالية.
- حُصرت `connect-src` في `self` وواجهة فهرس القراء `https://www.mp3quran.net` المستخدمة فعليًا من التطبيق. أُزيلت استثناءات `api.allorigins.win` و`corsproxy.io` لأنها لم تعد مستخدمة في الشيفرة الحالية، وأُزيل النمط الواسع `https://*.workers.dev` لأن بوابة المفكرة غير مفعلة حاليًا (`ANWAR_API_GATEWAY_BASE` فارغ).
- عند تفعيل بوابة API مستقبلًا، يجب إضافة أصلها الدقيق وحده إلى سياستي HTML وHTTP؛ يرفض اختبار `scripts/test-csp.mjs` النطاقات البديلة والأنماط ذات النجمة، ويتحقق من تطابق القائمتين.
- استُبدلت `media-src https:` بقائمة مضبوطة لمزودي الصوت الذين يستخدمهم التطبيق: MP3Quran، Way2Quran، Internet Archive، IslamHouse، al-Badr، Sabil Al-Rashad، ومحطة asmaki.ma على المنفذ 8000. كما يقبل مشغّل القراء الديناميكي نطاقات MP3Quran الفرعية فقط، ويرفض عناوين HTTPS من نطاقات غير معتمدة.
- `upgrade-insecure-requests` لترقية الموارد غير الآمنة إلى HTTPS.

تُحمّل الشيفرة البرمجية من ملفات JavaScript مستقلة على النطاق نفسه، وتُحمّل حزمة التطبيق الرئيسية بصفة مؤجلة وتُخزّن داخل عامل الخدمة. يفرض `scripts/test-csp.mjs` خلو HTML من كتل JavaScript المضمنة، وتتحقق `scripts/validate.mjs` من سلامة الحزمة وسياسة النشر.

لا توجد بصمات JavaScript مضمنة مطلوبة حاليًا؛ فكل الشيفرة تُحمّل من ملفات مستقلة وتُمنع الكتل المضمنة بواسطة CSP.



### تقييد سكربتات CDN ببصمات محددة

تستخدم وظيفة تصدير PDF ملف html2canvas 1.4.1، وتستخدم أداة QR ملف qrcodejs 1.0.0. تسمح سياستا CSP (داخل الصفحة ورأس HTTP) ببصمة SHA-512 المطابقة لكل ملف على حدة، لا باسم المضيف. يضع محمّل كل سكربت `integrity` و`crossOrigin` قبل إضافة العنصر إلى الصفحة. عند ترقية أي مكتبة يجب التحقق من الملف الرسمي، وتحديث SRI وبصمة CSP وفحوص `scripts/test-csp.mjs` معًا؛ لا تعِد السماح بمضيف CDN كامل لمجرد تسهيل الترقية.

## ما لم نفعّله عمداً

أضفنا `Strict-Transport-Security: max-age=31536000` للنطاق الحالي فقط. لم نضف `includeSubDomains` أو `preload` حتى لا نفرض سياسة على نطاقات فرعية أو نطاقات مستقبلية لم تُراجع. HSTS يساعد المتصفح على فرض HTTPS بعد استلام الترويسة، لكنه لا يغني عن التحقق من شهادة TLS ولا يحمي أول زيارة في كل الحالات. كما أن وجود هذه الرؤوس لا يعني أن التطبيق اجتاز اختبار اختراق مستقلاً.

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
