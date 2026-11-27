# سجل استخبارات التهديدات — مفكرة أنوار
**الإصدار المرجعي:** 2026-11-27  
**الغرض:** تجميع أصناف الهجمات القديمة والحديثة والغريبة، وربط كل صنف بمستوى الكشف المناسب وإجراء دفاعي قابل للتحقق.

## قاعدة العمل
لا يعني ذكر اسم هجوم أو لغة بلد ما أن كل مدخل منها خبيث. لا تتحول المعلومة إلى قاعدة حظر إلا إذا كانت إشارة دقيقة وقابلة للاختبار، وإلا تُسجل للمراجعة أو تُعالج في طبقة الخادم. قوائم الكلمات متعددة اللغات تغطي عائلات منتقاة ولا يمكنها ضمان تغطية كل لغات العالم أو كل صياغة مبتكرة.

## 1. عائلات الويب التقليدية
- XSS بأنواعه: منع إدخال عناصر نشطة ومعالجات الأحداث وروابط JavaScript، مع ترميز المخرجات بحسب السياق وسياسة CSP.
- SQL/NoSQL/LDAP/XPath injection: استعلامات معلّمة، ومكتبات آمنة، والتحقق من الأنواع والحقول.
- Command/OS injection وShellshock: منع تمرير مدخلات المستخدم إلى الصدفة، وقوائم سماح محددة للأوامر، وأقل صلاحية.
- CSRF، تثبيت الجلسة واختطافها، سرقة ملفات الارتباط والرموز، حشو بيانات الاعتماد والقوة الغاشمة: SameSite وHttpOnly وSecure، تدوير الجلسات، MFA، تحديد المعدل وإبطال الجلسة.
- Path traversal وLFI/RFI وZip Slip: حصر المسارات داخل مجلد معروف، ورفض المسارات المعيارية الخارجة، واختبار فك الأرشيف.
- XXE وSSRF وCRLF/header injection وOpen Redirect: تعطيل محللات XML غير الآمنة، وحصر وجهات الشبكة، وتوحيد تحليل URL والرؤوس، والتحقق من قوائم إعادة التوجيه.
- Deserialization وSSTI وPrototype Pollution وReDoS: تجنب فك التسلسل غير الموثوق، وقوالب آمنة، والتحقق من المفاتيح، وحدود وقت/حجم التنفيذ.

## 2. الهوية والسحابة وواجهات API وسلسلة التوريد
- BOLA/IDOR وكسر التحكم بالوصول ورفع الصلاحيات: تحقق من الصلاحية لكل مورد وفي كل طلب، لا بمجرد إخفاء عنصر الواجهة.
- سرقة رموز OAuth/OIDC وJWT ومفاتيح API والجلسات، وMFA fatigue وعمليات استعادة الحساب: تقليل عمر الرموز، تدويرها وإبطالها، ربطها بالسياق عند الإمكان، ومراجعة أجهزة/جلسات الدخول.
- SSRF إلى خدمات metadata السحابية، وإساءة استخدام تكاملات SaaS والاتصالات الموثوقة: قوائم وجهات مسموحة ومنع عناوين الشبكات الداخلية والروابط المحلية، مع فصل صلاحيات التكامل.
- تسريب الأسرار في المستودعات وسجلات البناء، dependency confusion وtyposquatting والحزم الخبيثة واختراق maintainer: تثبيت الإصدارات، مراجعة provenance وlockfiles، فحص الأسرار والاعتماديات، وتوقيع وبناء موثوق.
- Misconfiguration وسوء ضبط CORS وTLS وStorage وIAM: إعدادات افتراضية مغلقة، مراجعات دورية، وسياسات صلاحيات ضيقة.
- DDoS والبوتات وإساءة استخدام API والتعداد والتجريف: تحديد المعدل، حدود الموارد، التحقق من السلوك، وحماية نقاط النهاية المكلفة.

## 3. أساليب أقل مألوفية أو عالية الالتباس
- HTTP Request Smuggling / Desync وتعارض تفسير Content-Length وTransfer-Encoding.
- Web Cache Poisoning وCache Deception والتلاعب بمفاتيح التخزين الوسيط.
- DNS Rebinding وتبدل وجهة الاسم بين التحقق والاتصال.
- Parser Differential وUnicode homoglyphs وZero-width/Bidi controls والتمويه متعدد الترميزات.
- Polyglot files، MIME/content-type confusion، ومسارات الأرشيف المتسللة.
- Race Conditions وTOCTOU وعمليات إعادة إرسال الطلبات (Replay).
- GraphQL over-fetching/introspection abuse، WebSocket authorization gaps، OAuth redirect/consent abuse.
- JWT algorithm confusion أو قبول إعدادات تحقق غير صحيحة.
- Log injection وتزوير السجلات ومحو آثار النشاط.
هذه الأصناف غالباً تتطلب فحص بروتوكولات أو خادم أو إعدادات؛ لا يستطيع مرشح نص داخل المتصفح اكتشافها أو منعها بمفرده.

## 4. التهديدات المرتبطة بالذكاء الاصطناعي
- Direct وIndirect Prompt Injection داخل النصوص والصفحات والملفات ورسائل التقويم.
- Tool/Agent abuse عندما يُسمح للوكيل بتنفيذ API أو أوامر أو تصفح بحساب المستخدم.
- تسميم مصادر RAG والوثائق ومجموعات البيانات، واختراق ملحقات أو مكونات سلسلة توريد النموذج.
- تسريب أسرار عبر مخرجات الوكيل أو سياق المحادثة، وخداع أدوات الفحص أو مساعدات البرمجة.
لا ينطبق الحظر التنفيذي على كل نص يذكر هذه المصطلحات؛ يسجل الدرع مؤشرات لغوية للمراجعة فقط ما لم تظهر بصمة تنفيذية مؤكدة. ولا تستخدم المفكرة حالياً وكيلاً ذكياً لتنفيذ أوامر على محتوى المستخدم.

## 5. التغطية متعددة اللغات
أضيفت في v0.6.0 عبارات منتقاة بلغات: العربية والإنجليزية والفرنسية والإسبانية والألمانية والإيطالية والبرتغالية والروسية والصينية واليابانية والكورية والتركية والإندونيسية والهندية. كما يطبع المحرك بعض الاختلافات الشكلية والمحارف المتشابهة بين الأبجديات. هذه التغطية ليست ترجمة شاملة ولا ادعاءً باكتشاف كل لغة؛ تبقى البصمات التقنية المستقلة عن اللغة هي خط الدفاع الأهم.

## 6. كيف نقرر إضافة قاعدة
1. تسجيل المصدر والتاريخ واسم الصنف وموضعه: متصفح/محرر/خادم/API/هوية/سحابة/سلسلة توريد.
2. التمييز بين حادثة مؤكدة، وثغرة مستغلة فعلياً، وبحث مختبري، ومؤشر نظري.
3. تحديد ما إذا كان النمط قابلاً للكشف في نص المفكرة أصلاً. ما كان على مستوى الشبكة أو الصلاحيات أو الخادم يذهب إلى قائمة ضوابط الخادم لا إلى الكلمات.
4. صياغة قاعدة ضيقة مع اختبار إيجابي، واختبارات سلبية لقصيدة أو ملاحظة أو نص تقني سليم.
5. إبقاء المجهول للمراجعة فقط. لا يتم تعطيل الإدخال الطبيعي بسبب غرابة الصياغة.
6. عدم حفظ النص الأصلي في سجل المراجعة؛ يكفي معرّف القاعدة والحالة ومصدر الحدث.

## 7. مصادر متابعة موثوقة
- OWASP Top 10:2025: https://top10.owasp.org/2025/0x00_2025-Introduction/
- ENISA Threat Landscape 2025 (مراجعة تصحيحية 22 سبتمبر 2026): https://www.enisa.europa.eu/publications/enisa-threat-landscape-2025
- CISA KEV — مثال تحديث 9 نوفمبر 2026 يضم ثغرات ذات استغلال مؤكد: https://content.govdelivery.com/accounts/USDHSCISA/bulletins/4323900
- Google Cloud M-Trends 2026: https://cloud.google.com/security/resources/m-trends-executive-edition
- Google Threat Intelligence Group، AI Threat Tracker (8 سبتمبر 2026): https://cloud.google.com/blog/topics/threat-intelligence/from-prompting-to-autonomy-the-evolution-of-adversarial-ai
- Gartner ThreatScape 2026–2027 (2 يونيو 2026): https://www.gartner.com/en/newsroom/press-releases/2026-06-02-gartner-identifies-four-critical-threats-requiring-urgent-improvements-from-cybersecurity-leaders
- PortSwigger Web Security Academy — Request Smuggling: https://portswigger.net/web-security/request-smuggling
- PortSwigger — Web Cache Poisoning: https://portswigger.net/kb/issues/00200180_web-cache-poisoning
- Verizon 2025 DBIR: https://www.verizon.com/business/resources/T80a/reports/2025-dbir-data-breach-investigations-report.pdf

**ملاحظة:** هذا سجل بحث دفاعي متجدد، وليس قاعدة بيانات كاملة لجميع الحوادث. تاريخ كل إضافة ومصدرها يجب أن يبقيا موثقين، ويجب مراجعة المصادر قبل تحويل أي خبر إلى قاعدة حظر.


## 8. موجز الأخبار والتحويل إلى ضوابط (مراجعة 27 نوفمبر 2026)

### استغلال مؤكد أو نشاط رُصد ميدانياً
- **CISA KEV — 23 نوفمبر 2026:** أضيفت ثغرتا Path Traversal في Project MONAI (CVE-2026-133968) وSSRF في N-able Mail Assure (CVE-2026-134624) إلى سجل الثغرات المستغلة فعلياً. القرار الدفاعي: تثبيت الإصدارات المتأثرة والتحقق الخادمي من المسارات ووجهات الشبكة؛ لا تُحظر أسماء المنتجات أو CVE في المفكرة.
- **CISA KEV — 9 نوفمبر 2026:** شمل التحديث عيوب مصادقة/صلاحيات وحقن شيفرة في منتجات متعددة، منها GPUStack وFreeSWITCH وAspera. القرار: تحديث الأنظمة، مراجعة الهوية والصلاحيات وسجلات الوصول؛ مؤشرات أسماء CVE معلومات وليست نصوصاً ضارة.
- **Microsoft — 5 نوفمبر 2026:** رُصد استخدام وكلاء AI للبحث عن أسرار مكشوفة في GitHub ثم إساءة استخدامها في بيئات سحابية. القرار: فحص الأسرار في المستودع وسجلات CI، تدوير المفتاح فور كشفه، تقليل صلاحياته، وعدم طباعته في logs.
- **Microsoft — 9 سبتمبر 2026:** رُصدت حملات هندسة اجتماعية مرتبطة بموضوع Passkeys، أعقبها تسجيل وسائل مصادقة إضافية واستكشاف بيانات عبر Graph وSharePoint وOneDrive. القرار: إشعارات تغيير وسائل المصادقة، إبطال الجلسات، مراجعة الأجهزة، ومقاومة التصيد؛ أي نص عنها في المحرر يبقى إشارة مراجعة فقط.
- **Google Threat Intelligence Group — 16 نوفمبر 2026، وMandiant:** رُصد استخدام وكلاء وأطر متعددة الوكلاء، وسرقة جلسات واعتمادات، وإنشاء حسابات IAM غير مصرّح بها، وإساءة استخدام موارد النماذج السحابية (LLMjacking). القرار: ضبط صلاحيات الوكلاء، حصر أدواتهم ووجهاتهم، تسجيل tool calls، وحدود الإنفاق ومراقبة IAM وإبطال الاعتمادات.

### بحث مختبري منشور — لا دليل على استهداف المفكرة
- **PortSwigger — 4 نوفمبر 2026، تحديث 11 نوفمبر:** بحث تقني حول تصعيد حقن ترويسات HTTP إلى CRLF-powered desync. يعامل كمعلومة بحثية لا كحادثة ضد هذا الموقع. القرار: اختبار parser consistency في reverse proxy والخادم، وفحص الرؤوس بعد التطبيع على مستوى الخادم.
- **HTTP Request Smuggling / Desync:** اختلاف تفسير Content-Length وTransfer-Encoding بين طبقات HTTP موضوع اختبار خادمي/شبكي، وليس شيئاً تستطيع قائمة كلمات المتصفح منعه.

### أطر مرجعية واتجاهات عامة
- **ENISA Threat Landscape 2026:** تحليل للفترة من يناير إلى ديسمبر 2025؛ يفيد في ترتيب المخاطر وسلاسل الاعتماد، ولا يعني أن كل صنف حدث في مفكرة أنوار.
- **OWASP Top 10:2025 وOWASP API Security Top 10:** مرجعان لتغطية التحكم بالوصول، التهيئة، سلسلة توريد البرمجيات، الحقن، المصادقة واستهلاك الموارد؛ يستخدمان كأساس مراجعة وضوابط وليس قائمة كلمات.

## 9. مصفوفة الضوابط المطلوبة خارج مرشح النص
| المجال | مؤشر محلي مسموح | الضابط الحقيقي المطلوب |
|---|---|---|
| الأسرار والرموز | صيغ مفتاح خاص/رمز محتمل — مراجعة دون حفظ القيمة | secret scanning على Git، تدوير فوري، تخزين vault، منع الأسرار في logs |
| الهوية والجلسات | عبارات طلب الموافقة أو إضافة جهاز — مراجعة | MFA مقاومة للتصيد، إشعار تغييرات عوامل المصادقة، تدوير وإبطال الجلسات |
| API | ألفاظ BOLA/IDOR — مراجعة | تحقق تفويض على كل مورد وفعل وملكية على الخادم |
| السحابة وSSRF | بعض عناوين metadata الواضحة في النص — حظر محلي محدود | egress allowlist، منع private/link-local والـ metadata، DNS/IP pinning وفحص التحويلات |
| CI/CD | OIDC tokens وworkflow triggers ومراجع Actions المتحركة — مراجعة | صلاحيات قصيرة العمر، تثبيت actions على commit SHA، عزل forks، حماية cache وOIDC trust policy |
| الذكاء الاصطناعي | مؤشرات prompt injection وLLMjacking — مراجعة | فصل التعليمات عن البيانات، موافقة بشرية للأدوات الحساسة، allowlist للأدوات والوجهات، حدود tokens والإنفاق |
| HTTP/CDN | CRLF/desync/cache poisoning — مراجعة/خارج النطاق | توحيد parsing، ضبط cache keys، اختبار reverse proxy وWAF وإعدادات CDN |
| سلسلة التوريد | أسماء الحزم/الموردين ليست سبباً للحظر | lockfiles، provenance، التحقق من التواقيع، SCA/SBOM ومراجعة maintainer |

## 10. سجل مصادر مؤرخ
- CISA KEV، 23 نوفمبر 2026: https://www.cisa.gov/news-events/alerts/2026/11/23/cisa-adds-two-known-exploited-vulnerabilities-catalog
- CISA KEV، 9 نوفمبر 2026: https://content.govdelivery.com/accounts/USDHSCISA/bulletins/4323900
- Microsoft، 5 نوفمبر 2026: https://www.microsoft.com/en-us/security/blog/2026/11/05/threat-actors-use-agentic-ai-tooling-to-find-and-abuse-exposed-secrets/
- Microsoft، 9 سبتمبر 2026: https://www.microsoft.com/en-us/security/blog/2026/09/09/passkey-themed-social-engineering-leads-identity-cloud-compromise/
- Google Threat Intelligence Group، 16 نوفمبر 2026: https://cloud.google.com/blog/topics/threat-intelligence/agentic-threat-activity-crosses-a-significant-threshold
- Google Cloud / Mandiant، 2 نوفمبر 2026: https://cloud.google.com/blog/topics/threat-intelligence/llmjacking-monetizing-compromised-cloud-models
- Mandiant، 24 سبتمبر 2026: https://cloud.google.com/blog/topics/threat-intelligence/hardening-code-pipelines-and-ci-cd-infrastructure
- PortSwigger Research، 4 نوفمبر 2026 (تحديث 11 نوفمبر): https://portswigger.net/research/making-http-header-injection-critical-with-one-prompt
- ENISA Threat Landscape 2026: https://www.enisa.europa.eu/publications/enisa-threat-landscape-2026
- OWASP Top 10:2025: https://top10.owasp.org/2025/
- OWASP API Security Project: https://owasp.org/projects/api-security-project

**تمييز الدليل:** إدخالات CISA KEV تعني أن الثغرة أُدرجت ضمن ثغرات مستغلة فعلياً؛ تقارير Microsoft وGTIG تصف نشاطاً مرصوداً؛ PortSwigger يصف بحثاً تقنياً منشوراً؛ OWASP وENISA مرجعان للمخاطر والضوابط. لا يثبت أي مما سبق أن مفكرة أنوار نفسها تعرضت لهذه الهجمات.
