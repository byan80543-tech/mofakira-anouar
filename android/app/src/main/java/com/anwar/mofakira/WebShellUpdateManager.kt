package com.anwar.mofakira

import android.app.Activity
import android.app.AlertDialog
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.webkit.MimeTypeMap
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.widget.Toast
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.zip.ZipInputStream
import kotlin.concurrent.thread

/**
 * Updates the packaged PWA layer without reinstalling the Android APK.
 * Downloads are accepted only from this repository's HTTPS GitHub releases
 * and are checked against the SHA-256 digest in the matching release metadata.
 */
internal class WebShellUpdateManager(
    private val activity: Activity,
    private val webView: WebView,
    private val onStateChanged: () -> Unit
) {
    private data class UpdateInfo(
        val sourceCommit: String,
        val sourceCommitTimestamp: Long,
        val archiveUrl: String,
        val sha256: String,
        val sizeBytes: Long,
        val releaseNotes: String
    )

    private val preferences = activity.getSharedPreferences(PREFERENCES, Activity.MODE_PRIVATE)
    private val mainHandler = Handler(Looper.getMainLooper())

    @Volatile private var destroyed = false
    @Volatile private var checking = false
    @Volatile private var applying = false
    private var latestUpdate: UpdateInfo? = null

    private val periodicCheck = object : Runnable {
        override fun run() {
            if (destroyed) return
            checkForUpdate(force = false)
            mainHandler.postDelayed(this, CHECK_INTERVAL_MS)
        }
    }

    fun start() {
        checkForUpdate(force = true)
        mainHandler.removeCallbacks(periodicCheck)
        mainHandler.postDelayed(periodicCheck, CHECK_INTERVAL_MS)
    }

    fun onResume() {
        if (!destroyed) checkForUpdate(force = false)
    }

    fun destroy() {
        destroyed = true
        mainHandler.removeCallbacks(periodicCheck)
    }

    fun hasUpdate(): Boolean {
        val update = latestUpdate ?: return false
        return update.sourceCommitTimestamp > installedWebTimestamp()
    }

    fun isApplying(): Boolean = applying

    /**
     * Serve an installed OTA file for the appassets origin. A null result
     * deliberately falls through to WebViewAssetLoader's original APK assets.
     */
    fun intercept(uri: Uri): WebResourceResponse? {
        if (uri.scheme != "https" || uri.host != APP_ASSETS_HOST) return null
        val requestPath = uri.path ?: return null
        if (!requestPath.startsWith(ASSET_PATH_PREFIX)) return null

        val version = preferences.getString(KEY_ACTIVE_VERSION, null) ?: return null
        val activeTimestamp = preferences.getLong(KEY_ACTIVE_TIMESTAMP, 0L)
        if (activeTimestamp <= BuildConfig.WEB_BASELINE_TIMESTAMP) return null

        val relativePath = requestPath.removePrefix(ASSET_PATH_PREFIX)
        if (relativePath.isBlank()) return null
        val segments = relativePath.split('/')
        if (segments.any { it.isBlank() || it == "." || it == ".." || it.startsWith(".") }) {
            return null
        }

        return runCatching {
            val root = File(File(activity.filesDir, WEB_SHELL_DIRECTORY), version).canonicalFile
            val target = File(root, relativePath).canonicalFile
            if (!target.path.startsWith(root.path + File.separator) || !target.isFile) {
                return null
            }

            val extension = target.extension.lowercase()
            WebResourceResponse(
                mimeTypeFor(extension),
                if (extension in TEXT_EXTENSIONS) "UTF-8" else null,
                FileInputStream(target)
            ).apply {
                responseHeaders = mapOf("Cache-Control" to "no-store")
            }
        }.getOrNull()
    }

    fun showUpdateDialog() {
        val update = latestUpdate ?: return
        if (!hasUpdate() || activity.isFinishing || activity.isDestroyed) return

        AlertDialog.Builder(activity)
            .setTitle("تحديث جديد لمفكرة أنوار")
            .setMessage(
                update.releaseNotes.ifBlank { "تحسينات وإصلاحات جديدة للواجهة والمحتوى." } +
                    "\n\nسيتم تحديث ملفات المفكرة داخل التطبيق فقط، دون تنزيل ملف APK أو إعادة تثبيت التطبيق. " +
                    "تبقى القصائد والملاحظات والبيانات المحلية محفوظة."
            )
            .setPositiveButton("تحديث الآن") { _, _ -> downloadAndApply(update) }
            .setNegativeButton("لاحقاً", null)
            .show()
    }

    private fun installedWebTimestamp(): Long {
        val active = preferences.getLong(KEY_ACTIVE_TIMESTAMP, 0L)
        return maxOf(BuildConfig.WEB_BASELINE_TIMESTAMP, active)
    }

    private fun checkForUpdate(force: Boolean) {
        if (destroyed || checking || applying) return

        val now = System.currentTimeMillis()
        val lastCheck = preferences.getLong(KEY_LAST_CHECK, 0L)
        if (!force && now - lastCheck < CHECK_INTERVAL_MS) return

        checking = true
        preferences.edit().putLong(KEY_LAST_CHECK, now).apply()

        thread(name = "AnwarWebShellUpdateCheck") {
            val result = runCatching { findLatestUpdate() }.getOrNull()
            mainHandler.post {
                checking = false
                if (destroyed || activity.isFinishing || activity.isDestroyed) return@post

                latestUpdate = result
                if (result != null && result.sourceCommitTimestamp > installedWebTimestamp()) {
                    val notified = preferences.getString(KEY_NOTIFIED_VERSION, null)
                    if (notified != result.sourceCommit) {
                        preferences.edit()
                            .putString(KEY_NOTIFIED_VERSION, result.sourceCommit)
                            .apply()
                        Toast.makeText(
                            activity,
                            "يتوفر تحديث جديد لمحتوى المفكرة. اضغط أيقونة التحديث.",
                            Toast.LENGTH_LONG
                        ).show()
                    }
                }
                onStateChanged()
            }
        }
    }

    private fun findLatestUpdate(): UpdateInfo? {
        val releases = getJsonArray(RELEASES_API_URL, MAX_RELEASES_JSON_LENGTH)

        for (index in 0 until releases.length()) {
            val release = releases.optJSONObject(index) ?: continue
            val tag = release.optString("tag_name")
            if (!tag.matches(Regex("^web-shell-[0-9]+-[a-f0-9]{12}$"))) continue
            if (release.optBoolean("draft", true) || !release.optBoolean("prerelease", false)) continue

            val assets = release.optJSONArray("assets") ?: continue
            val metadataAsset = findAsset(assets, UPDATE_METADATA_ASSET) ?: continue
            val metadataUrl = metadataAsset.optString("browser_download_url")
            if (!isTrustedReleaseUrl(metadataUrl)) continue

            val metadata = getJsonObject(metadataUrl, MAX_METADATA_JSON_LENGTH)
            if (metadata.optInt("schemaVersion", -1) != 1) continue

            val sourceCommit = metadata.optString("sourceCommit").lowercase()
            val sourceTimestamp = metadata.optLong("sourceCommitTimestamp", -1L)
            val archiveName = metadata.optString("archiveAssetName")
            val digest = metadata.optString("sha256").lowercase()
            val expectedSize = metadata.optLong("sizeBytes", -1L)

            if (!sourceCommit.matches(Regex("^[a-f0-9]{40}$")) ||
                !tag.endsWith(sourceCommit.take(12)) ||
                sourceTimestamp <= installedWebTimestamp() ||
                archiveName != WEB_ARCHIVE_ASSET ||
                !digest.matches(Regex("^[a-f0-9]{64}$")) ||
                expectedSize !in 1..MAX_ARCHIVE_BYTES
            ) continue

            val archiveAsset = findAsset(assets, archiveName) ?: continue
            if (archiveAsset.optLong("size", -1L) != expectedSize) continue
            val archiveUrl = archiveAsset.optString("browser_download_url")
            if (!isTrustedReleaseUrl(archiveUrl)) continue

            return UpdateInfo(
                sourceCommit = sourceCommit,
                sourceCommitTimestamp = sourceTimestamp,
                archiveUrl = archiveUrl,
                sha256 = digest,
                sizeBytes = expectedSize,
                releaseNotes = metadata.optString("releaseNotes").take(MAX_RELEASE_NOTES_LENGTH)
            )
        }
        return null
    }

    private fun findAsset(assets: JSONArray, name: String): JSONObject? {
        for (index in 0 until assets.length()) {
            val asset = assets.optJSONObject(index) ?: continue
            if (asset.optString("name") == name) return asset
        }
        return null
    }

    private fun isTrustedReleaseUrl(value: String): Boolean {
        return runCatching {
            val uri = Uri.parse(value)
            uri.scheme == "https" &&
                uri.host == "github.com" &&
                uri.path.orEmpty().startsWith(RELEASE_DOWNLOAD_PATH)
        }.getOrDefault(false)
    }

    private fun getJsonArray(address: String, maximumBytes: Int): JSONArray {
        val connection = openConnection(address)
        try {
            val status = connection.responseCode
            if (status !in 200..299) throw IllegalStateException("Update server returned HTTP " + status)
            return JSONArray(readLimited(connection, maximumBytes))
        } finally {
            connection.disconnect()
        }
    }

    private fun getJsonObject(address: String, maximumBytes: Int): JSONObject {
        val connection = openConnection(address)
        try {
            val status = connection.responseCode
            if (status !in 200..299) throw IllegalStateException("Update metadata returned HTTP " + status)
            return JSONObject(readLimited(connection, maximumBytes))
        } finally {
            connection.disconnect()
        }
    }

    private fun openConnection(address: String): HttpURLConnection {
        val connection = URL(address).openConnection() as HttpURLConnection
        connection.connectTimeout = NETWORK_TIMEOUT_MS
        connection.readTimeout = NETWORK_TIMEOUT_MS
        connection.requestMethod = "GET"
        connection.setRequestProperty("Accept", "application/vnd.github+json")
        connection.setRequestProperty("User-Agent", "Mofakirat-Anwar-Web-Shell-Updater")
        connection.instanceFollowRedirects = true
        return connection
    }

    private fun readLimited(connection: HttpURLConnection, maximumBytes: Int): String {
        val output = ByteArrayOutputStream()
        connection.inputStream.use { input ->
            val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
            var total = 0
            while (true) {
                val count = input.read(buffer)
                if (count < 0) break
                total += count
                if (total > maximumBytes) throw IllegalStateException("Update response is too large")
                output.write(buffer, 0, count)
            }
        }
        return output.toString(Charsets.UTF_8.name())
    }

    private fun downloadAndApply(update: UpdateInfo) {
        if (applying || !hasUpdate()) return
        applying = true
        onStateChanged()
        Toast.makeText(activity, "يجري تنزيل تحديث محتوى المفكرة والتحقق منه…", Toast.LENGTH_LONG).show()

        thread(name = "AnwarWebShellUpdateInstall") {
            val installed = runCatching { downloadVerifyAndExtract(update) }.getOrNull()
            mainHandler.post {
                applying = false
                if (destroyed || activity.isFinishing || activity.isDestroyed) return@post

                if (installed == null) {
                    Toast.makeText(
                        activity,
                        "تعذّر تطبيق التحديث. بقيت النسخة الحالية وبياناتك كما هي؛ يمكنك المحاولة لاحقاً.",
                        Toast.LENGTH_LONG
                    ).show()
                    onStateChanged()
                    return@post
                }

                latestUpdate = null
                onStateChanged()
                Toast.makeText(
                    activity,
                    "تم تحديث محتوى مفكرة أنوار. يجري فتح النسخة المحدّثة…",
                    Toast.LENGTH_LONG
                ).show()
                reloadWebView(update.sourceCommit)
            }
        }
    }

    private fun downloadVerifyAndExtract(update: UpdateInfo): File {
        val zipFile = File(activity.cacheDir, "anwar-web-" + update.sourceCommit + ".zip")
        val connection = URL(update.archiveUrl).openConnection() as HttpURLConnection
        connection.connectTimeout = NETWORK_TIMEOUT_MS
        connection.readTimeout = NETWORK_TIMEOUT_MS
        connection.requestMethod = "GET"
        connection.instanceFollowRedirects = true

        var stagingDirectory: File? = null
        try {
            val status = connection.responseCode
            if (status !in 200..299) throw IllegalStateException("Web update download failed")

            val digest = MessageDigest.getInstance("SHA-256")
            var totalBytes = 0L
            connection.inputStream.use { input ->
                BufferedInputStream(input).use { buffered ->
                    FileOutputStream(zipFile).use { output ->
                        val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                        while (true) {
                            val count = buffered.read(buffer)
                            if (count < 0) break
                            totalBytes += count
                            if (totalBytes > MAX_ARCHIVE_BYTES || totalBytes > update.sizeBytes) {
                                throw IllegalStateException("Web update archive is too large")
                            }
                            digest.update(buffer, 0, count)
                            output.write(buffer, 0, count)
                        }
                        output.fd.sync()
                    }
                }
            }

            if (totalBytes != update.sizeBytes) throw SecurityException("Web update size mismatch")
            val actualDigest = digest.digest().joinToString("") { "%02x".format(it) }
            if (actualDigest != update.sha256) throw SecurityException("Web update SHA-256 mismatch")

            val root = File(activity.filesDir, WEB_SHELL_DIRECTORY).apply {
                if (!exists() && !mkdirs()) throw IllegalStateException("Cannot create update directory")
            }
            val staging = File(root, ".staging-" + update.sourceCommit)
            stagingDirectory = staging
            val destination = File(root, update.sourceCommit)
            staging.deleteRecursively()
            if (!staging.mkdirs()) throw IllegalStateException("Cannot create update staging directory")

            extractArchive(zipFile, staging)
            if (!File(staging, "index.html").isFile) {
                throw SecurityException("Web update is missing index.html")
            }

            if (destination.exists() && !destination.deleteRecursively()) {
                throw IllegalStateException("Cannot replace previous update files")
            }
            if (!staging.renameTo(destination)) {
                throw IllegalStateException("Cannot activate downloaded update files")
            }
            stagingDirectory = null

            val saved = preferences.edit()
                .putString(KEY_ACTIVE_VERSION, update.sourceCommit)
                .putLong(KEY_ACTIVE_TIMESTAMP, update.sourceCommitTimestamp)
                .commit()
            if (!saved) throw IllegalStateException("Cannot save active web update")

            zipFile.delete()
            cleanupOldUpdates(root, update.sourceCommit)
            return destination
        } catch (error: Throwable) {
            stagingDirectory?.deleteRecursively()
            zipFile.delete()
            throw error
        } finally {
            connection.disconnect()
        }
    }

    private fun extractArchive(archive: File, destination: File) {
        val canonicalRoot = destination.canonicalFile
        var entries = 0
        var extractedBytes = 0L

        ZipInputStream(BufferedInputStream(FileInputStream(archive))).use { zip ->
            while (true) {
                val entry = zip.nextEntry ?: break
                entries += 1
                if (entries > MAX_ARCHIVE_ENTRIES) {
                    throw SecurityException("Web update contains too many files")
                }

                if (entry.name.contains('\\')) throw SecurityException("Invalid archive path")
                val normalized = entry.name.trimEnd('/')
                if (normalized.isBlank()) {
                    zip.closeEntry()
                    continue
                }

                val parts = normalized.split('/')
                if (parts.any { it.isBlank() || it == "." || it == ".." || it.startsWith(".") }) {
                    throw SecurityException("Invalid archive path")
                }
                if (!isAllowedBundlePath(parts)) throw SecurityException("Unexpected file in web update")

                val outputFile = File(canonicalRoot, parts.joinToString(File.separator)).canonicalFile
                if (!outputFile.path.startsWith(canonicalRoot.path + File.separator)) {
                    throw SecurityException("Archive path escaped update directory")
                }

                if (entry.isDirectory) {
                    if (!outputFile.exists() && !outputFile.mkdirs()) {
                        throw IllegalStateException("Cannot create update directory")
                    }
                } else {
                    outputFile.parentFile?.let {
                        if (!it.exists() && !it.mkdirs()) throw IllegalStateException("Cannot create update folder")
                    }
                    FileOutputStream(outputFile).use { output ->
                        val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                        while (true) {
                            val count = zip.read(buffer)
                            if (count < 0) break
                            extractedBytes += count
                            if (extractedBytes > MAX_EXTRACTED_BYTES) {
                                throw SecurityException("Extracted web update is too large")
                            }
                            output.write(buffer, 0, count)
                        }
                    }
                }
                zip.closeEntry()
            }
        }
    }

    private fun isAllowedBundlePath(parts: List<String>): Boolean {
        if (parts.isEmpty()) return false
        if (parts.size == 1) {
            val name = parts[0].lowercase()
            return name == "index.html" ||
                name == "manifest.webmanifest" ||
                name == "_headers" ||
                name.endsWith(".html") ||
                name.endsWith(".js") ||
                name.endsWith(".mjs") ||
                name.endsWith(".css") ||
                name.endsWith(".json") ||
                name.endsWith(".webmanifest") ||
                name.endsWith(".png") ||
                name.endsWith(".jpg") ||
                name.endsWith(".jpeg") ||
                name.endsWith(".svg") ||
                name.endsWith(".webp")
        }
        return parts[0] in ALLOWED_BUNDLE_DIRECTORIES
    }

    private fun cleanupOldUpdates(root: File, currentVersion: String) {
        val directories = root.listFiles()
            ?.filter { it.isDirectory && it.name.matches(Regex("^[a-f0-9]{40}$")) }
            ?.sortedByDescending { it.lastModified() }
            .orEmpty()

        directories.filter { it.name != currentVersion }.drop(1).forEach {
            it.deleteRecursively()
        }
    }

    private fun mimeTypeFor(extension: String): String {
        return when (extension) {
            "html" -> "text/html"
            "js", "mjs" -> "application/javascript"
            "css" -> "text/css"
            "json" -> "application/json"
            "webmanifest" -> "application/manifest+json"
            "svg" -> "image/svg+xml"
            "wasm" -> "application/wasm"
            else -> MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension)
                ?: "application/octet-stream"
        }
    }

    private fun reloadWebView(version: String) {
        val targetUrl = APP_URL + "?anwarAndroid=1&ota=" + version
        val script = """
            (async function () {
              try {
                if (window.caches && window.caches.keys) {
                  const keys = await window.caches.keys();
                  await Promise.all(keys.map(key => window.caches.delete(key)));
                }
              } catch (_) {}
              window.location.replace("$targetUrl");
            })();
        """.trimIndent()

        webView.post {
            if (!activity.isFinishing && !activity.isDestroyed) {
                webView.evaluateJavascript(script, null)
            }
        }
    }

    private companion object {
        const val APP_ASSETS_HOST = "appassets.androidplatform.net"
        const val APP_URL = "https://appassets.androidplatform.net/assets/www/index.html"
        const val ASSET_PATH_PREFIX = "/assets/www/"
        const val RELEASES_API_URL =
            "https://api.github.com/repos/byan80543-tech/mofakira-anouar/releases?per_page=100"
        const val RELEASE_DOWNLOAD_PATH =
            "/byan80543-tech/mofakira-anouar/releases/download/"
        const val UPDATE_METADATA_ASSET = "mofakira-anwar-web-update.json"
        const val WEB_ARCHIVE_ASSET = "mofakira-anwar-web-shell.zip"
        const val WEB_SHELL_DIRECTORY = "anwar-web-shell"
        const val PREFERENCES = "anwar_web_shell_updates_v1"
        const val KEY_LAST_CHECK = "last_check_at"
        const val KEY_NOTIFIED_VERSION = "notified_version"
        const val KEY_ACTIVE_VERSION = "active_version"
        const val KEY_ACTIVE_TIMESTAMP = "active_timestamp"
        const val CHECK_INTERVAL_MS = 15L * 60L * 1000L
        const val NETWORK_TIMEOUT_MS = 20_000
        const val MAX_RELEASES_JSON_LENGTH = 2 * 1024 * 1024
        const val MAX_METADATA_JSON_LENGTH = 64 * 1024
        const val MAX_RELEASE_NOTES_LENGTH = 700
        const val MAX_ARCHIVE_BYTES = 32L * 1024L * 1024L
        const val MAX_EXTRACTED_BYTES = 128L * 1024L * 1024L
        const val MAX_ARCHIVE_ENTRIES = 2500
        val ALLOWED_BUNDLE_DIRECTORIES = setOf("assets", "vendor", "workers", "functions")
        val TEXT_EXTENSIONS = setOf("html", "js", "mjs", "css", "json", "webmanifest", "svg", "txt", "xml")
    }
}
