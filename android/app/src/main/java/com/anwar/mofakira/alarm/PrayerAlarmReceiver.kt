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

        // Schedule the following prayer first; this receiver should finish quickly.
        PrayerAlarmScheduler.scheduleNext(context)
        if (!config.enabled || !VoiceCatalog.supports(config.voiceKey)) return
        if (timestamp <= 0L || System.currentTimeMillis() - timestamp > 10 * 60 * 1000L) return
        if (PrayerSettings.lastFired(context) == eventId) return

        PrayerSettings.setLastFired(context, eventId)
        val serviceIntent = Intent(context, AdhanPlaybackService::class.java)
            .setAction(AdhanPlaybackService.ACTION_PLAY)
            .putExtra(AdhanPlaybackService.EXTRA_PRAYER_NAME, prayerName)
            .putExtra(AdhanPlaybackService.EXTRA_PRAYER_KEY, prayerKey)
            .putExtra(AdhanPlaybackService.EXTRA_EVENT_ID, eventId)
        try {
            ContextCompat.startForegroundService(context, serviceIntent)
        } catch (error: Exception) {
            Log.e("AnwarAdhan", "Unable to start background adhan service", error)
        }
    }
}
