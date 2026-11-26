import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const manifest = read('android/app/src/main/AndroidManifest.xml');
const nativeHome = read('android/app/src/main/java/com/anwar/mofakira/MainActivity.kt');
const notebook = read('android/app/src/main/java/com/anwar/mofakira/NativeNotebookActivity.kt');
const religiousGate = read('android/app/src/main/java/com/anwar/mofakira/ReligiousGateActivity.kt');
const activity = read('android/app/src/main/java/com/anwar/mofakira/LegacyWebActivity.kt');
const scheduler = read('android/app/src/main/java/com/anwar/mofakira/alarm/PrayerAlarmScheduler.kt');
const receiver = read('android/app/src/main/java/com/anwar/mofakira/alarm/PrayerAlarmReceiver.kt');
const service = read('android/app/src/main/java/com/anwar/mofakira/playback/AdhanPlaybackService.kt');
const calendar = read('android/app/src/main/java/com/anwar/mofakira/alarm/PrayerCalendarRepository.kt');
const prayer = read('prayer-times.js');
const voiceCatalog = read('android/app/src/main/java/com/anwar/mofakira/playback/VoiceCatalog.kt');
const companionReadme = read('android/README.md');

assert.match(manifest, /SCHEDULE_EXACT_ALARM/);
assert.match(manifest, /FOREGROUND_SERVICE_MEDIA_PLAYBACK/);
assert.match(manifest, /android:foregroundServiceType="mediaPlayback"/);
assert.match(manifest, /RECEIVE_BOOT_COMPLETED/);
assert.match(manifest, /android:name="\.MainActivity"[\s\S]*?android:exported="true"[\s\S]*?android.intent.action.MAIN[\s\S]*?android.intent.category.LAUNCHER/);
assert.match(manifest, /android:name="\.LegacyWebActivity"[\s\S]*?android:exported="false"/);
assert.match(nativeHome, /class MainActivity : Activity\(\)/);
assert.match(nativeHome, /NativeNotebookActivity::class\.java/, 'the launcher restores the native Android notebook');
assert.match(notebook, /الخدمات القرآنية والدينية/);
assert.match(notebook, /NativePrayerActivity::class\.java/, 'the native notebook exposes the native prayer screen directly');
assert.match(notebook, /ReligiousGateActivity::class\.java/);
assert.match(religiousGate, /NativePrayerActivity::class\.java/);
assert.match(religiousGate, /startActivity\(Intent\(this, LegacyWebActivity::class.java\)\)/,
  'remaining complete web services stay reachable inside the religious gateway');
assert.doesNotMatch(nativeHome, /https?:\/\//,
  'launcher delegates the complete UI to the bundled WebView activity without hard-coded remote URLs');

assert.match(activity, /WEB_MESSAGE_LISTENER/);
assert.match(activity, /setOf\(SITE_ORIGIN\)/);
assert.match(activity, /isMainFrame/);
assert.match(activity, /WebViewAssetLoader\.Builder\(\)/, 'the full PWA is bundled and served as local HTTPS assets');
assert.ok(activity.includes('SITE_URL = "$SITE_ORIGIN/assets/www/index.html"'), 'legacy activity opens the packaged canonical PWA entry point');
assert.doesNotMatch(activity, /feat-native-background-adhan\.mofakira-anouar\.pages\.dev/, 'legacy activity must not depend on a temporary preview deployment');
assert.match(scheduler, /setAlarmClock/);
assert.match(scheduler, /AlarmClockInfo/);
assert.match(scheduler, /setAndAllowWhileIdle/);
assert.match(scheduler, /canScheduleExactAlarms\(\)/,
  'exact AlarmClock scheduling is used only when Android grants exact-alarm access');
assert.match(receiver, /PrayerAlarmScheduler.scheduleNext\(context\)/);
assert.match(receiver, /startForegroundService/);
assert.match(service, /ServiceCompat.startForeground/);
assert.match(service, /MediaPlayer/);
assert.ok(service.includes('media.setVolume(config.volume, config.volume)'), 'native playback applies the selected adhan volume');
assert.match(calendar, /LocalPrayerCalculator\.calculateDay/);
assert.doesNotMatch(calendar, /HttpURLConnection|api\.aladhan\.com|calendarByCity|URL\(/,
  'the Android prayer calendar is calculated locally without HTTP fallbacks');
const localCalculator = read('android/app/src/main/java/com/anwar/mofakira/alarm/LocalPrayerCalculator.kt');
assert.match(localCalculator, /Africa\/Casablanca/);
assert.match(localCalculator, /"Meknes"/);
assert.match(localCalculator, /tuneSunrise = -5\.0, tuneDhuhr = 5\.0, tuneMaghrib = 5\.0/);
assert.match(calendar, /PrayerSettings\.saveEvents/);
assert.match(prayer, /function syncNativeBackground\(requestPermissions\)/);
assert.match(prayer, /if\(requestPermissions===true\)payload\.requestPermissions=true/);
assert.match(activity, /optBoolean\("requestPermissions", false\)/);
assert.match(activity, /if \(explicitPermissionRequest\) \{\s*permissionPromptDeferred = false/);
assert.match(activity, /أذونات الأذان الخلفي مفعّلة بالفعل/);
assert.match(prayer, /bridge\.postMessage\(JSON\.stringify\(payload\)\)/);
assert.match(prayer,/privatePrefs\.subscribe\(applyVaultPrayerPreferences\)/,
  'encrypted prayer preferences are observed after the vault loads');
assert.match(prayer,/function applyVaultPrayerPreferences\(snapshot\)[\s\S]{0,1800}if\(settings\.enabled\)syncNativeBackground\(\)/,
  'unlocked prayer preferences are synchronized with native Android after vault authentication');
assert.doesNotMatch(prayer,/localStorage|sessionStorage/,
  'prayer settings no longer rely on plaintext browser storage for native startup synchronization');
assert.match(prayer, /enabledInput\.addEventListener/);
assert.match(companionReadme, /Chrome.*PWA/);
assert.match(companionReadme, /المنبهات والتذكيرات/);
assert.match(activity, /تفعيل الأذان خارج المفكرة/);
assert.match(activity, /requestNotificationAccess\(\)/);
assert.match(activity, /requestExactAlarmAccessIfNeeded\(\)/);
assert.match(activity, /waitingForExactAlarmSettings/);
assert.match(activity, /permissionPromptDeferred/);
assert.match(activity, /lastAdhanEnabled/);
assert.match(activity, /hasExactAlarmAccess\(\)/);
assert.match(prayer, /لا يضمن استمرار الصوت بعد إغلاق الصفحة/);
assert.match(prayer,/const VOICES=\[\s*\{key:'calm',[^}]*assets\/adhan\/beautiful-adhan\.ogg[^}]*local:true\}\s*\]/,
  'the browser playback route is restricted to its bundled local voice');
assert.doesNotMatch(prayer,/key:'aqsa'|key:'haram_makki'|key:'morocco_kamal'|key:'madina'/,
  'the browser route cannot select remote audio sources');
assert.match(voiceCatalog, /assetPath = "www\/assets\/adhan\/beautiful-adhan\.ogg"/);
assert.doesNotMatch(voiceCatalog, /https?:\/\/|HttpURLConnection|URL\(/,
  'the Android adhan catalog and cache cannot contact an external audio host');
assert.match(voiceCatalog, /EXPECTED_SHA1 = "a1fa4fd942401922c5c3301816384aae86956522"/);
assert.doesNotMatch(service, /voice\.url|setDataSource\(voice\./,
  'native playback has no URL fallback');
assert.match(service, /VoiceCache\.cachedFile\(this, config\.voiceKey\)/);
assert.match(voiceCatalog, /context\.assets\.open\(voice\.assetPath\)/);
assert.match(voiceCatalog, /total != EXPECTED_BYTES/);
assert.match(nativePrayer, /NativePrayerVoice\("calm"/);
assert.doesNotMatch(nativePrayer, /NativePrayerVoice\("(?:aqsa|haram_makki|morocco_kamal|madina)"/);
assert.doesNotMatch(read('android/app/src/main/java/com/anwar/mofakira/alarm/PrayerRefreshWorker.kt'), /NetworkType|Constraints|CONNECTED/);
assert.doesNotMatch(prayer, /youtube\.com|morocco_old|الحاج محمد العمري/);
assert.doesNotMatch(voiceCatalog, /youtube\.com|morocco_old|الحاج محمد العمري/);
const nativePrayer = read('android/app/src/main/java/com/anwar/mofakira/NativePrayerActivity.kt');
const prayerSettings = read('android/app/src/main/java/com/anwar/mofakira/PrayerSettings.kt');
assert.match(manifest, /android:name="\.NativePrayerActivity"[\s\S]*?android:exported="false"/,
  'native prayer times screen is registered as an internal activity');
assert.match(nativePrayer, /class NativePrayerActivity : Activity\(\)/);
assert.doesNotMatch(nativePrayer, /WebView|WEB_MESSAGE_LISTENER|mofakira-anouar\.pages\.dev/,
  'native prayer times screen must not depend on the web notebook');
assert.match(nativePrayer, /الدولة/);
assert.match(nativePrayer, /المدينة/);
assert.match(nativePrayer, /مستوى الصوت/);
assert.match(nativePrayer, /تشغيل الأذان تلقائيًا عند دخول وقت الصلاة/);
assert.match(nativePrayer, /تجربة صوت الأذان الآن/);
assert.match(nativePrayer, /AdhanPlaybackService\.EXTRA_TEST_MODE/);
assert.match(service, /EXTRA_TEST_MODE/);
assert.match(service, /Log\.e\(TAG, "Adhan media playback failed/);
assert.match(nativePrayer, /PrayerCalendarRepository\.refreshAndSchedule\(this\)/,
  'the native prayer screen refreshes and stores its own calendar');
assert.match(nativePrayer, /Settings\.ACTION_REQUEST_SCHEDULE_EXACT_ALARM/,
  'the native screen can request Android exact-alarm access itself');
assert.match(nativePrayer, /Manifest\.permission\.POST_NOTIFICATIONS/,
  'the native screen can request Android notification permission itself');
assert.match(nativePrayer, /LegacyWebActivity::class\.java/,
  'all remaining legacy services stay reachable from the native prayer screen');
assert.match(prayerSettings, /fun updateNative\(/,
  'native controls persist to the same prayer preference store as the legacy bridge');
assert.match(localCalculator, /"الحسيمة"/,
  'Al Hoceima is supported when entered in Arabic');
assert.match(localCalculator, /fun supportedCities\(\)/);
assert.match(localCalculator, /"Morocco", "Meknes"/);
assert.match(read('android/app/src/test/java/com/anwar/mofakira/alarm/LocalPrayerCalculatorTest.kt'), /meknesMatchesPublishedNovember2026TimesWithinOneMinute/);
assert.match(calendar, /PrayerSettings\.saveEvents\(context, events\.toString\(\)\)/);
assert.match(calendar, /if \(config\.enabled && VoiceCatalog\.supports\(config\.voiceKey\)\)/,
  'prayer times are fetched and stored even when automatic adhan is switched off');
assert.match(calendar, /PrayerAlarmScheduler\.cancel\(context\)/,
  'turning automatic adhan off cancels the scheduled alarm without erasing prayer times');

console.log('Native Android launcher, legacy compatibility, background adhan bridge and scheduling tests passed.');
