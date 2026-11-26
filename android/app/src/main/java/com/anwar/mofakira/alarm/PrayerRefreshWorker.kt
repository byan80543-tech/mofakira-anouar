package com.anwar.mofakira.alarm

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

/** Refreshes the on-device solar calendar; this work has no network constraint. */
class PrayerRefreshWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result = withContext(Dispatchers.Default) {
        try {
            if (PrayerCalendarRepository.refreshAndSchedule(applicationContext)) Result.success()
            else Result.failure()
        } catch (_: Exception) {
            Result.failure()
        }
    }

    companion object {
        private const val PERIODIC_WORK = "anwar-prayer-calendar-refresh"
        private const val IMMEDIATE_WORK = "anwar-prayer-calendar-refresh-now"

        fun enqueueNow(context: Context) {
            val request = OneTimeWorkRequestBuilder<PrayerRefreshWorker>().build()
            WorkManager.getInstance(context).enqueueUniqueWork(
                IMMEDIATE_WORK, ExistingWorkPolicy.REPLACE, request
            )
        }

        fun ensurePeriodic(context: Context) {
            val request = PeriodicWorkRequestBuilder<PrayerRefreshWorker>(24, TimeUnit.HOURS).build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                PERIODIC_WORK, ExistingPeriodicWorkPolicy.UPDATE, request
            )
        }
    }
}
