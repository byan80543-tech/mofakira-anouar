import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const manifest = read('android/app/src/main/AndroidManifest.xml');
const activity = read('android/app/src/main/java/com/anwar/mofakira/MainActivity.kt');
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
assert.match(activity, /WEB_MESSAGE_LISTENER/);
assert.match(activity, /setOf\(SITE_ORIGIN\)/);
assert.match(activity, /isMainFrame/);
assert.ok(activity.includes('mofakira-anouar.pages.dev'), 'Android companion opens the published production site');
assert.ok(activity.includes('SITE_URL = "$SITE_ORIGIN/mofakira-anouar/"'), 'Android companion opens the PWA path used by the production deployment');
assert.doesNotMatch(activity, /feat-native-background-adhan\.mofakira-anouar\.pages\.dev/, 'production APK must not depend on a temporary preview deployment');
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
assert.match(prayer, /function syncNativeBackground\(\)/);
assert.match(prayer, /bridge\.postMessage\(JSON\.stringify\(payload\)\)/);
assert.match(prayer, /enabledInput\.addEventListener/);
assert.match(companionReadme, /Chrome.*PWA/);
assert.match(companionReadme, /المنبهات والتذكيرات/);
for (const key of ['aqsa', 'haram_makki', 'morocco_kamal']) {
    assert.ok(prayer.includes("key:'" + key + "'"), 'PWA exposes direct voice ' + key);
    assert.ok(voiceCatalog.includes('"' + key + '" to AdhanVoice'), 'Android exposes matching voice ' + key);
}
assert.doesNotMatch(prayer, /youtube\.com|morocco_old|الحاج محمد العمري/);
assert.doesNotMatch(voiceCatalog, /youtube\.com|morocco_old|الحاج محمد العمري/);
console.log('Native background adhan production-site, bridge and scheduling tests passed.');
