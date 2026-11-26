package com.anwar.mofakira

import android.content.Context
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
    private const val LEGACY_PREFS = "anwar_native_adhan"
    private const val STORE_NAMESPACE = "prayer.settings.v1"
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

    private fun state(context: Context): JSONObject {
        val raw = AnwarEncryptedStore.readPreferencesJson(context, STORE_NAMESPACE, LEGACY_PREFS)
        return if (raw.isNullOrBlank()) JSONObject() else JSONObject(raw)
    }

    private fun saveState(context: Context, value: JSONObject) {
        AnwarEncryptedStore.write(context, STORE_NAMESPACE, value.toString())
    }

    fun read(context: Context): PrayerConfig {
        val p = state(context)
        val rawZone = p.optString(KEY_TIME_ZONE, "Africa/Casablanca")
        val zone = runCatching { ZoneId.of(rawZone).id }.getOrElse { "Africa/Casablanca" }
        return PrayerConfig(
            enabled = p.optBoolean(KEY_ENABLED, false),
            city = safeText(p.optString(KEY_CITY, "Meknes"), "Meknes"),
            country = safeText(p.optString(KEY_COUNTRY, "Morocco"), "Morocco"),
            method = safeText(p.optString(KEY_METHOD, "21"), "21"),
            school = if (p.optString(KEY_SCHOOL, "0") == "1") "1" else "0",
            timeZone = zone,
            voiceKey = "calm",
            volume = p.optDouble(KEY_VOLUME, 0.9).toFloat().coerceIn(0f, 1f)
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
            voiceKey = "calm",
            volume = volume.takeIf { it.isFinite() }?.coerceIn(0f, 1f) ?: fallback.volume
        )
        val saved = state(context)
            .put(KEY_ENABLED, config.enabled)
            .put(KEY_CITY, config.city)
            .put(KEY_COUNTRY, config.country)
            .put(KEY_METHOD, config.method)
            .put(KEY_SCHOOL, config.school)
            .put(KEY_TIME_ZONE, config.timeZone)
            .put(KEY_VOICE, config.voiceKey)
            .put(KEY_VOLUME, config.volume.toDouble())
        saveState(context, saved)
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
            voiceKey = "calm",
            volume = json.optDouble("volume", fallback.volume.toDouble())
                .toFloat().takeIf { it.isFinite() }?.coerceIn(0f, 1f) ?: fallback.volume
        )
        val saved = state(context)
            .put(KEY_ENABLED, config.enabled)
            .put(KEY_CITY, config.city)
            .put(KEY_COUNTRY, config.country)
            .put(KEY_METHOD, config.method)
            .put(KEY_SCHOOL, config.school)
            .put(KEY_TIME_ZONE, config.timeZone)
            .put(KEY_VOICE, config.voiceKey)
            .put(KEY_VOLUME, config.volume.toDouble())
        saveState(context, saved)
        return config
    }

    fun eventJson(context: Context): String? =
        state(context).let { if (it.has(KEY_EVENTS) && !it.isNull(KEY_EVENTS)) it.optString(KEY_EVENTS) else null }

    fun saveEvents(context: Context, eventsJson: String) {
        require(eventsJson.length <= 1_000_000) { "Schedule payload is too large" }
        saveState(context, state(context).put(KEY_EVENTS, eventsJson))
    }

    fun lastFired(context: Context): String? =
        state(context).let { if (it.has(KEY_LAST_FIRED) && !it.isNull(KEY_LAST_FIRED)) it.optString(KEY_LAST_FIRED) else null }

    fun setLastFired(context: Context, key: String) {
        saveState(context, state(context).put(KEY_LAST_FIRED, key.take(180)))
    }

    private fun safeText(value: String?, fallback: String): String {
        val cleaned = value.orEmpty().trim()
        return if (cleaned.isNotEmpty()) cleaned.take(90) else fallback
    }
}
