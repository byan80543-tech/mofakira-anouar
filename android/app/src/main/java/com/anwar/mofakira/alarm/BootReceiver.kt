package com.anwar.mofakira.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.anwar.mofakira.PrayerSettings

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        when (intent?.action) {
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED,
            Intent.ACTION_MY_PACKAGE_REPLACED,
            "android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED" -> {
                if (PrayerSettings.read(context).enabled) {
                    PrayerAlarmScheduler.scheduleNext(context)
                    PrayerRefreshWorker.ensurePeriodic(context)
                    PrayerRefreshWorker.enqueueNow(context)
                }
            }
        }
    }
}
