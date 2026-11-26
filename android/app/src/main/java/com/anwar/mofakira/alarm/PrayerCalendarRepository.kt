package com.anwar.mofakira.alarm

import android.content.Context
import com.anwar.mofakira.PrayerSettings
import com.anwar.mofakira.playback.VoiceCatalog
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.time.YearMonth

/** Builds the Android prayer calendar entirely on-device; no HTTP endpoint is used. */
object PrayerCalendarRepository {
    fun refreshAndSchedule(context: Context): Boolean {
        val config = PrayerSettings.read(context)
        val zone = LocalPrayerCalculator.timeZone(config.country, config.city) ?: return false
        val firstMonth = YearMonth.now(zone)
        val events = JSONArray()

        listOf(firstMonth, firstMonth.plusMonths(1)).forEach { month ->
            var date: LocalDate = month.atDay(1)
            while (date.month == month.month) {
                val times = LocalPrayerCalculator.calculateDay(
                    country = config.country,
                    city = config.city,
                    method = config.method,
                    school = config.school,
                    date = date
                )
                listOf(
                    Triple("Fajr", "الفجر", "Fajr"),
                    Triple("Dhuhr", "الظهر", "Dhuhr"),
                    Triple("Asr", "العصر", "Asr"),
                    Triple("Maghrib", "المغرب", "Maghrib"),
                    Triple("Isha", "العشاء", "Isha")
                ).forEach { (key, name, timeKey) ->
                    val time = times[timeKey] ?: return@forEach
                    val timestamp = date.atTime(time).atZone(zone).toInstant().toEpochMilli()
                    events.put(
                        JSONObject()
                            .put("timestamp", timestamp)
                            .put("prayerKey", key)
                            .put("prayerName", name)
                            .put("date", date.toString())
                    )
                }
                date = date.plusDays(1)
            }
        }

        if (events.length() == 0) return false
        PrayerSettings.saveEvents(context, events.toString())
        if (config.enabled && VoiceCatalog.supports(config.voiceKey)) {
            PrayerAlarmScheduler.scheduleNext(context)
        } else {
            PrayerAlarmScheduler.cancel(context)
        }
        return true
    }
}
