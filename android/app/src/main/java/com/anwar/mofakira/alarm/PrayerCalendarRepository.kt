package com.anwar.mofakira.alarm

import android.content.Context
import android.net.Uri
import com.anwar.mofakira.PrayerSettings
import com.anwar.mofakira.playback.VoiceCache
import com.anwar.mofakira.playback.VoiceCatalog
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.LocalDate
import java.time.LocalTime
import java.time.YearMonth
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

object PrayerCalendarRepository {
    private val apiDate = DateTimeFormatter.ofPattern("dd-MM-yyyy", Locale.US)

    fun refreshAndSchedule(context: Context): Boolean {
        val config = PrayerSettings.read(context)
        if (!config.enabled) {
            PrayerAlarmScheduler.cancel(context)
            return true
        }
        if (!VoiceCatalog.supports(config.voiceKey)) {
            PrayerAlarmScheduler.cancel(context)
            return false
        }

        val zone = runCatching { ZoneId.of(config.timeZone) }.getOrElse { ZoneId.systemDefault() }
        val firstMonth = YearMonth.now(zone)
        val events = JSONArray()
        listOf(firstMonth, firstMonth.plusMonths(1)).forEach { month ->
            val days = fetchMonth(config.city, config.country, config.method, config.school, month)
            days.forEach dayLoop@ { day ->
                val dateObj = day.optJSONObject("date")?.optJSONObject("gregorian") ?: return@dayLoop
                val dateText = dateObj.optString("date")
                val date = runCatching { LocalDate.parse(dateText, apiDate) }.getOrNull() ?: return@dayLoop
                val timings = day.optJSONObject("timings") ?: return@dayLoop
                listOf(
                    Triple("Fajr", "الفجر", "Fajr"),
                    Triple("Dhuhr", "الظهر", "Dhuhr"),
                    Triple("Asr", "العصر", "Asr"),
                    Triple("Maghrib", "المغرب", "Maghrib"),
                    Triple("Isha", "العشاء", "Isha")
                ).forEach prayerLoop@ { (key, name, apiKey) ->
                    val time = parseTime(timings.optString(apiKey)) ?: return@prayerLoop
                    val instant = ZonedDateTime.of(date, time, zone).toInstant().toEpochMilli()
                    events.put(
                        JSONObject()
                            .put("timestamp", instant)
                            .put("prayerKey", key)
                            .put("prayerName", name)
                            .put("date", date.toString())
                    )
                }
            }
        }
        if (events.length() == 0) return false
        PrayerSettings.saveEvents(context, events.toString())
        VoiceCache.downloadBestEffort(context, config.voiceKey)
        PrayerAlarmScheduler.scheduleNext(context)
        return true
    }

    private fun fetchMonth(
        city: String,
        country: String,
        method: String,
        school: String,
        month: YearMonth
    ): List<JSONObject> {
        val builder = Uri.parse(
            "https://api.aladhan.com/v1/calendarByCity/${month.year}/${month.monthValue}"
        ).buildUpon()
            .appendQueryParameter("city", city)
            .appendQueryParameter("country", country)
            .appendQueryParameter("school", school)
        if (method != "auto") builder.appendQueryParameter("method", method)
        val connection = (URL(builder.build().toString()).openConnection() as HttpURLConnection).apply {
            connectTimeout = 12_000
            readTimeout = 18_000
            requestMethod = "GET"
            setRequestProperty("Accept", "application/json")
            setRequestProperty("User-Agent", "AnwarBackgroundAdhan/0.1")
        }
        try {
            if (connection.responseCode !in 200..299) {
                throw IllegalStateException("Prayer API HTTP ${connection.responseCode}")
            }
            val body = connection.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
            require(body.length <= 3_000_000) { "Prayer calendar response is too large" }
            val root = JSONObject(body)
            require(root.optInt("code") == 200) { "Prayer API returned an invalid response" }
            val data = root.optJSONArray("data") ?: return emptyList()
            return buildList(data.length()) {
                for (i in 0 until data.length()) data.optJSONObject(i)?.let(::add)
            }
        } finally {
            connection.disconnect()
        }
    }

    private fun parseTime(raw: String): LocalTime? {
        val match = Regex("^(\\d{1,2}):(\\d{2})").find(raw.trim()) ?: return null
        val hour = match.groupValues[1].toIntOrNull() ?: return null
        val minute = match.groupValues[2].toIntOrNull() ?: return null
        return runCatching { LocalTime.of(hour, minute) }.getOrNull()
    }
}
