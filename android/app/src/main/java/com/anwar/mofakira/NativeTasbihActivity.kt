package com.anwar.mofakira

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RadialGradient
import android.graphics.Shader
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.LayerDrawable
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.text.InputFilter
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.nio.ByteBuffer
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import java.text.Normalizer
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Native equivalent of the complete legacy tasbih experience.
 *
 * The public adhkar catalog is generated from the existing official-adhkar.js
 * source during the Android workflow. Personal settings are encrypted with a
 * non-exportable Android Keystore key before they are written to preferences.
 * The old WebView vault remains untouched and is still reachable separately.
 */
class NativeTasbihActivity : Activity() {

    private data class DhikrItem(
        val id: String,
        val title: String,
        val text: String,
        val period: String,
        val category: String = "",
        val count: Int? = null,
        val occasion: String = "",
        val source: String = ""
    )

    private data class ThemeSpec(
        val key: String,
        val label: String,
        val background: Int,
        val surface: Int,
        val text: Int,
        val muted: Int,
        val accent: Int,
        val accentSoft: Int,
        val border: Int,
        val tapStart: Int,
        val tapEnd: Int
    )

    private val themes = listOf(
        ThemeSpec(
            "emerald", "الأخضر والذهبي",
            Color.rgb(244, 234, 214), Color.rgb(255, 250, 240),
            Color.rgb(18, 61, 50), Color.rgb(101, 112, 103),
            Color.rgb(23, 99, 77), Color.rgb(216, 189, 124),
            Color.rgb(200, 164, 94), Color.rgb(232, 211, 160), Color.rgb(198, 160, 91)
        ),
        ThemeSpec(
            "dark", "الفخم الداكن",
            Color.rgb(9, 37, 31), Color.rgb(18, 59, 51),
            Color.rgb(255, 245, 223), Color.rgb(195, 185, 159),
            Color.rgb(231, 199, 127), Color.rgb(150, 120, 67),
            Color.rgb(184, 142, 69), Color.rgb(232, 203, 139), Color.rgb(188, 145, 74)
        ),
        ThemeSpec(
            "pink", "التوليب الوردي",
            Color.rgb(251, 232, 238), Color.rgb(255, 248, 250),
            Color.rgb(113, 50, 68), Color.rgb(148, 107, 119),
            Color.rgb(183, 66, 104), Color.rgb(242, 195, 208),
            Color.rgb(227, 165, 184), Color.rgb(244, 196, 210), Color.rgb(210, 133, 157)
        ),
        ThemeSpec(
            "night", "الليلي",
            Color.rgb(16, 30, 59), Color.rgb(23, 41, 75),
            Color.rgb(245, 240, 223), Color.rgb(189, 201, 220),
            Color.rgb(242, 206, 120), Color.rgb(130, 150, 191),
            Color.rgb(201, 164, 93), Color.rgb(244, 213, 139), Color.rgb(190, 155, 92)
        ),
        ThemeSpec(
            "heritage", "التراثي",
            Color.rgb(245, 232, 201), Color.rgb(255, 248, 232),
            Color.rgb(36, 67, 51), Color.rgb(131, 112, 78),
            Color.rgb(40, 98, 70), Color.rgb(212, 173, 97),
            Color.rgb(196, 154, 80), Color.rgb(233, 209, 154), Color.rgb(191, 151, 79)
        ),
        ThemeSpec(
            "glass", "الزجاجي",
            Color.rgb(220, 229, 232), Color.rgb(248, 251, 251),
            Color.rgb(38, 62, 73), Color.rgb(101, 123, 130),
            Color.rgb(71, 123, 133), Color.rgb(185, 211, 213),
            Color.rgb(155, 187, 192), Color.rgb(213, 232, 231), Color.rgb(150, 190, 194)
        )
    )

    private val builtInDhikrs = listOf(
        DhikrItem("legacy-default", "سبوح قدوس رب الملائكة والروح", "سبوح قدوس رب الملائكة والروح.", "builtin", "التسبيح والتحميد"),
        DhikrItem("subhan", "سبحان الله", "سبحان الله", "builtin", "التسبيح والتحميد"),
        DhikrItem("hamd", "الحمد لله", "الحمد لله", "builtin", "التسبيح والتحميد"),
        DhikrItem("takbir", "الله أكبر", "الله أكبر", "builtin", "التسبيح والتحميد"),
        DhikrItem("tahlil", "لا إله إلا الله", "لا إله إلا الله", "builtin", "التسبيح والتحميد"),
        DhikrItem("subhan-hamd", "سبحان الله وبحمده", "سبحان الله وبحمده", "builtin", "التسبيح والتحميد"),
        DhikrItem("subhan-azim", "سبحان الله العظيم", "سبحان الله العظيم", "builtin", "التسبيح والتحميد"),
        DhikrItem("four-words", "سبحان الله والحمد لله ولا إله إلا الله والله أكبر", "سبحان الله والحمد لله ولا إله إلا الله والله أكبر", "builtin", "التسبيح والتحميد"),
        DhikrItem("hawqala", "لا حول ولا قوة إلا بالله", "لا حول ولا قوة إلا بالله", "builtin", "التسبيح والتحميد"),
        DhikrItem("istighfar", "أستغفر الله", "أستغفر الله", "builtin", "الاستغفار والتوبة"),
        DhikrItem("istighfar-tawbah", "أستغفر الله العظيم وأتوب إليه", "أستغفر الله العظيم وأتوب إليه", "builtin", "الاستغفار والتوبة"),
        DhikrItem("istighfar-long", "أستغفر الله العظيم الذي لا إله إلا هو الحي القيوم وأتوب إليه", "أستغفر الله العظيم الذي لا إله إلا هو الحي القيوم وأتوب إليه", "builtin", "الاستغفار والتوبة"),
        DhikrItem("rabb-ighfir", "رب اغفر لي وتب علي إنك أنت التواب الرحيم", "رب اغفر لي وتب علي إنك أنت التواب الرحيم", "builtin", "الاستغفار والتوبة"),
        DhikrItem("afw", "اللهم إنك عفو تحب العفو فاعف عني", "اللهم إنك عفو تحب العفو فاعف عني", "builtin", "الاستغفار والتوبة"),
        DhikrItem("salawat", "اللهم صل وسلم على نبينا محمد", "اللهم صل وسلم على نبينا محمد", "builtin", "أذكار وأدعية جامعة"),
        DhikrItem("dua-help", "اللهم أعني على ذكرك وشكرك وحسن عبادتك", "اللهم أعني على ذكرك وشكرك وحسن عبادتك", "builtin", "أذكار وأدعية جامعة"),
        DhikrItem("yunus", "لا إله إلا أنت سبحانك إني كنت من الظالمين", "لا إله إلا أنت سبحانك إني كنت من الظالمين", "builtin", "أذكار وأدعية جامعة"),
        DhikrItem("hasbi", "حسبي الله لا إله إلا هو عليه توكلت وهو رب العرش العظيم", "حسبي الله لا إله إلا هو عليه توكلت وهو رب العرش العظيم", "builtin", "أذكار وأدعية جامعة"),
        DhikrItem("contentment", "رضيت بالله رباً وبالإسلام ديناً وبمحمد نبياً", "رضيت بالله رباً وبالإسلام ديناً وبمحمد نبياً", "builtin", "أذكار وأدعية جامعة"),
        DhikrItem("living", "يا حي يا قيوم برحمتك أستغيث", "يا حي يا قيوم برحمتك أستغيث", "builtin", "أذكار وأدعية جامعة"),
        DhikrItem("good", "ربنا آتنا في الدنيا حسنة وفي الآخرة حسنة وقنا عذاب النار", "ربنا آتنا في الدنيا حسنة وفي الآخرة حسنة وقنا عذاب النار", "builtin", "أذكار وأدعية جامعة"),
        DhikrItem("halal", "اللهم اكفني بحلالك عن حرامك وأغنني بفضلك عمن سواك", "اللهم اكفني بحلالك عن حرامك وأغنني بفضلك عمن سواك", "builtin", "أذكار وأدعية جامعة")
    )

    private val preferences by lazy { getSharedPreferences(PREFS_NAME, MODE_PRIVATE) }
    private val customDhikrs = mutableListOf<String>()
    private val removedDhikrs = linkedSetOf<String>()
    private var officialDhikrs: List<DhikrItem> = emptyList()

    private var count = 0
    private var selectedKey = "builtin:legacy-default"
    private var selectedTitle = "سبوح قدوس رب الملائكة والروح"
    private var selectedText = "سبوح قدوس رب الملائكة والروح."
    private var themeKey = "emerald"
    private var storageAvailable = true
    private var storageFailureMessage = ""

    private lateinit var rootContent: LinearLayout
    private lateinit var phraseView: TextView
    private lateinit var countView: TextView
    private lateinit var counterCenter: LinearLayout
    private lateinit var beadRing: BeadRingView
    private lateinit var listToggle: TextView
    private lateinit var listPanel: LinearLayout
    private lateinit var listContainer: LinearLayout
    private lateinit var themePanel: LinearLayout
    private lateinit var themeToggle: TextView
    private lateinit var customInput: EditText
    private lateinit var customStatus: TextView
    private lateinit var restoreButton: TextView
    private lateinit var removeButton: TextView
    private lateinit var voiceButton: TextView
    private lateinit var voiceStatus: TextView

    private var listExpanded = false
    private var themeExpanded = false

    private val mainHandler = Handler(Looper.getMainLooper())
    private var speechRecognizer: SpeechRecognizer? = null
    private var voiceRequested = false
    private var speechLanguageIndex = 0
    private var restartCount = 0
    private var countedSpeechMatches = 0
    private var partialSpeechText = ""
    private val finalSpeechSegments = mutableListOf<String>()
    private var restartRunnable: Runnable? = null
    private val speechLanguages = listOf("ar-MA", "ar-SA", "ar")
    private val permissionRequestCode = 915

    private val palette: ThemeSpec
        get() = themes.firstOrNull { it.key == themeKey } ?: themes.first()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.decorView.layoutDirection = View.LAYOUT_DIRECTION_RTL
        officialDhikrs = loadOfficialCatalog()
        loadEncryptedState()
        applyWindowTheme()
        setContentView(buildScreen())
        updateCounter()
        updateSelectedPhrase()
        renderDhikrList()
        if (!storageAvailable) {
            customStatus.text = storageFailureMessage
        }
    }

    override fun onPause() {
        stopVoice("توقف العد الصوتي عند مغادرة شاشة السبحة.")
        super.onPause()
    }

    override fun onDestroy() {
        stopVoice(null)
        speechRecognizer?.destroy()
        speechRecognizer = null
        super.onDestroy()
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != permissionRequestCode) return
        if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            startVoice()
        } else {
            setVoiceStatus("لم يُسمح باستخدام الميكروفون. يمكنك متابعة العد اليدوي.", true)
        }
    }

    private fun loadOfficialCatalog(): List<DhikrItem> {
        return runCatching {
            val raw = assets.open("official-adhkar.json").bufferedReader().use { it.readText() }
            val array = JSONArray(raw)
            buildList {
                for (index in 0 until array.length()) {
                    val item = array.optJSONObject(index) ?: continue
                    val id = item.optString("id").takeIf { it.isNotBlank() } ?: continue
                    val title = item.optString("title").trim()
                    val text = item.optString("text").trim()
                    val period = item.optString("period").trim()
                    if (title.isBlank() || text.isBlank() || period.isBlank()) continue
                    val fixedCount = if (item.has("count") && !item.isNull("count")) {
                        item.optInt("count").takeIf { it > 0 }
                    } else null
                    add(
                        DhikrItem(
                            id = id,
                            title = title,
                            text = text,
                            period = period,
                            count = fixedCount,
                            occasion = item.optString("occasion", ""),
                            source = item.optString("source", "")
                        )
                    )
                }
            }
        }.getOrElse {
            // The bundled workflow generates the complete catalog. This small
            // offline fallback keeps the manual counter usable in development
            // builds where the generation step has not been run yet.
            listOf(
                DhikrItem("tasbih-after-prayer", "سبحان الله", "سُبْحَانَ اللَّهِ.", "tasbih", count = 33, occasion = "بعد كل صلاة مفروضة", source = "صحيح مسلم 597"),
                DhikrItem("tahmid-after-prayer", "الحمد لله", "الْحَمْدُ لِلَّهِ.", "tasbih", count = 33, occasion = "بعد كل صلاة مفروضة", source = "صحيح مسلم 597"),
                DhikrItem("takbir-after-prayer", "الله أكبر", "اللَّهُ أَكْبَرُ.", "tasbih", count = 33, occasion = "بعد كل صلاة مفروضة", source = "صحيح مسلم 597"),
                DhikrItem("tahlil-complete-hundred", "تهليل تمام المائة", "لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ.", "tasbih", count = 1, source = "صحيح مسلم 597"),
                DhikrItem("tasbih-hundred-daily", "سبحان الله وبحمده", "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ.", "tasbih", count = 100, occasion = "خلال اليوم", source = "صحيح مسلم 2691؛ صحيح مسلم 2692"),
                DhikrItem("tahlil-hundred-daily", "لا إله إلا الله وحده مائة مرة", "لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ.", "tasbih", count = 100, occasion = "خلال اليوم", source = "صحيح مسلم 2691"),
                DhikrItem("four-beloved-words", "الكلمات الأربع المحبوبة", "سُبْحَانَ اللَّهِ، وَالْحَمْدُ لِلَّهِ، وَلَا إِلَٰهَ إِلَّا اللَّهُ، وَاللَّهُ أَكْبَرُ.", "tasbih", occasion = "ذكر مطلق؛ لم يحدد الحديث عدداً", source = "صحيح مسلم 2137"),
                DhikrItem("hawqala-open", "لا حول ولا قوة إلا بالله", "لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ.", "tasbih", occasion = "ذكر مطلق؛ لم يحدد الحديث عدداً", source = "صحيح البخاري 6384"),
                DhikrItem("dua-after-prayer", "اللهم أعني على ذكرك وشكرك", "اللَّهُمَّ أَعِنِّي عَلَىٰ ذِكْرِكَ، وَشُكْرِكَ، وَحُسْنِ عِبَادَتِكَ.", "tasbih", count = 1, occasion = "بعد كل صلاة", source = "سنن أبي داود 1522")
            )
        }
    }

    private fun loadEncryptedState() {
        val envelope = preferences.getString(STATE_KEY, null) ?: return
        try {
            val raw = decryptState(envelope)
            val json = JSONObject(String(raw, StandardCharsets.UTF_8))
            count = json.optInt("count", 0).coerceIn(0, MAX_COUNT)
            themeKey = json.optString("theme", "emerald")
                .takeIf { value -> themes.any { it.key == value } } ?: "emerald"
            customDhikrs.clear()
            val custom = json.optJSONArray("customDhikrs") ?: JSONArray()
            for (index in 0 until custom.length()) {
                val value = custom.optString(index).replace(WHITESPACE, " ").trim()
                if (value.isNotBlank() && value.length <= MAX_CUSTOM_LENGTH &&
                    !customDhikrs.contains(value) && customDhikrs.size < MAX_CUSTOM_DHIKRS
                ) customDhikrs.add(value)
            }
            removedDhikrs.clear()
            val removed = json.optJSONArray("removedDhikrs") ?: JSONArray()
            for (index in 0 until removed.length()) {
                val value = removed.optString(index)
                if (value.isNotBlank() && value.length <= 4000 && removedDhikrs.size < 60) {
                    removedDhikrs.add(value)
                }
            }
            selectedKey = json.optString("selectedKey", selectedKey)
            selectedTitle = json.optString("selectedTitle", selectedTitle)
            selectedText = json.optString("selectedText", selectedText)
            if (selectedText.isBlank() || selectedText.length > MAX_SELECTED_TEXT) {
                selectedKey = "builtin:legacy-default"
                selectedTitle = "سبوح قدوس رب الملائكة والروح"
                selectedText = "سبوح قدوس رب الملائكة والروح."
            }
            if (selectedKey.startsWith("custom:") && !customDhikrs.contains(selectedText)) {
                selectedKey = "builtin:legacy-default"
                selectedTitle = "سبوح قدوس رب الملائكة والروح"
                selectedText = "سبوح قدوس رب الملائكة والروح."
            }
        } catch (error: Exception) {
            storageAvailable = false
            storageFailureMessage = "تعذر فك تشفير إعدادات السبحة. أبقينا السجل المشفر كما هو ولم نكتب فوقه."
        }
    }

    private fun saveEncryptedState(): Boolean {
        if (!storageAvailable) {
            customStatus.text = storageFailureMessage
            return false
        }
        return try {
            val json = JSONObject()
                .put("count", count.coerceIn(0, MAX_COUNT))
                .put("selectedKey", selectedKey)
                .put("selectedTitle", selectedTitle)
                .put("selectedText", selectedText)
                .put("theme", themeKey)
            val custom = JSONArray()
            customDhikrs.take(MAX_CUSTOM_DHIKRS).forEach { custom.put(it) }
            val removed = JSONArray()
            removedDhikrs.take(60).forEach { removed.put(it) }
            json.put("customDhikrs", custom)
                .put("removedDhikrs", removed)

            val plain = json.toString().toByteArray(StandardCharsets.UTF_8)
            val encrypted = encryptState(plain)
            if (!preferences.edit().putString(STATE_KEY, encrypted).commit()) {
                throw IllegalStateException("تعذر تثبيت سجل السبحة في التخزين المحلي.")
            }
            val saved = preferences.getString(STATE_KEY, null)
                ?: throw IllegalStateException("لم نعثر على السجل الذي حُفظ.")
            val verified = decryptState(saved)
            if (!verified.contentEquals(plain)) {
                throw IllegalStateException("لم تتطابق مراجعة السجل المشفر مع البيانات الأصلية.")
            }
            true
        } catch (error: Exception) {
            storageFailureMessage = "تعذر حفظ التغيير المشفر. لم نحذف السجل السابق."
            customStatus.text = storageFailureMessage
            false
        }
    }

    private fun getKeystoreKey(createIfMissing: Boolean): SecretKey {
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        val existing = keyStore.getKey(KEY_ALIAS, null) as? SecretKey
        if (existing != null) return existing
        if (!createIfMissing) throw IllegalStateException("مفتاح تشفير السبحة غير متاح.")
        val generator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            "AndroidKeyStore"
        )
        generator.init(
            KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build()
        )
        return generator.generateKey()
    }

    private fun encryptState(plain: ByteArray): String {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, getKeystoreKey(true))
        val encrypted = cipher.doFinal(plain)
        val iv = cipher.iv
        require(iv.isNotEmpty() && iv.size <= 32)
        val envelope = ByteBuffer.allocate(1 + iv.size + encrypted.size)
            .put(iv.size.toByte())
            .put(iv)
            .put(encrypted)
            .array()
        return Base64.encodeToString(envelope, Base64.NO_WRAP)
    }

    private fun decryptState(encoded: String): ByteArray {
        val envelope = Base64.decode(encoded, Base64.NO_WRAP)
        require(envelope.size > 14) { "سجل السبحة المشفر غير مكتمل." }
        val ivLength = envelope[0].toInt() and 0xff
        require(ivLength in 12..32 && envelope.size > 1 + ivLength + 16) {
            "صيغة سجل السبحة المشفر غير صحيحة."
        }
        val iv = envelope.copyOfRange(1, 1 + ivLength)
        val ciphertext = envelope.copyOfRange(1 + ivLength, envelope.size)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(
            Cipher.DECRYPT_MODE,
            getKeystoreKey(false),
            GCMParameterSpec(128, iv)
        )
        return cipher.doFinal(ciphertext)
    }

    private fun buildScreen(): View {
        val scroll = ScrollView(this).apply {
            setBackgroundColor(palette.background)
            isFillViewport = true
            clipToPadding = false
        }
        rootContent = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            setPadding(dp(13), dp(16), dp(13), dp(28))
        }
        scroll.addView(rootContent)

        val outer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            setPadding(dp(11), dp(11), dp(11), dp(14))
            background = rounded(palette.surface, 24, palette.border, 2)
            elevation = dp(2).toFloat()
        }
        rootContent.addView(outer)

        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            setPadding(dp(9), dp(10), dp(9), dp(10))
            background = GradientDrawable(
                GradientDrawable.Orientation.LEFT_RIGHT,
                intArrayOf(palette.accent, blend(palette.accent, Color.BLACK, 0.18f))
            ).apply {
                cornerRadius = dp(17).toFloat()
                setStroke(dp(1), palette.border)
            }
        }
        val back = actionButton("‹  العودة", palette.surface, palette.text, 11f) { finish() }
        header.addView(back, LinearLayout.LayoutParams(dp(82), dp(41)))
        header.addView(textView(
            "السبحة الإلكترونية",
            18f,
            Color.WHITE,
            true,
            Gravity.CENTER
        ), LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        themeToggle = actionButton("⚙", palette.accentSoft, palette.text, 19f) {
            themeExpanded = !themeExpanded
            themePanel.visibility = if (themeExpanded) View.VISIBLE else View.GONE
            themeToggle.text = if (themeExpanded) "×" else "⚙"
        }
        header.addView(themeToggle, LinearLayout.LayoutParams(dp(42), dp(41)))
        outer.addView(header)

        themePanel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            setPadding(dp(10), dp(9), dp(10), dp(9))
            background = rounded(palette.background, 13, palette.border)
            visibility = if (themeExpanded) View.VISIBLE else View.GONE
        }
        themePanel.addView(textView("ألوان السبحة", 13f, palette.text, true))
        themePanel.addView(textView(
            "اختر المظهر الذي يريح عينك",
            10f,
            palette.muted,
            false,
            Gravity.END,
            top = 3,
            bottom = 7
        ))
        themes.chunked(3).forEach { rowThemes ->
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                layoutDirection = View.LAYOUT_DIRECTION_RTL
            }
            rowThemes.forEach { spec ->
                val choice = actionButton(
                    (if (spec.key == themeKey) "✓  " else "") + spec.label,
                    spec.surface,
                    spec.text,
                    10f
                ) { chooseTheme(spec.key) }
                choice.background = rounded(
                    spec.surface,
                    11,
                    if (spec.key == themeKey) spec.accent else spec.border,
                    if (spec.key == themeKey) 2 else 1
                )
                row.addView(choice, LinearLayout.LayoutParams(0, dp(47), 1f).apply {
                    marginStart = dp(3)
                    marginEnd = dp(3)
                    topMargin = dp(4)
                })
            }
            themePanel.addView(row)
        }
        outer.addView(themePanel, marginTop(9))

        // Keep the selected dhikr inscription compact and visually integrated
        // with the bead ring; use Android's Arabic sans family, never the bulky
        // Amiri heading face that was rejected in the previous tasbih design.
        phraseView = textView(
            selectedText,
            17f,
            palette.text,
            true,
            Gravity.CENTER,
            top = 14,
            bottom = 4
        ).apply {
            setLineSpacing(dp(3).toFloat(), 1f)
        }
        outer.addView(phraseView)

        val ornament = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            layoutDirection = View.LAYOUT_DIRECTION_LTR
            setPadding(dp(20), dp(2), dp(20), dp(8))
        }
        ornament.addView(View(this).apply { setBackgroundColor(palette.border) },
            LinearLayout.LayoutParams(0, dp(1), 1f))
        ornament.addView(textView("✿", 17f, palette.accent, true, Gravity.CENTER),
            LinearLayout.LayoutParams(dp(34), dp(24)))
        ornament.addView(View(this).apply { setBackgroundColor(palette.border) },
            LinearLayout.LayoutParams(0, dp(1), 1f))
        outer.addView(ornament)

        listToggle = actionButton(
            "☷  اختيار الذكر  ⌄",
            palette.background,
            palette.text,
            12f
        ) {
            listExpanded = !listExpanded
            listPanel.visibility = if (listExpanded) View.VISIBLE else View.GONE
            listToggle.text = if (listExpanded) "☷  إخفاء قائمة الأذكار  ⌃" else "☷  اختيار الذكر  ⌄"
        }
        outer.addView(listToggle, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            dp(42)
        ).apply {
            gravity = Gravity.CENTER_HORIZONTAL
            leftMargin = dp(35)
            rightMargin = dp(35)
            bottomMargin = dp(8)
        })

        listPanel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            setPadding(dp(9), dp(9), dp(9), dp(9))
            background = rounded(palette.background, 14, palette.border)
            visibility = if (listExpanded) View.VISIBLE else View.GONE
        }
        listContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
        }
        listPanel.addView(listContainer)

        listPanel.addView(textView(
            "إضافة ذكر خاص",
            12f,
            palette.text,
            true,
            top = 11,
            bottom = 5
        ))
        val customRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
        }
        customInput = EditText(this).apply {
            textSize = 13f
            setTextColor(palette.text)
            setHintTextColor(palette.muted)
            hint = "اكتب الذكر هنا"
            gravity = Gravity.CENTER_VERTICAL or Gravity.END
            textAlignment = View.TEXT_ALIGNMENT_VIEW_END
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
            filters = arrayOf(InputFilter.LengthFilter(MAX_CUSTOM_LENGTH))
            setSingleLine(true)
            setPadding(dp(10), dp(8), dp(10), dp(8))
            background = rounded(palette.surface, 11, palette.border)
        }
        customRow.addView(customInput, LinearLayout.LayoutParams(0, dp(43), 1f).apply {
            marginEnd = dp(5)
        })
        customRow.addView(actionButton("إضافة", palette.accent, Color.WHITE, 11f) {
            addCustomDhikr()
        }, LinearLayout.LayoutParams(dp(76), dp(43)))
        listPanel.addView(customRow)

        customStatus = textView("", 10f, palette.muted, false, top = 5)
        listPanel.addView(customStatus)
        listPanel.addView(textView(
            "حتى 30 ذكراً مخصصاً، وبحد أقصى 200 محرف لكل ذكر.",
            9f,
            palette.muted,
            false,
            top = 2
        ))
        removeButton = actionButton("إزالة الذكر المحدد", palette.surface, palette.text, 10f) {
            removeSelectedDhikr()
        }
        listPanel.addView(removeButton, marginTop(8))
        restoreButton = actionButton("استعادة الأذكار التي أزيلت", palette.accentSoft, palette.text, 10f) {
            restoreRemovedDhikrs()
        }
        listPanel.addView(restoreButton, marginTop(6))
        listPanel.addView(textView(
            "الإزالة تخص قائمتك على هذا الجهاز فقط، ويمكنك استعادة الأذكار الرسمية متى شئت.",
            9f,
            palette.muted,
            false,
            top = 6
        ))
        outer.addView(listPanel)

        val stage = FrameLayout(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(330)
            ).apply {
                topMargin = dp(5)
                bottomMargin = dp(3)
            }
        }
        beadRing = BeadRingView(this).apply {
            setProgress(count)
            contentDescription = "حلقة السبحة المكونة من 33 حبة"
        }
        stage.addView(beadRing, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ))
        counterCenter = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            setPadding(dp(14), dp(10), dp(14), dp(10))
            background = counterBackground()
            isClickable = true
            isFocusable = true
            contentDescription = "عداد السبحة: اضغط للزيادة"
            setOnClickListener {
                animate().cancel()
                scaleX = 0.97f
                scaleY = 0.97f
                animate().scaleX(1f).scaleY(1f).setDuration(150).start()
                addCount(1)
            }
            setOnKeyListener { _, keyCode, event ->
                if (event.action == android.view.KeyEvent.ACTION_UP &&
                    (keyCode == android.view.KeyEvent.KEYCODE_ENTER ||
                        keyCode == android.view.KeyEvent.KEYCODE_SPACE)
                ) {
                    addCount(1)
                    true
                } else false
            }
        }
        countView = textView(
            arabicNumber(count),
            49f,
            palette.accent,
            true,
            Gravity.CENTER
        )
        counterCenter.addView(countView)
        counterCenter.addView(textView("اضغط للعد", 10f, palette.muted, true, Gravity.CENTER))
        stage.addView(counterCenter, FrameLayout.LayoutParams(dp(236), dp(236), Gravity.CENTER))
        outer.addView(stage)

        val actions = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            layoutDirection = View.LAYOUT_DIRECTION_RTL
        }
        actions.addView(actionButton("−", palette.surface, palette.accent, 26f) {
            addCount(-1)
        }, LinearLayout.LayoutParams(dp(48), dp(46)).apply { marginEnd = dp(5) })
        actions.addView(actionButton("تصفير العد", palette.accent, Color.WHITE, 12f) {
            resetCount()
        }, LinearLayout.LayoutParams(dp(145), dp(46)).apply {
            marginStart = dp(5)
            marginEnd = dp(5)
        })
        outer.addView(actions, marginTop(2))

        val voiceCard = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            setPadding(dp(11), dp(10), dp(11), dp(10))
            background = rounded(palette.background, 14, palette.border)
        }
        val voiceRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
        }
        voiceButton = actionButton(
            if (voiceRequested) "إيقاف العد الصوتي" else "ابدأ العد الصوتي",
            palette.accent,
            Color.WHITE,
            11f
        ) { toggleVoice() }
        voiceRow.addView(voiceButton, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            dp(40)
        ))
        voiceRow.addView(textView(
            "العد بالنطق",
            12f,
            palette.text,
            true
        ), LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
            marginStart = dp(8)
        })
        voiceCard.addView(voiceRow)
        voiceStatus = textView(
            "انطق الذكر المختار كاملاً. لا تُعرض الكلمات المسموعة ولا تُحفظ في سجل السبحة.",
            10f,
            palette.muted,
            false,
            top = 6
        )
        voiceCard.addView(voiceStatus)
        voiceCard.addView(textView(
            "يتطلب إذن الميكروفون وخدمة التعرف الصوتي في الجهاز؛ وقد تتطلب الخدمة اتصالاً بالإنترنت حسب مزودها.",
            9f,
            palette.muted,
            false,
            top = 5
        ))
        outer.addView(voiceCard, marginTop(12))

        rootContent.addView(textView(
            if (storageAvailable) {
                "حفظ محلي مشفّر على الجهاز. تبقى بيانات السبحة القديمة في شاشة المفكرة الكاملة إلى أن ننفذ استيراداً آمناً لها."
            } else {
                storageFailureMessage
            },
            10f,
            palette.muted,
            false,
            Gravity.CENTER,
            top = 12
        ))

        return scroll
    }

    private fun renderDhikrList() {
        if (!::listContainer.isInitialized) return
        listContainer.removeAllViews()

        val periods = listOf(
            "tasbih" to "أذكار السبحة الرسمية",
            "morning" to "أذكار الصباح الرسمية",
            "evening" to "أذكار المساء الرسمية",
            "daily" to "أذكار يومية"
        )

        periods.forEach { (period, title) ->
            val items = officialDhikrs.filter {
                it.period == period && !removedDhikrs.contains("official:" + it.id)
            }
            if (items.isNotEmpty()) addDhikrSection(title, items, true)
        }

        builtInDhikrs.groupBy { it.category }.forEach { (category, items) ->
            val visible = items.filter { !removedDhikrs.contains("builtin:" + it.id) }
            if (visible.isNotEmpty()) addDhikrSection(category, visible, false)
        }

        if (customDhikrs.isNotEmpty()) {
            val customItems = customDhikrs.mapIndexed { index, value ->
                DhikrItem("custom-$index", value, value, "custom", "أذكاري المضافة")
            }
            addDhikrSection("أذكاري المضافة", customItems, false, custom = true)
        }

        if (listContainer.childCount == 0) {
            listContainer.addView(textView(
                "القائمة فارغة. يمكنك إضافة ذكر خاص أو استعادة الأذكار التي أزلتها.",
                11f,
                palette.muted,
                false,
                Gravity.CENTER,
                top = 8,
                bottom = 8
            ))
        }
        restoreButton.visibility = if (removedDhikrs.isEmpty()) View.GONE else View.VISIBLE
        removeButton.isEnabled = selectedKey.isNotBlank()
        removeButton.alpha = if (selectedKey.isNotBlank()) 1f else 0.45f
    }

    private fun addDhikrSection(
        title: String,
        items: List<DhikrItem>,
        official: Boolean,
        custom: Boolean = false
    ) {
        listContainer.addView(textView(
            title,
            11f,
            palette.accent,
            true,
            top = 9,
            bottom = 5
        ))
        items.forEach { item ->
            val key = when {
                custom -> "custom:" + item.text
                official -> "official:" + item.id
                else -> "builtin:" + item.id
            }
            val selected = key == selectedKey
            val card = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                layoutDirection = View.LAYOUT_DIRECTION_RTL
                setPadding(dp(10), dp(9), dp(10), dp(9))
                background = rounded(
                    if (selected) palette.accentSoft else palette.surface,
                    11,
                    if (selected) palette.accent else palette.border,
                    if (selected) 2 else 1
                )
                isClickable = true
                isFocusable = true
                setOnClickListener { chooseDhikr(key, item) }
            }
            card.addView(textView(item.title, 12f, palette.text, true))
            if (item.text != item.title || official) {
                card.addView(textView(
                    item.text,
                    11f,
                    palette.text,
                    false,
                    top = 4
                ).apply { setLineSpacing(dp(2).toFloat(), 1f) })
            }
            if (official) {
                val details = mutableListOf<String>()
                if (item.occasion.isNotBlank()) details.add(item.occasion)
                details.add(item.count?.let { arabicNumber(it) + " مرة" } ?: "غير محدد العدد")
                if (item.source.isNotBlank()) details.add(item.source)
                card.addView(textView(
                    details.joinToString("  •  "),
                    9f,
                    palette.muted,
                    false,
                    top = 5
                ))
            }
            if (selected) {
                card.addView(textView("الذكر المحدد", 9f, palette.accent, true, top = 4))
            }
            listContainer.addView(card, marginTop(5))
        }
    }

    private fun chooseDhikr(key: String, item: DhikrItem) {
        if (voiceRequested) stopVoice("توقف العد الصوتي لأن الذكر المختار تغيّر.")
        selectedKey = key
        selectedTitle = item.title
        selectedText = item.text
        count = 0
        listExpanded = false
        listPanel.visibility = View.GONE
        listToggle.text = "☷  اختيار الذكر  ⌄"
        saveEncryptedState()
        updateSelectedPhrase()
        updateCounter()
        renderDhikrList()
        customStatus.text = "تم اختيار الذكر."
    }

    private fun updateSelectedPhrase() {
        if (::phraseView.isInitialized) phraseView.text = selectedText
        if (::counterCenter.isInitialized) {
            counterCenter.contentDescription = "عداد السبحة: " + arabicNumber(count) +
                ". الذكر المحدد: " + selectedTitle + ". اضغط للزيادة."
        }
    }

    private fun addCount(amount: Int) {
        count = (count.toLong() + amount.toLong()).coerceIn(0L, MAX_COUNT.toLong()).toInt()
        saveEncryptedState()
        updateCounter()
        updateSelectedPhrase()
    }

    private fun resetCount() {
        count = 0
        saveEncryptedState()
        updateCounter()
        updateSelectedPhrase()
    }

    private fun updateCounter() {
        if (::countView.isInitialized) countView.text = arabicNumber(count)
        if (::beadRing.isInitialized) {
            beadRing.setProgress(count)
            beadRing.contentDescription =
                "حبات السبحة المضيئة: " + arabicNumber(completedBeads()) + " من 33"
        }
    }

    private fun completedBeads(): Int {
        if (count <= 0) return 0
        return (count % BEAD_COUNT).let { if (it == 0) BEAD_COUNT else it }
    }

    private fun addCustomDhikr() {
        val value = customInput.text.toString().replace(WHITESPACE, " ").trim()
        if (value.isBlank()) {
            customStatus.text = "اكتب الذكر أولاً."
            customInput.requestFocus()
            return
        }
        if (value.length > MAX_CUSTOM_LENGTH) {
            customStatus.text = "الحد الأقصى لطول الذكر هو 200 محرف."
            return
        }

        val removedOfficial = officialDhikrs.firstOrNull {
            it.text == value && removedDhikrs.contains("official:" + it.id)
        }
        if (removedOfficial != null) {
            removedDhikrs.remove("official:" + removedOfficial.id)
            customInput.setText("")
            chooseDhikr("official:" + removedOfficial.id, removedOfficial)
            customStatus.text = "أُعيد الذكر الرسمي."
            return
        }

        val alreadyVisible = visibleDhikrs().firstOrNull { it.text == value }
        if (alreadyVisible != null) {
            customInput.setText("")
            chooseDhikr(dhikrKey(alreadyVisible), alreadyVisible)
            customStatus.text = "الذكر موجود في القائمة."
            return
        }

        if (customDhikrs.contains(value)) {
            customInput.setText("")
            val item = DhikrItem("custom", value, value, "custom", "أذكاري المضافة")
            chooseDhikr("custom:" + value, item)
            customStatus.text = "الذكر موجود."
            return
        }
        if (customDhikrs.size >= MAX_CUSTOM_DHIKRS) {
            customStatus.text = "وصلت إلى الحد الأقصى وهو 30 ذكراً مضافاً."
            return
        }

        customDhikrs.add(value)
        customInput.setText("")
        val item = DhikrItem("custom", value, value, "custom", "أذكاري المضافة")
        chooseDhikr("custom:" + value, item)
        customStatus.text = "تمت الإضافة وحُفظ الذكر."
    }

    private fun removeSelectedDhikr() {
        if (voiceRequested) stopVoice("توقف العد الصوتي بسبب تعديل قائمة الأذكار.")
        when {
            selectedKey.startsWith("custom:") -> {
                customDhikrs.remove(selectedText)
                customStatus.text = "تم حذف الذكر المخصص."
            }
            selectedKey.startsWith("official:") || selectedKey.startsWith("builtin:") -> {
                if (!removedDhikrs.contains(selectedKey)) removedDhikrs.add(selectedKey)
                customStatus.text = "أُزيل الذكر من قائمتك على هذا الجهاز. يمكنك استعادته."
            }
            else -> return
        }
        selectFirstVisibleDhikr()
        count = 0
        saveEncryptedState()
        updateSelectedPhrase()
        updateCounter()
        renderDhikrList()
    }

    private fun restoreRemovedDhikrs() {
        if (removedDhikrs.isEmpty()) return
        if (voiceRequested) stopVoice("توقف العد الصوتي بسبب استعادة قائمة الأذكار.")
        removedDhikrs.clear()
        if (visibleDhikrs().none { dhikrKey(it) == selectedKey }) {
            selectFirstVisibleDhikr()
        }
        count = 0
        saveEncryptedState()
        updateSelectedPhrase()
        updateCounter()
        renderDhikrList()
        customStatus.text = "تمت استعادة الأذكار الرسمية والمختارة."
    }

    private fun visibleDhikrs(): List<DhikrItem> {
        val officialOrder = listOf("tasbih", "morning", "evening", "daily")
            .flatMap { period ->
                officialDhikrs.filter {
                    it.period == period && !removedDhikrs.contains("official:" + it.id)
                }
            }
        val builtIns = builtInDhikrs.filter { !removedDhikrs.contains("builtin:" + it.id) }
        val custom = customDhikrs.map {
            DhikrItem("custom", it, it, "custom", "أذكاري المضافة")
        }
        return officialOrder + builtIns + custom
    }

    private fun dhikrKey(item: DhikrItem): String {
        return when {
            item.period == "custom" -> "custom:" + item.text
            officialDhikrs.any { it.id == item.id } -> "official:" + item.id
            else -> "builtin:" + item.id
        }
    }

    private fun selectFirstVisibleDhikr() {
        val first = visibleDhikrs().firstOrNull()
        if (first == null) {
            selectedKey = ""
            selectedTitle = ""
            selectedText = ""
            return
        }
        selectedKey = dhikrKey(first)
        selectedTitle = first.title
        selectedText = first.text
    }

    private fun chooseTheme(nextTheme: String) {
        if (themes.none { it.key == nextTheme }) return
        themeKey = nextTheme
        themeExpanded = false
        saveEncryptedState()
        applyWindowTheme()
        setContentView(buildScreen())
        updateCounter()
        updateSelectedPhrase()
        renderDhikrList()
        if (!storageAvailable) customStatus.text = storageFailureMessage
    }

    private fun applyWindowTheme() {
        window.statusBarColor = blend(palette.background, palette.text, 0.12f)
        window.navigationBarColor = blend(palette.background, palette.text, 0.12f)
    }

    private fun toggleVoice() {
        if (voiceRequested) {
            stopVoice("تم إيقاف العد الصوتي.")
            return
        }
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), permissionRequestCode)
            return
        }
        startVoice()
    }

    private fun startVoice() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            setVoiceStatus("خدمة التعرف الصوتي غير متاحة على هذا الجهاز. يمكنك متابعة العد اليدوي.", true)
            return
        }
        if (selectedText.isBlank()) {
            setVoiceStatus("اختر ذكراً قبل بدء العد الصوتي.", true)
            return
        }
        try {
            if (speechRecognizer == null) {
                speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this)
                speechRecognizer?.setRecognitionListener(recognitionListener)
            }
            voiceRequested = true
            speechLanguageIndex = 0
            restartCount = 0
            countedSpeechMatches = 0
            partialSpeechText = ""
            finalSpeechSegments.clear()
            setVoiceStatus("جارٍ تشغيل الميكروفون.", false)
            startListeningSession()
        } catch (error: Exception) {
            voiceRequested = false
            setVoiceStatus("تعذر تهيئة التعرف الصوتي. يمكنك متابعة العد اليدوي.", true)
        }
    }

    private val recognitionListener = object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) {
            if (voiceRequested) setVoiceStatus("الميكروفون نشط. انطق الذكر المختار كاملاً.", false)
        }

        override fun onBeginningOfSpeech() {
            restartCount = 0
            if (voiceRequested) setVoiceStatus("جارٍ الاستماع والتحقق من الذكر.", false)
        }

        override fun onRmsChanged(rmsdB: Float) = Unit
        override fun onBufferReceived(buffer: ByteArray?) = Unit
        override fun onEndOfSpeech() {
            if (voiceRequested) setVoiceStatus("جارٍ التحقق من الذكر المنطوق.", false)
        }

        override fun onError(error: Int) {
            if (!voiceRequested) return
            if (error == SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED &&
                speechLanguageIndex < speechLanguages.lastIndex
            ) {
                speechLanguageIndex++
                setVoiceStatus("لغة التعرف الأولى غير متاحة؛ نجرب إعداداً عربياً آخر.", false)
                scheduleVoiceRestart(250, countRetry = false)
                return
            }
            val recoverable = error == SpeechRecognizer.ERROR_NO_MATCH ||
                error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT ||
                error == SpeechRecognizer.ERROR_NETWORK ||
                error == SpeechRecognizer.ERROR_NETWORK_TIMEOUT ||
                error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY ||
                error == SpeechRecognizer.ERROR_SERVER ||
                error == SpeechRecognizer.ERROR_SERVER_DISCONNECTED
            if (recoverable) {
                val message = when (error) {
                    SpeechRecognizer.ERROR_NO_MATCH,
                    SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "لم نلتقط الذكر بوضوح؛ سنعيد الاستماع تلقائياً."
                    SpeechRecognizer.ERROR_NETWORK,
                    SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "انقطع اتصال خدمة التعرف الصوتي؛ سنحاول مجدداً."
                    else -> "انتهت جلسة الاستماع؛ جارٍ استئنافها."
                }
                scheduleVoiceRestart(400, countRetry = true, message = message)
            } else {
                val message = when (error) {
                    SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "لم يُسمح بالميكروفون. راجع أذونات التطبيق."
                    SpeechRecognizer.ERROR_AUDIO -> "تعذر الوصول إلى الميكروفون."
                    else -> "تعذر استمرار التعرف الصوتي. أوقفه ثم حاول مرة أخرى."
                }
                stopVoice(message)
            }
        }

        override fun onResults(results: Bundle?) {
            if (!voiceRequested) return
            processSpeechResults(results, finalResult = true)
            scheduleVoiceRestart(350, countRetry = false)
        }

        override fun onPartialResults(partialResults: Bundle?) {
            if (!voiceRequested) return
            processSpeechResults(partialResults, finalResult = false)
        }

        override fun onEvent(eventType: Int, params: Bundle?) = Unit
    }

    private fun startListeningSession() {
        if (!voiceRequested) return
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, speechLanguages[speechLanguageIndex])
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, speechLanguages[speechLanguageIndex])
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
            putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, packageName)
        }
        try {
            speechRecognizer?.startListening(intent)
        } catch (error: Exception) {
            scheduleVoiceRestart(500, countRetry = true, message = "تعذر بدء جلسة الاستماع؛ سنحاول مرة أخرى.")
        }
    }

    private fun processSpeechResults(bundle: Bundle?, finalResult: Boolean) {
        val candidates = bundle?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
            ?.filter { it.isNotBlank() } ?: return
        val candidate = bestSpeechCandidate(candidates, selectedText)
        if (candidate.isBlank()) return
        if (finalResult) {
            finalSpeechSegments.add(candidate)
            if (finalSpeechSegments.size > 20) {
                finalSpeechSegments.removeAt(0)
            }
            partialSpeechText = ""
        } else {
            partialSpeechText = candidate
        }
        val completeText = (finalSpeechSegments + listOf(partialSpeechText))
            .filter { it.isNotBlank() }
            .joinToString(" ")
        val totalMatches = countPhraseMatches(completeText, selectedText)
        val newMatches = (totalMatches - countedSpeechMatches).coerceAtLeast(0)
        if (newMatches > 0) {
            countedSpeechMatches = totalMatches
            addCount(newMatches)
            setVoiceStatus(
                "تم احتساب " + arabicNumber(newMatches) + " تسبيحة.",
                false
            )
        } else if (finalResult) {
            setVoiceStatus("تم التحقق من نتيجة الاستماع. واصل النطق بالذكر كاملاً.", false)
        }
    }

    private fun bestSpeechCandidate(candidates: List<String>, phrase: String): String {
        val target = normalizeSpeech(phrase).split(" ").filter { it.isNotBlank() }
        return candidates.maxByOrNull { candidate ->
            val heard = normalizeSpeech(candidate).split(" ").filter { it.isNotBlank() }
            val overlap = target.count { heard.contains(it) }
            val matches = countPhraseMatches(candidate, phrase)
            matches * 10000 + overlap * 100 - kotlin.math.abs(target.size - heard.size)
        }.orEmpty()
    }

    private fun normalizeSpeech(value: String): String {
        val withoutMarks = Normalizer.normalize(value.lowercase(), Normalizer.Form.NFD)
            .replace(Regex("[\\u064B-\\u065F\\u0670\\u06D6-\\u06ED\\uFE00-\\uFE0F]"), "")
        return withoutMarks
            .replace(Regex("[،؛؟٪٫٬۔,:;.!؟]+"), " ")
            .replace(Regex("[أإآٱ]"), "ا")
            .replace("ى", "ي")
            .replace("ة", "ه")
            .replace("ـ", "")
            .replace(Regex("[^\\u0600-\\u06FFa-z0-9\\s]", RegexOption.IGNORE_CASE), " ")
            .replace(WHITESPACE, " ")
            .trim()
    }

    private fun countPhraseMatches(transcript: String, phrase: String): Int {
        val heard = normalizeSpeech(transcript).split(" ").filter { it.isNotBlank() }
        val target = normalizeSpeech(phrase).split(" ").filter { it.isNotBlank() }
        if (target.isEmpty() || heard.size < target.size) return 0
        var matches = 0
        var index = 0
        while (index <= heard.size - target.size) {
            var same = true
            for (offset in target.indices) {
                if (heard[index + offset] != target[offset]) {
                    same = false
                    break
                }
            }
            if (same) {
                matches++
                index += target.size
            } else {
                index++
            }
        }
        return matches
    }

    private fun scheduleVoiceRestart(
        delayMillis: Long,
        countRetry: Boolean,
        message: String = "جارٍ استئناف التعرف الصوتي."
    ) {
        if (!voiceRequested || restartRunnable != null) return
        if (countRetry) {
            restartCount++
            if (restartCount >= MAX_VOICE_RETRIES) {
                stopVoice("انقطع التعرف الصوتي عدة مرات. اضغط إعادة المحاولة لبدء جلسة جديدة.")
                return
            }
        }
        setVoiceStatus(message, false)
        val runnable = Runnable {
            restartRunnable = null
            if (voiceRequested) startListeningSession()
        }
        restartRunnable = runnable
        mainHandler.postDelayed(runnable, delayMillis)
    }

    private fun stopVoice(message: String?) {
        val wasRequested = voiceRequested
        voiceRequested = false
        restartRunnable?.let { mainHandler.removeCallbacks(it) }
        restartRunnable = null
        try {
            speechRecognizer?.cancel()
        } catch (_: Exception) {
        }
        partialSpeechText = ""
        finalSpeechSegments.clear()
        countedSpeechMatches = 0
        restartCount = 0
        if (message != null && ::voiceStatus.isInitialized) {
            setVoiceStatus(message, false)
        } else if (wasRequested && ::voiceStatus.isInitialized) {
            setVoiceStatus("تم إيقاف العد الصوتي.", false)
        }
    }

    private fun setVoiceStatus(message: String, error: Boolean) {
        if (::voiceStatus.isInitialized) {
            voiceStatus.text = message
            voiceStatus.setTextColor(if (error) Color.rgb(158, 65, 57) else palette.muted)
        }
        if (::voiceButton.isInitialized) {
            voiceButton.text = if (voiceRequested) "إيقاف العد الصوتي" else "ابدأ العد الصوتي"
            voiceButton.isEnabled = true
            voiceButton.alpha = 1f
        }
    }

    private fun textView(
        value: String,
        size: Float,
        color: Int,
        bold: Boolean = false,
        gravityValue: Int = Gravity.END,
        top: Int = 0,
        bottom: Int = 0
    ): TextView = TextView(this).apply {
        text = value
        textSize = size
        setTextColor(color)
        gravity = gravityValue
        textAlignment = when (gravityValue) {
            Gravity.CENTER -> View.TEXT_ALIGNMENT_CENTER
            Gravity.START -> View.TEXT_ALIGNMENT_VIEW_START
            Gravity.END -> View.TEXT_ALIGNMENT_VIEW_END
            else -> View.TEXT_ALIGNMENT_GRAVITY
        }
        layoutDirection = View.LAYOUT_DIRECTION_RTL
        typeface = Typeface.create(
            "sans-serif",
            if (bold) Typeface.BOLD else Typeface.NORMAL
        )
        setPadding(0, dp(top), 0, dp(bottom))
    }

    private fun actionButton(
        label: String,
        backgroundColor: Int,
        textColor: Int,
        size: Float,
        onClick: () -> Unit
    ): TextView = TextView(this).apply {
        text = label
        textSize = size
        setTextColor(textColor)
        gravity = Gravity.CENTER
        textAlignment = View.TEXT_ALIGNMENT_CENTER
        layoutDirection = View.LAYOUT_DIRECTION_RTL
        typeface = Typeface.create("sans-serif", Typeface.BOLD)
        setPadding(dp(8), dp(7), dp(8), dp(7))
        background = rounded(backgroundColor, 12, palette.border)
        isClickable = true
        isFocusable = true
        setOnClickListener { onClick() }
    }

    /**
     * The royal counter keeps the deep emerald face and double antique-gold
     * rim from the approved web design, while each selectable theme supplies
     * its own accent. Insets create a second fine inner rim without an image
     * dependency, so the Android view remains crisp at every screen density.
     */
    private fun counterBackground(): LayerDrawable {
        val outer = GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            intArrayOf(
                blend(palette.accent, Color.BLACK, 0.38f),
                palette.accent,
                blend(palette.accent, Color.BLACK, 0.26f)
            )
        ).apply {
            shape = GradientDrawable.OVAL
            setStroke(dp(7), palette.border)
        }
        val inner = GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            intArrayOf(
                blend(palette.accent, palette.surface, 0.18f),
                blend(palette.accent, Color.BLACK, 0.08f),
                blend(palette.accent, Color.BLACK, 0.22f)
            )
        ).apply {
            shape = GradientDrawable.OVAL
            setStroke(dp(1), palette.accentSoft)
        }
        return LayerDrawable(arrayOf(outer, inner)).apply {
            setLayerInset(1, dp(9), dp(9), dp(9), dp(9))
        }
    }

    private fun rounded(
        color: Int,
        radius: Int,
        stroke: Int? = null,
        strokeWidth: Int = 1
    ) = GradientDrawable().apply {
        setColor(color)
        cornerRadius = dp(radius).toFloat()
        if (stroke != null) setStroke(dp(strokeWidth), stroke)
    }

    private fun marginTop(value: Int) = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
    ).apply { topMargin = dp(value) }

    private fun arabicNumber(value: Int): String {
        val digits = "٠١٢٣٤٥٦٧٨٩"
        return value.toString().map { char ->
            if (char in '0'..'9') digits[char - '0'] else char
        }.joinToString("")
    }

    private fun blend(foreground: Int, background: Int, amount: Float): Int {
        val ratio = amount.coerceIn(0f, 1f)
        val inverse = 1f - ratio
        return Color.rgb(
            (Color.red(foreground) * ratio + Color.red(background) * inverse).toInt(),
            (Color.green(foreground) * ratio + Color.green(background) * inverse).toInt(),
            (Color.blue(foreground) * ratio + Color.blue(background) * inverse).toInt()
        )
    }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density + 0.5f).toInt()

    private inner class BeadRingView(activity: Activity) : View(activity) {
        private val beadPaint = Paint(Paint.ANTI_ALIAS_FLAG)
        private val shadowPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.argb(62, 0, 20, 15)
        }
        private val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = dp(1).toFloat()
        }
        private var progress = 0

        fun setProgress(value: Int) {
            progress = value.coerceAtLeast(0)
            invalidate()
        }

        override fun onDraw(canvas: Canvas) {
            super.onDraw(canvas)
            val centerX = width / 2f
            val centerY = height / 2f
            val radius = (minOf(width, height) / 2f) - dp(15)
            val beadRadius = dp(8).toFloat()
            val lit = if (progress > 0) {
                (progress % BEAD_COUNT).let { if (it == 0) BEAD_COUNT else it }
            } else 0

            for (index in 0 until BEAD_COUNT) {
                val angle = -Math.PI / 2.0 + (2.0 * Math.PI * index / BEAD_COUNT)
                val x = centerX + kotlin.math.cos(angle).toFloat() * radius
                val y = centerY + kotlin.math.sin(angle).toFloat() * radius
                val isLit = index < lit

                // Soft lower shadow gives each bead a rounded, polished edge.
                canvas.drawCircle(x, y + dp(2), beadRadius, shadowPaint)

                val highlight = if (palette.key == "emerald" || palette.key == "heritage") {
                    Color.rgb(182, 208, 192)
                } else {
                    blend(palette.surface, palette.accent, 0.58f)
                }
                val middle = if (isLit) palette.tapEnd else palette.accent
                val deep = blend(palette.accent, Color.BLACK, 0.48f)
                val edge = blend(palette.accent, Color.BLACK, 0.76f)
                beadPaint.style = Paint.Style.FILL
                beadPaint.shader = RadialGradient(
                    x - beadRadius * 0.32f,
                    y - beadRadius * 0.38f,
                    beadRadius * 1.25f,
                    intArrayOf(highlight, middle, deep, edge),
                    floatArrayOf(0f, 0.36f, 0.73f, 1f),
                    Shader.TileMode.CLAMP
                )
                canvas.drawCircle(x, y, beadRadius, beadPaint)
                beadPaint.shader = null

                borderPaint.color = palette.border
                borderPaint.strokeWidth = dp(1).toFloat()
                canvas.drawCircle(x, y, beadRadius, borderPaint)

                if (isLit && index == lit - 1) {
                    borderPaint.color = palette.accentSoft
                    borderPaint.strokeWidth = dp(2).toFloat()
                    canvas.drawCircle(x, y, beadRadius + dp(3), borderPaint)
                    borderPaint.strokeWidth = dp(1).toFloat()
                }
            }
        }
    }

    companion object {
        private const val PREFS_NAME = "anwar_tasbih_secure_v1"
        private const val STATE_KEY = "tasbih_envelope_v1"
        private const val KEY_ALIAS = "anwar_mofakira_tasbih_aes_gcm_v1"
        private const val MAX_COUNT = 1_000_000_000
        private const val BEAD_COUNT = 33
        private const val MAX_CUSTOM_DHIKRS = 30
        private const val MAX_CUSTOM_LENGTH = 200
        private const val MAX_SELECTED_TEXT = 4000
        private const val MAX_VOICE_RETRIES = 4
        private val WHITESPACE = Regex("\\s+")
    }
}
