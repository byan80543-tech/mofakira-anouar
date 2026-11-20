package com.anwar.mofakira.alarm

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.anwar.mofakira.PrayerSettings
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

class PrayerRefreshWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val config = PrayerSettings.read(applicationContext)
        if (!config.enabled) return@withContext Result.success()
        try {
            if (PrayerCalendarRepository.refreshAndSchedule(applicationContext)) Result.success()
            else Result.retry()
        } catch (_: Exception) {
            Result.retry()
        }
    }

    companion object {
        private const val PERIODIC_WORK = "anwar-prayer-calendar-refresh"
        private const val IMMEDIATE_WORK = "anwar-prayer-calendar-refresh-now"
        private fun networkConstraint() = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        fun enqueueNow(context: Context) {
            val request = OneTimeWorkRequestBuilder<PrayerRefreshWorker>()
                .setConstraints(networkConstraint())
                .build()
            WorkManager.getInstance(context).enqueueUniqueWork(
                IMMEDIATE_WORK, ExistingWorkPolicy.REPLACE, request
            )
        }

        fun ensurePeriodic(context: Context) {
            val request = PeriodicWorkRequestBuilder<PrayerRefreshWorker>(24, TimeUnit.HOURS)
                .setConstraints(networkConstraint())
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                PERIODIC_WORK, ExistingPeriodicWorkPolicy.KEEP, request
            )
        }
    }
}
