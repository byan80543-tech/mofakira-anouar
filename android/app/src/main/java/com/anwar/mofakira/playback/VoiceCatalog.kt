package com.anwar.mofakira.playback

import android.content.Context
import java.io.File
import java.security.MessageDigest

data class AdhanVoice(
    val key: String,
    val title: String,
    val assetPath: String,
    val credit: String,
    val license: String,
    val fileName: String
)

/** Android background adhan accepts only the bundled, verified local recording. */
object VoiceCatalog {
    const val LOCAL_VOICE_KEY = "calm"
    private val localVoice = AdhanVoice(
        key = LOCAL_VOICE_KEY,
        title = "أذان هادئ · محلي",
        assetPath = "www/assets/adhan/beautiful-adhan.ogg",
        credit = "Adam-synagda",
        license = "CC0 1.0",
        fileName = "adhan-calm.ogg"
    )

    fun get(key: String): AdhanVoice? = if (key == LOCAL_VOICE_KEY) localVoice else null
    fun supports(key: String): Boolean = key == LOCAL_VOICE_KEY
}

object VoiceCache {
    private const val EXPECTED_BYTES = 1_229_032L
    private const val EXPECTED_SHA1 = "a1fa4fd942401922c5c3301816384aae86956522"

    /** Copies the APK asset into app-private storage; never downloads or resolves URLs. */
    fun cachedFile(context: Context, voiceKey: String): File? {
        val voice = VoiceCatalog.get(voiceKey) ?: return null
        val directory = File(context.filesDir, "adhan")
        if (!directory.exists() && !directory.mkdirs()) return null
        val target = File(directory, voice.fileName)
        if (isVerified(target)) return target

        val temporary = File(directory, voice.fileName + ".part")
        return try {
            val digest = MessageDigest.getInstance("SHA-1")
            var total = 0L
            context.assets.open(voice.assetPath).use { input ->
                temporary.outputStream().buffered().use { output ->
                    val buffer = ByteArray(16 * 1024)
                    while (true) {
                        val count = input.read(buffer)
                        if (count < 0) break
                        total += count
                        if (total > EXPECTED_BYTES) {
                            temporary.delete()
                            return null
                        }
                        digest.update(buffer, 0, count)
                        output.write(buffer, 0, count)
                    }
                }
            }
            val actualSha1 = digest.digest().joinToString("") { "%02x".format(it) }
            if (total != EXPECTED_BYTES || actualSha1 != EXPECTED_SHA1) {
                temporary.delete()
                return null
            }
            if (target.exists()) target.delete()
            if (!temporary.renameTo(target)) {
                temporary.copyTo(target, overwrite = true)
                temporary.delete()
            }
            target.takeIf(::isVerified)
        } catch (_: Exception) {
            temporary.delete()
            null
        }
    }

    private fun isVerified(file: File): Boolean {
        if (!file.isFile || file.length() != EXPECTED_BYTES) return false
        return runCatching {
            val digest = MessageDigest.getInstance("SHA-1")
            file.inputStream().buffered().use { input ->
                val buffer = ByteArray(16 * 1024)
                while (true) {
                    val count = input.read(buffer)
                    if (count < 0) break
                    digest.update(buffer, 0, count)
                }
            }
            digest.digest().joinToString("") { "%02x".format(it) } == EXPECTED_SHA1
        }.getOrDefault(false)
    }
}
