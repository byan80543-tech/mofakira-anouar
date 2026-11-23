package com.anwar.mofakira.alarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import com.anwar.mofakira.MainActivity
import com.anwar.mofakira.PrayerSettings
import com.anwar.mofakira.playback.VoiceCatalog
import org.json.JSONArray

object PrayerAlarmScheduler {
    const val ACTION_PRAYER_ALARM = "com.anwar.mofakira.action.PRAYER_ALARM"
    const val EXTRA_EVENT_ID = "event_id"
    const val EXTRA_PRAYER_KEY = "prayer_key"
    const val EXTRA_PRAYER_NAME = "prayer_name"
    const val EXTRA_TIMESTAMP = "timestamp"
    private const val REQUEST_CODE = 7021
    private const val SHOW_REQUEST_CODE = 7022
    private const val MIN_LEAD_MS = 5_000L
    private const val TAG = "AnwarAdhan"

    fun scheduleNext(context: Context): Boolean {
        val config = PrayerSettings.read(context)
        if (!config.enabled || !VoiceCatalog.supports(config.voiceKey)) {
            cancel(context)
            Log.i(TAG, "Scheduling skipped: adhan disabled or unsupported voice")
            return false
        }

        val raw = PrayerSettings.eventJson(context)
        if (raw.isNullOrBlank()) {
            cancel(context)
            Log.w(TAG, "Scheduling failed: no saved prayer events")
            return false
        }
        val events = runCatching { JSONArray(raw) }.getOrNull()
        if (events == null) {
            cancel(context)
            Log.e(TAG, "Scheduling failed: saved prayer events are invalid JSON")
            return false
        }

        val now = System.currentTimeMillis()
        var selected: org.json.JSONObject? = null
        var selectedTime = Long.MAX_VALUE
        for (i in 0 until events.length()) {
            val item = events.optJSONObject(i) ?: continue
            val time = item.optLong("timestamp", -1L)
            if (time > now + MIN_LEAD_MS && time < selectedTime) {
                selected = item
                selectedTime = time
            }
        }
        val event = selected
        if (event == null) {
            cancel(context)
            Log.w(TAG, "Scheduling failed: no future prayer event in saved calendar")
            return false
        }

        val prayerKey = event.optString("prayerKey")
        val prayerName = event.optString("prayerName", "الصلاة")
        val eventId = "${event.optString("date")}|${prayerKey}"
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val operation = createPendingIntent(context, eventId, prayerKey, prayerName, selectedTime)

        return try {
            val exactAllowed = Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
                alarmManager.canScheduleExactAlarms()
            if (exactAllowed) {
                // AlarmClock is the system's user-visible, wake-up alarm path.
                // It still requires exact-alarm access on Android 12+.
                val showIntent = PendingIntent.getActivity(
                    context,
                    SHOW_REQUEST_CODE,
                    Intent(context, MainActivity::class.java),
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                alarmManager.setAlarmClock(
                    AlarmManager.AlarmClockInfo(selectedTime, showIntent),
                    operation
                )
                Log.i(TAG, "AlarmClock scheduled: ${eventId} at ${selectedTime}")
            } else {
                // Best-effort fallback only; it may be delayed by the system.
                alarmManager.setAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP, selectedTime, operation
                )
                Log.w(TAG, "Exact alarm access unavailable; inexact fallback scheduled")
            }
            true
        } catch (error: SecurityException) {
            Log.e(TAG, "Exact alarm scheduling denied; trying fallback", error)
            runCatching {
                alarmManager.setAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP, selectedTime, operation
                )
            }.onFailure { Log.e(TAG, "Fallback alarm scheduling failed", it) }.isSuccess
        } catch (error: Exception) {
            Log.e(TAG, "Alarm scheduling failed", error)
            false
        }
    }

    fun cancel(context: Context) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, PrayerAlarmReceiver::class.java)
            .setAction(ACTION_PRAYER_ALARM)
        val existing = PendingIntent.getBroadcast(
            context, REQUEST_CODE, intent,
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        )
        if (existing != null) alarmManager.cancel(existing)
    }

    private fun createPendingIntent(
        context: Context,
        eventId: String,
        prayerKey: String,
        prayerName: String,
        timestamp: Long
    ): PendingIntent {
        val intent = Intent(context, PrayerAlarmReceiver::class.java)
            .setAction(ACTION_PRAYER_ALARM)
            .putExtra(EXTRA_EVENT_ID, eventId)
            .putExtra(EXTRA_PRAYER_KEY, prayerKey)
            .putExtra(EXTRA_PRAYER_NAME, prayerName)
            .putExtra(EXTRA_TIMESTAMP, timestamp)
        return PendingIntent.getBroadcast(
            context,
            REQUEST_CODE,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }
}
