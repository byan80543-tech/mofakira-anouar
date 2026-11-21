package com.anwar.mofakira

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.time.ZoneId

data class PrayerConfig(
    val enabled: Boolean,
    val city: String,
    val country: String,
    val method: String,
    val school: String,
    val timeZone: String,
    val voiceKey: String,
    val volume: Float
)

object PrayerSettings {
    private const val PREFS = "anwar_native_adhan"
    private const val KEY_ENABLED = "enabled"
    private const val KEY_CITY = "city"
    private const val KEY_COUNTRY = "country"
    private const val KEY_METHOD = "method"
    private const val KEY_SCHOOL = "school"
    private const val KEY_TIME_ZONE = "time_zone"
    private const val KEY_VOICE = "voice"
    private const val KEY_VOLUME = "volume"
    private const val KEY_EVENTS = "schedule_events"
    private const val KEY_LAST_FIRED = "last_fired"

    fun read(context: Context): PrayerConfig {
        val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val rawZone = p.getString(KEY_TIME_ZONE, "Africa/Casablanca") ?: "Africa/Casablanca"
        val zone = runCatching { ZoneId.of(rawZone).id }.getOrElse { "Africa/Casablanca" }
        return PrayerConfig(
            enabled = p.getBoolean(KEY_ENABLED, false),
            city = safeText(p.getString(KEY_CITY, "Meknes"), "Meknes"),
            country = safeText(p.getString(KEY_COUNTRY, "Morocco"), "Morocco"),
            method = safeText(p.getString(KEY_METHOD, "21"), "21"),
            school = if (p.getString(KEY_SCHOOL, "0") == "1") "1" else "0",
            timeZone = zone,
            voiceKey = safeText(p.getString(KEY_VOICE, "calm"), "calm"),
            volume = p.getFloat(KEY_VOLUME, 0.9f).coerceIn(0f, 1f)
        )
    }

    fun updateNative(
        context: Context,
        enabled: Boolean,
        city: String,
        country: String,
        method: String,
        timeZone: String,
        voiceKey: String,
        volume: Float,
        school: String = "0"
    ): PrayerConfig {
        val fallback = read(context)
        val validZone = runCatching { ZoneId.of(timeZone).id }.getOrElse { fallback.timeZone }
        val config = PrayerConfig(
            enabled = enabled,
            city = safeText(city, fallback.city),
            country = safeText(country, fallback.country),
            method = safeText(method, fallback.method),
            school = if (school == "1") "1" else "0",
            timeZone = validZone,
            voiceKey = safeText(voiceKey, fallback.voiceKey),
            volume = volume.takeIf { it.isFinite() }?.coerceIn(0f, 1f) ?: fallback.volume
        )
        save(context, config)
        return config
    }

    fun updateFromWeb(context: Context, rawJson: String): PrayerConfig {
        require(rawJson.length <= 8_000) { "Settings payload is too large" }
        val json = JSONObject(rawJson)
        val fallback = read(context)
        val rawZone = safeText(json.optString("timezone", fallback.timeZone), fallback.timeZone)
        val config = PrayerConfig(
            enabled = json.optBoolean("enabled", fallback.enabled),
            city = safeText(json.optString("city", fallback.city), fallback.city),
            country = safeText(json.optString("country", fallback.country), fallback.country),
            method = safeText(json.optString("method", fallback.method), fallback.method),
            school = if (json.optString("school", fallback.school) == "1") "1" else "0",
            timeZone = runCatching { ZoneId.of(rawZone).id }.getOrElse { fallback.timeZone },
            voiceKey = safeText(json.optString("voice", fallback.voiceKey), fallback.voiceKey),
            volume = json.optDouble("volume", fallback.volume.toDouble())
                .toFloat().takeIf { it.isFinite() }?.coerceIn(0f, 1f) ?: fallback.volume
        )
        save(context, config)
        return config
    }

    private fun save(context: Context, config: PrayerConfig) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putBoolean(KEY_ENABLED, config.enabled)
            .putString(KEY_CITY, config.city)
            .putString(KEY_COUNTRY, config.country)
            .putString(KEY_METHOD, config.method)
            .putString(KEY_SCHOOL, config.school)
            .putString(KEY_TIME_ZONE, config.timeZone)
            .putString(KEY_VOICE, config.voiceKey)
            .putFloat(KEY_VOLUME, config.volume)
            .apply()
    }

    fun eventJson(context: Context): String? =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_EVENTS, null)

    fun saveEvents(context: Context, eventsJson: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(KEY_EVENTS, eventsJson).apply()
    }

    fun lastFired(context: Context): String? =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_LAST_FIRED, null)

    fun setLastFired(context: Context, key: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(KEY_LAST_FIRED, key).apply()
    }

    private fun safeText(value: String?, fallback: String): String {
        val cleaned = value.orEmpty().trim()
        return if (cleaned.isNotEmpty()) cleaned.take(90) else fallback
    }
}
