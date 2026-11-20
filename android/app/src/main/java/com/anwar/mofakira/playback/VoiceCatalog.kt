package com.anwar.mofakira.playback

import android.content.Context
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

data class AdhanVoice(
    val key: String,
    val title: String,
    val url: String,
    val credit: String,
    val license: String,
    val fileName: String
)

object VoiceCatalog {
    private val voices = mapOf(
        "calm" to AdhanVoice(
            key = "calm",
            title = "أذان هادئ",
            url = "https://upload.wikimedia.org/wikipedia/commons/b/b0/Beautiful_adhan.ogg",
            credit = "Adam-synagda",
            license = "CC0 1.0",
            fileName = "adhan-calm.ogg"
        ),
        "aqsa" to AdhanVoice(
            key = "aqsa",
            title = "أذان المسجد الأقصى · ناجي قزاز",
            url = "https://raw.githubusercontent.com/Kiwifu/adhan-mp3/b9180a2bb769f74cff8e378ef2cc7aaf8db5cd5b/Najee_Qazaz_-_Al_Aqsa_Jerusalem_%28%D9%86%D8%A7%D8%AC%D9%8A_%D9%82%D8%B2%D8%A7%D8%B2_-_%D8%A7%D9%84%D9%85%D8%B3%D8%AC%D8%AF_%D8%A7%D9%84%D8%A3%D9%82%D8%B5%D9%89_%D8%A7%D9%84%D9%82%D8%AF%D8%B3%29.mp3",
            credit = "ناجي قزاز · المسجد الأقصى",
            license = "المصدر: مجموعة Kiwifu للأذان",
            fileName = "adhan-al-aqsa-najee.mp3"
        ),
        "haram_makki" to AdhanVoice(
            key = "haram_makki",
            title = "أذان الحرم المكي · علي بن أحمد ملا",
            url = "https://raw.githubusercontent.com/Kiwifu/adhan-mp3/b9180a2bb769f74cff8e378ef2cc7aaf8db5cd5b/Ali_Ibn_Ahmad_Mala_1_-_Al_Haram_Al_Maki_%28%D8%B9%D9%84%D9%8A_%D8%A8%D9%86_%D8%A3%D8%AD%D9%85%D8%AF_%D9%85%D9%84%D8%A7_-_%D8%A7%D9%84%D8%AD%D8%B1%D9%85_%D8%A7%D9%84%D9%85%D9%83%D9%8A%29.mp3",
            credit = "علي بن أحمد ملا · الحرم المكي",
            license = "المصدر: مجموعة Kiwifu للأذان",
            fileName = "adhan-haram-makki-ali-mala.mp3"
        ),
        "morocco_kamal" to AdhanVoice(
            key = "morocco_kamal",
            title = "أذان مغربي · كمال محمد المروش",
            url = "https://raw.githubusercontent.com/Kiwifu/adhan-mp3/b9180a2bb769f74cff8e378ef2cc7aaf8db5cd5b/Kamal_Muhammad_Al_Marush_2_-_Morocco_%28%D9%83%D9%85%D8%A7%D9%84_%D9%85%D8%AD%D9%85%D8%AF_%D8%A7%D9%84%D9%85%D8%B1%D8%B9%D9%88%D8%B4_-_%D8%A7%D9%84%D9%85%D8%BA%D8%B1%D8%A8%29.mp3",
            credit = "كمال محمد المروش · المغرب",
            license = "المصدر: مجموعة Kiwifu للأذان",
            fileName = "adhan-morocco-kamal.mp3"
        ),
        "madina" to AdhanVoice(
            key = "madina",
            title = "أذان المسجد النبوي",
            url = "https://upload.wikimedia.org/wikipedia/commons/7/7c/33937_ejaz215_call-to-prayer-from-the-prophet-s-mo.ogg",
            credit = "ejaz215",
            license = "CC BY 3.0",
            fileName = "adhan-madina.ogg"
        )
    )
    fun get(key: String): AdhanVoice? = voices[key]
    fun supports(key: String): Boolean = voices.containsKey(key)
}

object VoiceCache {
    private const val MAX_AUDIO_BYTES = 18L * 1024L * 1024L

    fun cachedFile(context: Context, voiceKey: String): File? {
        val voice = VoiceCatalog.get(voiceKey) ?: return null
        val file = File(File(context.filesDir, "adhan"), voice.fileName)
        return file.takeIf { it.isFile && it.length() > 8_000L }
    }

    fun downloadBestEffort(context: Context, voiceKey: String): File? {
        cachedFile(context, voiceKey)?.let { return it }
        val voice = VoiceCatalog.get(voiceKey) ?: return null
        val directory = File(context.filesDir, "adhan")
        if (!directory.exists() && !directory.mkdirs()) return null
        val target = File(directory, voice.fileName)
        val temporary = File(directory, voice.fileName + ".part")
        val connection = (URL(voice.url).openConnection() as HttpURLConnection).apply {
            connectTimeout = 12_000
            readTimeout = 20_000
            instanceFollowRedirects = true
            setRequestProperty("User-Agent", "AnwarBackgroundAdhan/0.1")
            setRequestProperty("Accept", "audio/ogg,audio/*;q=0.9,*/*;q=0.5")
        }
        return try {
            connection.connect()
            if (connection.responseCode !in 200..299) return null
            val contentType = connection.contentType.orEmpty().lowercase()
            if (contentType.isNotEmpty() && !contentType.startsWith("audio/") &&
                contentType != "application/ogg" && !contentType.contains("octet-stream")) return null
            if (connection.contentLengthLong > MAX_AUDIO_BYTES) return null
            var total = 0L
            connection.inputStream.use { input ->
                temporary.outputStream().buffered().use { output ->
                    val buffer = ByteArray(16 * 1024)
                    while (true) {
                        val count = input.read(buffer)
                        if (count < 0) break
                        total += count
                        if (total > MAX_AUDIO_BYTES) {
                            temporary.delete()
                            return null
                        }
                        output.write(buffer, 0, count)
                    }
                }
            }
            if (total < 8_000L) {
                temporary.delete()
                return null
            }
            if (target.exists()) target.delete()
            if (!temporary.renameTo(target)) {
                temporary.copyTo(target, overwrite = true)
                temporary.delete()
            }
            target
        } catch (_: Exception) {
            temporary.delete()
            null
        } finally {
            connection.disconnect()
        }
    }
}
