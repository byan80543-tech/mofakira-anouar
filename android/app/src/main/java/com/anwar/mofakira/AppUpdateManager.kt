package com.anwar.mofakira

import android.app.Activity
import android.app.AlertDialog
import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import android.view.View
import android.widget.ImageButton
import android.widget.Toast
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.BufferedInputStream
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import kotlin.concurrent.thread

/**
 * Checks the public Android release channel and offers a user-approved APK
 * install. It is intentionally disabled for CI/debug previews because those
 * builds use isolated package IDs and disposable signing certificates.
 * Android always owns the final installation confirmation.
 */
internal class AppUpdateManager(
    private val activity: Activity,
    private val actionButton: ImageButton,
    private val webShellUpdater: WebShellUpdateManager
) {
    private data class UpdateInfo(
        val versionName: String,
        val versionCode: Long,
        val apkUrl: String,
        val apkAssetName: String,
        val sha256: String,
        val releaseNotes: String
    )

    private val preferences = activity.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
    private val mainHandler = android.os.Handler(android.os.Looper.getMainLooper())
    private var latestUpdate: UpdateInfo? = null
    private var downloadId: Long = -1L
    private var receiverRegistered = false
    private var checkInProgress = false
    private var verifyingDownload = false
    private var awaitingInstallPermission = false
    private var destroyed = false

    private val downloadReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action != DownloadManager.ACTION_DOWNLOAD_COMPLETE) return
            val completedId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L)
            if (completedId > 0L && completedId == downloadId) inspectDownload(completedId)
        }
    }

    fun start() {
        actionButton.setOnClickListener { showAvailableUpdates() }
        webShellUpdater.start()
        if (activity.packageName != PRODUCTION_PACKAGE) {
            refreshButtonVisibility()
            return
        }

        downloadId = preferences.getLong(KEY_DOWNLOAD_ID, -1L)
        runCatching {
            ContextCompat.registerReceiver(
                activity,
                downloadReceiver,
                IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
                ContextCompat.RECEIVER_NOT_EXPORTED
            )
            receiverRegistered = true
        }

        refreshButtonVisibility()
        if (downloadId > 0L) inspectDownload(downloadId)
        checkForUpdate(force = true)
    }

    fun onResume() {
        if (destroyed) return
        webShellUpdater.onResume()
        if (activity.packageName != PRODUCTION_PACKAGE) return
        if (isInstalledVersionNewerThanPending()) {
            clearPendingUpdate()
            latestUpdate = null
            refreshButtonVisibility()
            Toast.makeText(activity, "تم تحديث مفكرة أنوار بنجاح.", Toast.LENGTH_LONG).show()
            checkForUpdate(force = true)
            return
        }

        if (awaitingInstallPermission) {
            awaitingInstallPermission = false
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
                !activity.packageManager.canRequestPackageInstalls()
            ) {
                Toast.makeText(
                    activity,
                    "لم يُمنح إذن تثبيت التحديثات. يمكنك تفعيله لاحقاً من إعدادات التطبيق.",
                    Toast.LENGTH_LONG
                ).show()
            } else {
                installPreparedUpdate()
            }
        }
        checkForUpdate(force = false)
    }

    fun destroy() {
        destroyed = true
        webShellUpdater.destroy()
        if (receiverRegistered) {
            runCatching { activity.unregisterReceiver(downloadReceiver) }
            receiverRegistered = false
        }
    }

    internal fun refreshButtonVisibility() {
        val preparedFile = preparedApkFile()
        val webUpdateAvailable = webShellUpdater.hasUpdate()
        val applyingWebUpdate = webShellUpdater.isApplying()
        actionButton.visibility = if (
            latestUpdate != null || preparedFile != null || webUpdateAvailable || applyingWebUpdate
        ) View.VISIBLE else View.GONE
        actionButton.isEnabled = !verifyingDownload && !applyingWebUpdate
        actionButton.contentDescription = when {
            preparedFile != null -> "تثبيت تحديث مفكرة أنوار"
            webUpdateAvailable -> "تحديث محتوى مفكرة أنوار متاح"
            else -> "تحديث جديد متاح لمفكرة أنوار"
        }
    }

    private fun showAvailableUpdates() {
        val webAvailable = webShellUpdater.hasUpdate()
        val apkAvailable = latestUpdate != null || preparedApkFile() != null
        when {
            webAvailable && apkAvailable -> AlertDialog.Builder(activity)
                .setTitle("تحديثات مفكرة أنوار")
                .setItems(arrayOf("تحديث المحتوى دون إعادة تثبيت", "تحديث تطبيق Android (APK)")) { _, which ->
                    if (which == 0) webShellUpdater.showUpdateDialog() else showApkUpdateDialog()
                }
                .setNegativeButton("إغلاق", null)
                .show()
            webAvailable -> webShellUpdater.showUpdateDialog()
            apkAvailable -> showApkUpdateDialog()
        }
    }

    private fun showApkUpdateDialog() {
        val prepared = preparedApkFile()
        if (prepared != null) {
            val targetName = preferences.getString(KEY_PENDING_VERSION_NAME, "الإصدار الجديد")
                ?: "الإصدار الجديد"
            AlertDialog.Builder(activity)
                .setTitle("التحديث جاهز")
                .setMessage("تم تنزيل مفكرة أنوار " + targetName + " والتحقق من سلامة الملف. يمكنك الآن تثبيته عبر Android.")
                .setPositiveButton("تثبيت الآن") { _, _ -> installPreparedUpdate() }
                .setNegativeButton("لاحقاً", null)
                .show()
            return
        }

        val update = latestUpdate ?: return
        AlertDialog.Builder(activity)
            .setTitle("تحديث جديد لمفكرة أنوار")
            .setMessage(
                "الإصدار " + update.versionName + " متاح الآن.\n\n" +
                    update.releaseNotes.ifBlank { "تحسينات وإصلاحات جديدة." } +
                    "\n\nسيُنزل التطبيق التحديث ويتحقق من بصمته، ثم يعرض Android نافذة التثبيت. لن يُثبّت أي تحديث بصمت."
            )
            .setPositiveButton("تنزيل التحديث") { _, _ -> downloadUpdate(update) }
            .setNegativeButton("لاحقاً", null)
            .show()
    }

    private fun checkForUpdate(force: Boolean) {
        if (destroyed || checkInProgress) return
        val now = System.currentTimeMillis()
        val lastCheck = preferences.getLong(KEY_LAST_CHECK, 0L)
        if (!force && now - lastCheck < CHECK_INTERVAL_MS) return

        checkInProgress = true
        preferences.edit().putLong(KEY_LAST_CHECK, now).apply()
        thread(name = "AnwarAppUpdateCheck") {
            val result = runCatching { findLatestUpdate() }.getOrNull()
            mainHandler.post {
                checkInProgress = false
                if (destroyed || activity.isFinishing || activity.isDestroyed) return@post
                latestUpdate = result
                if (result != null) {
                    val notifiedVersion = preferences.getString(KEY_NOTIFIED_VERSION, null)
                    if (notifiedVersion != result.versionName) {
                        preferences.edit().putString(KEY_NOTIFIED_VERSION, result.versionName).apply()
                        Toast.makeText(
                            activity,
                            "يتوفر تحديث جديد لمفكرة أنوار. اضغط أيقونة التحديث.",
                            Toast.LENGTH_LONG
                        ).show()
                    }
                }
                refreshButtonVisibility()
            }
        }
    }

    private fun findLatestUpdate(): UpdateInfo? {
        val release = getJson(LATEST_RELEASE_URL)
        val assets = release.optJSONArray("assets") ?: return null
        val metadataAsset = findAsset(assets, UPDATE_METADATA_ASSET) ?: return null
        val metadataUrl = metadataAsset.optString("browser_download_url")
        if (!isTrustedReleaseUrl(metadataUrl)) return null

        val metadata = getJson(metadataUrl)
        val targetPackage = metadata.optString("packageName")
        val versionName = metadata.optString("versionName")
        val versionCode = metadata.optLong("versionCode", -1L)
        val apkAssetName = metadata.optString("apkAssetName")
        val sha256 = metadata.optString("sha256").lowercase()

        if (targetPackage != PRODUCTION_PACKAGE ||
            versionName.isBlank() ||
            versionCode <= currentInstalledVersionCode() ||
            apkAssetName.isBlank() ||
            !sha256.matches(Regex("^[a-f0-9]{64}$"))
        ) return null

        val apkAsset = findAsset(assets, apkAssetName) ?: return null
        val apkUrl = apkAsset.optString("browser_download_url")
        if (!isTrustedReleaseUrl(apkUrl)) return null

        val notes = metadata.optString("releaseNotes").take(MAX_RELEASE_NOTES_LENGTH)
        return UpdateInfo(versionName, versionCode, apkUrl, apkAssetName, sha256, notes)
    }

    private fun findAsset(assets: org.json.JSONArray, name: String): JSONObject? {
        for (index in 0 until assets.length()) {
            val asset = assets.optJSONObject(index) ?: continue
            if (asset.optString("name") == name) return asset
        }
        return null
    }

    private fun getJson(address: String): JSONObject {
        val connection = URL(address).openConnection() as HttpURLConnection
        connection.connectTimeout = NETWORK_TIMEOUT_MS
        connection.readTimeout = NETWORK_TIMEOUT_MS
        connection.requestMethod = "GET"
        connection.setRequestProperty("Accept", "application/vnd.github+json")
        connection.setRequestProperty("User-Agent", "Mofakirat-Anwar-Android-Updater")
        connection.instanceFollowRedirects = true
        try {
            val status = connection.responseCode
            if (status !in 200..299) throw IllegalStateException("Update server returned HTTP $status")
            val body = connection.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
            if (body.length > MAX_JSON_LENGTH) throw IllegalStateException("Update metadata is too large")
            return JSONObject(body)
        } finally {
            connection.disconnect()
        }
    }

    private fun isTrustedReleaseUrl(value: String): Boolean {
        return runCatching {
            val uri = Uri.parse(value)
            uri.scheme == "https" &&
                uri.host == "github.com" &&
                uri.path.orEmpty().startsWith(RELEASE_DOWNLOAD_PATH)
        }.getOrDefault(false)
    }

    private fun downloadUpdate(update: UpdateInfo) {
        if (preparedApkFile() != null) {
            installPreparedUpdate()
            return
        }

        val manager = activity.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        val request = DownloadManager.Request(Uri.parse(update.apkUrl))
            .setTitle("تحديث مفكرة أنوار " + update.versionName)
            .setDescription("تنزيل ملف التحديث والتحقق من سلامته")
            .setMimeType(APK_MIME_TYPE)
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setAllowedOverMetered(true)
            .setAllowedOverRoaming(false)
            .setDestinationInExternalFilesDir(
                activity,
                Environment.DIRECTORY_DOWNLOADS,
                update.apkAssetName
            )

        runCatching {
            downloadId = manager.enqueue(request)
            preferences.edit()
                .putLong(KEY_DOWNLOAD_ID, downloadId)
                .putString(KEY_PENDING_VERSION_NAME, update.versionName)
                .putLong(KEY_PENDING_VERSION_CODE, update.versionCode)
                .putString(KEY_PENDING_SHA256, update.sha256)
                .putString(KEY_PENDING_ASSET_NAME, update.apkAssetName)
                .apply()
            Toast.makeText(activity, "بدأ تنزيل تحديث مفكرة أنوار.", Toast.LENGTH_LONG).show()
        }.onFailure {
            Toast.makeText(activity, "تعذّر بدء تنزيل التحديث. حاول لاحقاً.", Toast.LENGTH_LONG).show()
        }
    }

    private fun inspectDownload(id: Long) {
        if (destroyed || verifyingDownload || id <= 0L) return
        val manager = activity.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        val cursor = runCatching { manager.query(DownloadManager.Query().setFilterById(id)) }.getOrNull()
            ?: return
        cursor.use {
            if (!it.moveToFirst()) return
            val status = it.getInt(it.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
            when (status) {
                DownloadManager.STATUS_SUCCESSFUL -> {
                    val uri = manager.getUriForDownloadedFile(id) ?: return
                    verifyAndPrepare(uri)
                }
                DownloadManager.STATUS_FAILED -> {
                    val reason = it.getInt(it.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON))
                    preferences.edit().remove(KEY_DOWNLOAD_ID).apply()
                    downloadId = -1L
                    Toast.makeText(
                        activity,
                        "تعذّر تنزيل التحديث (رمز " + reason + "). يمكنك المحاولة مجدداً.",
                        Toast.LENGTH_LONG
                    ).show()
                    refreshButtonVisibility()
                }
            }
        }
    }

    private fun verifyAndPrepare(downloadUri: Uri) {
        if (verifyingDownload) return
        verifyingDownload = true
        refreshButtonVisibility()
        val expectedDigest = preferences.getString(KEY_PENDING_SHA256, null).orEmpty()
        val targetCode = preferences.getLong(KEY_PENDING_VERSION_CODE, -1L)
        thread(name = "AnwarVerifyAppUpdate") {
            val prepared = runCatching {
                require(targetCode > currentInstalledVersionCode())
                require(expectedDigest.matches(Regex("^[a-f0-9]{64}$")))
                val directory = File(activity.cacheDir, "updates").apply { mkdirs() }
                val destination = File(directory, "mofakira-anwar-update.apk")
                val digest = MessageDigest.getInstance("SHA-256")
                val input = activity.contentResolver.openInputStream(downloadUri)
                    ?: throw IllegalStateException("Downloaded APK is unavailable")
                input.use { source ->
                    BufferedInputStream(source).use { buffered ->
                        FileOutputStream(destination).use { output ->
                            val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                            while (true) {
                                val count = buffered.read(buffer)
                                if (count < 0) break
                                digest.update(buffer, 0, count)
                                output.write(buffer, 0, count)
                            }
                            output.fd.sync()
                        }
                    }
                }
                val actualDigest = digest.digest().joinToString("") { "%02x".format(it) }
                if (actualDigest != expectedDigest) {
                    destination.delete()
                    throw SecurityException("APK SHA-256 mismatch")
                }

                val archiveInfo = activity.packageManager.getPackageArchiveInfo(destination.absolutePath, 0)
                    ?: throw SecurityException("Downloaded file is not a readable Android package")
                @Suppress("DEPRECATION")
                val archiveVersion = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    archiveInfo.longVersionCode
                } else {
                    archiveInfo.versionCode.toLong()
                }
                if (archiveInfo.packageName != PRODUCTION_PACKAGE || archiveVersion != targetCode) {
                    destination.delete()
                    throw SecurityException("APK package identity or version does not match the update manifest")
                }
                destination
            }.getOrNull()

            mainHandler.post {
                verifyingDownload = false
                if (destroyed || activity.isFinishing || activity.isDestroyed) return@post
                if (prepared == null) {
                    clearPendingUpdate()
                    Toast.makeText(
                        activity,
                        "لم يجتز ملف التحديث فحص السلامة؛ لم نفتح أداة التثبيت.",
                        Toast.LENGTH_LONG
                    ).show()
                } else {
                    preferences.edit().putString(KEY_VERIFIED_APK_PATH, prepared.absolutePath).apply()
                    Toast.makeText(
                        activity,
                        "اكتمل تنزيل التحديث والتحقق من سلامته. اضغط أيقونة التحديث للتثبيت.",
                        Toast.LENGTH_LONG
                    ).show()
                }
                refreshButtonVisibility()
            }
        }
    }

    private fun preparedApkFile(): File? {
        val path = preferences.getString(KEY_VERIFIED_APK_PATH, null) ?: return null
        return File(path).takeIf { it.isFile && it.length() > 0L }
    }

    private fun installPreparedUpdate() {
        val file = preparedApkFile()
        if (file == null) {
            refreshButtonVisibility()
            latestUpdate?.let { showApkUpdateDialog() }
            return
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            !activity.packageManager.canRequestPackageInstalls()
        ) {
            awaitingInstallPermission = true
            val settingsIntent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES)
                .setData(Uri.parse("package:" + activity.packageName))
            runCatching { activity.startActivity(settingsIntent) }.onFailure {
                awaitingInstallPermission = false
                Toast.makeText(
                    activity,
                    "افتح إعدادات Android واسمح لمفكرة أنوار بتثبيت التحديثات.",
                    Toast.LENGTH_LONG
                ).show()
            }
            return
        }

        runCatching {
            val uri = FileProvider.getUriForFile(
                activity,
                activity.packageName + ".updates",
                file
            )
            val installIntent = Intent(Intent.ACTION_VIEW)
                .setDataAndType(uri, APK_MIME_TYPE)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION)
            activity.startActivity(installIntent)
        }.onFailure {
            Toast.makeText(
                activity,
                "تعذّر فتح مثبت Android. بقي ملف التحديث المحقق محفوظاً لإعادة المحاولة.",
                Toast.LENGTH_LONG
            ).show()
        }
    }

    private fun currentInstalledVersionCode(): Long {
        @Suppress("DEPRECATION")
        val packageInfo = activity.packageManager.getPackageInfo(activity.packageName, 0)
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            packageInfo.longVersionCode
        } else {
            packageInfo.versionCode.toLong()
        }
    }

    private fun isInstalledVersionNewerThanPending(): Boolean {
        val targetCode = preferences.getLong(KEY_PENDING_VERSION_CODE, -1L)
        if (targetCode <= 0L) return false
        return runCatching { currentInstalledVersionCode() >= targetCode }.getOrDefault(false)
    }

    private fun clearPendingUpdate() {
        preparedApkFile()?.delete()
        preferences.edit()
            .remove(KEY_DOWNLOAD_ID)
            .remove(KEY_PENDING_VERSION_NAME)
            .remove(KEY_PENDING_VERSION_CODE)
            .remove(KEY_PENDING_SHA256)
            .remove(KEY_PENDING_ASSET_NAME)
            .remove(KEY_VERIFIED_APK_PATH)
            .apply()
        downloadId = -1L
    }

    private companion object {
        const val PRODUCTION_PACKAGE = "com.anwar.mofakira"
        const val LATEST_RELEASE_URL =
            "https://api.github.com/repos/byan80543-tech/mofakira-anouar/releases/latest"
        const val UPDATE_METADATA_ASSET = "mofakira-anwar-update.json"
        const val RELEASE_DOWNLOAD_PATH = "/byan80543-tech/mofakira-anouar/releases/download/"
        const val PREFERENCES = "anwar_app_updates_v1"
        const val KEY_LAST_CHECK = "last_check_at"
        const val KEY_NOTIFIED_VERSION = "notified_version"
        const val KEY_DOWNLOAD_ID = "download_id"
        const val KEY_PENDING_VERSION_NAME = "pending_version_name"
        const val KEY_PENDING_VERSION_CODE = "pending_version_code"
        const val KEY_PENDING_SHA256 = "pending_sha256"
        const val KEY_PENDING_ASSET_NAME = "pending_asset_name"
        const val KEY_VERIFIED_APK_PATH = "verified_apk_path"
        const val CHECK_INTERVAL_MS = 6L * 60L * 60L * 1000L
        const val NETWORK_TIMEOUT_MS = 12_000
        const val MAX_JSON_LENGTH = 64 * 1024
        const val MAX_RELEASE_NOTES_LENGTH = 700
        const val APK_MIME_TYPE = "application/vnd.android.package-archive"
    }
}
