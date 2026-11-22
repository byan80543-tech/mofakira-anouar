package com.anwar.mofakira

import android.Manifest
import android.app.Activity
import android.app.AlarmManager
import android.app.AlertDialog
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebResourceResponse
import android.widget.Toast
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import com.anwar.mofakira.alarm.PrayerAlarmScheduler
import com.anwar.mofakira.alarm.PrayerRefreshWorker
import com.anwar.mofakira.playback.AdhanPlaybackService
import com.anwar.mofakira.playback.VoiceCatalog

/**
 * Compatibility surface for the complete existing notebook.
 *
 * This activity intentionally remains available while native feature screens
 * are migrated one by one. Do not remove it until feature parity and migration
 * of user data have been verified.
 */
class LegacyWebActivity : Activity() {
    private lateinit var webView: WebView
    private var unsupportedVoiceToastShown = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = android.graphics.Color.rgb(9, 38, 77)
        window.navigationBarColor = android.graphics.Color.rgb(9, 38, 77)

        // Package the complete, original PWA inside the APK. The HTTPS-style
        // appassets origin keeps same-origin storage/fetch behavior without file:// access.
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView = WebView(this).apply {
            setBackgroundColor(android.graphics.Color.rgb(247, 243, 234))
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.databaseEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.javaScriptCanOpenWindowsAutomatically = false
            settings.setSupportMultipleWindows(false)
            settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
            webChromeClient = WebChromeClient()
            webViewClient = object : WebViewClientCompat() {
                override fun shouldInterceptRequest(
                    view: WebView?,
                    request: WebResourceRequest?
                ): WebResourceResponse? {
                    val uri = request?.url ?: return null
                    return assetLoader.shouldInterceptRequest(uri)
                }

                @Suppress("DEPRECATION")
                override fun shouldInterceptRequest(
                    view: WebView?,
                    url: String?
                ): WebResourceResponse? {
                    return url?.let { assetLoader.shouldInterceptRequest(Uri.parse(it)) }
                }

                override fun shouldOverrideUrlLoading(
                    view: WebView,
                    request: WebResourceRequest
                ): Boolean {
                    val uri = request.url
                    if (uri.scheme == "https" && uri.host == SITE_HOST) return false
                    return if (uri.scheme == "https" || uri.scheme == "http" || uri.scheme == "mailto" || uri.scheme == "tel") {
                        try {
                            startActivity(Intent(Intent.ACTION_VIEW, uri))
                            true
                        } catch (_: Exception) {
                            true
                        }
                    } else {
                        true
                    }
                }
            }
        }
        setContentView(webView)

        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(
                webView,
                "AnwarAdhanBridge",
                setOf(SITE_ORIGIN)
            ) { _, message, sourceOrigin, isMainFrame, _ ->
                if (isMainFrame && sourceOrigin.toString().trimEnd('/') == SITE_ORIGIN) {
                    val data = message.data
                    if (data != null) onPrayerSettingsFromWeb(data)
                }
            }
        } else {
            Toast.makeText(
                this, "حدّث مكوّن Android System WebView لتفعيل الأذان في الخلفية",
                Toast.LENGTH_LONG
            ).show()
        }

        webView.loadUrl(SITE_URL)
    }

    private fun onPrayerSettingsFromWeb(payload: String) {
        val explicitPermissionRequest = runCatching {
            org.json.JSONObject(payload).optBoolean("requestPermissions", false)
        }.getOrDefault(false)
        val config = runCatching { PrayerSettings.updateFromWeb(this, payload) }.getOrNull()
            ?: return
        if (!config.enabled) {
            lastAdhanEnabled = false
            permissionPromptDeferred = false
            PrayerAlarmScheduler.cancel(this)
            stopService(Intent(this, AdhanPlaybackService::class.java))
            return
        }
        if (!lastAdhanEnabled) permissionPromptDeferred = false
        lastAdhanEnabled = true

        runOnUiThread {
            if (explicitPermissionRequest) {
                permissionPromptDeferred = false
                if (hasNotificationAccess() && hasExactAlarmAccess()) {
                    Toast.makeText(
                        this,
                        "أذونات الأذان الخلفي مفعّلة بالفعل. سيواصل أنوار جدولة الصلاة التالية.",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
            requestRequiredAccess()
        }

        if (!VoiceCatalog.supports(config.voiceKey)) {
            if (!unsupportedVoiceToastShown) {
                unsupportedVoiceToastShown = true
                runOnUiThread {
                    Toast.makeText(
                        this,
                        "هذا التسجيل الخارجي غير متاح حاليًا للأذان الخلفي. اختر صوتًا مدعومًا.",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
            PrayerAlarmScheduler.cancel(this)
            return
        }

        PrayerRefreshWorker.ensurePeriodic(this)
        PrayerRefreshWorker.enqueueNow(this)
    }

    private var permissionFlowInProgress = false
    private var waitingForExactAlarmSettings = false
    private var permissionPromptDeferred = false
    private var lastAdhanEnabled = false

    private fun hasNotificationAccess(): Boolean {
        return Build.VERSION.SDK_INT < 33 ||
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) ==
            android.content.pm.PackageManager.PERMISSION_GRANTED
    }

    private fun hasExactAlarmAccess(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
        val alarmManager = getSystemService(ALARM_SERVICE) as AlarmManager
        return alarmManager.canScheduleExactAlarms()
    }

    private fun requestRequiredAccess() {
        if (permissionFlowInProgress || permissionPromptDeferred ||
            (hasNotificationAccess() && hasExactAlarmAccess())) return

        permissionFlowInProgress = true
        AlertDialog.Builder(this)
            .setTitle("تفعيل الأذان خارج المفكرة")
            .setMessage(
                "حتى يعمل الأذان عند موعد الصلاة بعد مغادرة المفكرة، يحتاج تطبيق أنوار إلى إذن الإشعارات، " +
                    "وإذن «المنبهات والتذكيرات» حتى يوقظ الهاتف في الوقت المحدد. " +
                    "سيعرض Android طلب الإشعارات أولًا، ثم يفتح إعدادات المنبهات الدقيقة عند الحاجة. " +
                    "يمكنك اختيار «لاحقًا» والعودة إلى هذا الإعداد متى شئت."
            )
            .setPositiveButton("متابعة") { _, _ -> requestNotificationAccess() }
            .setNegativeButton("لاحقًا") { _, _ ->
                permissionFlowInProgress = false
                permissionPromptDeferred = true
            }
            .setOnCancelListener {
                permissionFlowInProgress = false
                permissionPromptDeferred = true
            }
            .show()
    }

    private fun requestNotificationAccess() {
        if (Build.VERSION.SDK_INT >= 33 && !hasNotificationAccess()) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQUEST_NOTIFICATIONS)
            return
        }
        requestExactAlarmAccessIfNeeded()
    }

    private fun requestExactAlarmAccessIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || hasExactAlarmAccess()) {
            permissionFlowInProgress = false
            PrayerRefreshWorker.enqueueNow(this)
            return
        }

        AlertDialog.Builder(this)
            .setTitle("السماح بالأذان في وقته")
            .setMessage(
                "افتح إعدادات Android وفعّل خيار «المنبهات والتذكيرات» لتطبيق مفكرة أنوار. " +
                    "هذا الإذن مطلوب لجدولة الأذان بدقة حتى عندما تكون المفكرة مغلقة."
            )
            .setPositiveButton("فتح الإعدادات") { _, _ ->
                val settingsIntent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
                    .setData(Uri.parse("package:$packageName"))
                waitingForExactAlarmSettings = true
                try {
                    startActivity(settingsIntent)
                } catch (_: Exception) {
                    waitingForExactAlarmSettings = false
                    permissionFlowInProgress = false
                    permissionPromptDeferred = true
                    Toast.makeText(
                        this, "تعذّر فتح إعدادات المنبهات. افتح إعدادات التطبيق يدويًا.",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
            .setNegativeButton("لاحقًا") { _, _ ->
                permissionFlowInProgress = false
                permissionPromptDeferred = true
            }
            .setOnCancelListener {
                permissionFlowInProgress = false
                permissionPromptDeferred = true
            }
            .show()
    }

    @Deprecated("Deprecated in Android API; retained for API 23 compatibility")
    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_NOTIFICATIONS) {
            if (!hasNotificationAccess()) {
                permissionPromptDeferred = true
                Toast.makeText(
                    this,
                    "لم يُمنح إذن الإشعارات؛ يمكنك تفعيله لاحقًا من إعدادات التطبيق.",
                    Toast.LENGTH_LONG
                ).show()
            }
            requestExactAlarmAccessIfNeeded()
        }
    }

    override fun onResume() {
        super.onResume()

        if (waitingForExactAlarmSettings) {
            waitingForExactAlarmSettings = false
            permissionFlowInProgress = false
            if (hasExactAlarmAccess()) {
                Toast.makeText(
                    this, "تم السماح بالمنبهات والتذكيرات. يجري تحديث مواعيد الأذان.",
                    Toast.LENGTH_LONG
                ).show()
                permissionPromptDeferred = !hasNotificationAccess()
            } else {
                permissionPromptDeferred = true
                Toast.makeText(
                    this, "لم يُفعّل إذن المنبهات الدقيقة؛ قد يتأخر الأذان في وضع السكون.",
                    Toast.LENGTH_LONG
                ).show()
            }
        }

        if (PrayerSettings.read(this).enabled && hasExactAlarmAccess()) {
            PrayerRefreshWorker.enqueueNow(this)
        }
    }

    @Deprecated("Deprecated in Android API; retained for API 23 compatibility")
    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) webView.goBack()
        else super.onBackPressed()
    }

    override fun onDestroy() {
        if (::webView.isInitialized) {
            webView.stopLoading()
            webView.destroy()
        }
        super.onDestroy()
    }

    companion object {
        private const val SITE_HOST = "appassets.androidplatform.net"
        private const val SITE_ORIGIN = "https://appassets.androidplatform.net"
        private const val SITE_URL = "$SITE_ORIGIN/assets/www/index.html"
        private const val REQUEST_NOTIFICATIONS = 721
    }
}
