package com.anwar.mofakira.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.content.ContextCompat
import com.anwar.mofakira.PrayerSettings
import com.anwar.mofakira.playback.AdhanPlaybackService
import com.anwar.mofakira.playback.VoiceCatalog

class PrayerAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != PrayerAlarmScheduler.ACTION_PRAYER_ALARM) return
        val eventId = intent.getStringExtra(PrayerAlarmScheduler.EXTRA_EVENT_ID) ?: return
        val prayerKey = intent.getStringExtra(PrayerAlarmScheduler.EXTRA_PRAYER_KEY) ?: return
        val prayerName = intent.getStringExtra(PrayerAlarmScheduler.EXTRA_PRAYER_NAME) ?: "الصلاة"
        val timestamp = intent.getLongExtra(PrayerAlarmScheduler.EXTRA_TIMESTAMP, -1L)
        val config = PrayerSettings.read(context)

        Log.i(TAG, "Alarm received: $eventId")
        // Queue the following prayer before starting playback.
        PrayerAlarmScheduler.scheduleNext(context)

        if (!config.enabled || !VoiceCatalog.supports(config.voiceKey)) {
            Log.w(TAG, "Playback skipped: adhan disabled or voice unsupported")
            return
        }
        if (timestamp <= 0L || System.currentTimeMillis() - timestamp > MAX_LATE_MS) {
            Log.w(TAG, "Playback skipped: alarm arrived too late or has invalid timestamp")
            return
        }
        if (PrayerSettings.lastFired(context) == eventId) {
            Log.i(TAG, "Duplicate alarm ignored: $eventId")
            return
        }

        val serviceIntent = Intent(context, AdhanPlaybackService::class.java)
            .setAction(AdhanPlaybackService.ACTION_PLAY)
            .putExtra(AdhanPlaybackService.EXTRA_PRAYER_NAME, prayerName)
            .putExtra(AdhanPlaybackService.EXTRA_PRAYER_KEY, prayerKey)
            .putExtra(AdhanPlaybackService.EXTRA_EVENT_ID, eventId)
        try {
            ContextCompat.startForegroundService(context, serviceIntent)
            // Only mark the event after Android accepted the foreground-service start request.
            PrayerSettings.setLastFired(context, eventId)
            Log.i(TAG, "Foreground adhan service start requested: $eventId")
        } catch (error: Exception) {
            Log.e(TAG, "Unable to start background adhan service: $eventId", error)
        }
    }

    companion object {
        private const val TAG = "AnwarAdhan"
        private const val MAX_LATE_MS = 10 * 60 * 1000L
    }
}
