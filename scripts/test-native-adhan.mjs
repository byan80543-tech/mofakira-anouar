import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const manifest = read('android/app/src/main/AndroidManifest.xml');
const nativeHome = read('android/app/src/main/java/com/anwar/mofakira/MainActivity.kt');
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
assert.match(nativeHome, /مفكرة أنوار/);
assert.match(nativeHome, /setContentView\(buildHome\(\)\)/);
assert.match(nativeHome, /startActivity\(Intent\(this, LegacyWebActivity::class.java\)\)/);
assert.doesNotMatch(nativeHome, /WebView|WEB_MESSAGE_LISTENER|mofakira-anouar\.pages\.dev/,
  'native launcher must not load the production web page as its main interface');

assert.match(activity, /WEB_MESSAGE_LISTENER/);
assert.match(activity, /setOf\(SITE_ORIGIN\)/);
assert.match(activity, /isMainFrame/);
assert.ok(activity.includes('mofakira-anouar.pages.dev'), 'legacy compatibility screen opens the published production site');
assert.ok(activity.includes('SITE_URL = "$SITE_ORIGIN/mofakira-anouar/"'), 'legacy activity opens the production notebook path');
assert.doesNotMatch(activity, /feat-native-background-adhan\.mofakira-anouar\.pages\.dev/, 'legacy activity must not depend on a temporary preview deployment');
assert.match(scheduler, /setExactAndAllowWhileIdle/);
assert.match(scheduler, /setAndAllowWhileIdle/);
assert.match(scheduler, /Build\.VERSION\.SDK_INT < Build\.VERSION_CODES\.S \|\| alarmManager\.canScheduleExactAlarms\(\)/,
  'Android 6–11 keep exact alarms; only Android 12+ without special access uses the inexact fallback');
assert.match(receiver, /PrayerAlarmScheduler.scheduleNext\(context\)/);
assert.match(receiver, /startForegroundService/);
assert.match(service, /ServiceCompat.startForeground/);
assert.match(service, /MediaPlayer/);
assert.ok(service.includes('media.setVolume(config.volume, config.volume)'), 'native playback applies the selected adhan volume');
assert.match(calendar, /calendarByCity/);
assert.match(prayer, /function syncNativeBackground\(requestPermissions\)/);
assert.match(prayer, /if\(requestPermissions===true\)payload\.requestPermissions=true/);
assert.match(activity, /optBoolean\("requestPermissions", false\)/);
assert.match(activity, /if \(explicitPermissionRequest\) \{\s*permissionPromptDeferred = false/);
assert.match(activity, /أذونات الأذان الخلفي مفعّلة بالفعل/);
assert.match(prayer, /bridge\.postMessage\(JSON\.stringify\(payload\)\)/);
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
for (const key of ['aqsa', 'haram_makki', 'morocco_kamal']) {
    assert.ok(prayer.includes("key:'" + key + "'"), 'PWA exposes direct voice ' + key);
    assert.ok(voiceCatalog.includes('"' + key + '" to AdhanVoice'), 'Android exposes matching voice ' + key);
}
assert.doesNotMatch(prayer, /youtube\.com|morocco_old|الحاج محمد العمري/);
assert.doesNotMatch(voiceCatalog, /youtube\.com|morocco_old|الحاج محمد العمري/);
const nativePrayer = read('android/app/src/main/java/com/anwar/mofakira/NativePrayerActivity.kt');
const prayerSettings = read('android/app/src/main/java/com/anwar/mofakira/PrayerSettings.kt');
assert.match(manifest, /android:name="\.NativePrayerActivity"[\s\S]*?android:exported="false"/,
  'native prayer times screen is registered as an internal activity');
assert.match(nativeHome, /NativePrayerActivity::class\.java/,
  'the prayer tile opens the native prayer screen');
assert.match(nativePrayer, /class NativePrayerActivity : Activity\(\)/);
assert.doesNotMatch(nativePrayer, /WebView|WEB_MESSAGE_LISTENER|mofakira-anouar\.pages\.dev/,
  'native prayer times screen must not depend on the web notebook');
assert.match(nativePrayer, /الدولة/);
assert.match(nativePrayer, /المدينة/);
assert.match(nativePrayer, /مستوى الصوت/);
assert.match(nativePrayer, /تشغيل الأذان تلقائيًا عند دخول وقت الصلاة/);
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
assert.match(calendar, /PrayerSettings\.saveEvents\(context, events\.toString\(\)\)/);
assert.match(calendar, /if \(config\.enabled && VoiceCatalog\.supports\(config\.voiceKey\)\)/,
  'prayer times are fetched and stored even when automatic adhan is switched off');
assert.match(calendar, /PrayerAlarmScheduler\.cancel\(context\)/,
  'turning automatic adhan off cancels the scheduled alarm without erasing prayer times');
\nconsole.log('Native Android launcher, legacy compatibility, background adhan bridge and scheduling tests passed.');
