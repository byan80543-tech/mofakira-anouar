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
