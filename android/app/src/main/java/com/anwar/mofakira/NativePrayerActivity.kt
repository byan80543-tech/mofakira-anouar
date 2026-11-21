package com.anwar.mofakira

import android.Manifest
import android.app.Activity
import android.app.AlarmManager
import android.app.AlertDialog
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.widget.ArrayAdapter
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.SeekBar
import android.widget.Spinner
import android.widget.Switch
import android.widget.TextView
import android.widget.Toast
import com.anwar.mofakira.alarm.PrayerAlarmScheduler
import com.anwar.mofakira.alarm.PrayerCalendarRepository
import com.anwar.mofakira.alarm.PrayerRefreshWorker
import com.anwar.mofakira.playback.AdhanPlaybackService
import com.anwar.mofakira.playback.VoiceCatalog
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

private data class NativePrayerCountry(
    val api: String,
    val label: String,
    val defaultCity: String,
    val method: String,
    val timeZone: String
)

private data class NativePrayerVoice(val key: String, val label: String)

/**
 * First fully native feature screen: prayer times and automatic background adhan.
 *
 * The same SharedPreferences and alarm pipeline are used by the legacy web
 * compatibility activity, so both screens see the same prayer configuration.
 */
class NativePrayerActivity : Activity() {
    private val navy = Color.rgb(9, 38, 77)
    private val blue = Color.rgb(18, 69, 116)
    private val green = Color.rgb(13, 59, 50)
    private val gold = Color.rgb(201, 169, 106)
    private val cream = Color.rgb(247, 243, 234)
    private val ink = Color.rgb(35, 48, 58)
    private val muted = Color.rgb(101, 112, 120)
    private val handler = Handler(Looper.getMainLooper())

    private lateinit var cityInput: EditText
    private lateinit var countrySpinner: Spinner
    private lateinit var voiceSpinner: Spinner
    private lateinit var volumeSeek: SeekBar
    private lateinit var volumeValue: TextView
    private lateinit var adhanSwitch: Switch
    private lateinit var statusText: TextView
    private lateinit var todayRows: LinearLayout
    private lateinit var nextPrayerName: TextView
    private lateinit var nextPrayerTime: TextView
    private lateinit var countdownText: TextView

    private var refreshing = false
    private var waitingForExactAlarmSettings = false
    private var nextPrayerTimestamp: Long? = null

    private val countries = listOf(
        NativePrayerCountry("Morocco", "المغرب", "Meknes", "21", "Africa/Casablanca"),
        NativePrayerCountry("Algeria", "الجزائر", "Algiers", "19", "Africa/Algiers"),
        NativePrayerCountry("Tunisia", "تونس", "Tunis", "18", "Africa/Tunis"),
        NativePrayerCountry("Libya", "ليبيا", "Tripoli", "auto", "Africa/Tripoli"),
        NativePrayerCountry("Egypt", "مصر", "Cairo", "5", "Africa/Cairo"),
        NativePrayerCountry("Sudan", "السودان", "Khartoum", "auto", "Africa/Khartoum"),
        NativePrayerCountry("Mauritania", "موريتانيا", "Nouakchott", "auto", "Africa/Nouakchott"),
        NativePrayerCountry("Somalia", "الصومال", "Mogadishu", "auto", "Africa/Mogadishu"),
        NativePrayerCountry("Djibouti", "جيبوتي", "Djibouti", "auto", "Africa/Djibouti"),
        NativePrayerCountry("Comoros", "جزر القمر", "Moroni", "auto", "Indian/Comoro"),
        NativePrayerCountry("Saudi Arabia", "السعودية", "Riyadh", "4", "Asia/Riyadh"),
        NativePrayerCountry("Yemen", "اليمن", "Sanaa", "auto", "Asia/Aden"),
        NativePrayerCountry("Oman", "عمان", "Muscat", "8", "Asia/Muscat"),
        NativePrayerCountry("United Arab Emirates", "الإمارات", "Abu Dhabi", "8", "Asia/Dubai"),
        NativePrayerCountry("Qatar", "قطر", "Doha", "10", "Asia/Qatar"),
        NativePrayerCountry("Bahrain", "البحرين", "Manama", "8", "Asia/Bahrain"),
        NativePrayerCountry("Kuwait", "الكويت", "Kuwait City", "9", "Asia/Kuwait"),
        NativePrayerCountry("Iraq", "العراق", "Baghdad", "auto", "Asia/Baghdad"),
        NativePrayerCountry("Syria", "سوريا", "Damascus", "auto", "Asia/Damascus"),
        NativePrayerCountry("Lebanon", "لبنان", "Beirut", "auto", "Asia/Beirut"),
        NativePrayerCountry("Jordan", "الأردن", "Amman", "23", "Asia/Amman"),
        NativePrayerCountry("Palestine", "فلسطين", "Gaza", "auto", "Asia/Gaza"),
        NativePrayerCountry("Turkey", "تركيا", "Ankara", "13", "Europe/Istanbul"),
        NativePrayerCountry("France", "فرنسا", "Paris", "12", "Europe/Paris"),
        NativePrayerCountry("Germany", "ألمانيا", "Berlin", "auto", "Europe/Berlin"),
        NativePrayerCountry("United Kingdom", "بريطانيا", "London", "auto", "Europe/London"),
        NativePrayerCountry("United States", "الولايات المتحدة", "Washington", "2", "America/New_York"),
        NativePrayerCountry("Canada", "كندا", "Ottawa", "2", "America/Toronto"),
        NativePrayerCountry("Pakistan", "باكستان", "Islamabad", "1", "Asia/Karachi"),
        NativePrayerCountry("India", "الهند", "New Delhi", "auto", "Asia/Kolkata"),
        NativePrayerCountry("Malaysia", "ماليزيا", "Kuala Lumpur", "17", "Asia/Kuala_Lumpur"),
        NativePrayerCountry("Indonesia", "إندونيسيا", "Jakarta", "20", "Asia/Jakarta")
    )

    private val voices = listOf(
        NativePrayerVoice("calm", "أذان هادئ · الافتراضي"),
        NativePrayerVoice("aqsa", "المسجد الأقصى · ناجي قزاز"),
        NativePrayerVoice("haram_makki", "الحرم المكي · علي بن أحمد ملا"),
        NativePrayerVoice("morocco_kamal", "أذان مغربي · كمال محمد المروش"),
        NativePrayerVoice("madina", "المسجد النبوي · تسجيل ميداني")
    )

    private val countdownTicker = object : Runnable {
        override fun run() {
            updateCountdown()
            handler.postDelayed(this, 1_000L)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = navy
        window.navigationBarColor = navy
        window.decorView.layoutDirection = View.LAYOUT_DIRECTION_RTL
        setContentView(buildScreen())
        loadSettings()
        renderSchedule()
        if (!hasCurrentDaySchedule()) refreshCalendar()
    }

    override fun onResume() {
        super.onResume()
        handler.removeCallbacks(countdownTicker)
        handler.post(countdownTicker)
        if (waitingForExactAlarmSettings) {
            waitingForExactAlarmSettings = false
            if (hasExactAlarmAccess()) {
                Toast.makeText(this, "تم تفعيل المنبهات والتذكيرات. يجري تحديث جدول الأذان.", Toast.LENGTH_LONG).show()
                PrayerAlarmScheduler.scheduleNext(this)
                PrayerRefreshWorker.ensurePeriodic(this)
                PrayerRefreshWorker.enqueueNow(this)
            } else {
                Toast.makeText(this, "لم يُفعّل إذن المنبهات الدقيقة؛ قد يتأخر التنبيه في وضع السكون.", Toast.LENGTH_LONG).show()
            }
        }
    }

    override fun onPause() {
        handler.removeCallbacks(countdownTicker)
        super.onPause()
    }

    private fun buildScreen(): View {
        val scroll = ScrollView(this).apply {
            setBackgroundColor(cream)
            isFillViewport = true
            clipToPadding = false
        }
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            setPadding(dp(16), dp(15), dp(16), dp(28))
        }
        scroll.addView(root)

        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
        }
        header.addView(makeButton("رجوع", Color.WHITE, navy) { finish() }, LinearLayout.LayoutParams(dp(75), dp(42)))
        val headerTitle = text("مواقيت الصلاة والأذان", 20f, navy, true)
        headerTitle.gravity = Gravity.END or Gravity.CENTER_VERTICAL
        header.addView(headerTitle, LinearLayout.LayoutParams(0, dp(48), 1f).apply { marginEnd = dp(10) })
        root.addView(header)

        root.addView(text("إعدادات الصلاة وجدولة الأذان من داخل تطبيق أندرويد.", 12f, muted, top = 5, bottom = 14))
        root.addView(nextPrayerCard())
        root.addView(sectionHeading("مواقيت اليوم"))
        todayRows = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            background = rounded(Color.WHITE, 15, Color.rgb(229, 222, 208))
            setPadding(dp(13), dp(5), dp(13), dp(5))
        }
        root.addView(todayRows)

        root.addView(sectionHeading("الموقع"))
        val locationCard = card()
        locationCard.addView(fieldLabel("الدولة"))
        countrySpinner = Spinner(this)
        locationCard.addView(countrySpinner, matchWrap(dp(48)))
        locationCard.addView(fieldLabel("المدينة", 9))
        cityInput = EditText(this).apply {
            textSize = 15f
            setTextColor(ink)
            setHintTextColor(muted)
            hint = "اكتب اسم المدينة"
            gravity = Gravity.END or Gravity.CENTER_VERTICAL
            textAlignment = View.TEXT_ALIGNMENT_VIEW_END
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            singleLine = true
            inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_FLAG_CAP_WORDS
            setPadding(dp(12), dp(7), dp(12), dp(7))
            background = rounded(Color.rgb(250, 249, 245), 10, Color.rgb(221, 214, 201))
        }
        locationCard.addView(cityInput, matchWrap(dp(48)))
        root.addView(locationCard)

        root.addView(sectionHeading("صوت الأذان"))
        val audioCard = card()
        voiceSpinner = Spinner(this)
        audioCard.addView(voiceSpinner, matchWrap(dp(48)))
        val volumeRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
        }
        volumeRow.addView(text("مستوى الصوت", 12f, ink, true), LinearLayout.LayoutParams(0, dp(38), 1f))
        volumeValue = text("90%", 12f, green, true)
        volumeRow.addView(volumeValue)
        audioCard.addView(volumeRow)
        volumeSeek = SeekBar(this).apply { max = 100 }
        audioCard.addView(volumeSeek, matchWrap(dp(40)))
        root.addView(audioCard)

        root.addView(sectionHeading("الأذان خارج التطبيق"))
        val adhanCard = card()
        adhanSwitch = Switch(this).apply {
            text = "تشغيل الأذان تلقائيًا عند دخول وقت الصلاة"
            textSize = 13f
            setTextColor(ink)
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, dp(6), 0, dp(6))
        }
        adhanCard.addView(adhanSwitch, matchWrap(dp(55)))
        adhanCard.addView(text(
            "يحتاج أندرويد إلى إذن الإشعارات، وإذن المنبهات والتذكيرات لجدولة الصلاة بدقة. يمكن أن يتأثر التشغيل بقيود البطارية أو الإيقاف الإجباري.",
            11f,
            muted,
            top = 5
        ))
        root.addView(adhanCard)

        val refresh = makeButton("حفظ وتحديث المواقيت", gold, navy) { saveAndRefresh() }
        root.addView(refresh, marginTop(dp(13)))
        val permission = makeButton("إعداد أذونات الأذان الخلفي", navy, Color.WHITE) {
            if (!adhanSwitch.isChecked) adhanSwitch.isChecked = true
            saveSettings()
            requestRequiredAccess()
        }
        root.addView(permission, marginTop(dp(9)))

        statusText = text("تُحفظ الإعدادات على هذا الجهاز.", 11f, muted, top = 11)
        root.addView(statusText)
        root.addView(makeButton("فتح بقية خدمات المفكرة", Color.WHITE, green) {
            startActivity(Intent(this, LegacyWebActivity::class.java))
        }, marginTop(dp(18)))
        return scroll
    }

    private fun nextPrayerCard(): View {
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            setPadding(dp(16), dp(17), dp(16), dp(16))
            background = GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                intArrayOf(navy, blue)
            ).apply { cornerRadius = dp(18).toFloat() }
        }
        box.addView(text("الصلاة القادمة", 12f, Color.rgb(235, 225, 200), true, bottom = 5).apply { gravity = Gravity.CENTER })
        nextPrayerName = text("بانتظار المواقيت", 21f, Color.WHITE, true, bottom = 2).apply { gravity = Gravity.CENTER }
        nextPrayerTime = text("--:--", 27f, Color.WHITE, true, bottom = 2).apply { gravity = Gravity.CENTER }
        countdownText = text("--:--:--", 13f, Color.rgb(235, 225, 200), true).apply { gravity = Gravity.CENTER }
        box.addView(nextPrayerName)
        box.addView(nextPrayerTime)
        box.addView(countdownText)
        return box
    }

    private fun loadSettings() {
        val config = PrayerSettings.read(this)
        val countryAdapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, countries.map { it.label })
        countryAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        countrySpinner.adapter = countryAdapter
        countrySpinner.setSelection(countries.indexOfFirst { it.api == config.country }.coerceAtLeast(0))

        val voiceAdapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, voices.map { it.label })
        voiceAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        voiceSpinner.adapter = voiceAdapter
        voiceSpinner.setSelection(voices.indexOfFirst { it.key == config.voiceKey }.coerceAtLeast(0))

        cityInput.setText(config.city)
        volumeSeek.progress = (config.volume * 100).toInt()
        volumeValue.text = "${volumeSeek.progress}%"
        adhanSwitch.isChecked = config.enabled
        volumeSeek.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                volumeValue.text = "${progress}%"
            }
            override fun onStartTrackingTouch(seekBar: SeekBar?) = Unit
            override fun onStopTrackingTouch(seekBar: SeekBar?) = Unit
        })
        adhanSwitch.setOnCheckedChangeListener { _, isChecked ->
            persistSettings()
            if (isChecked) requestRequiredAccess()
            else {
                PrayerAlarmScheduler.cancel(this)
                stopService(Intent(this, AdhanPlaybackService::class.java))
                statusText.text = "تم إيقاف الأذان التلقائي. تبقى المواقيت ظاهرة."
            }
        }
    }

    private fun saveSettings(): PrayerConfig? {
        val city = cityInput.text?.toString()?.trim().orEmpty()
        if (city.isBlank()) {
            cityInput.error = "أدخل اسم المدينة"
            statusText.text = "لم تُحفظ الإعدادات؛ اسم المدينة مطلوب."
            return null
        }
        val country = countries.getOrNull(countrySpinner.selectedItemPosition) ?: countries.first()
        val voice = voices.getOrNull(voiceSpinner.selectedItemPosition) ?: voices.first()
        val config = PrayerSettings.updateNative(
            context = this,
            enabled = adhanSwitch.isChecked,
            city = city,
            country = country.api,
            method = country.method,
            timeZone = country.timeZone,
            voiceKey = voice.key,
            volume = volumeSeek.progress / 100f
        )
        if (config.enabled) PrayerRefreshWorker.ensurePeriodic(this)
        else {
            PrayerAlarmScheduler.cancel(this)
            stopService(Intent(this, AdhanPlaybackService::class.java))
        }
        return config
    }

    private fun persistSettings() {
        val config = saveSettings() ?: return
        statusText.text = if (config.enabled) "حُفظت الإعدادات. يجري تحديث جدول الأذان." else "حُفظت الإعدادات."
        if (config.enabled) refreshCalendar()
    }

    private fun saveAndRefresh() {
        val config = saveSettings() ?: return
        statusText.text = "حُفظت الإعدادات. يجري تحديث مواقيت الصلاة..."
        refreshCalendar()
        if (config.enabled) requestRequiredAccess()
    }

    private fun refreshCalendar() {
        if (refreshing) {
            statusText.text = "يجري تحديث المواقيت بالفعل..."
            return
        }
        refreshing = true
        statusText.text = "جارٍ جلب مواقيت الشهر الحالي والقادم..."
        Thread({
            val result = runCatching { PrayerCalendarRepository.refreshAndSchedule(this) }
            runOnUiThread {
                refreshing = false
                if (isFinishing || isDestroyed) return@runOnUiThread
                val success = result.getOrNull() == true
                if (success) {
                    statusText.text = "تم تحديث المواقيت وحفظها على الجهاز."
                    renderSchedule()
                } else {
                    statusText.text = "تعذّر جلب المواقيت. تحقق من الاتصال واسم المدينة ثم أعد المحاولة."
                }
            }
        }, "Anwar-Native-Prayer-Refresh").start()
    }

    private fun renderSchedule() {
        val raw = PrayerSettings.eventJson(this)
        val events = runCatching { JSONArray(raw ?: "[]") }.getOrNull() ?: JSONArray()
        val config = PrayerSettings.read(this)
        val zone = TimeZone.getTimeZone(config.timeZone)
        val todayFormat = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { timeZone = zone }
        val clockFormat = SimpleDateFormat("HH:mm", Locale.US).apply { timeZone = zone }
        val today = todayFormat.format(Date())
        val now = System.currentTimeMillis()

        val todayEvents = ArrayList<JSONObject>()
        val futureEvents = ArrayList<JSONObject>()
        for (index in 0 until events.length()) {
            val item = events.optJSONObject(index) ?: continue
            val timestamp = item.optLong("timestamp", -1L)
            if (timestamp <= 0L) continue
            if (item.optString("date") == today) todayEvents.add(item)
            if (timestamp > now) futureEvents.add(item)
        }
        todayEvents.sortBy { it.optLong("timestamp") }
        futureEvents.sortBy { it.optLong("timestamp") }
        todayRows.removeAllViews()
        if (todayEvents.isEmpty()) {
            todayRows.addView(text("لم تُحمّل مواقيت اليوم بعد.", 12f, muted, top = 12, bottom = 12))
        } else {
            todayEvents.forEachIndexed { index, event ->
                val row = LinearLayout(this).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = Gravity.CENTER_VERTICAL
                    layoutDirection = View.LAYOUT_DIRECTION_RTL
                    setPadding(dp(5), dp(9), dp(5), dp(9))
                }
                val name = text(event.optString("prayerName", "الصلاة"), 13f, ink, true)
                row.addView(name, LinearLayout.LayoutParams(0, dp(30), 1f))
                row.addView(text(clockFormat.format(Date(event.optLong("timestamp"))), 14f, green, true))
                todayRows.addView(row)
                if (index != todayEvents.lastIndex) {
                    val divider = View(this).apply { setBackgroundColor(Color.rgb(238, 233, 222)) }
                    todayRows.addView(divider, LinearLayout.LayoutParams(-1, dp(1)))
                }
            }
        }

        val next = futureEvents.firstOrNull()
        nextPrayerTimestamp = next?.optLong("timestamp")
        if (next != null) {
            nextPrayerName.text = next.optString("prayerName", "الصلاة")
            nextPrayerTime.text = clockFormat.format(Date(next.optLong("timestamp")))
            updateCountdown()
        } else {
            nextPrayerTimestamp = null
            nextPrayerName.text = "بانتظار المواقيت"
            nextPrayerTime.text = "--:--"
            countdownText.text = "--:--:--"
        }
    }

    private fun updateCountdown() {
        val timestamp = nextPrayerTimestamp ?: return
        val remaining = timestamp - System.currentTimeMillis()
        if (remaining <= 0L) {
            nextPrayerTimestamp = null
            nextPrayerName.text = "حان وقت الصلاة"
            countdownText.text = "00:00:00"
            refreshCalendar()
            return
        }
        val totalSeconds = remaining / 1_000L
        val hours = totalSeconds / 3_600L
        val minutes = (totalSeconds % 3_600L) / 60L
        val seconds = totalSeconds % 60L
        countdownText.text = String.format(Locale.US, "%02d:%02d:%02d", hours, minutes, seconds)
    }

    private fun hasCurrentDaySchedule(): Boolean {
        val raw = PrayerSettings.eventJson(this) ?: return false
        val events = runCatching { JSONArray(raw) }.getOrNull() ?: return false
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.US)
            .apply { timeZone = TimeZone.getTimeZone(PrayerSettings.read(this).timeZone) }
            .format(Date())
        var count = 0
        for (index in 0 until events.length()) {
            val item = events.optJSONObject(index) ?: continue
            if (item.optString("date") == today && item.optLong("timestamp", 0L) > 0L) count++
        }
        return count >= 5
    }

    private fun hasNotificationAccess(): Boolean =
        Build.VERSION.SDK_INT < 33 ||
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) ==
            android.content.pm.PackageManager.PERMISSION_GRANTED

    private fun hasExactAlarmAccess(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
        val alarmManager = getSystemService(ALARM_SERVICE) as AlarmManager
        return alarmManager.canScheduleExactAlarms()
    }

    private fun requestRequiredAccess() {
        if (hasNotificationAccess() && hasExactAlarmAccess()) {
            statusText.text = "الأذونات مفعّلة. سيُجدول الأذان التالي على مستوى النظام."
            PrayerAlarmScheduler.scheduleNext(this)
            return
        }
        AlertDialog.Builder(this)
            .setTitle("تفعيل الأذان خارج التطبيق")
            .setMessage(
                "يحتاج أنوار إلى إذن الإشعارات، وإذن «المنبهات والتذكيرات» لجدولة الأذان بدقة بعد إغلاق الواجهة. " +
                    "اضغط متابعة لمنح الأذونات من نظام Android."
            )
            .setPositiveButton("متابعة") { _, _ -> requestNotificationAccess() }
            .setNegativeButton("لاحقًا") { _, _ ->
                statusText.text = "حُفظ الاختيار، لكن الأذان الدقيق يحتاج إلى الأذونات."
            }
            .show()
    }

    private fun requestNotificationAccess() {
        if (Build.VERSION.SDK_INT >= 33 && !hasNotificationAccess()) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQUEST_NOTIFICATIONS)
        } else {
            requestExactAlarmAccess()
        }
    }

    private fun requestExactAlarmAccess() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || hasExactAlarmAccess()) {
            PrayerAlarmScheduler.scheduleNext(this)
            PrayerRefreshWorker.enqueueNow(this)
            statusText.text = "الأذونات متاحة. تم تحديث طلب جدولة الأذان."
            return
        }
        AlertDialog.Builder(this)
            .setTitle("السماح بالمنبهات والتذكيرات")
            .setMessage("افتح إعدادات Android وفعّل «المنبهات والتذكيرات» لتطبيق مفكرة أنوار.")
            .setPositiveButton("فتح الإعدادات") { _, _ ->
                val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
                    .setData(Uri.parse("package:$packageName"))
                waitingForExactAlarmSettings = true
                try {
                    startActivity(intent)
                } catch (_: Exception) {
                    waitingForExactAlarmSettings = false
                    statusText.text = "تعذّر فتح صفحة الإذن. افتح إعدادات التطبيق ثم المنبهات والتذكيرات."
                }
            }
            .setNegativeButton("لاحقًا") { _, _ ->
                statusText.text = "يمكنك منح الإذن لاحقًا من إعدادات التطبيق."
            }
            .show()
    }

    @Deprecated("Retained for Android API compatibility")
    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_NOTIFICATIONS) {
            if (!hasNotificationAccess()) {
                Toast.makeText(this, "لم يُمنح إذن الإشعارات. يمكنك تفعيله لاحقًا من إعدادات التطبيق.", Toast.LENGTH_LONG).show()
            }
            requestExactAlarmAccess()
        }
    }

    private fun card() = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        layoutDirection = View.LAYOUT_DIRECTION_RTL
        setPadding(dp(14), dp(12), dp(14), dp(12))
        background = rounded(Color.WHITE, 15, Color.rgb(229, 222, 208))
    }

    private fun sectionHeading(value: String) = text(value, 15f, green, true, top = 19, bottom = 8)

    private fun fieldLabel(value: String, top: Int = 0) = text(value, 12f, muted, true, top = top, bottom = 5)

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

    private fun makeButton(
        label: String,
        backgroundColor: Int,
        textColor: Int,
        action: () -> Unit
    ) = TextView(this).apply {
        text = label
        textSize = 13f
        setTextColor(textColor)
        gravity = Gravity.CENTER
        typeface = Typeface.create("sans-serif", Typeface.BOLD)
        setPadding(dp(10), dp(9), dp(10), dp(9))
        background = rounded(backgroundColor, 13, if (backgroundColor == Color.WHITE) Color.rgb(226, 220, 208) else null)
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
        private const val REQUEST_NOTIFICATIONS = 722
    }
}
