/* ANWAR SHIELD 3D v0.9.0 — normalized intent-aware editor input gate; local rules only. */
(function(root){
 'use strict';
 if(root.AnwarShield3D&&root.AnwarShield3D.version==='0.8.0')return;
 const VERSION='0.8.0',MAX=200000;
 const SEMANTIC_BLOCK_FAMILIES=[
  {id:'semantic-xss-variants',phrases:['xss','cross site scripting','cross-site scripting','crosssitescripting']},
  {id:'semantic-sql-injection',phrases:['sql injection','s q l injection','sqli','sql command injection','nosql injection','حقن sql','حقن اس كيو ال','حقن قواعد البيانات']},
  {id:'semantic-command-injection',phrases:['command injection','os command injection','shell injection','remote command execution','execute remote commands','حقن الاوامر','حقن اوامر النظام','تنفيذ اوامر عن بعد','تشغيل اوامر عن بعد','تنفيذ تعليمات عن بعد']},
  {id:'semantic-security-bypass',phrases:[
   'تجاوز الحماية','تجاوز نظام الحماية','تجاوز انظمة الحماية','تخطي الحماية','تخطي نظام الحماية','الالتفاف على الحماية','الالتفاف على نظام الحماية','تعطيل وسائل الحماية','تعطيل نظام الحماية','كسر الحماية','تفادي الحماية','تجاوز ضوابط الامان','تخطي اجراءات الامان',
   'bypass protection','bypass security','security bypass','circumvent security','evade security controls','disable security protection'
  ]},
  {id:'semantic-session-theft',phrases:[
   'سرقة الجلسة','سرقة الجلسات','اختطاف الجلسة','اختطاف الجلسات','خطف الجلسة','خطف الجلسات','الاستيلاء على الجلسة','الاستيلاء على الجلسات','سرقة ملفات تعريف الارتباط','سرقة الكوكيز','سرقة الكوكي','سحب الكوكيز','بسرقة الجلسات',
   'session hijacking','session theft','steal session','steal sessions','cookie theft','cookie hijacking','steal cookies','steal session cookie'
  ]},
  {id:'semantic-secret-token-theft',phrases:[
   'استخراج الرموز السرية','استخراج الرمز السري','استخراج رموز الدخول','سرقة الرموز','سرقة الرمز','سرقة التوكن','سرقة التوكنات','سحب التوكن','سحب التوكنات','انتزاع الرموز','استخراج المفاتيح السرية','سرقة المفاتيح السرية','استخراج مفاتيح api','سرقة مفاتيح api','كشف مفاتيح api','استخراج الاسرار','سحب الاسرار','استخراج بيانات الاعتماد',
   'extract secrets','secret extraction','steal secrets','dump secrets','token theft','steal token','steal tokens','api key theft','extract api keys','credential dumping','credential harvesting'
  ]},
  {id:'semantic-authentication-bypass',phrases:[
   'تجاوز تسجيل الدخول','تخطي تسجيل الدخول','تجاوز المصادقة','تخطي المصادقة','تجاوز التحقق','تخطي التحقق','الدخول دون تصريح','دخول غير مصرح','الوصول غير المصرح','تجاوز صلاحيات المستخدم','رفع الصلاحيات','تصعيد الامتيازات',
   'authentication bypass','bypass login','bypass authentication','unauthorized access','privilege escalation'
  ]},
  {id:'semantic-credential-theft',phrases:[
   'سرقة كلمات المرور','سرقة كلمة المرور','سرقة بيانات الدخول','جمع بيانات تسجيل الدخول','جمع بيانات الاعتماد','تصيد كلمات المرور','سرقة الحسابات','سرقة الحساب',
   'steal passwords','password theft','credential theft','credential harvesting','steal credentials'
  ]},
  {id:'semantic-data-exfiltration',phrases:[
   'استخراج قاعدة البيانات','سحب قاعدة البيانات','نسخ قاعدة البيانات','تهريب البيانات','تسريب بيانات المستخدمين','استخراج بيانات المستخدمين','سحب بيانات المستخدمين','نسخ بيانات المستخدمين','تهريب بيانات المستخدمين',
   'data exfiltration','exfiltrate data','database dump','dump database','steal user data'
  ]},
  {id:'semantic-log-tampering',phrases:[
   'اخفاء اثار الاختراق','محو اثار الاختراق','محو سجلات الدخول','حذف سجلات النظام','تعطيل سجلات المراقبة','اخفاء النشاط الضار','التلاعب بسجلات النظام',
   'erase audit logs','delete security logs','hide attack traces','tamper with logs'
  ]},
  {id:'semantic-multilingual-injection',phrases:[
   "injection de commandes","injection de commande","inyeccion de comandos","inyección de comandos","befehlsinjektion","befehle einschleusen","iniezione di comandi","injeção de comandos","injecao de comandos","инъекция команд","внедрение команд","命令注入","コマンドインジェクション","명령어 삽입","komut enjeksiyonu","कमांड इंजेक्शन",
   "injection sql","inyeccion sql","inyección sql","iniezione sql","injeção sql","инъекция sql","внедрение sql","sql注入","sqlインジェクション","sql 인젝션","sql enjeksiyonu","sql इंजेक्शन"
  ]},
  {id:'semantic-multilingual-security-bypass',phrases:[
   "contourner la securite","contourner la sécurité","contourner les controles de securite","contourner les contrôles de sécurité","bypasser les controles d'acces","bypasser les contrôles d'accès","eludir la seguridad","evadir los controles de seguridad","omitir la autenticacion","saltarse la proteccion",
   "sicherheitskontrollen umgehen","authentifizierung umgehen","zugriffskontrollen umgehen",
   "aggirare la sicurezza","eludere l'autenticazione","contornar a seguranca","contornar a segurança","burlar a autenticacao","burlar a autenticação","ignorar os controles de acesso",
   "обойти защиту","обход защиты","обойти аутентификацию","обход контроля доступа",
   "绕过安全机制","绕过身份验证","绕过访问控制",
   "セキュリティを回避","認証を回避","アクセス制御を回避",
   "보안 우회","인증 우회","접근 제어 우회",
   "guvenligi atlatmak","güvenliği atlatmak","kimlik dogrulamayi atlatmak","kimlik doğrulamayı atlatmak",
   "surturarea securitatii","melewati keamanan","melewati autentikasi",
   "सुरक्षा को दरकिनार करना","प्रमाणीकरण को दरकिनार करना","सुरक्षा को बायपास करना"
  ]},
  {id:'semantic-multilingual-session-theft',phrases:[
   "vol de session","detournement de session","voler les sessions","robo de sesion","robo de sesión","secuestro de sesion","secuestro de sesión","robar sesiones",
   "sitzungsdiebstahl","sitzung kapern","furto di sessione","dirottamento di sessione","roubo de sessao","roubo de sessão","sequestro de sessao",
   "кража сессии","угон сессии","перехват сессии",
   "窃取会话","会话劫持","セッション窃取","セッションハイジャック",
   "세션 탈취","세션 가로채기","oturum calma","oturum çalma","oturum ele gecirme",
   "सत्र चोरी","सत्र अपहरण"
  ]},
  {id:'semantic-multilingual-credential-theft',phrases:[
   "vol de mots de passe","voler les identifiants","robo de contrasenas","robo de contraseñas","robar credenciales",
   "passworter stehlen","passwörter stehlen","zugangsdaten stehlen",
   "rubare password","furto di credenziali","roubo de senhas","roubar credenciais",
   "кража паролей","похищение учетных данных","窃取密码","盗取凭据","パスワード窃取","認証情報の窃取",
   "비밀번호 탈취","인증 정보 탈취","sifre hirsizligi","şifre hırsızlığı","kimlik bilgilerini calmak",
   "पासवर्ड चोरी","क्रेडेंशियल चोरी"
  ]},
  {id:'semantic-multilingual-data-exfiltration',phrases:[
   "exfiltration de donnees","exfiltration de données","exfiltrer des donnees","exfiltrer des données","exfiltracion de datos","exfiltración de datos","extraer datos",
   "datenexfiltration","daten ausschleusen","esfiltrazione dei dati","esfiltrare dati","exfiltracao de dados","exfiltração de dados","extrair dados",
   "эксфильтрация данных","вывести данные","утечка данных",
   "数据外泄","窃取数据","データ流出","データ窃取","데이터 유출","데이터 탈취",
   "veri sizdirma","verileri disari aktarmak","डेटा चोरी","डेटा निकालना"
  ]},
  {id:'semantic-multilingual-ransomware-intent',phrases:[
   "chiffrer les fichiers contre rancon","cifrar archivos para pedir rescate","dateien verschlusseln und losgeld verlangen",
   "criptare i file per chiedere un riscatto","criptografar arquivos para exigir resgate",
   "зашифровать файлы ради выкупа","加密文件索要赎金","身代金のためにファイルを暗号化","몸값을 위해 파일 암호화",
   "fidye icin dosyalari sifrelemek","फिरौती के लिए फ़ाइलों को एन्क्रिप्ट करना"
  ]},
  {id:'semantic-global-security-and-credential-abuse',phrases:[
   'beveiliging omzeilen','toegangscontrole omzeilen','wachtwoorden stelen','sessie kapen','gegevens stelen','commando injectie','commando-injectie',
   'kringgå säkerheten','kringgå autentisering','stjäla lösenord','sessionskapning','datastöld','kommandoinjektion',
   'omgå sikkerheten','omgå autentisering','stjele passord','kapre økten','datatyveri','kommandoinjeksjon',
   'omgå sikkerheden','omgå godkendelse','stjæle adgangskoder','kapre session','datatyveri','kommandoindsprøjtning',
   'obejść zabezpieczenia','obejść uwierzytelnianie','kraść hasła','przejęcie sesji','kradzież danych','wstrzykiwanie poleceń',
   'obejít zabezpečení','obejít ověřování','krást hesla','převzít relaci','krádež dat','vkládání příkazů',
   'παράκαμψη ασφάλειας','παράκαμψη ελέγχου ταυτότητας','κλοπή κωδικών','κλοπή συνεδρίας','κλοπή δεδομένων','έγχυση εντολών',
   'עקיפת אבטחה','עקיפת אימות','גניבת סיסמאות','חטיפת הפעלה','גניבת נתונים','הזרקת פקודות',
   'ข้ามการรักษาความปลอดภัย','หลีกเลี่ยงการตรวจสอบสิทธิ์','ขโมยรหัสผ่าน','ยึดเซสชัน','ขโมยข้อมูล','การแทรกคำสั่ง',
   'vượt qua bảo mật','bỏ qua xác thực','đánh cắp mật khẩu','chiếm đoạt phiên','đánh cắp dữ liệu','chèn lệnh',
   'lampasan ang seguridad','iwasan ang pagpapatotoo','pagnakaw ng password','pag-hijack ng sesyon','pagnanakaw ng datos','iniiksyon ng utos',
   'سیکیورٹی کو بائی پاس کرنا','تصدیق کو بائی پاس کرنا','پاس ورڈ چوری کرنا','سیشن ہائی جیک کرنا','ڈیٹا چوری کرنا','کمانڈ انجیکشن',
   'دور زدن امنیت','دور زدن احراز هویت','سرقت گذرواژه','ربودن نشست','سرقت داده','تزریق فرمان',
   'kukwepa usalama','kupita uthibitishaji','wizi wa nywila','utekaji wa kikao','wizi wa data','uingizaji wa amri',
   'নিরাপত্তা এড়িয়ে যাওয়া','প্রমাণীকরণ এড়িয়ে যাওয়া','পাসওয়ার্ড চুরি','সেশন হাইজ্যাক','তথ্য চুরি','কমান্ড ইনজেকশন'
  ]}, ];

 const RULES=[
  /* Product policy: the notebook is an Arabic creative space. Known attack names
     and executable payloads are blocked even when entered as isolated words. */
  {id:'known-attack-vocabulary',status:'blocked',re:/\b(?:xss|cross[\s_-]*site[\s_-]*scripting|sql[\s_-]*injection|sqli|nosql[\s_-]*injection|command[\s_-]*injection|os[\s_-]*command[\s_-]*injection|shell[\s_-]*injection|code[\s_-]*injection|remote[\s_-]*code[\s_-]*execution|rce|csrf|cross[\s_-]*site[\s_-]*request[\s_-]*forgery|ssrf|server[\s_-]*side[\s_-]*request[\s_-]*forgery|xxe|xml[\s_-]*external[\s_-]*entity|ssti|server[\s_-]*side[\s_-]*template[\s_-]*injection|lfi|local[\s_-]*file[\s_-]*inclusion|rfi|remote[\s_-]*file[\s_-]*inclusion|path[\s_-]*traversal|directory[\s_-]*traversal|prototype[\s_-]*pollution|ldap[\s_-]*injection|xpath[\s_-]*injection|crlf[\s_-]*injection|header[\s_-]*injection|html[\s_-]*injection|template[\s_-]*injection|deserialization[\s_-]*attack|insecure[\s_-]*deserialization|open[\s_-]*redirect|clickjacking|session[\s_-]*fixation|credential[\s_-]*stuffing|brute[\s_-]*force|reverse[\s_-]*shell|webshell|shellcode|keylogger|phishing|ransomware|malware|exploit(?:ation)?|zero[\s_-]*day)\b/i},
  {id:'standalone-attack-keywords',status:'blocked',re:/\b(?:select|union|drop|insert|update|delete|cat|ls|whoami|wget|curl)\b|\balert\s*\(/i},
  {id:'standalone-executable-terms',status:'blocked',re:/\b(?:eval|vbscript)\s*\(|\bdocument\s*\.\s*cookie\b|\b(?:innerhtml|outerhtml)\s*=|\bon[a-z]{3,}\s*=/i},
  {id:'xss-dangerous-element',status:'blocked',re:/<\s*\/?\s*(?:script|iframe|object|embed|applet|svg|math|link|meta)\b/i},
  {id:'xss-event-handler',status:'blocked',re:/\bon[a-z]{3,}\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i},
  {id:'xss-javascript-url',status:'blocked',re:/\b(?:javascript|vbscript)\s*:/i},
  {id:'xss-html-data-url',status:'blocked',re:/\bdata\s*:\s*text\/html/i},
  {id:'dangerous-uri-scheme',status:'blocked',re:/\b(?:file|gopher|dict)\s*:\s*\/\//i},
  {id:'xss-html-injection',status:'blocked',re:/<\/?(?:img|video|audio|source|form|input|button)\b[^>]*>/i},
  {id:'xss-css-execution',status:'blocked',re:/\bexpression\s*\(|url\s*\(\s*["']?\s*(?:javascript|vbscript|data\s*:\s*text\/html)\s*:/i},
  {id:'malicious-complete-url',status:'blocked',re:/https?:\/\/[^\s<>"']{0,2000}(?:%3c\s*(?:script|svg|iframe)|<\s*(?:script|svg|iframe)|javascript%3a|vbscript%3a|%0d%0a|%2e%2e(?:%2f|\/)|\.\.\/|(?:onerror|onload)%3d)/i},
  {id:'ssrf-local-target-url',status:'blocked',re:/https?:\/\/(?:localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|169\.254\.169\.254|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})(?::\d+)?(?:[/?#]|$)/i},
  {id:'sql-union-select',status:'blocked',re:/\bunion\s+(?:all\s+)?select\b/i},
  {id:'sql-tautology',status:'blocked',re:/(?:'|")?\s*(?:or|and)\s*(?:'|")?\d+(?:'|")?\s*=\s*(?:'|")?\d+/i},
  {id:'sql-destructive',status:'blocked',re:/\b(?:drop|truncate|alter)\s+(?:table|database)\b|\bdelete\s+from\b/i},
  {id:'sql-stacked-command',status:'blocked',re:/;\s*(?:select|insert|update|delete|drop|alter|create|exec(?:ute)?)\b/i},
  {id:'sql-metadata-probe',status:'blocked',re:/\b(?:information_schema|pg_catalog)\b/i},
  {id:'sql-time-probe',status:'blocked',re:/\b(?:sleep|benchmark)\s*\(|\bwaitfor\s+delay\b/i},
  {id:'sql-commented-tautology',status:'blocked',re:/(?:'|")?\s*(?:or|and)\s*(?:'|")?\d+\s*=\s*\d+\s*(?:--|#|\/\*)/i},
  {id:'nosql-operator-injection',status:'blocked',re:/[$＄]\s*(?:where|ne|gt|gte|lt|lte|regex|exists|expr|in|nin)\b/i},
  {id:'ldap-filter-injection',status:'blocked',re:/\*\)\s*\(\s*&|\(\s*\|\s*\(\s*[\w.-]+\s*=\s*\*\s*\)|\(\s*!\s*\(\s*[\w.-]+\s*=/i},
  {id:'xml-external-entity',status:'blocked',re:/<!\s*(?:DOCTYPE|ENTITY)\b[\s\S]{0,500}?(?:SYSTEM|PUBLIC)\b/i},
  {id:'path-traversal',status:'blocked',re:/(?:\.\.\/|\.\.\\|%2e%2e(?:%2f|%5c|\/|\\)|%252e%252e(?:%252f|%255c)|%c0%ae%c0%ae)/i},
  {id:'crlf-header-injection',status:'blocked',re:/(?:%0d%0a|\\r\\n|\r\n)(?:[a-z0-9-]{2,40}\s*:|location\s*:)/i},
  {id:'command-chain',status:'blocked',re:/(?:;|&&|\|\|?)\s*(?:curl|wget|bash|sh|zsh|powershell|pwsh|cmd(?:\.exe)?|nc|netcat|python(?:3)?|perl|ruby|node|php|rm|chmod|whoami|uname|cat|base64|env|printenv)\b/i},
  {id:'command-substitution',status:'blocked',re:/\$\s*\(\s*(?:curl|wget|bash|sh|powershell|cmd|nc|python|perl|ruby|node|php)\b|\x60(?:curl|wget|bash|sh|powershell|cmd|nc)\b/i},
  {id:'command-pipe-to-shell',status:'blocked',re:/\b(?:curl|wget)\b[^\n]{0,180}\|\s*(?:sh|bash|zsh)\b/i},
  {id:'dangerous-shell-action',status:'blocked',re:/\b(?:rm\s+-rf|chmod\s+\+x|nc\s+-e|netcat\s+-e)\b|\b(?:powershell|pwsh)\b[^\n]{0,100}\s-(?:enc|encodedcommand|e)\b/i},
  {id:'template-injection',status:'review',re:/\$\{\s*(?:constructor|process|require|globalThis|this\b)|<%[=!]?[\s\S]{0,80}?%>|\{\{\s*(?:constructor|__proto__|7\s*\*\s*7)/i},
  {id:'prototype-pollution',status:'blocked',re:/__proto__|\bconstructor\s*\.\s*prototype\b|\bprototype\s*\[/i},
  {id:'encoded-executable-markup',status:'blocked',re:/(?:%3c\s*(?:script|svg|iframe)|&#x0*3c;?\s*(?:script|svg)|\\x3c\\x73\\x63\\x72\\x69\\x70\\x74)/i},
  {id:'suspicious-control-sequence',status:'review',re:/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/},
  {id:'log4shell-jndi-lookup',status:'blocked',re:/\$\s*\{\s*jndi\s*:\s*(?:ldap|ldaps|rmi|dns|iiop|corba)\s*:/i},
  {id:'shellshock-function-signature',status:'blocked',re:/\(\)\s*\{\s*:\s*;\s*\}\s*;/i},
  {id:'yaml-object-construction',status:'blocked',re:/!!(?:python\/object|javax\.script\.ScriptEngineManager)\b/i},
  {id:'ssrf-cloud-metadata-hostname',status:'blocked',re:/https?:\/\/(?:metadata\.google\.internal|instance-data\.ec2\.internal)(?::\d+)?(?:[/?#]|$)/i},
  {id:'http-request-smuggling-indicator',status:'review',re:/(?:content-length\s*:\s*\d+[\s\S]{0,180}transfer-encoding\s*:|transfer-encoding\s*:[\s\S]{0,180}content-length\s*:)/i},
  {id:'web-cache-poisoning-indicator',status:'review',re:/\bx-forwarded-host\s*:[^\r\n]{1,200}/i},
  {id:'jwt-none-algorithm-indicator',status:'review',re:/["']alg["']\s*:\s*["']none["']/i},
  {id:'prompt-injection-indicator',status:'review',re:/\b(?:ignore|disregard|override)\s+(?:all\s+)?(?:previous|prior|system)\s+instructions\b|\b(?:reveal|print|show|expose)\s+(?:the\s+)?(?:system|developer)\s+prompt\b/i},
  {id:'ssrf-ipv6-and-secondary-metadata-target',status:'blocked',re:/https?:\/\/(?:\[::1\]|\[::ffff:127\.0\.0\.1\]|100\.100\.100\.200|fd00:ec2::254)(?::\d+)?(?:[/?#]|$)/i},
  {id:'path-traversal-overencoded-separators',status:'blocked',re:/(?:\.\.%2f|\.\.%5c|%2e%2e(?:%2f|%5c)|%252e%252e(?:%252f|%255c)|%c0%af|%c1%9c)/i},
  {id:'exposed-private-key-marker',status:'review',re:/-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/i},
  {id:'exposed-provider-token-pattern',status:'review',re:/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AIza[0-9A-Za-z_-]{35}|xox[baprs]-[0-9A-Za-z-]{10,})\b/i},
  {id:'exposed-secret-environment-assignment',status:'review',re:/\b(?:AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN|OPENAI_API_KEY|ANTHROPIC_API_KEY|GEMINI_API_KEY|GOOGLE_API_KEY|SLACK_BOT_TOKEN|GITHUB_TOKEN|GH_TOKEN)\s*[:=]\s*['\x22]?[A-Za-z0-9_+/=-]{20,}/i},
  {id:'exposed-bearer-token',status:'review',re:/\bBearer\s+[A-Za-z0-9._~+/-]{24,}={0,2}\b/i},
  {id:'exposed-jwt-token-shape',status:'review',re:/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/i},
  {id:'identity-mfa-push-and-passkey-social-engineering',status:'review',re:/\b(?:approve|accept|confirm)\s+(?:the\s+)?(?:mfa|multi[- ]factor|sign[- ]in|login)\s+(?:push|request|prompt|notification)\b|\b(?:add|register|enroll)\s+(?:a\s+)?new\s+(?:passkey|authenticator|security key|trusted device)\b|(?:وافق على|اقبل|أكد)\s+(?:طلب|إشعار|اشعار)\s+(?:تسجيل الدخول|الدخول|المصادقة)|(?:إضافة|اضف|سجل)\s+(?:مفتاح مرور|جهاز مصادقة|وسيلة مصادقة)\s+جديد/i},
  {id:'ci-cd-oidc-and-workflow-token-exposure',status:'review',re:/\b(?:ACTIONS_ID_TOKEN_REQUEST_TOKEN|ACTIONS_ID_TOKEN_REQUEST_URL|ACTIONS_RUNTIME_TOKEN)\b/i},
  {id:'ci-cd-untrusted-workflow-trigger',status:'review',re:/\b(?:pull_request_target|workflow_run)\b/i},
  {id:'ci-cd-cache-poisoning-context',status:'review',re:/(?:actions\/cache|cache key|restore-keys)[\s\S]{0,160}(?:pull_request_target|workflow_run|untrusted|fork)/i},
  {id:'multilingual-prompt-injection-extra-languages',status:'review',re:/ignora\s+(?:todas?\s+las?\s+)?instrucciones\s+anteriores|ignorer\s+(?:toutes?\s+les?\s+)?instructions\s+précédentes|ignoriere\s+(?:alle\s+)?vorherigen\s+anweisungen|ignore\s+(?:todas?\s+as?\s+)?instruções\s+anteriores|忽略(?:所有)?(?:之前|先前)的指令|以前の指示を無視|이전 지침을 무시|सभी पिछले निर्देशों को अनदेखा करें|تمام سابقہ ہدایات کو نظر انداز کریں|تمام دستورهای قبلی را نادیده بگیر|ignora\s+tutte\s+le\s+istruzioni\s+precedenti|zignoruj\s+wszystkie\s+poprzednie\s+instrukcje|ignoruj\s+všechny\s+předchozí\s+pokyny/i},
  {id:'ci-cd-floating-action-reference',status:'review',re:/\buses\s*:\s*[\w./-]+@(?:main|master|latest)\b/i},
  {id:'api-object-authorization-risk-indicator',status:'review',re:/\b(?:BOLA|IDOR|broken object[- ]level authorization|broken function[- ]level authorization|object property[- ]level authorization)\b/i},
  {id:'identity-cloud-privilege-abuse-indicator',status:'review',re:/\b(?:create|add|grant)\s+(?:an?\s+)?(?:unauthorized\s+)?(?:iam user|service principal|access key)\b|\b(?:disable|bypass)\s+(?:mfa|multi[- ]factor authentication|audit logging|conditional access)\b/i},
  {id:'multilingual-prompt-injection-indicator',status:'review',re:/\b(?:ignore|disregard|override)\s+(?:all\s+)?(?:previous|prior|system)\s+instructions\b|\b(?:reveal|print|show|expose)\s+(?:the\s+)?(?:system|developer)\s+prompt\b|ignora\s+(?:todas?\s+las\s+)?instrucciones\s+anteriores|ignorer\s+(?:toutes?\s+les\s+)?instructions\s+précédentes|ignoriere\s+(?:alle\s+)?vorherigen\s+anweisungen|忽略(?:所有)?(?:之前|先前)的指令|以前の指示を無視|이전 지침을 무시|تمام سابقہ ہدایات کو نظر انداز کریں|تمام دستورهای قبلی را نادیده بگیر/i},
  {id:'agentic-ai-tool-and-secret-abuse-indicator',status:'review',re:/\b(?:ai agent|agentic tool|mcp server|tool call)\b[\s\S]{0,140}\b(?:exfiltrat\w*|steal\w*|unauthorized|secret|credential|execute arbitrary)\b|\b(?:llmjacking|llm jacking|cloud model hijacking)\b/i},
  {id:'struts-ognl-indicator',status:'review',re:/%\{\s*#(?:context|_memberaccess|dm|cmd)\b/i}
 ];

 function decodeEntities(value){
  if(value.indexOf('&')===-1)return value;
  const named={lt:'<',gt:'>',colon:':',sol:'/',semi:';',equals:'=',amp:'&',quot:'"',apos:"'"};
  return value.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|lt|gt|colon|sol|semi|equals|amp|quot|apos);?/gi,function(match,entity){
   const key=String(entity).toLowerCase();
   if(key.charAt(0)!=='#')return named[key]||match;
   const hex=key.charAt(1)==='x',number=parseInt(key.slice(hex?2:1),hex?16:10);
   return Number.isFinite(number)&&number>=0&&number<=0x10ffff?String.fromCodePoint(number):match;
  });
 }
 function decodeEscapes(value){
  if(value.indexOf('\\')===-1)return value;
  return value
   .replace(/\\x([0-9a-f]{2})/gi,function(_,hex){return String.fromCharCode(parseInt(hex,16));})
   .replace(/\\u\{([0-9a-f]{1,6})\}/gi,function(_,hex){const n=parseInt(hex,16);return n<=0x10ffff?String.fromCodePoint(n):_;})
   .replace(/\\u([0-9a-f]{4})/gi,function(_,hex){return String.fromCharCode(parseInt(hex,16));});
 }
 function decodePercent(value){
  if(!/%[0-9a-f]{2}/i.test(value))return value;
  let current=value;
  for(let i=0;i<3;i++){
   let next;
   try{next=decodeURIComponent(current.replace(/\+/g,'%2B'));}
   catch(_){next=current.replace(/%([0-9a-f]{2})/gi,function(match,hex){return String.fromCharCode(parseInt(hex,16));});}
   if(next===current)break;
   current=next;
  }
  return current;
 }
 function foldIntentText(value){
  let text=String(value==null?'':value);
  try{text=text.normalize('NFKC');}catch(_){}
  text=text.toLowerCase()
   .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0300-\u036F]/g,'')
   .replace(/\u0640/g,'')
   .replace(/[أإآٱ]/g,'ا')
   .replace(/[ىی]/g,'ي')
   .replace(/ک/g,'ك')
   .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g,'');
  const confusables={
   'а':'a','е':'e','о':'o','р':'p','с':'c','х':'x','і':'i','ј':'j','ѕ':'s',
   'к':'k','м':'m','т':'t','у':'y','в':'b','һ':'h','н':'h','ӏ':'l','ԁ':'d','ԛ':'q','ԝ':'w',
   'α':'a','ο':'o','ρ':'p','χ':'x','ι':'i','κ':'k','τ':'t','ν':'v','ϲ':'c','ϳ':'j','ϱ':'p','ϵ':'e','ϰ':'k'
  };
  text=text.replace(/[аеорсхіјѕкмтувһнӏԁԛԝαορχικτνϲϳϱϵϰ]/g,ch=>confusables[ch]||ch);
  return text.replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 }
 const INTENT_WORD_CHARACTER=/[\p{L}\p{N}]/u;
 function buildSemanticMatcher(){
  const nodes=[{next:new Map(),failure:0,outputs:[]}];
  for(const family of SEMANTIC_BLOCK_FAMILIES){
   for(const phrase of family.phrases){
    const compact=Array.from(foldIntentText(phrase).replace(/\s+/g,''));
    if(compact.length<4)continue;
    let state=0;
    for(const character of compact){
     let next=nodes[state].next.get(character);
     if(next===undefined){
      next=nodes.length;
      nodes[state].next.set(character,next);
      nodes.push({next:new Map(),failure:0,outputs:[]});
     }
     state=next;
    }
    if(!nodes[state].outputs.some(output=>output.id===family.id)){
     nodes[state].outputs.push({length:compact.length,id:family.id});
    }
   }
  }
  const queue=[];
  for(const child of nodes[0].next.values())queue.push(child);
  for(let cursor=0;cursor<queue.length;cursor++){
   const state=queue[cursor];
   for(const [character,child] of nodes[state].next){
    let fallback=nodes[state].failure;
    while(fallback!==0&&!nodes[fallback].next.has(character))fallback=nodes[fallback].failure;
    const fallbackChild=nodes[fallback].next.get(character);
    nodes[child].failure=fallbackChild===undefined?0:fallbackChild;
    const inherited=nodes[nodes[child].failure].outputs;
    if(inherited.length)nodes[child].outputs.push(...inherited);
    queue.push(child);
   }
  }
  return nodes;
 }
 const SEMANTIC_MATCHER=buildSemanticMatcher();
 function findSemanticMatch(folded){
  if(!folded)return null;
  const characters=[],boundaryBefore=[],boundaryAfter=[];
  let previousWord=false,lastWordIndex=-1;
  for(let offset=0;offset<folded.length;){
   const character=String.fromCodePoint(folded.codePointAt(offset));
   const isWord=INTENT_WORD_CHARACTER.test(character);
   if(isWord){
    const index=characters.length;
    characters.push(character);
    boundaryBefore.push(!previousWord);
    boundaryAfter.push(false);
    previousWord=true;
    lastWordIndex=index;
   }else{
    if(lastWordIndex>=0)boundaryAfter[lastWordIndex]=true;
    previousWord=false;
    lastWordIndex=-1;
   }
   offset+=character.length;
  }
  if(lastWordIndex>=0)boundaryAfter[lastWordIndex]=true;
  let state=0;
  for(let index=0;index<characters.length;index++){
   const character=characters[index];
   while(state!==0&&!SEMANTIC_MATCHER[state].next.has(character)){
    state=SEMANTIC_MATCHER[state].failure;
   }
   const next=SEMANTIC_MATCHER[state].next.get(character);
   state=next===undefined?0:next;
   const outputs=SEMANTIC_MATCHER[state].outputs;
   for(const output of outputs){
    const start=index+1-output.length;
    if(start>=0&&boundaryBefore[start]&&boundaryAfter[index])return output.id;
   }
  }
  return null;
 }
 function normalizeForms(value){
  let original=String(value==null?'':value).slice(0,MAX);
  try{original=original.normalize('NFKC');}catch(_){}
  original=original
   .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g,'')
   .replace(/[＜﹤]/g,'<').replace(/[＞﹥]/g,'>').replace(/[：﹕]/g,':');
  const forms=[original];
  let current=original;
  for(let i=0;i<3;i++){
   const next=decodePercent(decodeEscapes(decodeEntities(current)));
   if(next===current)break;
   current=next;
   forms.push(current);
  }
  const withoutComments=current
   .replace(/\/\*[\s\S]{0,2000}?\*\//g,' ')
   .replace(/<!--[\s\S]{0,2000}?-->/g,' ');
  if(withoutComments!==current)forms.push(withoutComments);
  const folded=foldIntentText(withoutComments);
  if(folded&&folded!==withoutComments)forms.push(folded);
  const compact=folded.replace(/\s+/g,'');
  if(compact&&compact!==folded)forms.push(compact);
  return forms.filter((form,index,list)=>form.length<=MAX*2&&list.indexOf(form)===index);
 }
 function normalize(value){return normalizeForms(value).join('\n');}
 function inspect(value){
  const forms=normalizeForms(value);
  let reviewMatch=null;
  for(const rule of RULES){
   for(const form of forms){
    rule.re.lastIndex=0;
    if(!rule.re.test(form))continue;
    if(rule.status==='blocked'){
     return Object.freeze({blocked:true,status:'blocked',id:rule.id,version:VERSION});
    }
    if(!reviewMatch)reviewMatch=rule.id;
   }
  }
  const checkedIntentForms=new Set();
  for(const form of forms){
   const folded=foldIntentText(form);
   if(!folded||checkedIntentForms.has(folded))continue;
   checkedIntentForms.add(folded);
   const semanticId=findSemanticMatch(folded);
   if(semanticId)return Object.freeze({blocked:true,status:'blocked',id:semanticId,version:VERSION});
  }
  if(reviewMatch)return Object.freeze({blocked:false,status:'review',id:reviewMatch,version:VERSION});
  return Object.freeze({blocked:false,status:'clean',id:null,version:VERSION});
 }

 function editableHost(target){
  let node=target&&target.nodeType===3?target.parentElement:target;
  let fallback=null;
  while(node&&node.nodeType===1){
   const attr=typeof node.getAttribute==='function'?String(node.getAttribute('contenteditable')||'').toLowerCase():'';
   if(attr==='false')return null;
   if(attr==='true'||attr==='plaintext-only')return node;
   if(node.isContentEditable===true)fallback=node;
   node=node.parentElement;
  }
  return fallback;
 }
 function field(target){
  const element=target&&target.nodeType===3?target.parentElement:target;
  if(!element||element.disabled||element.readOnly)return null;
  const tag=String(element.tagName||'').toLowerCase();
  if(tag==='textarea')return element;
  if(tag==='input')return ['text','search','url','tel'].includes(String(element.type||'text').toLowerCase())?element:null;
  return editableHost(element);
 }
 function isEditable(target){
  if(!target)return false;
  const tag=String(target.tagName||'').toLowerCase();
  if(tag==='input'||tag==='textarea')return false;
  const attr=typeof target.getAttribute==='function'?String(target.getAttribute('contenteditable')||'').toLowerCase():'';
  return target.isContentEditable===true||attr==='true'||attr==='plaintext-only';
 }
 function read(target){
  if(isEditable(target)){
   if(typeof target.innerText==='string')return target.innerText;
   return String(target.textContent||'');
  }
  return typeof target.value==='string'?target.value:'';
 }
 function snapshot(target){
  if(isEditable(target)){
   return {kind:'dom',children:Array.from(target.childNodes||[]).map(node=>node.cloneNode(true))};
  }
  return {kind:'value',value:read(target)};
 }
 function restore(target,state){
  if(!state)return;
  if(state.kind==='dom'){
   const nodes=state.children.map(node=>node.cloneNode(true));
   if(typeof target.replaceChildren==='function')target.replaceChildren(...nodes);
   else{
    while(target.firstChild)target.removeChild(target.firstChild);
    nodes.forEach(node=>target.appendChild(node));
   }
  }else target.value=state.value;
 }
 const safe=new WeakMap();
 const pendingInputs=new WeakMap();
 const prevalidatedInsertions=new WeakMap();
 function remember(target){if(target)safe.set(target,snapshot(target));}
 function insertedValue(target,data){
  const current=read(target);
  if(isEditable(target)){
   const selection=typeof root.getSelection==='function'?root.getSelection():null;
   const range=selection&&selection.rangeCount?selection.getRangeAt(0):null;
   if(range&&typeof target.contains==='function'&&
      (target.contains(range.startContainer)||range.startContainer===target)){
    try{
     const before=target.ownerDocument.createRange();
     before.selectNodeContents(target);
     before.setEnd(range.startContainer,range.startOffset);
     const after=target.ownerDocument.createRange();
     after.selectNodeContents(target);
     after.setStart(range.endContainer,range.endOffset);
     return before.toString()+data+after.toString();
    }catch(_){}
   }
   return current+data;
  }
  const start=typeof target.selectionStart==='number'?target.selectionStart:current.length;
  const end=typeof target.selectionEnd==='number'?target.selectionEnd:start;
  return current.slice(0,start)+data+current.slice(end);
 }
 const reviewLog=[],reviewLastSeen=new Map();
 function recordReview(result,source){
  if(!result||result.status!=='review')return;
  const now=Date.now(),key=String(result.id||'unknown')+':'+String(source||'input');
  const last=reviewLastSeen.get(key)||0;
  if(now-last<1200)return;
  reviewLastSeen.set(key,now);
  reviewLog.push(Object.freeze({id:result.id,status:'review',source:source||'input',at:now}));
  if(reviewLog.length>50)reviewLog.shift();
  announce(result,source);
 }

 function announce(result,source){
  if(typeof root.CustomEvent==='function'&&typeof root.dispatchEvent==='function'){
   root.dispatchEvent(new root.CustomEvent('anwar-shield-detection',{detail:{version:VERSION,id:result.id,status:result.status,source:source||'input'}}));
  }
 }
 function notify(result){
  if(!root.document||!root.document.body)return;
  let notice=root.document.getElementById('anwar-shield-notice');
  if(!notice){
   notice=root.document.createElement('div');
   notice.id='anwar-shield-notice';
   notice.setAttribute('role','alert');
   notice.setAttribute('aria-live','assertive');
   notice.style.cssText='position:fixed;z-index:2147483647;inset:auto 12px 18px;max-width:520px;margin:auto;padding:12px 16px;border-radius:12px;background:#182b3d;color:#fff;text-align:center;font:600 14px Tahoma,sans-serif;box-shadow:0 4px 18px #0004';
   root.document.body.appendChild(notice);
  }
  notice.textContent=result.status==='blocked'
   ?'منع الدرع إدخالاً يطابق نمط هجوم معروفاً؛ لم يُدرج النص ولم يُحفظ.'
   :'أوقف الدرع إدخالاً غير مألوف للمراجعة؛ لم يُدرج النص ولم يُحفظ.';
  notice.hidden=false;
  if(notify.timer)root.clearTimeout(notify.timer);
  notify.timer=root.setTimeout(function(){notice.hidden=true;},3500);
 }
 function reject(target,result,source){
  if(safe.has(target))restore(target,safe.get(target));
  else if(isEditable(target)&&typeof target.replaceChildren==='function')target.replaceChildren();
  else if(!isEditable(target))target.value='';
  announce(result,source);
  notify(result);
 }
 function rejectEvent(event,result,source){
  if(event&&typeof event.preventDefault==='function')event.preventDefault();
  if(event&&typeof event.stopImmediatePropagation==='function')event.stopImmediatePropagation();
  announce(result,source);
  notify(result);
 }
 const snapshotTimers=new WeakMap();
 function scheduleRemember(target,source){
  if(!target)return;
  if(!isEditable(target)){
   remember(target);
   return;
  }
  const previous=snapshotTimers.get(target);
  if(previous)root.clearTimeout(previous);
  const timer=root.setTimeout(function(){
   snapshotTimers.delete(target);
   const result=inspect(read(target));
   if(result.status==='blocked'){
    reject(target,result,source||'idle-input');
    return;
   }
   if(result.status==='review')recordReview(result,source||'idle-input');
   remember(target);
  },650);
  snapshotTimers.set(target,timer);
 }
 function commitRemember(target,source){
  if(!target)return;
  const timer=snapshotTimers.get(target);
  if(timer){
   root.clearTimeout(timer);
   snapshotTimers.delete(target);
  }
  const result=inspect(read(target));
  if(result.status==='blocked'){
   reject(target,result,source||'change');
   return;
  }
  if(result.status==='review')recordReview(result,source||'change');
  remember(target);
 }
 function before(event){
  const target=field(event.target);
  if(!target)return;
  const inputType=String(event.inputType||'');
  if(/^delete/i.test(inputType)){
   prevalidatedInsertions.delete(target);
   return;
  }
  const data=event.data;
  if(typeof data!=='string'||!data){
   if((inputType==='insertFromPaste'||inputType==='insertFromDrop')&&prevalidatedInsertions.has(target)){
    pendingInputs.set(target,prevalidatedInsertions.get(target));
    prevalidatedInsertions.delete(target);
   }
   return;
  }
  const candidate=insertedValue(target,data);
  if(prevalidatedInsertions.has(target)){
   const prevalidated=prevalidatedInsertions.get(target);
   prevalidatedInsertions.delete(target);
   if(prevalidated===candidate){
    pendingInputs.set(target,candidate);
    return;
   }
  }
  const result=inspect(candidate);
  if(result.status==='blocked')rejectEvent(event,result,'beforeinput');
  else pendingInputs.set(target,candidate);
 }
 function paste(event){
  const target=field(event.target);
  if(!target)return;
  const transfer=event.clipboardData;
  const text=transfer&&typeof transfer.getData==='function'?(transfer.getData('text/plain')||transfer.getData('text')):'';
  if(!text)return;
  const candidate=insertedValue(target,text);
  const result=inspect(candidate);
  if(result.status==='blocked')rejectEvent(event,result,'paste');
  else prevalidatedInsertions.set(target,candidate);
 }
 function drop(event){
  const target=field(event.target);
  if(!target)return;
  const transfer=event.dataTransfer;
  const text=transfer&&typeof transfer.getData==='function'?(transfer.getData('text/plain')||transfer.getData('text')):'';
  if(!text)return;
  const candidate=insertedValue(target,text);
  const result=inspect(candidate);
  if(result.status==='blocked')rejectEvent(event,result,'drop');
  else prevalidatedInsertions.set(target,candidate);
 }
 function input(event){
  const target=field(event.target);
  if(!target)return;
  const current=read(target);
  if(pendingInputs.has(target)){
   const expected=pendingInputs.get(target);
   pendingInputs.delete(target);
   if(current===expected){
    prevalidatedInsertions.delete(target);
    scheduleRemember(target,'input');
    return;
   }
  }
  if(prevalidatedInsertions.has(target)){
   const expected=prevalidatedInsertions.get(target);
   prevalidatedInsertions.delete(target);
   if(current===expected){
    scheduleRemember(target,'input');
    return;
   }
  }
  const result=inspect(current);
  if(result.status==='blocked'){
   if(/^delete/i.test(String(event.inputType||'')))return;
   reject(target,result,'input');
  }else{
   if(result.status==='review')recordReview(result,'input');
   scheduleRemember(target,'input');
  }
 }
 function change(event){
  const target=field(event.target);
  if(target)commitRemember(target,'change');
 }
 function focus(event){
  const target=field(event.target);
  if(target)remember(target);
 }
 function blur(event){
  const target=field(event.target);
  if(target)commitRemember(target,'blur');
 }
 function submit(event){
  const formElement=event.target;
  if(!formElement||!formElement.elements)return;
  for(const target of Array.from(formElement.elements)){
   const editable=field(target);
   if(!editable)continue;
   const result=inspect(read(editable));
   if(result.status==='blocked'){
    event.preventDefault();
    event.stopImmediatePropagation();
    reject(editable,result,'submit');
    return;
   }
   if(result.status==='review')recordReview(result,'submit');
  }
 }
 if(root.document&&root.document.addEventListener){
  root.document.addEventListener('focusin',focus,true);
  root.document.addEventListener('focusout',blur,true);
  root.document.addEventListener('beforeinput',before,true);
  root.document.addEventListener('paste',paste,true);
  root.document.addEventListener('drop',drop,true);
  root.document.addEventListener('input',input,true);
  root.document.addEventListener('change',change,true);
  root.document.addEventListener('submit',submit,true);
 }
 root.AnwarShield3D=Object.freeze({version:VERSION,inspect,normalize,getReviewLog:()=>reviewLog.map(item=>({...item}))});
})(globalThis);
