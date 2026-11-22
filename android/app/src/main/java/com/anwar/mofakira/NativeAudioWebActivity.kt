package com.anwar.mofakira

import android.app.Activity
import android.content.ComponentName
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.anwar.mofakira.playback.LiveStation
import com.anwar.mofakira.playback.NativeMediaCatalog
import com.anwar.mofakira.playback.NativeMediaService
import com.anwar.mofakira.playback.QuranEdition
import com.google.common.util.concurrent.ListenableFuture
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale
import java.util.concurrent.Executor

/**
 * Original Anwar audio-library interface hosted locally inside Android.
 * The web layer owns presentation only; all playback uses the shared Media3 session.
 */
class NativeAudioWebActivity : Activity() {
    private val mainHandler = Handler(Looper.getMainLooper())
    private val mainExecutor = Executor { command -> mainHandler.post(command) }

    private lateinit var webView: WebView
    private var mode = NativeAudioActivity.MODE_QURAN
    private var controller: MediaController? = null
    private var controllerFuture: ListenableFuture<MediaController>? = null

    @Volatile private var reciters: List<QuranEdition> = emptyList()
    @Volatile private var stations: List<LiveStation> = emptyList()
    @Volatile private var recitersLoaded = false
    @Volatile private var stationsLoaded = false
    @Volatile private var catalogJson: String? = null

    private val progressTicker = object : Runnable {
        override fun run() {
            pushPlayerState()
            mainHandler.postDelayed(this, 900L)
        }
    }

    private val playerListener = object : Player.Listener {
        override fun onIsPlayingChanged(isPlaying: Boolean) = pushPlayerState()
        override fun onPlaybackStateChanged(playbackState: Int) {
            pushPlayerState()
            if (playbackState == Player.STATE_ENDED) pushStatus("انتهت قائمة التشغيل.")
        }
        override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) = pushPlayerState()
        override fun onPlayerError(error: PlaybackException) {
            pushStatus("تعذّر تشغيل هذا الملف. تحقق من الاتصال أو اختر مادة أخرى.")
            pushPlayerState()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        mode = normalizeMode(intent.getStringExtra(NativeAudioActivity.EXTRA_MODE))
        window.statusBarColor = Color.rgb(9, 38, 77)
        window.navigationBarColor = Color.rgb(9, 38, 77)
        window.decorView.layoutDirection = android.view.View.LAYOUT_DIRECTION_RTL

        webView = WebView(this).apply {
            setBackgroundColor(Color.WHITE)
            isVerticalScrollBarEnabled = false
            isHorizontalScrollBarEnabled = false
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = false
            settings.databaseEnabled = false
            settings.allowFileAccess = true
            settings.allowContentAccess = false
            settings.allowFileAccessFromFileURLs = false
            settings.allowUniversalAccessFromFileURLs = false
            settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
            settings.setSupportZoom(false)
            addJavascriptInterface(AudioBridge(), "AnwarAudioBridge")
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(
                    view: WebView?,
                    request: WebResourceRequest?
                ): Boolean {
                    val uri = request?.url ?: return true
                    return !(uri.scheme == "file" &&
                        uri.path.orEmpty().startsWith("/android_asset/audio/"))
                }

                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    webView.evaluateJavascript(
                        "window.AnwarAudio && window.AnwarAudio.setLaunchMode(${JSONObject.quote(mode)});",
                        null
                    )
                    pushPlayerState()
                    publishCatalogIfReady()
                }
            }
        }
        setContentView(webView)

        connectPlaybackService()
        startCatalogLoading()
        mainHandler.post(progressTicker)
        webView.loadUrl("file:///android_asset/audio/index.html")
    }

    override fun onResume() {
        super.onResume()
        mainHandler.removeCallbacks(progressTicker)
        mainHandler.post(progressTicker)
        pushPlayerState()
    }

    override fun onPause() {
        mainHandler.removeCallbacks(progressTicker)
        super.onPause()
    }

    override fun onDestroy() {
        mainHandler.removeCallbacks(progressTicker)
        controller?.removeListener(playerListener)
        controller?.release()
        controller = null
        controllerFuture?.cancel(false)
        controllerFuture = null
        if (::webView.isInitialized) {
            webView.removeJavascriptInterface("AnwarAudioBridge")
            webView.stopLoading()
            webView.destroy()
        }
        super.onDestroy()
    }

    private fun connectPlaybackService() {
        val token = SessionToken(this, ComponentName(this, NativeMediaService::class.java))
        val future = MediaController.Builder(this, token).buildAsync()
        controllerFuture = future
        future.addListener({
            try {
                val connected = future.get()
                if (isFinishing || isDestroyed) {
                    connected.release()
                    return@addListener
                }
                controllerFuture = null
                controller = connected
                connected.addListener(playerListener)
                pushPlayerState()
            } catch (_: Exception) {
                pushStatus("تعذّر الاتصال بمشغل أنوار الأصلي. أعد فتح المكتبة الصوتية.")
            }
        }, mainExecutor)
    }

    private fun startCatalogLoading() {
        Thread({
            reciters = NativeMediaCatalog.loadReciters()
            recitersLoaded = true
            publishCatalogIfReady()
        }, "Anwar-WebView-Quran-Catalog").start()

        Thread({
            stations = NativeMediaCatalog.loadStations()
            stationsLoaded = true
            publishCatalogIfReady()
        }, "Anwar-WebView-Radio-Catalog").start()
    }

    private fun publishCatalogIfReady() {
        if (!recitersLoaded || !stationsLoaded || isFinishing || isDestroyed) return
        val raw = synchronized(this) {
            catalogJson ?: buildCatalogJson().toString().also { catalogJson = it }
        }
        val quoted = JSONObject.quote(raw)
        runOnUiThread {
            if (!isFinishing && !isDestroyed && ::webView.isInitialized) {
                webView.evaluateJavascript(
                    "window.AnwarAudio && window.AnwarAudio.onCatalog($quoted);",
                    null
                )
            }
        }
    }

    private fun buildCatalogJson(): JSONObject {
        val editions = JSONArray()
        reciters.forEachIndexed { index, edition ->
            val surahs = JSONArray()
            edition.availableSurahs.forEach { surahs.put(it) }
            editions.put(
                JSONObject()
                    .put("index", index)
                    .put("reciterName", edition.reciterName)
                    .put("narrationName", edition.narrationName)
                    .put("displayName", edition.displayName)
                    .put("serverUrl", edition.serverUrl)
                    .put("availableSurahs", surahs)
            )
        }

        val surahNames = JSONArray()
        NativeMediaCatalog.surahNames.forEach { surahNames.put(it) }

        val series = JSONArray()
        NativeMediaCatalog.lessonSeries.forEachIndexed { index, item ->
            val tracks = JSONArray()
            for (trackIndex in 0 until item.count) tracks.put(item.trackTitle(trackIndex))
            series.put(
                JSONObject()
                    .put("index", index)
                    .put("id", item.id)
                    .put("title", item.title)
                    .put("count", item.count)
                    .put("sourceUrl", item.sourceUrl)
                    .put("tracks", tracks)
            )
        }

        val radio = JSONArray()
        stations.forEachIndexed { index, station ->
            radio.put(
                JSONObject()
                    .put("index", index)
                    .put("name", station.name)
                    .put("url", station.url)
            )
        }

        val devotional = JSONArray()
        NativeMediaCatalog.devotionalTracks.forEachIndexed { index, item ->
            devotional.put(
                JSONObject()
                    .put("index", index)
                    .put("id", item.id)
                    .put("title", item.title)
                    .put("sourceLabel", item.sourceLabel)
            )
        }

        return JSONObject()
            .put("editions", editions)
            .put("surahNames", surahNames)
            .put("lessonSeries", series)
            .put("stations", radio)
            .put("devotionalTracks", devotional)
    }

    private fun playEdition(index: Int, requestedSurah: Int, continuous: Boolean) {
        val edition = reciters.getOrNull(index) ?: run {
            pushStatus("لم نعثر على هذا القارئ. حدّث القائمة ثم حاول مجددًا.")
            return
        }
        val available = edition.availableSurahs.ifEmpty { (1..114).toList() }
        val startSurah = if (requestedSurah in available) requestedSurah else available.first()
        val sequence = if (continuous) available else listOf(startSurah)
        val items = sequence.map { number ->
            mediaItem(
                id = "quran:${edition.serverUrl}:${number}",
                url = edition.surahUrl(number),
                title = "سورة ${NativeMediaCatalog.surahNames[number - 1]}",
                artist = edition.displayName,
                album = "القرآن الكريم · مفكرة أنوار"
            )
        }
        val startIndex = sequence.indexOf(startSurah).coerceAtLeast(0)
        startPlaylist(
            items,
            startIndex,
            if (continuous) Player.REPEAT_MODE_ALL else Player.REPEAT_MODE_OFF,
            "تلاوة ${edition.displayName} · ${NativeMediaCatalog.surahNames[startSurah - 1]}"
        )
    }

    private fun playStation(index: Int) {
        val station = stations.getOrNull(index) ?: NativeMediaCatalog.quickRadioStation()
        val item = mediaItem(
            id = "radio:${station.url}",
            url = station.url,
            title = station.name,
            artist = "إذاعات مفكرة أنوار",
            album = "بث مباشر"
        )
        startPlaylist(listOf(item), 0, Player.REPEAT_MODE_OFF, station.name)
    }

    private fun playLesson(seriesIndex: Int, lessonIndex: Int) {
        val series = NativeMediaCatalog.lessonSeries.getOrNull(seriesIndex) ?: return
        if (series.count <= 0) {
            pushStatus("لا توجد ملفات مباشرة لهذه السلسلة. افتح فهرس المصدر.")
            openSource(series.sourceUrl)
            return
        }
        val safeStart = lessonIndex.coerceIn(0, series.count - 1)
        val items = (0 until series.count).map { index ->
            mediaItem(
                id = "lesson:${series.id}:${index}",
                url = series.urlForIndex(index),
                title = series.trackTitle(index),
                artist = "الشيخ عبد الرزاق البدر",
                album = series.title
            )
        }
        startPlaylist(items, safeStart, Player.REPEAT_MODE_OFF, "${series.title} · ${series.trackTitle(safeStart)}")
    }

    private fun playDevotional(index: Int) {
        val tracks = NativeMediaCatalog.devotionalTracks
        val track = tracks.getOrNull(index) ?: return
        val items = tracks.map { item ->
            mediaItem(
                id = "ibtihal:${item.id}",
                url = item.url,
                title = item.title,
                artist = "الشيخ سيد النقشبندي",
                album = "ابتهالات مختارة · مفكرة أنوار"
            )
        }
        startPlaylist(items, index, Player.REPEAT_MODE_OFF, track.title)
    }

    private fun mediaItem(id: String, url: String, title: String, artist: String, album: String): MediaItem {
        require(url.startsWith("https://", ignoreCase = true)) { "Audio URL must use HTTPS." }
        return MediaItem.Builder()
            .setMediaId(id.take(240))
            .setUri(Uri.parse(url))
            .setMediaMetadata(
                MediaMetadata.Builder()
                    .setTitle(title.take(180))
                    .setArtist(artist.take(180))
                    .setAlbumTitle(album.take(180))
                    .build()
            )
            .build()
    }

    private fun startPlaylist(items: List<MediaItem>, startIndex: Int, repeatMode: Int, description: String) {
        val player = controller
        if (player == null) {
            pushStatus("جارٍ تجهيز مشغل أنوار. أعد الضغط بعد لحظة.")
            return
        }
        if (items.isEmpty()) {
            pushStatus("لا توجد ملفات صالحة للتشغيل.")
            return
        }
        player.repeatMode = repeatMode
        player.setMediaItems(items, startIndex.coerceIn(0, items.lastIndex), 0L)
        player.prepare()
        player.play()
        pushStatus("جارٍ بدء «${description}»…")
        pushPlayerState()
    }

    private fun togglePlayback() {
        val player = controller ?: run {
            pushStatus("جارٍ تجهيز المشغل الأصلي…")
            return
        }
        if (player.isPlaying) player.pause()
        else if (player.mediaItemCount > 0) {
            if (player.playbackState == Player.STATE_IDLE) player.prepare()
            player.play()
        } else pushStatus("اختر قارئًا أو محطة أو درسًا أولًا.")
        pushPlayerState()
    }

    private fun seekTo(positionMs: Long) {
        val player = controller ?: return
        val duration = player.duration
        if (duration > 0L && duration != androidx.media3.common.C.TIME_UNSET) {
            player.seekTo(positionMs.coerceIn(0L, duration))
        } else player.seekTo(positionMs.coerceAtLeast(0L))
        pushPlayerState()
    }

    private fun setVolume(value: Float) {
        controller?.volume = value.coerceIn(0f, 1f)
    }

    private fun playerStateJson(): JSONObject {
        val player = controller
        val item = player?.currentMediaItem
        val duration = player?.duration?.takeIf {
            it > 0L && it != androidx.media3.common.C.TIME_UNSET
        } ?: 0L
        return JSONObject()
            .put("connected", player != null)
            .put("isPlaying", player?.isPlaying == true)
            .put("hasQueue", (player?.mediaItemCount ?: 0) > 0)
            .put("title", item?.mediaMetadata?.title?.toString().orEmpty())
            .put("artist", item?.mediaMetadata?.artist?.toString().orEmpty())
            .put("mediaId", item?.mediaId.orEmpty())
            .put("index", player?.currentMediaItemIndex ?: 0)
            .put("count", player?.mediaItemCount ?: 0)
            .put("position", player?.currentPosition?.coerceAtLeast(0L) ?: 0L)
            .put("duration", duration)
            .put("volume", player?.volume ?: 1f)
    }

    private fun pushPlayerState() {
        if (!::webView.isInitialized || isFinishing || isDestroyed) return
        val json = playerStateJson().toString()
        webView.post {
            if (!isFinishing && !isDestroyed) {
                webView.evaluateJavascript(
                    "window.AnwarAudio && window.AnwarAudio.onPlayerState($json);",
                    null
                )
            }
        }
    }

    private fun pushStatus(message: String) {
        if (!::webView.isInitialized || isFinishing || isDestroyed) return
        val quoted = JSONObject.quote(message)
        webView.post {
            if (!isFinishing && !isDestroyed) {
                webView.evaluateJavascript(
                    "window.AnwarAudio && window.AnwarAudio.onNativeStatus($quoted);",
                    null
                )
            }
        }
    }

    private fun openSource(rawUrl: String) {
        val uri = runCatching { Uri.parse(rawUrl) }.getOrNull() ?: return
        val allowedHosts = setOf(
            "islamhouse.com", "alfiqh.net", "sabil-alrashad.com", "al-badr.net",
            "ajurry.com", "www.ajurry.com", "archive.org", "www.archive.org",
            "asmaki.ma", "www.mp3quran.net", "mp3quran.net"
        )
        if (uri.scheme != "https" || uri.host?.lowercase(Locale.ROOT) !in allowedHosts) {
            pushStatus("رابط المصدر غير معتمد.")
            return
        }
        runCatching { startActivity(Intent(Intent.ACTION_VIEW, uri)) }
            .onFailure { pushStatus("تعذّر فتح رابط المصدر على هذا الجهاز.") }
    }

    private fun normalizeMode(value: String?): String = when (value) {
        NativeAudioActivity.MODE_RADIO -> NativeAudioActivity.MODE_RADIO
        NativeAudioActivity.MODE_LESSONS -> NativeAudioActivity.MODE_LESSONS
        NativeAudioActivity.MODE_IBTIHALAT -> NativeAudioActivity.MODE_IBTIHALAT
        else -> NativeAudioActivity.MODE_QURAN
    }

    private inner class AudioBridge {
        @JavascriptInterface fun requestCatalog() {
            val raw = catalogJson
            if (raw == null) {
                pushStatus("جارٍ تجهيز قوائم القراء والمحطات…")
                return
            }
            val quoted = JSONObject.quote(raw)
            webView.post {
                if (!isFinishing && !isDestroyed) {
                    webView.evaluateJavascript(
                        "window.AnwarAudio && window.AnwarAudio.onCatalog($quoted);",
                        null
                    )
                }
            }
        }

        @JavascriptInterface fun playEdition(index: Int, surah: Int, continuous: Boolean) {
            runOnUiThread { this@NativeAudioWebActivity.playEdition(index, surah, continuous) }
        }
        @JavascriptInterface fun playStation(index: Int) {
            runOnUiThread { this@NativeAudioWebActivity.playStation(index) }
        }
        @JavascriptInterface fun playLesson(seriesIndex: Int, lessonIndex: Int) {
            runOnUiThread { this@NativeAudioWebActivity.playLesson(seriesIndex, lessonIndex) }
        }
        @JavascriptInterface fun playDevotional(index: Int) {
            runOnUiThread { this@NativeAudioWebActivity.playDevotional(index) }
        }
        @JavascriptInterface fun togglePlayback() {
            runOnUiThread { this@NativeAudioWebActivity.togglePlayback() }
        }
        @JavascriptInterface fun next() {
            runOnUiThread {
                controller?.seekToNextMediaItem()
                pushPlayerState()
            }
        }
        @JavascriptInterface fun previous() {
            runOnUiThread {
                controller?.seekToPreviousMediaItem()
                pushPlayerState()
            }
        }
        @JavascriptInterface fun seekTo(positionMs: Long) {
            runOnUiThread { this@NativeAudioWebActivity.seekTo(positionMs) }
        }
        @JavascriptInterface fun setVolume(value: Float) {
            runOnUiThread { this@NativeAudioWebActivity.setVolume(value) }
        }
        @JavascriptInterface fun openSource(url: String) {
            runOnUiThread { this@NativeAudioWebActivity.openSource(url.take(2_000)) }
        }
        @JavascriptInterface fun close() {
            runOnUiThread { finish() }
        }
    }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density + 0.5f).toInt()
}
