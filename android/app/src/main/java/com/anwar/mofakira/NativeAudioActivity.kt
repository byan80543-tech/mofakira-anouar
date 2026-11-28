package com.anwar.mofakira

import android.app.Activity
import android.content.ComponentName
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.ColorDrawable
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.Editable
import android.text.TextWatcher
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.AbsListView
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ListView
import android.widget.ScrollView
import android.widget.SeekBar
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.anwar.mofakira.playback.DevotionalTrack
import com.anwar.mofakira.playback.LessonSeries
import com.anwar.mofakira.playback.LiveStation
import com.anwar.mofakira.playback.NativeMediaCatalog
import com.anwar.mofakira.playback.NativeMediaService
import com.anwar.mofakira.playback.QuranEdition
import com.google.common.util.concurrent.ListenableFuture
import java.util.Locale
import java.util.concurrent.Executor

/**
 * Unified native audio library:
 * Quran recitations, live radio, lessons and selected devotional recordings.
 * The playback engine lives in NativeMediaService and is not tied to this screen.
 */
class NativeAudioActivity : Activity() {
    private val navy = Color.rgb(9, 38, 77)
    private val blue = Color.rgb(18, 69, 116)
    private val green = Color.rgb(13, 59, 50)
    private val gold = Color.rgb(201, 169, 106)
    private val cream = Color.rgb(247, 243, 234)
    private val ink = Color.rgb(35, 48, 58)
    private val muted = Color.rgb(101, 112, 120)
    private val handler = Handler(Looper.getMainLooper())
    private val directExecutor = Executor { it.run() }

    private lateinit var contentArea: LinearLayout
    private lateinit var statusText: TextView
    private lateinit var nowPlayingText: TextView
    private lateinit var playPauseButton: TextView
    private lateinit var seekBar: SeekBar
    private lateinit var timeText: TextView
    private lateinit var tabButtons: Map<String, TextView>

    private var mode = MODE_QURAN
    private var controller: MediaController? = null
    private var controllerFuture: ListenableFuture<MediaController>? = null
    private var isSeeking = false
    private var reciters: List<QuranEdition> = emptyList()
    private var visibleReciters: List<QuranEdition> = emptyList()
    private var stations: List<LiveStation> = emptyList()
    private var selectedEdition: QuranEdition? = null
    private var selectedSurah = 1
    private var selectedStation: LiveStation? = null
    private var selectedLessonSeries: LessonSeries = NativeMediaCatalog.lessonSeries.first()
    private var selectedLessonIndex = 0
    private val playerListener = object : Player.Listener {
        override fun onIsPlayingChanged(isPlaying: Boolean) = syncPlayerUi()

        override fun onPlaybackStateChanged(playbackState: Int) {
            syncPlayerUi()
            if (playbackState == Player.STATE_ENDED) {
                statusText.text = "انتهت قائمة التشغيل."
            }
        }

        override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
            val title = mediaItem?.mediaMetadata?.title?.toString().orEmpty()
            if (title.isNotBlank()) statusText.text = "يُشغّل الآن: $title"
            syncPlayerUi()
        }

        override fun onPlayerError(error: PlaybackException) {
            statusText.text = "تعذّر تشغيل هذا المصدر الصوتي. تحقق من الاتصال أو اختر مصدراً آخر."
            Toast.makeText(this@NativeAudioActivity, "تعذّر تشغيل الملف الصوتي", Toast.LENGTH_LONG).show()
            syncPlayerUi()
        }
    }

    private val progressTicker = object : Runnable {
        override fun run() {
            updateProgress()
            handler.postDelayed(this, 1_000L)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        mode = normalizeMode(intent.getStringExtra(EXTRA_MODE))
        window.statusBarColor = navy
        window.navigationBarColor = navy
        window.decorView.layoutDirection = View.LAYOUT_DIRECTION_RTL
        setContentView(buildScreen())
        connectPlaybackService()
        renderMode()
        loadCatalogForMode(mode)
    }

    override fun onResume() {
        super.onResume()
        handler.removeCallbacks(progressTicker)
        handler.post(progressTicker)
        syncPlayerUi()
    }

    override fun onPause() {
        handler.removeCallbacks(progressTicker)
        super.onPause()
    }

    override fun onDestroy() {
        handler.removeCallbacks(progressTicker)
        controller?.removeListener(playerListener)
        controller?.release()
        controller = null
        controllerFuture?.cancel(false)
        controllerFuture = null
        super.onDestroy()
    }

    private fun buildScreen(): View {
        val outer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            setBackgroundColor(cream)
        }
        val scroll = ScrollView(this).apply {
            isFillViewport = true
            clipToPadding = false
        }
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            setPadding(dp(15), dp(14), dp(15), dp(16))
        }
        scroll.addView(root)

        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            gravity = Gravity.CENTER_VERTICAL
        }
        header.addView(actionButton("رجوع", Color.WHITE, navy) { finish() },
            LinearLayout.LayoutParams(dp(68), dp(42)))
        val title = text("المكتبة الصوتية", 20f, navy, true)
        header.addView(title, LinearLayout.LayoutParams(0, dp(46), 1f).apply { marginEnd = dp(10) })
        root.addView(header)
        root.addView(text(
            "مشغل واحد للقرآن والدروس والإذاعات والابتهالات، ويستمر عند الانتقال إلى شاشة أخرى.",
            11f, muted, top = 4, bottom = 12
        ))

        val tabs = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            gravity = Gravity.CENTER
        }
        val tabMap = linkedMapOf<String, TextView>()
        listOf(
            MODE_QURAN to "القرآن",
            MODE_RADIO to "الإذاعات",
            MODE_LESSONS to "الدروس",
            MODE_IBTIHALAT to "الابتهالات"
        ).forEach { (key, label) ->
            val button = actionButton(label, Color.WHITE, navy) { switchMode(key) }
            tabs.addView(button, LinearLayout.LayoutParams(0, dp(43), 1f).apply {
                marginStart = dp(3)
                marginEnd = dp(3)
            })
            tabMap[key] = button
        }
        tabButtons = tabMap
        root.addView(tabs)
        contentArea = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            setPadding(0, dp(7), 0, dp(12))
        }
        root.addView(contentArea)

        statusText = text("جارٍ تجهيز المشغل…", 11f, muted, top = 6, bottom = 4)
        root.addView(statusText)
        outer.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))
        outer.addView(buildPlayerPanel())
        return outer
    }

    private fun buildPlayerPanel(): View {
        val panel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            setPadding(dp(14), dp(10), dp(14), dp(11))
            background = GradientDrawable().apply {
                setColor(Color.WHITE)
                cornerRadii = floatArrayOf(dp(16).toFloat(), dp(16).toFloat(), dp(16).toFloat(), dp(16).toFloat(), 0f, 0f, 0f, 0f)
                setStroke(dp(1), Color.rgb(225, 219, 207))
            }
        }
        nowPlayingText = text("لا يوجد تشغيل نشط", 12f, navy, true)
        panel.addView(nowPlayingText)
        timeText = text("--:-- / --:--", 10f, muted, top = 2)
        panel.addView(timeText)
        seekBar = SeekBar(this).apply {
            max = 1_000
            progress = 0
            setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(bar: SeekBar?, progress: Int, fromUser: Boolean) = Unit
                override fun onStartTrackingTouch(bar: SeekBar?) { isSeeking = true }
                override fun onStopTrackingTouch(bar: SeekBar?) {
                    isSeeking = false
                    val player = controller ?: return
                    val duration = player.duration
                    if (duration > 0L && duration != C.TIME_UNSET) {
                        player.seekTo((duration * ((bar?.progress ?: 0) / 1_000.0)).toLong())
                    }
                }
            })
        }
        panel.addView(seekBar, LinearLayout.LayoutParams(-1, dp(34)))
        val controls = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            gravity = Gravity.CENTER
        }
        controls.addView(actionButton("السابق", Color.rgb(249, 247, 241), navy) {
            controller?.seekToPreviousMediaItem()
        }, LinearLayout.LayoutParams(0, dp(40), 1f).apply { marginEnd = dp(3); marginStart = dp(3) })
        playPauseButton = actionButton("تشغيل", gold, navy) { togglePlayback() }
        controls.addView(playPauseButton, LinearLayout.LayoutParams(0, dp(42), 1.2f).apply {
            marginStart = dp(3); marginEnd = dp(3)
        })
        controls.addView(actionButton("التالي", Color.rgb(249, 247, 241), navy) {
            controller?.seekToNextMediaItem()
        }, LinearLayout.LayoutParams(0, dp(40), 1f).apply { marginStart = dp(3); marginEnd = dp(3) })
        controls.addView(actionButton("إيقاف", Color.rgb(249, 239, 236), Color.rgb(135, 45, 35)) {
            controller?.stop()
            controller?.clearMediaItems()
            syncPlayerUi()
        }, LinearLayout.LayoutParams(0, dp(40), 1f).apply { marginStart = dp(3); marginEnd = dp(3) })
        panel.addView(controls)
        return panel
    }

    private fun switchMode(next: String) {
        mode = normalizeMode(next)
        renderMode()
        loadCatalogForMode(mode)
    }

    private fun renderMode() {
        contentArea.removeAllViews()
        tabButtons.forEach { (key, button) ->
            val selected = key == mode
            button.background = rounded(if (selected) navy else Color.WHITE, 11,
                if (selected) gold else Color.rgb(225, 219, 207))
            button.setTextColor(if (selected) Color.WHITE else navy)
        }
        when (mode) {
            MODE_QURAN -> renderQuran()
            MODE_RADIO -> renderRadio()
            MODE_LESSONS -> renderLessons()
            MODE_IBTIHALAT -> renderIbtihalat()
        }
    }

    private fun renderQuran() {
        contentArea.addView(sectionTitle("القرآن الكريم"))
        contentArea.addView(text("ابحث عن القارئ، ثم اختر الرواية والسورة. تشغيل التلاوة يبقى مستمراً مع الانتقال بين السور المتاحة.", 11f, muted, bottom = 8))
        val search = EditText(this).apply {
            hint = "ابحث عن قارئ أو رواية…"
            textSize = 13f
            setSingleLine(true)
            setTextColor(ink)
            setHintTextColor(muted)
            gravity = Gravity.END or Gravity.CENTER_VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            setPadding(dp(12), dp(6), dp(12), dp(6))
            background = rounded(Color.WHITE, 11, Color.rgb(225, 219, 207))
        }
        contentArea.addView(search, matchWrap(dp(46)))
        val reciterList = ListView(this).apply {
            divider = ColorDrawable(Color.TRANSPARENT)
            dividerHeight = dp(9)
            setBackgroundColor(Color.TRANSPARENT)
            isNestedScrollingEnabled = false
        }
        contentArea.addView(reciterList, matchWrap(dp(190)))
        val selectedReader = text("القارئ: لم يُحدد بعد", 11f, green, true, top = 6, bottom = 8)
        contentArea.addView(selectedReader)

        val surahLabel = fieldLabel("السورة")
        contentArea.addView(surahLabel)
        val surahSpinner = Spinner(this)
        val surahAdapter = ArrayAdapter(this, android.R.layout.simple_spinner_item,
            NativeMediaCatalog.surahNames.mapIndexed { index, name -> "${index + 1}. $name" })
        surahAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        surahSpinner.adapter = surahAdapter
        contentArea.addView(surahSpinner, matchWrap(dp(48)))

        val play = actionButton("تشغيل التلاوة المتتابعة", gold, navy) {
            val edition = selectedEdition
            if (edition == null) {
                statusText.text = "اختر قارئاً أولا."
            } else {
                selectedSurah = (surahSpinner.selectedItemPosition + 1).coerceIn(1, 114)
                playQuran(edition, selectedSurah)
            }
        }
        contentArea.addView(play, marginTop(dp(10)))

        if (reciters.isEmpty()) {
            reciterList.adapter = ArrayAdapter(this, android.R.layout.simple_list_item_1, listOf("جارٍ تحميل القراء…"))
        } else {
            selectedEdition = selectedEdition ?: reciters.first()
            applyReciterFilter("", reciterList, selectedReader)
        }
        reciterList.setOnItemClickListener { _, _, position, _ ->
            val edition = visibleReciters.getOrNull(position) ?: return@setOnItemClickListener
            selectedEdition = edition
            selectedSurah = edition.availableSurahs.firstOrNull() ?: 1
            selectedReader.text = "القارئ: ${edition.displayName}"
            val targetPosition = (selectedSurah - 1).coerceIn(0, 113)
            surahSpinner.setSelection(targetPosition)
        }
        search.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                applyReciterFilter(s?.toString().orEmpty(), reciterList, selectedReader)
            }
            override fun afterTextChanged(s: Editable?) = Unit
        })
    }

    private fun applyReciterFilter(query: String, list: ListView, selectedReader: TextView) {
        val q = query.trim().lowercase(Locale.forLanguageTag("ar"))
        visibleReciters = reciters.filter { q.isBlank() || it.displayName.lowercase(Locale.forLanguageTag("ar")).contains(q) }
        list.adapter = tulipArrayAdapter(
            visibleReciters.map { it.displayName },
            TulipRowStyle.RECITER,
            visibleReciters.indexOf(selectedEdition)
        )
        val selected = selectedEdition
        selectedReader.text = selected?.let { "القارئ: ${it.displayName}" } ?: "القارئ: لم يُحدد بعد"
    }

    private fun renderRadio() {
        contentArea.addView(sectionTitle("الإذاعات المباشرة"))
        contentArea.addView(text("اختر محطة بث مباشر. يظل البث في الخدمة الصوتية الأصلية عند مغادرة الشاشة.", 11f, muted, bottom = 8))
        val stationList = ListView(this).apply {
            divider = ColorDrawable(Color.TRANSPARENT)
            dividerHeight = dp(8)
            setBackgroundColor(Color.TRANSPARENT)
            isNestedScrollingEnabled = false
        }
        contentArea.addView(stationList, matchWrap(dp(250)))
        val selected = text("لم تُحدد محطة بعد.", 11f, green, true, top = 5)
        contentArea.addView(selected)
        contentArea.addView(actionButton("تشغيل المحطة المختارة", gold, navy) {
            selectedStation?.let { playStation(it) } ?: run { statusText.text = "اختر محطة من القائمة أولا." }
        }, marginTop(dp(8)))

        if (stations.isEmpty()) {
            stationList.adapter = ArrayAdapter(this, android.R.layout.simple_list_item_1, listOf("جارٍ تحميل المحطات…"))
        } else {
            stationList.adapter = tulipArrayAdapter(stations.map { it.name }, TulipRowStyle.STATION)
        }
        stationList.setOnItemClickListener { _, _, position, _ ->
            selectedStation = stations.getOrNull(position)
            selected.text = selectedStation?.let { "المحطة المختارة: ${it.name}" } ?: "اختر محطة صالحة."
            stationList.adapter = tulipArrayAdapter(
                stations.map { it.name },
                TulipRowStyle.STATION,
                position
            )
        }
    }

    private fun renderLessons() {
        contentArea.addView(sectionTitle("الدروس والمحاضرات"))
        contentArea.addView(text("سلاسل الشيخ عبد الرزاق البدر المتاحة بروابط صوتية مباشرة. اختر السلسلة ثم المس الدرس للتشغيل.", 11f, muted, bottom = 8))
        val seriesSpinner = Spinner(this)
        val seriesAdapter = ArrayAdapter(this, android.R.layout.simple_spinner_item,
            NativeMediaCatalog.lessonSeries.map { "${it.title} · ${it.count} درسًا" })
        seriesAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        seriesSpinner.adapter = seriesAdapter
        val initialIndex = NativeMediaCatalog.lessonSeries.indexOfFirst { it.id == selectedLessonSeries.id }.coerceAtLeast(0)
        seriesSpinner.setSelection(initialIndex)
        contentArea.addView(seriesSpinner, matchWrap(dp(50)))
        val lessonList = ListView(this).apply {
            divider = null
            dividerHeight = 0
            isNestedScrollingEnabled = false
        }
        contentArea.addView(lessonList, matchWrap(dp(250)))
        val playSeries = actionButton("تشغيل السلسلة من الدرس الأول", gold, navy) {
            playLessons(selectedLessonSeries, selectedLessonIndex)
        }
        contentArea.addView(playSeries, marginTop(dp(8)))
        val sourceButton = actionButton("فتح فهرس السلسلة الأصلي", Color.WHITE, green) {
            openExternal(selectedLessonSeries.sourceUrl)
        }
        contentArea.addView(sourceButton, marginTop(dp(7)))

        fun populateLessons(series: LessonSeries) {
            selectedLessonSeries = series
            selectedLessonIndex = 0
            val labels = (0 until series.count).map { index ->
                "${(index + 1).toString().padStart(2, '0')} · ${series.trackTitle(index)}"
            }
            lessonList.adapter = tulipArrayAdapter(labels, TulipRowStyle.LESSON)
        }
        populateLessons(selectedLessonSeries)
        seriesSpinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                NativeMediaCatalog.lessonSeries.getOrNull(position)?.let(::populateLessons)
            }
            override fun onNothingSelected(parent: AdapterView<*>?) = Unit
        }
        lessonList.setOnItemClickListener { _, _, position, _ ->
            selectedLessonIndex = position
            val labels = (0 until selectedLessonSeries.count).map { index ->
                "${(index + 1).toString().padStart(2, '0')} · ${selectedLessonSeries.trackTitle(index)}"
            }
            lessonList.adapter = tulipArrayAdapter(labels, TulipRowStyle.LESSON, position)
            playLessons(selectedLessonSeries, position)
        }
    }

    private fun renderIbtihalat() {
        contentArea.addView(sectionTitle("ابتهالات الشيخ سيد النقشبندي"))
        contentArea.addView(text("المقطوعتان اللتان اخترناهما من المجموعة الصوتية المحفوظة في Internet Archive.", 11f, muted, bottom = 9))
        NativeMediaCatalog.devotionalTracks.forEachIndexed { index, track ->
            val card = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                layoutDirection = View.LAYOUT_DIRECTION_RTL
                setPadding(dp(12), dp(12), dp(12), dp(12))
                background = rounded(Color.WHITE, 13, Color.rgb(225, 219, 207))
            }
            val copy = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                layoutDirection = View.LAYOUT_DIRECTION_RTL
            }
            copy.addView(text(track.title, 13f, navy, true))
            copy.addView(text(track.sourceLabel, 10f, muted, top = 3))
            card.addView(
                NativeAudioArtwork.badge(
                    this,
                    widthDp = 36,
                    heightDp = 38,
                    radiusDp = 9,
                    borderColor = Color.rgb(213, 227, 210),
                    backgroundColor = Color.rgb(251, 248, 235)
                ),
                LinearLayout.LayoutParams(dp(36), dp(38)).apply { marginEnd = dp(9) }
            )
            card.addView(copy, LinearLayout.LayoutParams(0, -2, 1f))
            card.addView(actionButton("استماع", gold, navy) { playDevotional(track, index) },
                LinearLayout.LayoutParams(dp(82), dp(42)).apply { marginStart = dp(10) })
            contentArea.addView(card, marginTop(dp(7)))
        }
        contentArea.addView(actionButton("فتح صفحة المجموعة الصوتية", Color.WHITE, green) {
            openExternal("https://archive.org/details/20240309_20240309_1714")
        }, marginTop(dp(10)))
    }

    private fun loadCatalogForMode(requestedMode: String) {
        when (requestedMode) {
            MODE_QURAN -> if (reciters.isEmpty()) {
                statusText.text = "جارٍ تحميل موسوعة القراء والروايات…"
                Thread({
                    val loaded = NativeMediaCatalog.loadReciters()
                    runOnUiThread {
                        reciters = loaded
                        if (mode == MODE_QURAN && !isFinishing && !isDestroyed) {
                            renderMode()
                            statusText.text = if (loaded.isNotEmpty()) {
                                "تم تجهيز ${loaded.size} خياراً من القراء والروايات."
                            } else {
                                "تعذّر تحميل الفهرس. تحقق من الاتصال وأعد الدخول."
                            }
                        }
                    }
                }, "Anwar-Native-Quran-Catalog").start()
            }
            MODE_RADIO -> if (stations.isEmpty()) {
                statusText.text = "جارٍ تحميل محطات البث المباشر…"
                Thread({
                    val loaded = NativeMediaCatalog.loadStations()
                    runOnUiThread {
                        stations = loaded
                        if (mode == MODE_RADIO && !isFinishing && !isDestroyed) {
                            renderMode()
                            statusText.text = if (loaded.isNotEmpty()) {
                                "تم تجهيز ${loaded.size} محطة بث."
                            } else {
                                "تعذّر تحميل المحطات. تحقق من الاتصال وأعد المحاولة."
                            }
                        }
                    }
                }, "Anwar-Native-Radio-Catalog").start()
            }
        }
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
                controller = connected
                connected.addListener(playerListener)
                syncPlayerUi()
                statusText.text = "المشغل الأصلي جاهز. اختر مادة للاستماع."
            } catch (_: Exception) {
                statusText.text = "تعذّر الاتصال بمحرك الصوت. أغلق الشاشة وافتحها مجدداً."
            }
        }, directExecutor)
    }

    private fun playQuran(edition: QuranEdition, startSurah: Int) {
        val c = controller ?: return notConnected()
        val available = edition.availableSurahs.ifEmpty { (1..114).toList() }
        val items = available.map { number ->
            mediaItem(
                id = "quran:${edition.serverUrl}:$number",
                url = edition.surahUrl(number),
                title = "سورة ${NativeMediaCatalog.surahNames[number - 1]}",
                artist = edition.displayName,
                album = "القرآن الكريم · مفكرة أنوار"
            )
        }
        val startIndex = available.indexOf(startSurah).coerceAtLeast(0)
        startPlaylist(c, items, startIndex,
            "تلاوة ${edition.displayName} · سورة ${NativeMediaCatalog.surahNames[available[startIndex] - 1]}")
    }

    private fun playStation(station: LiveStation) {
        val c = controller ?: return notConnected()
        val item = mediaItem(
            id = "radio:${station.url}",
            url = station.url,
            title = station.name,
            artist = "إذاعات مفكرة أنوار",
            album = "بث مباشر"
        )
        c.setMediaItem(item)
        c.prepare()
        c.play()
        statusText.text = "جارٍ الاتصال بمحطة «${station.name}»…"
    }

    private fun playLessons(series: LessonSeries, startIndex: Int) {
        val c = controller ?: return notConnected()
        if (series.count <= 0) {
            statusText.text = "لا توجد ملفات مباشرة لهذه السلسلة. افتح فهرس المصدر."
            openExternal(series.sourceUrl)
            return
        }
        val items = (0 until series.count).map { index ->
            mediaItem(
                id = "lesson:${series.id}:$index",
                url = series.urlForIndex(index),
                title = series.trackTitle(index),
                artist = "الشيخ عبد الرزاق البدر",
                album = series.title
            )
        }
        startPlaylist(c, items, startIndex.coerceIn(0, items.lastIndex),
            "${series.title} · ${series.trackTitle(startIndex.coerceIn(0, items.lastIndex))}")
    }

    private fun playDevotional(track: DevotionalTrack, index: Int) {
        val c = controller ?: return notConnected()
        val items = NativeMediaCatalog.devotionalTracks.map { item ->
            mediaItem(
                id = "ibtihal:${item.id}",
                url = item.url,
                title = item.title,
                artist = "الشيخ سيد النقشبندي",
                album = "ابتهالات مختارة · مفكرة أنوار"
            )
        }
        startPlaylist(c, items, index.coerceIn(0, items.lastIndex), track.title)
    }

    private fun mediaItem(id: String, url: String, title: String, artist: String, album: String): MediaItem =
        MediaItem.Builder()
            .setMediaId(id)
            .setUri(Uri.parse(url))
            .setMediaMetadata(
                MediaMetadata.Builder()
                    .setTitle(title)
                    .setArtist(artist)
                    .setAlbumTitle(album)
                    .build()
            )
            .build()

    private fun startPlaylist(c: MediaController, items: List<MediaItem>, index: Int, description: String) {
        if (items.isEmpty()) {
            statusText.text = "لا توجد ملفات صالحة للتشغيل."
            return
        }
        c.setMediaItems(items, index, 0L)
        c.prepare()
        c.play()
        statusText.text = "جارٍ بدء «$description»…"
    }

    private fun togglePlayback() {
        val c = controller ?: return notConnected()
        if (c.isPlaying) c.pause()
        else if (c.mediaItemCount > 0) {
            if (c.playbackState == Player.STATE_IDLE) c.prepare()
            c.play()
        } else statusText.text = "اختر قارئاً أو محطة أو درساً أولا."
        syncPlayerUi()
    }

    private fun syncPlayerUi() {
        val c = controller
        val item = c?.currentMediaItem
        val title = item?.mediaMetadata?.title?.toString().orEmpty()
        val artist = item?.mediaMetadata?.artist?.toString().orEmpty()
        nowPlayingText.text = when {
            item == null -> "لا يوجد تشغيل نشط"
            artist.isBlank() -> title
            else -> "$title · $artist"
        }
        playPauseButton.text = if (c?.isPlaying == true) "إيقاف مؤقت" else "استئناف"
        playPauseButton.alpha = if ((c?.mediaItemCount ?: 0) > 0) 1f else 0.55f
        updateProgress()
    }

    private fun updateProgress() {
        val c = controller
        if (c == null) {
            timeText.text = "--:-- / --:--"
            seekBar.isEnabled = false
            return
        }
        val duration = c.duration
        val position = c.currentPosition.coerceAtLeast(0L)
        val knownDuration = duration > 0L && duration != C.TIME_UNSET
        seekBar.isEnabled = knownDuration
        if (!isSeeking) {
            seekBar.progress = if (knownDuration) {
                ((position.toDouble() / duration.toDouble()) * 1_000).toInt().coerceIn(0, 1_000)
            } else 0
        }
        timeText.text = "${formatTime(position)} / ${if (knownDuration) formatTime(duration) else "بث مباشر"}"
    }

    private fun formatTime(milliseconds: Long): String {
        val seconds = (milliseconds.coerceAtLeast(0L) / 1_000L)
        val hours = seconds / 3_600L
        val minutes = (seconds % 3_600L) / 60L
        val remainder = seconds % 60L
        return if (hours > 0) String.format(Locale.US, "%d:%02d:%02d", hours, minutes, remainder)
        else String.format(Locale.US, "%02d:%02d", minutes, remainder)
    }

    private fun notConnected() {
        statusText.text = "محرك الصوت ما زال يتصل. أعد المحاولة بعد لحظات."
    }

    private fun openExternal(url: String) {
        runCatching { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
            .onFailure { statusText.text = "تعذّر فتح صفحة المصدر." }
    }

    private fun normalizeMode(value: String?): String =
        when (value) {
            MODE_RADIO, MODE_LESSONS, MODE_IBTIHALAT -> value
            else -> MODE_QURAN
        }


    private enum class TulipRowStyle {
        RECITER,
        STATION,
        LESSON
    }

    /**
     * Native list row that preserves the notebook's original tulip placement
     * while keeping list selection and playback behavior in Android views.
     */
    private fun tulipArrayAdapter(
        labels: List<String>,
        style: TulipRowStyle,
        selectedPosition: Int = -1
    ): ArrayAdapter<String> = object : ArrayAdapter<String>(this, 0, labels) {
        override fun getView(position: Int, convertView: View?, parent: ViewGroup): View {
            val label = getItem(position).orEmpty()
            return tulipRow(label, style, position == selectedPosition)
        }
    }

    private fun tulipRow(label: String, style: TulipRowStyle, selected: Boolean): View {
        val rowHeight: Int
        val badgeWidth: Int
        val badgeHeight: Int
        val badgeRadius: Int
        val badgeBorder: Int
        val badgeBackground: Int
        val badgeCircle: Boolean
        val cardRadius: Int
        val normalStart: Int
        val normalEnd: Int
        val selectedStart: Int
        val selectedEnd: Int
        val normalBorder: Int
        val selectedBorder: Int
        val normalText: Int
        val selectedText: Int
        val textSize: Float

        when (style) {
            TulipRowStyle.RECITER -> {
                rowHeight = 74
                badgeWidth = 48
                badgeHeight = 48
                badgeRadius = 24
                badgeBorder = Color.rgb(223, 197, 141)
                badgeBackground = Color.rgb(255, 250, 240)
                badgeCircle = true
                cardRadius = 17
                normalStart = Color.rgb(247, 248, 250)
                normalEnd = Color.rgb(233, 237, 242)
                selectedStart = Color.rgb(247, 248, 250)
                selectedEnd = Color.rgb(233, 237, 242)
                normalBorder = Color.rgb(212, 217, 223)
                selectedBorder = gold
                normalText = Color.rgb(23, 42, 58)
                selectedText = Color.rgb(23, 42, 58)
                textSize = 16f
            }
            TulipRowStyle.STATION -> {
                rowHeight = 66
                badgeWidth = 39
                badgeHeight = 43
                badgeRadius = 10
                badgeBorder = Color.rgb(213, 227, 210)
                badgeBackground = Color.rgb(251, 248, 235)
                badgeCircle = false
                cardRadius = 13
                normalStart = Color.rgb(240, 247, 240)
                normalEnd = Color.rgb(229, 240, 230)
                selectedStart = Color.rgb(45, 112, 77)
                selectedEnd = Color.rgb(32, 86, 59)
                normalBorder = Color.rgb(201, 221, 204)
                selectedBorder = Color.rgb(36, 92, 67)
                normalText = Color.rgb(37, 77, 50)
                selectedText = Color.WHITE
                textSize = 14f
            }
            TulipRowStyle.LESSON -> {
                rowHeight = 60
                badgeWidth = 36
                badgeHeight = 38
                badgeRadius = 9
                badgeBorder = Color.rgb(213, 227, 210)
                badgeBackground = Color.rgb(251, 248, 235)
                badgeCircle = false
                cardRadius = 12
                normalStart = Color.rgb(240, 247, 240)
                normalEnd = Color.rgb(229, 240, 230)
                selectedStart = Color.rgb(45, 112, 77)
                selectedEnd = Color.rgb(32, 86, 59)
                normalBorder = Color.rgb(201, 221, 204)
                selectedBorder = Color.rgb(36, 92, 67)
                normalText = Color.rgb(37, 77, 50)
                selectedText = Color.WHITE
                textSize = 13f
            }
        }

        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(11), dp(7), dp(11), dp(7))
            background = GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                intArrayOf(
                    if (selected) selectedStart else normalStart,
                    if (selected) selectedEnd else normalEnd
                )
            ).apply {
                cornerRadius = dp(cardRadius).toFloat()
                setStroke(dp(1), if (selected) selectedBorder else normalBorder)
            }
        }
        row.layoutParams = AbsListView.LayoutParams(
            AbsListView.LayoutParams.MATCH_PARENT,
            dp(rowHeight)
        )
        row.addView(
            NativeAudioArtwork.badge(
                this,
                widthDp = badgeWidth,
                heightDp = badgeHeight,
                radiusDp = badgeRadius,
                borderColor = badgeBorder,
                backgroundColor = badgeBackground,
                circular = badgeCircle
            ),
            LinearLayout.LayoutParams(dp(badgeWidth), dp(badgeHeight))
        )
        val name = text(label, textSize, if (selected) selectedText else normalText, true).apply {
            gravity = Gravity.CENTER_VERTICAL
            maxLines = 2
        }
        row.addView(
            name,
            LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1f).apply {
                marginStart = dp(10)
                marginEnd = dp(6)
            }
        )
        return row
    }

    private fun sectionTitle(value: String) = text(value, 17f, green, true, top = 12, bottom = 5)

    private fun fieldLabel(value: String) = text(value, 12f, muted, true, top = 10, bottom = 4)

    private fun text(
        value: String,
        size: Float,
        color: Int,
        bold: Boolean = false,
        top: Int = 0,
        bottom: Int = 0
    ): TextView = TextView(this).apply {
        text = value
        textSize = size
        setTextColor(color)
        gravity = Gravity.END
        textAlignment = View.TEXT_ALIGNMENT_VIEW_END
        layoutDirection = View.LAYOUT_DIRECTION_RTL
        if (bold) typeface = Typeface.create("sans-serif", Typeface.BOLD)
        setPadding(0, dp(top), 0, dp(bottom))
    }

    private fun actionButton(
        label: String,
        backgroundColor: Int,
        textColor: Int,
        action: () -> Unit
    ): TextView = TextView(this).apply {
        text = label
        textSize = 12f
        setTextColor(textColor)
        gravity = Gravity.CENTER
        typeface = Typeface.create("sans-serif", Typeface.BOLD)
        setPadding(dp(8), dp(8), dp(8), dp(8))
        background = rounded(backgroundColor, 11, if (backgroundColor == Color.WHITE) Color.rgb(226, 220, 208) else null)
        isClickable = true
        isFocusable = true
        setOnClickListener { action() }
    }

    private fun rounded(color: Int, radius: Int, stroke: Int? = null) =
        GradientDrawable().apply {
            setColor(color)
            cornerRadius = dp(radius).toFloat()
            if (stroke != null) setStroke(dp(1), stroke)
        }

    private fun matchWrap(height: Int) = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT, height
    )

    private fun marginTop(top: Int) = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
    ).apply { topMargin = top }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density + 0.5f).toInt()

    companion object {
        const val EXTRA_MODE = "audio_mode"
        const val MODE_QURAN = "quran"
        const val MODE_RADIO = "radio"
        const val MODE_LESSONS = "lessons"
        const val MODE_IBTIHALAT = "ibtihalat"
    }
}
