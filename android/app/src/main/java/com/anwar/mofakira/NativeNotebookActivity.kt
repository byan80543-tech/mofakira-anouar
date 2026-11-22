package com.anwar.mofakira

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.text.Html
import android.text.InputFilter
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.EditText
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.nio.ByteBuffer
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import java.security.SecureRandom
import java.text.DateFormat
import java.util.Date
import java.util.Calendar
import java.util.Locale
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.Mac
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties

/**
 * First native notebook milestone: private plain-text poems, texts and ideas.
 *
 * The previous encrypted Web/PWA vault is deliberately not accessed or changed.
 * Native records use an independent Android Keystore key and a verified,
 * encrypted backup-before-replace write sequence.
 */
class NativeNotebookActivity : Activity() {
    private data class HistoryVersion(
        val title: String,
        val type: String,
        val text: String,
        val updatedAt: Long,
        val font: String,
        val sizeSp: Int,
        val textColor: Int,
        val paper: String,
        val pinned: Boolean
    )

    private data class Note(
        val id: String,
        val title: String,
        val type: String,
        val text: String,
        val pinned: Boolean,
        val updatedAt: Long,
        val font: String,
        val sizeSp: Int,
        val textColor: Int,
        val paper: String,
        val history: List<HistoryVersion> = emptyList()
    )

    private val navy = Color.rgb(9, 38, 77)
    private val green = Color.rgb(13, 59, 50)
    private val gold = Color.rgb(201, 169, 106)
    private val cream = Color.rgb(247, 243, 234)
    private val ink = Color.rgb(35, 48, 58)
    private val muted = Color.rgb(101, 112, 120)
    private val border = Color.rgb(224, 216, 200)
    private val fontChoices = listOf("serif" to "نسخي", "sans-serif" to "حديث")
    private val textColorChoices = listOf(
        "ink" to "فحمي",
        "black" to "أسود",
        "navy" to "كحلي",
        "green" to "أخضر",
        "brown" to "بني",
        "wine" to "عنابي"
    )
    private val paperChoices = listOf(
        "plain" to "أبيض",
        "cream" to "كريمي",
        "parchment" to "رق",
        "mint" to "أخضر",
        "blue" to "أزرق",
        "rose" to "وردي"
    )

    private val notes = mutableListOf<Note>()
    private var activeFilter = "all"
    private var storageAvailable = true
    private var storageMessage = ""
    private var renderLimit = PAGE_SIZE
    private var pendingExportJson: String? = null
    private var pendingImportJson: String? = null

    private lateinit var rootContent: LinearLayout
    private lateinit var noteContainer: LinearLayout
    private lateinit var filterContainer: LinearLayout
    private lateinit var searchInput: EditText
    private lateinit var countLabel: TextView
    private lateinit var streakLabel: TextView
    private lateinit var addButton: TextView
    private lateinit var moreButton: TextView
    private lateinit var storageNotice: TextView
    private lateinit var importButton: TextView
    private lateinit var exportButton: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = navy
        window.navigationBarColor = navy
        window.decorView.layoutDirection = View.LAYOUT_DIRECTION_RTL

        try {
            loadNotes()
        } catch (error: Exception) {
            storageAvailable = false
            storageMessage = "تعذّر التحقق من سجل الكتابة المشفر. أوقفنا التعديل حمايةً لبياناتك، ولم نحذف السجل."
        }

        setContentView(buildScreen())
        renderFilters()
        renderNotes()
    }

    private fun buildScreen(): View {
        val shell = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            setBackgroundColor(Color.rgb(233, 236, 241))
        }

        val toolbar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            setPadding(dp(7), dp(7), dp(7), dp(7))
            background = rounded(intArrayOf(Color.rgb(8, 38, 76), Color.rgb(23, 77, 118)), 0)
        }
        toolbar.addView(toolbarIconButton("🔒", "قفل المفكرة المشفرة") {
            AlertDialog.Builder(this)
                .setTitle("قفل المفكرة المشفرة")
                .setMessage("تُحفظ أعمالك محليًا مشفرة على هذا الجهاز. إغلاق المفكرة يخفي محتواها من الشاشة.")
                .setNegativeButton("إلغاء", null)
                .setPositiveButton("إغلاق المفكرة") { _, _ -> finish() }
                .show()
        }, LinearLayout.LayoutParams(dp(39), dp(42)))

        val brand = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            layoutDirection = View.LAYOUT_DIRECTION_LTR
            setPadding(dp(5), 0, dp(5), 0)
        }
        brand.addView(text("مفكرة أنوار", 20f, Color.rgb(255, 242, 197), true).apply {
            gravity = Gravity.CENTER
            textAlignment = View.TEXT_ALIGNMENT_CENTER
        }, LinearLayout.LayoutParams(0, dp(42), 1f))
        brand.addView(text("✒", 23f, Color.rgb(231, 193, 109), true).apply {
            gravity = Gravity.CENTER
        }, LinearLayout.LayoutParams(dp(27), dp(42)))
        toolbar.addView(brand, LinearLayout.LayoutParams(0, dp(44), 1f))

        toolbar.addView(toolbarIconButton("▤", "أرشيف أنوار") {
            showArchiveMenu()
        }, LinearLayout.LayoutParams(dp(39), dp(42)))
        toolbar.addView(toolbarIconButton("📻", "تشغيل أو إيقاف إذاعة القرآن") {
            startActivity(
                Intent(this, NativeAudioActivity::class.java)
                    .putExtra(NativeAudioActivity.EXTRA_MODE, NativeAudioActivity.MODE_RADIO)
            )
        }, LinearLayout.LayoutParams(dp(39), dp(42)))
        toolbar.addView(toolbarIconButton("☼", "تبديل الوضع الليلي والنهاري") {
            toggleNotebookTheme(shell)
        }, LinearLayout.LayoutParams(dp(39), dp(42)))
        toolbar.addView(toolbarIconButton("🎨", "تغيير ألوان المفكرة") {
            showPalettePicker(shell)
        }, LinearLayout.LayoutParams(dp(39), dp(42)))
        shell.addView(toolbar)

        val serviceRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            setPadding(dp(9), dp(6), dp(9), dp(6))
            setBackgroundColor(Color.rgb(225, 237, 248))
        }
        val serviceButton = actionButton(
            "🌷  الخدمات القرآنية والدينية  ⌄",
            Color.rgb(239, 245, 251),
            Color.rgb(35, 59, 80)
        ) {
            startActivity(Intent(this@NativeNotebookActivity, ReligiousGateActivity::class.java))
        }.apply {
            textSize = 14f
            setPadding(dp(17), dp(8), dp(17), dp(8))
            background = rounded(intArrayOf(Color.rgb(245, 249, 253), Color.rgb(229, 239, 249)), 25, Color.rgb(205, 218, 231))
            contentDescription = "الخدمات القرآنية والدينية"
        }
        serviceRow.addView(serviceButton, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, dp(42)
        ))
        shell.addView(serviceRow)

        val scroll = ScrollView(this).apply {
            setBackgroundColor(Color.rgb(233, 236, 241))
            isFillViewport = true
            clipToPadding = false
        }
        rootContent = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            setPadding(dp(13), dp(12), dp(13), dp(18))
        }
        scroll.addView(rootContent)

        countLabel = text("", 1f, muted)
        countLabel.visibility = View.GONE
        rootContent.addView(countLabel)

        storageNotice = text("", 11f, Color.rgb(133, 63, 43), true)
        storageNotice.setPadding(dp(12), dp(10), dp(12), dp(10))
        storageNotice.background = rounded(intArrayOf(Color.rgb(255, 244, 234), Color.rgb(255, 244, 234)), 11, Color.rgb(224, 184, 157))
        storageNotice.visibility = View.GONE
        rootContent.addView(storageNotice, marginBottom(9))

        searchInput = EditText(this).apply {
            hint = "ابحث…"
            textSize = 16f
            setSingleLine(true)
            setTextColor(ink)
            setHintTextColor(muted)
            gravity = Gravity.CENTER_VERTICAL or Gravity.END
            textAlignment = View.TEXT_ALIGNMENT_VIEW_END
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
            setPadding(dp(13), dp(12), dp(13), dp(12))
            background = rounded(intArrayOf(Color.rgb(235, 238, 243), Color.rgb(235, 238, 243)), 11, Color.rgb(211, 216, 224))
            addTextChangedListener(object : android.text.TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
                override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                    renderNotes()
                }
                override fun afterTextChanged(s: android.text.Editable?) = Unit
            })
        }
        rootContent.addView(searchInput, marginBottom(9))

        val filterScroll = HorizontalScrollView(this).apply {
            isHorizontalScrollBarEnabled = false
            layoutDirection = View.LAYOUT_DIRECTION_RTL
        }
        filterContainer = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
        }
        filterScroll.addView(filterContainer)
        rootContent.addView(filterScroll, marginBottom(8))

        streakLabel = text("", 14f, navy, true)
        streakLabel.setPadding(dp(12), dp(11), dp(12), dp(11))
        streakLabel.background = rounded(intArrayOf(Color.rgb(219, 230, 246), Color.rgb(219, 230, 246)), 10)
        streakLabel.visibility = View.GONE
        rootContent.addView(streakLabel, marginBottom(10))

        // These actions are opened from «أرشيف أنوار», not shown as extra buttons
        // in the compact writing screen.
        exportButton = actionButton("تصدير نسخة مشفرة", Color.WHITE, navy) { exportPortableBackup() }
        importButton = actionButton("استيراد نسخة", Color.WHITE, navy) { selectBackupFile() }

        noteContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
        }
        rootContent.addView(noteContainer)

        moreButton = actionButton("عرض المزيد", Color.WHITE, navy) {
            renderLimit += PAGE_SIZE
            renderNotes(keepPage = true)
        }
        moreButton.visibility = View.GONE
        rootContent.addView(moreButton, marginTop(10))

        shell.addView(scroll, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f
        ))

        addButton = actionButton("+ عمل جديد", Color.rgb(43, 87, 154), Color.WHITE) {
            showEditor(null)
        }.apply {
            textSize = 18f
            setPadding(dp(12), dp(14), dp(12), dp(14))
            background = rounded(intArrayOf(Color.rgb(43, 87, 154), Color.rgb(43, 87, 154)), 9)
        }
        shell.addView(addButton, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(58)
        ).apply {
            marginStart = dp(13)
            marginEnd = dp(13)
            topMargin = dp(7)
            bottomMargin = dp(8)
        })
        return shell
    }

    private fun toolbarIconButton(glyph: String, label: String, onClick: () -> Unit): TextView =
        TextView(this).apply {
            text = glyph
            textSize = if (glyph == "🔒" || glyph == "📻" || glyph == "🎨") 21f else 23f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            textAlignment = View.TEXT_ALIGNMENT_CENTER
            background = rounded(intArrayOf(Color.rgb(37, 78, 119), Color.rgb(37, 78, 119)), 10, Color.rgb(199, 169, 106))
            contentDescription = label
            isClickable = true
            isFocusable = true
            setOnClickListener { onClick() }
        }

    private fun showArchiveMenu() {
        val choices = arrayOf("تصدير نسخة مشفرة", "استيراد نسخة مشفرة", "فتح الخدمات الكاملة")
        AlertDialog.Builder(this)
            .setTitle("أرشيف أنوار")
            .setItems(choices) { _, which ->
                when (which) {
                    0 -> exportPortableBackup()
                    1 -> selectBackupFile()
                    2 -> startActivity(Intent(this, LegacyWebActivity::class.java))
                }
            }
            .setNegativeButton("إغلاق", null)
            .show()
    }

    private fun toggleNotebookTheme(shell: View) {
        val dark = !preferences.getBoolean("night_mode", false)
        preferences.edit().putBoolean("night_mode", dark).apply()
        val background = if (dark) Color.rgb(27, 29, 34) else Color.rgb(233, 236, 241)
        shell.setBackgroundColor(background)
        rootContent.setBackgroundColor(background)
        window.statusBarColor = if (dark) Color.rgb(18, 25, 35) else Color.rgb(8, 38, 76)
        window.navigationBarColor = window.statusBarColor
        Toast.makeText(this, if (dark) "الوضع الليلي" else "الوضع النهاري", Toast.LENGTH_SHORT).show()
    }

    private fun showPalettePicker(shell: View) {
        val labels = arrayOf("أزرق هادئ", "أخضر مريح", "بنفسجي", "وردي ناعم", "عنبر دافئ", "رمادي أنيق")
        val colors = intArrayOf(
            Color.rgb(233, 236, 241),
            Color.rgb(234, 241, 236),
            Color.rgb(240, 237, 245),
            Color.rgb(246, 237, 239),
            Color.rgb(244, 240, 230),
            Color.rgb(233, 237, 240)
        )
        AlertDialog.Builder(this)
            .setTitle("تخصيص ألوان المفكرة")
            .setItems(labels) { _, which ->
                preferences.edit().putInt("palette_color", colors[which]).apply()
                shell.setBackgroundColor(colors[which])
                rootContent.setBackgroundColor(colors[which])
            }
            .setNegativeButton("إغلاق", null)
            .show()
    }

    private fun writingStreakDays(): Int {
        if (notes.isEmpty()) return 0
        fun dayStart(time: Long): Long {
            val calendar = Calendar.getInstance().apply {
                timeInMillis = time
                set(Calendar.HOUR_OF_DAY, 0)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }
            return calendar.timeInMillis
        }
        val activeDays = notes.map { dayStart(it.updatedAt) }.toSet()
        val oneDay = 24L * 60L * 60L * 1000L
        var cursor = dayStart(System.currentTimeMillis())
        if (cursor !in activeDays) cursor -= oneDay
        var streak = 0
        while (cursor in activeDays && streak < 3650) {
            streak++
            cursor -= oneDay
        }
        return streak
    }

    private fun renderFilters() {
        filterContainer.removeAllViews()
        val filters = listOf(
            "all" to "الكل",
            "poem" to "قصائد",
            "text" to "نصوص",
            "idea" to "أفكار",
            "pinned" to "⭐ المثبتة"
        )
        filters.forEach { (key, label) ->
            val selected = activeFilter == key
            val chip = actionButton(
                label,
                if (selected) Color.rgb(43, 87, 154) else Color.WHITE,
                if (selected) Color.WHITE else ink
            ) {
                activeFilter = key
                renderFilters()
                renderNotes()
            }
            chip.textSize = 13f
            chip.setPadding(dp(13), dp(5), dp(13), dp(5))
            chip.background = rounded(
                intArrayOf(if (selected) Color.rgb(43, 87, 154) else Color.WHITE, if (selected) Color.rgb(43, 87, 154) else Color.WHITE),
                22,
                if (selected) Color.rgb(43, 87, 154) else border
            )
            filterContainer.addView(chip, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                dp(38)
            ).apply {
                marginEnd = dp(5)
                marginStart = dp(5)
            })
        }
    }

    private fun renderNotes(keepPage: Boolean = false) {
        if (!::noteContainer.isInitialized) return
        if (!keepPage) renderLimit = PAGE_SIZE
        noteContainer.removeAllViews()
        val query = if (::searchInput.isInitialized) searchInput.text.toString().trim().lowercase(Locale.ROOT) else ""
        val filtered = notes
            .filter { note ->
                val typeMatches = activeFilter == "all" ||
                    (activeFilter == "pinned" && note.pinned) ||
                    note.type == activeFilter
                val queryMatches = query.isBlank() ||
                    note.title.lowercase(Locale.ROOT).contains(query) ||
                    note.text.lowercase(Locale.ROOT).contains(query)
                typeMatches && queryMatches
            }
            .sortedWith(compareByDescending<Note> { it.pinned }.thenByDescending { it.updatedAt })

        countLabel.text = "الأعمال المحفوظة على هذا الجهاز: " + notes.size
        val activeStreak = writingStreakDays()
        streakLabel.visibility = if (activeStreak > 0) View.VISIBLE else View.GONE
        streakLabel.text = when (activeStreak) {
            1 -> "🔥 تكتب منذ يوم واحد"
            else -> "🔥 تكتب منذ " + activeStreak + " أيام متتالية"
        }

        if (!storageAvailable) {
            storageNotice.text = storageMessage
            storageNotice.visibility = View.VISIBLE
            addButton.isEnabled = false
            addButton.alpha = 0.45f
            importButton.isEnabled = false
            exportButton.isEnabled = false
            importButton.alpha = 0.45f
            exportButton.alpha = 0.45f
        } else {
            storageNotice.visibility = View.GONE
            addButton.isEnabled = true
            addButton.alpha = 1f
            importButton.isEnabled = true
            exportButton.isEnabled = true
            importButton.alpha = 1f
            exportButton.alpha = 1f
        }

        if (filtered.isEmpty()) {
            moreButton.visibility = View.GONE
            val empty = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER
                layoutDirection = View.LAYOUT_DIRECTION_RTL
                setPadding(dp(18), dp(24), dp(18), dp(24))
                minimumHeight = dp(320)
            }
            empty.addView(text(
                if (notes.isEmpty()) "لا شيء هنا بعد" else "لا توجد نتائج مطابقة",
                16f, muted
            ).apply { gravity = Gravity.CENTER })
            noteContainer.addView(empty)
            return
        }

        val visible = filtered.take(renderLimit)
        visible.forEachIndexed { index, note ->
            noteContainer.addView(noteCard(note), marginBottom(if (index == visible.lastIndex) 0 else 9))
        }
        if (filtered.size > renderLimit) {
            moreButton.text = "عرض 50 عملاً آخر · المتبقي " + (filtered.size - renderLimit)
            moreButton.visibility = View.VISIBLE
        } else {
            moreButton.visibility = View.GONE
        }
    }

    private fun noteCard(note: Note): View {
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            setPadding(dp(14), dp(12), dp(14), dp(12))
            background = paperBackground(note.paper, 15)
            elevation = dp(1).toFloat()
            isClickable = true
            isFocusable = true
            setOnClickListener { showEditor(note) }
        }

        val top = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
        }
        val typeLabel = text(typeIcon(note.type) + "  " + typeName(note.type), 10f, muted)
        top.addView(typeLabel, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        top.addView(text(if (note.pinned) "⭐ مثبتة" else "", 10f, gold, true))
        card.addView(top)

        card.addView(text(
            note.title.ifBlank { "بلا عنوان" },
            16f, green, true, top = 7, bottom = 5
        ))
        val preview = note.text.replace(Regex("\\s+"), " ").trim().take(190)
        val previewText = text(
            preview.ifBlank { "لا يوجد محتوى نصي" },
            12f, note.textColor
        ).apply { typeface = fontTypeface(note.font) }
        card.addView(previewText)
        card.addView(text(formatDate(note.updatedAt), 10f, muted, top = 8))

        val actions = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
        }
        actions.addView(actionButton("فتح وتحرير", Color.rgb(235, 242, 237), green) {
            showEditor(note)
        }, LinearLayout.LayoutParams(0, dp(38), 1f).apply { marginEnd = dp(3) })
        actions.addView(actionButton(if (note.pinned) "إلغاء التثبيت" else "تثبيت", Color.rgb(250, 246, 234), navy) {
            togglePin(note)
        }, LinearLayout.LayoutParams(0, dp(38), 1f).apply {
            marginStart = dp(3)
            marginEnd = dp(3)
        })
        actions.addView(actionButton("حذف", Color.rgb(250, 238, 235), Color.rgb(143, 62, 52)) {
            confirmDelete(note)
        }, LinearLayout.LayoutParams(0, dp(38), 1f).apply { marginStart = dp(3) })
        if (!storageAvailable) actions.visibility = View.GONE
        card.addView(actions, marginTop(10))
        val historyButton = actionButton(
            "سجل الإصدارات · " + note.history.size,
            Color.rgb(247, 243, 234),
            navy
        ) { showHistory(note) }.apply {
            textSize = 11f
            alpha = if (note.history.isEmpty()) 0.72f else 1f
            isEnabled = storageAvailable
        }
        card.addView(historyButton, marginTop(7))
        return card
    }

    private fun showEditor(existing: Note?) {
        if (!storageAvailable) {
            Toast.makeText(this, storageMessage, Toast.LENGTH_LONG).show()
            return
        }
        if (existing == null && notes.size >= MAX_NOTES) {
            Toast.makeText(this, "بلغت الحد الأقصى وهو " + MAX_NOTES + " عمل.", Toast.LENGTH_LONG).show()
            return
        }

        var selectedType = existing?.type ?: "poem"
        var selectedFont = existing?.font ?: "serif"
        var selectedTextSize = existing?.sizeSp ?: 20
        var selectedTextColor = existing?.textColor ?: Color.rgb(35, 48, 58)
        var selectedPaper = existing?.paper ?: "plain"
        val titleInput = EditText(this).apply {
            setText(existing?.title.orEmpty())
            hint = "عنوان العمل (اختياري)"
            textSize = 15f
            setTextColor(ink)
            setHintTextColor(muted)
            gravity = Gravity.CENTER_VERTICAL or Gravity.END
            textAlignment = View.TEXT_ALIGNMENT_VIEW_END
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
            filters = arrayOf(InputFilter.LengthFilter(MAX_TITLE_LENGTH))
            setPadding(dp(12), dp(10), dp(12), dp(10))
            background = rounded(intArrayOf(Color.WHITE, Color.WHITE), 11, border)
        }
        val bodyInput = EditText(this).apply {
            setText(existing?.text.orEmpty())
            hint = "ابدأ الكتابة هنا…"
            textSize = selectedTextSize.toFloat()
            setTextColor(selectedTextColor)
            typeface = fontTypeface(selectedFont)
            setHintTextColor(muted)
            gravity = Gravity.TOP or Gravity.END
            textAlignment = View.TEXT_ALIGNMENT_VIEW_END
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            inputType = InputType.TYPE_CLASS_TEXT or
                InputType.TYPE_TEXT_FLAG_MULTI_LINE or
                InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
            minLines = 9
            maxLines = 16
            filters = arrayOf(InputFilter.LengthFilter(MAX_CONTENT_LENGTH))
            setLineSpacing(dp(4).toFloat(), 1f)
            setPadding(dp(13), dp(12), dp(13), dp(12))
            background = paperBackground(selectedPaper, 12)
        }

        val styleScroll = HorizontalScrollView(this).apply {
            isHorizontalScrollBarEnabled = false
            layoutDirection = View.LAYOUT_DIRECTION_RTL
        }
        val styleRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
        }
        styleScroll.addView(styleRow)

        fun applyEditorStyle() {
            bodyInput.textSize = selectedTextSize.toFloat()
            bodyInput.setTextColor(selectedTextColor)
            bodyInput.typeface = fontTypeface(selectedFont)
            bodyInput.background = paperBackground(selectedPaper, 12)
        }

        fun addStyleControl(label: String, onClick: () -> Unit) {
            val control = actionButton(label, Color.WHITE, ink, onClick).apply {
                textSize = 10f
                setPadding(dp(8), dp(7), dp(8), dp(7))
            }
            styleRow.addView(control, LinearLayout.LayoutParams(dp(82), dp(46)).apply {
                marginEnd = dp(3)
                marginStart = dp(3)
            })
        }

        fun refreshStyleControls() {
            styleRow.removeAllViews()
            addStyleControl("الخط\n" + fontLabel(selectedFont)) {
                showOptionPicker("اختر الخط", fontChoices, selectedFont) { value ->
                    selectedFont = value
                    applyEditorStyle()
                    refreshStyleControls()
                }
            }
            addStyleControl("الحجم\n" + selectedTextSize) {
                val sizes = listOf(16, 18, 20, 22, 24, 26, 28).map { it.toString() to "$it نقطة" }
                showOptionPicker("حجم الكتابة", sizes, selectedTextSize.toString()) { value ->
                    selectedTextSize = value.toInt()
                    applyEditorStyle()
                    refreshStyleControls()
                }
            }
            val colorKey = textColorChoices.firstOrNull { textColorFor(it.first) == selectedTextColor }?.first ?: "ink"
            addStyleControl("لون النص\n" + textColorLabel(colorKey)) {
                showOptionPicker("لون النص", textColorChoices, colorKey) { value ->
                    selectedTextColor = textColorFor(value)
                    applyEditorStyle()
                    refreshStyleControls()
                }
            }
            addStyleControl("الورق\n" + paperLabel(selectedPaper)) {
                showOptionPicker("شكل الورق", paperChoices, selectedPaper) { value ->
                    selectedPaper = value
                    applyEditorStyle()
                    refreshStyleControls()
                }
            }
        }
        refreshStyleControls()

        val typeButtons = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
        }
        fun renderTypeButtons() {
            typeButtons.removeAllViews()
            listOf("poem" to "قصيدة", "text" to "نص", "idea" to "فكرة").forEach { (key, label) ->
                val selected = selectedType == key
                val button = actionButton(
                    label,
                    if (selected) green else Color.WHITE,
                    if (selected) Color.WHITE else ink
                ) { selectedType = key; renderTypeButtons() }
                button.textSize = 12f
                typeButtons.addView(button, LinearLayout.LayoutParams(0, dp(39), 1f).apply {
                    marginEnd = dp(3)
                    marginStart = dp(3)
                })
            }
        }
        renderTypeButtons()

        val form = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            setPadding(dp(15), dp(8), dp(15), dp(5))
            addView(text("نوع العمل", 11f, muted, bottom = 6))
            addView(typeButtons, marginBottom(11))
            addView(text("تنسيق الكتابة", 11f, muted, bottom = 6))
            addView(styleScroll, marginBottom(12))
            addView(text("العنوان", 11f, muted, bottom = 5))
            addView(titleInput, marginBottom(11))
            addView(text("المحتوى", 11f, muted, bottom = 5))
            addView(bodyInput)
            addView(text(
                "النصوص تحفظ كنص عادي داخل مخزن Android المشفر. تنسيق الخطوط والورق المتقدم ما زال في النسخة الكاملة.",
                10f, muted, top = 8
            ))
        }
        val dialogScroll = ScrollView(this).apply {
            addView(form)
            isFillViewport = true
        }

        val dialog = AlertDialog.Builder(this)
            .setTitle(if (existing == null) "عمل جديد" else "تحرير العمل")
            .setView(dialogScroll)
            .setPositiveButton("حفظ", null)
            .setNegativeButton("إلغاء", null)
            .create()

        dialog.setOnShowListener {
            dialog.window?.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                val title = titleInput.text.toString().trim()
                val body = bodyInput.text.toString().replace("\r\n", "\n").trimEnd()
                if (body.isBlank()) {
                    bodyInput.error = "اكتب المحتوى أولًا"
                    bodyInput.requestFocus()
                    return@setOnClickListener
                }
                if (body.length > MAX_CONTENT_LENGTH) {
                    bodyInput.error = "تجاوز المحتوى الحد المسموح"
                    return@setOnClickListener
                }

                val previous = notes.toList()
                val changed = existing != null && (
                    existing.title != title ||
                    existing.type != selectedType ||
                    existing.text != body ||
                    existing.font != selectedFont ||
                    existing.sizeSp != selectedTextSize ||
                    existing.textColor != selectedTextColor ||
                    existing.paper != selectedPaper
                )
                val history = existing?.history.orEmpty().toMutableList().apply {
                    if (changed && existing != null) add(existing.toHistoryVersion())
                }.takeLast(MAX_HISTORY)
                val updated = Note(
                    id = existing?.id ?: UUID.randomUUID().toString(),
                    title = title,
                    type = selectedType,
                    text = body,
                    pinned = existing?.pinned ?: false,
                    updatedAt = System.currentTimeMillis(),
                    font = selectedFont,
                    sizeSp = selectedTextSize,
                    textColor = selectedTextColor,
                    paper = selectedPaper,
                    history = history
                )
                if (existing == null) {
                    notes.add(0, updated)
                } else {
                    val index = notes.indexOfFirst { it.id == existing.id }
                    if (index < 0) {
                        Toast.makeText(this, "لم نعثر على العمل المطلوب تعديله.", Toast.LENGTH_LONG).show()
                        dialog.dismiss()
                        return@setOnClickListener
                    }
                    notes[index] = updated
                }

                if (!saveEncryptedState()) {
                    notes.clear()
                    notes.addAll(previous)
                    renderNotes()
                    Toast.makeText(this, storageMessage, Toast.LENGTH_LONG).show()
                    return@setOnClickListener
                }
                renderNotes()
                dialog.dismiss()
                Toast.makeText(this, "حُفظ العمل مشفرًا على هذا الجهاز.", Toast.LENGTH_SHORT).show()
            }
        }
        dialog.show()
    }

    private fun Note.toHistoryVersion(): HistoryVersion = HistoryVersion(
        title = title,
        type = type,
        text = text,
        updatedAt = updatedAt,
        font = font,
        sizeSp = sizeSp,
        textColor = textColor,
        paper = paper,
        pinned = pinned
    )

    private fun showHistory(note: Note) {
        if (note.history.isEmpty()) {
            Toast.makeText(this, "لا توجد إصدارات سابقة لهذا العمل بعد.", Toast.LENGTH_SHORT).show()
            return
        }
        val reversed = note.history.withIndex().toList().asReversed()
        val labels = reversed.map { (_, version) ->
            (version.title.ifBlank { "بلا عنوان" }) + " · " +
                typeName(version.type) + " · " + formatDate(version.updatedAt)
        }.toTypedArray()
        AlertDialog.Builder(this)
            .setTitle("سجل إصدارات العمل")
            .setItems(labels) { _, selected ->
                val entry = reversed.getOrNull(selected) ?: return@setItems
                confirmRestoreHistory(note, entry.index)
            }
            .setNegativeButton("إغلاق", null)
            .show()
    }

    private fun confirmRestoreHistory(note: Note, historyIndex: Int) {
        val currentIndex = notes.indexOfFirst { it.id == note.id }
        if (currentIndex < 0 || !storageAvailable) return
        val version = notes[currentIndex].history.getOrNull(historyIndex) ?: return
        AlertDialog.Builder(this)
            .setTitle("استعادة هذا الإصدار؟")
            .setMessage("سيُحفظ الإصدار الحالي أولًا في السجل، ثم تُستعاد النسخة المحددة.")
            .setPositiveButton("استعادة") { _, _ ->
                val previous = notes.toList()
                val current = notes[currentIndex]
                val nextHistory = (current.history + current.toHistoryVersion()).takeLast(MAX_HISTORY)
                notes[currentIndex] = current.copy(
                    title = version.title,
                    type = version.type,
                    text = version.text,
                    updatedAt = System.currentTimeMillis(),
                    font = version.font,
                    sizeSp = version.sizeSp,
                    textColor = version.textColor,
                    paper = version.paper,
                    pinned = version.pinned,
                    history = nextHistory
                )
                if (!saveEncryptedState()) {
                    notes.clear()
                    notes.addAll(previous)
                    Toast.makeText(this, storageMessage, Toast.LENGTH_LONG).show()
                } else {
                    Toast.makeText(this, "تمت استعادة الإصدار مع حفظ الحالة السابقة.", Toast.LENGTH_SHORT).show()
                }
                renderNotes()
            }
            .setNegativeButton("إلغاء", null)
            .show()
    }

    private fun togglePin(note: Note) {
        if (!storageAvailable) return
        val index = notes.indexOfFirst { it.id == note.id }
        if (index < 0) return
        val previous = notes[index]
        notes[index] = previous.copy(pinned = !previous.pinned, updatedAt = System.currentTimeMillis())
        if (!saveEncryptedState()) {
            notes[index] = previous
            Toast.makeText(this, storageMessage, Toast.LENGTH_LONG).show()
        }
        renderNotes()
    }

    private fun confirmDelete(note: Note) {
        if (!storageAvailable) return
        AlertDialog.Builder(this)
            .setTitle("حذف العمل")
            .setMessage("سيُحذف هذا العمل من دفتر Android على هذا الجهاز فقط.")
            .setPositiveButton("حذف") { _, _ ->
                val previous = notes.toList()
                notes.removeAll { it.id == note.id }
                if (!saveEncryptedState()) {
                    notes.clear()
                    notes.addAll(previous)
                    Toast.makeText(this, storageMessage, Toast.LENGTH_LONG).show()
                }
                renderNotes()
            }
            .setNegativeButton("إلغاء", null)
            .show()
    }

    private fun loadNotes() {
        val primary = preferences.getString(PRIMARY_KEY, null)
        if (primary != null) {
            try {
                val plain = decryptState(primary)
                val parsed = parseNotes(plain)
                notes.clear()
                notes.addAll(parsed)
                return
            } catch (primaryError: Exception) {
                val backup = preferences.getString(BACKUP_KEY, null)
                if (backup != null) {
                    try {
                        val parsed = parseNotes(decryptState(backup))
                        notes.clear()
                        notes.addAll(parsed)
                        storageAvailable = false
                        storageMessage = "تعذّر التحقق من السجل الرئيسي، فعرضنا النسخة الاحتياطية المشفرة بوضع القراءة فقط. لم نكتب فوق أي سجل."
                        return
                    } catch (backupError: Exception) {
                        throw IllegalStateException("تعذّر التحقق من السجلين المشفرين.", backupError)
                    }
                }
                throw IllegalStateException("تعذّر فك السجل الرئيسي المشفر.", primaryError)
            }
        }

        val backup = preferences.getString(BACKUP_KEY, null)
        if (backup != null) {
            val parsed = parseNotes(decryptState(backup))
            notes.clear()
            notes.addAll(parsed)
            storageAvailable = false
            storageMessage = "لم نعثر على السجل الرئيسي، لكن توجد نسخة احتياطية مشفرة. عُرضت للقراءة فقط حمايةً للبيانات."
        }
    }

    private fun parseNotes(plain: ByteArray): List<Note> {
        require(plain.size <= MAX_PLAINTEXT_BYTES) { "حجم دفتر الكتابة يتجاوز الحد الآمن." }
        val root = JSONObject(String(plain, StandardCharsets.UTF_8))
        require(root.optInt("formatVersion", -1) == FORMAT_VERSION) { "صيغة دفتر الكتابة غير مدعومة." }
        val array = root.optJSONArray("notes") ?: throw IllegalStateException("قائمة الأعمال غير موجودة.")
        require(array.length() <= MAX_NOTES) { "عدد الأعمال يتجاوز الحد الآمن." }
        val parsed = ArrayList<Note>(array.length())
        val ids = HashSet<String>()
        for (index in 0 until array.length()) {
            val item = array.optJSONObject(index) ?: throw IllegalStateException("يوجد سجل عمل غير صالح.")
            val id = item.optString("id").trim()
            val title = item.optString("title", "")
            val type = item.optString("type", "text")
            val body = item.optString("text", "")
            val timestamp = item.optLong("ts", 0L)
            val rawFont = item.optString("font", "serif")
            val font = when (rawFont) {
                "Amiri" -> "serif"
                "Cairo" -> "sans-serif"
                else -> rawFont.takeIf { it == "serif" || it == "sans-serif" } ?: "serif"
            }
            val sizeSp = item.optInt("size", 20).coerceIn(16, 28)
            val textColor = item.optInt("textColor", Color.rgb(35, 48, 58))
            val rawPaper = item.optString("paper", "plain")
            val paper = rawPaper.takeIf { key -> paperChoices.any { it.first == key } } ?: "plain"
            require(id.isNotBlank() && id.length <= 80 && ids.add(id)) { "معرّف عمل مكرر أو غير صالح." }
            require(title.length <= MAX_TITLE_LENGTH) { "عنوان عمل يتجاوز الحد." }
            require(body.isNotBlank() && body.length <= MAX_CONTENT_LENGTH) { "محتوى عمل غير صالح أو يتجاوز الحد." }
            require(type in ALLOWED_TYPES) { "نوع عمل غير معروف." }
            require(timestamp > 0L) { "تاريخ عمل غير صالح." }
            val history = parseHistory(item.optJSONArray("history"))
            parsed.add(Note(
                id, title, type, body, item.optBoolean("pin", false), timestamp,
                font, sizeSp, textColor, paper, history
            ))
        }
        return parsed
    }

    private fun parseHistory(array: JSONArray?): List<HistoryVersion> {
        if (array == null) return emptyList()
        val parsed = ArrayList<HistoryVersion>()
        val start = (array.length() - MAX_HISTORY).coerceAtLeast(0)
        for (index in start until array.length()) {
            val item = array.optJSONObject(index) ?: continue
            runCatching {
                val textValue = noteTextFromJson(item)
                require(textValue.isNotBlank() && textValue.length <= MAX_CONTENT_LENGTH)
                val rawFont = item.optString("font", "serif")
                val size = item.optInt("size", 20).coerceIn(16, 28)
                val rawPaper = item.optString("paper", "plain")
                val stamp = item.optLong("ts", System.currentTimeMillis()).takeIf { it > 0L }
                    ?: System.currentTimeMillis()
                parsed.add(HistoryVersion(
                    title = item.optString("title", "").take(MAX_TITLE_LENGTH),
                    type = item.optString("type", "text").takeIf { it in ALLOWED_TYPES } ?: "text",
                    text = textValue,
                    updatedAt = stamp,
                    font = nativeFontFromExternal(rawFont),
                    sizeSp = size,
                    textColor = item.optInt("textColor", Color.rgb(35, 48, 58)),
                    paper = nativePaperFromExternal(rawPaper),
                    pinned = item.optBoolean("pin", false)
                ))
            }
        }
        return parsed.takeLast(MAX_HISTORY)
    }

    private fun noteTextFromJson(item: JSONObject): String {
        val raw = if (item.has("text") && !item.isNull("text")) {
            item.optString("text", "")
        } else {
            Html.fromHtml(item.optString("html", "")).toString()
        }
        return raw.replace("\u0000", "").replace("\r\n", "\n").trimEnd()
    }

    private fun nativeFontFromExternal(value: String): String = when (value.trim().lowercase(Locale.ROOT)) {
        "cairo", "sans-serif", "ibm plex sans arabic", "tajawal", "noto sans arabic" -> "sans-serif"
        else -> "serif"
    }

    private fun nativePaperFromExternal(value: String): String = when (value) {
        "cream", "framed" -> "cream"
        "parchment", "poetry" -> "parchment"
        "mint" -> "mint"
        "blue", "ruled" -> "blue"
        "rose" -> "rose"
        else -> "plain"
    }

    private fun saveEncryptedState(): Boolean {
        if (!storageAvailable) {
            storageMessage = "الحفظ متوقف حمايةً للسجل المشفر. لم نغيّر البيانات السابقة."
            return false
        }
        var oldPrimary: String? = null
        var primaryMayHaveChanged = false
        return try {
            val plain = encodeNotes()
            require(plain.size <= MAX_PLAINTEXT_BYTES) {
                "بلغ دفتر الكتابة حد التخزين الآمن. احتفظ بنسخة من أعمالك قبل إضافة المزيد."
            }

            oldPrimary = preferences.getString(PRIMARY_KEY, null)
            if (oldPrimary != null) {
                val oldPlain = decryptState(oldPrimary)
                parseNotes(oldPlain)
                if (!preferences.edit().putString(BACKUP_KEY, oldPrimary).commit()) {
                    throw IllegalStateException("تعذّر تثبيت النسخة الاحتياطية المشفرة.")
                }
                val backupReadBack = preferences.getString(BACKUP_KEY, null)
                    ?: throw IllegalStateException("لم نعثر على النسخة الاحتياطية بعد حفظها.")
                if (!decryptState(backupReadBack).contentEquals(oldPlain)) {
                    throw IllegalStateException("لم تتطابق مراجعة النسخة الاحتياطية.")
                }
            }

            val encrypted = encryptState(plain)
            primaryMayHaveChanged = true
            if (!preferences.edit().putString(PRIMARY_KEY, encrypted).commit()) {
                throw IllegalStateException("تعذّر تثبيت سجل الكتابة المشفر.")
            }
            val saved = preferences.getString(PRIMARY_KEY, null)
                ?: throw IllegalStateException("لم نعثر على سجل الكتابة بعد الحفظ.")
            val verified = decryptState(saved)
            if (!verified.contentEquals(plain)) {
                throw IllegalStateException("لم تتطابق مراجعة السجل المشفر مع النص الأصلي.")
            }
            true
        } catch (error: Exception) {
            if (primaryMayHaveChanged && oldPrimary != null) {
                runCatching { preferences.edit().putString(PRIMARY_KEY, oldPrimary).commit() }
            }
            storageMessage = error.message
                ?.takeIf { it.isNotBlank() }
                ?.let { "تعذّر إكمال الحفظ المشفر: " + it + " لم نحذف النسخة السابقة." }
                ?: "تعذّر إكمال الحفظ المشفر. لم نحذف النسخة السابقة."
            false
        }
    }

    private fun encodeNotes(): ByteArray {
        val array = JSONArray()
        notes.take(MAX_NOTES).forEach { note ->
            array.put(JSONObject()
                .put("id", note.id)
                .put("title", note.title.take(MAX_TITLE_LENGTH))
                .put("type", note.type)
                .put("text", note.text)
                .put("pin", note.pinned)
                .put("ts", note.updatedAt)
                .put("font", note.font)
                .put("size", note.sizeSp)
                .put("textColor", note.textColor)
                .put("paper", note.paper)
                .put("history", encodeHistory(note.history)))
        }
        return JSONObject()
            .put("formatVersion", FORMAT_VERSION)
            .put("notes", array)
            .toString()
            .toByteArray(StandardCharsets.UTF_8)
    }

    private fun encodeHistory(history: List<HistoryVersion>): JSONArray {
        val array = JSONArray()
        history.takeLast(MAX_HISTORY).forEach { version ->
            array.put(JSONObject()
                .put("title", version.title.take(MAX_TITLE_LENGTH))
                .put("type", version.type)
                .put("text", version.text)
                .put("ts", version.updatedAt)
                .put("font", version.font)
                .put("size", version.sizeSp)
                .put("textColor", version.textColor)
                .put("paper", version.paper)
                .put("pin", version.pinned))
        }
        return array
    }

    private fun getKeystoreKey(createIfMissing: Boolean): SecretKey {
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        val existing = keyStore.getKey(KEY_ALIAS, null) as? SecretKey
        if (existing != null) return existing
        if (!createIfMissing) throw IllegalStateException("مفتاح تشفير دفتر الكتابة غير متاح.")
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
        require(iv.size in 12..32)
        val envelope = ByteBuffer.allocate(1 + iv.size + encrypted.size)
            .put(iv.size.toByte())
            .put(iv)
            .put(encrypted)
            .array()
        return Base64.encodeToString(envelope, Base64.NO_WRAP)
    }

    private fun decryptState(encoded: String): ByteArray {
        val envelope = Base64.decode(encoded, Base64.NO_WRAP)
        require(envelope.size > 14) { "سجل دفتر الكتابة المشفر غير مكتمل." }
        val ivLength = envelope[0].toInt() and 0xff
        require(ivLength in 12..32 && envelope.size > 1 + ivLength + 16) {
            "صيغة سجل دفتر الكتابة المشفر غير صحيحة."
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

    private fun exportPortableBackup() {
        if (!storageAvailable) return
        askPassphrase("حماية النسخة الاحتياطية", confirm = true) { password ->
            try {
                val envelope = encryptPortableBackup(password)
                pendingExportJson = envelope.toString(2)
                val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "application/json"
                    putExtra(Intent.EXTRA_TITLE, "mofakira-anouar-encrypted-backup.json")
                }
                startActivityForResult(intent, REQUEST_EXPORT)
            } catch (error: Exception) {
                pendingExportJson = null
                Toast.makeText(this, error.message ?: "تعذّر تجهيز النسخة المشفرة.", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun selectBackupFile() {
        if (!storageAvailable) return
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "application/json"
            putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("application/json", "text/plain"))
        }
        runCatching { startActivityForResult(intent, REQUEST_IMPORT) }
            .onFailure { Toast.makeText(this, "تعذّر فتح منتقي ملفات النسخ الاحتياطية.", Toast.LENGTH_LONG).show() }
    }

    private fun askPassphrase(title: String, confirm: Boolean, onSubmit: (String) -> Unit) {
        val fields = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            setPadding(dp(18), dp(8), dp(18), dp(4))
        }
        val passwordInput = EditText(this).apply {
            hint = if (confirm) "عبارة مرور من 12 محرفًا على الأقل" else "عبارة مرور النسخة الاحتياطية"
            textSize = 14f
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
            setTextColor(ink)
            setHintTextColor(muted)
            gravity = Gravity.CENTER_VERTICAL or Gravity.END
            layoutDirection = View.LAYOUT_DIRECTION_RTL
        }
        fields.addView(passwordInput)
        val confirmInput = if (confirm) EditText(this).apply {
            hint = "أعد كتابة عبارة المرور"
            textSize = 14f
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
            setTextColor(ink)
            setHintTextColor(muted)
            gravity = Gravity.CENTER_VERTICAL or Gravity.END
            layoutDirection = View.LAYOUT_DIRECTION_RTL
        } else null
        confirmInput?.let { fields.addView(it, marginTop(8)) }
        fields.addView(text(
            if (confirm) "هذه العبارة مطلوبة عند استيراد النسخة لاحقًا. احتفظ بها في مكان آمن؛ لا يمكن استعادتها إذا نسيتها."
            else "لن تُرفع النسخة إلى أي خادم. ستُفك على الجهاز ثم يعاد حفظ الأعمال في الخزنة المحلية المشفرة.",
            10f, muted, top = 8
        ))
        val dialog = AlertDialog.Builder(this)
            .setTitle(title)
            .setView(fields)
            .setPositiveButton("متابعة", null)
            .setNegativeButton("إلغاء", null)
            .create()
        dialog.setOnCancelListener {
            passwordInput.setText("")
            confirmInput?.setText("")
            if (!confirm) pendingImportJson = null
        }
        dialog.setOnShowListener {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                val password = passwordInput.text.toString()
                if (password.length < MIN_EXPORT_PASSWORD_LENGTH || password.length > MAX_EXPORT_PASSWORD_LENGTH) {
                    passwordInput.error = "استخدم عبارة مرور بين 12 و2048 محرفًا."
                    return@setOnClickListener
                }
                if (confirmInput != null && confirmInput.text.toString() != password) {
                    confirmInput.error = "عبارتا المرور غير متطابقتين."
                    return@setOnClickListener
                }
                passwordInput.setText("")
                confirmInput?.setText("")
                dialog.dismiss()
                onSubmit(password)
            }
        }
        dialog.show()
    }

    private fun encryptPortableBackup(password: String): JSONObject {
        val plaintext = buildPortableSnapshot().toByteArray(StandardCharsets.UTF_8)
        require(plaintext.size <= MAX_PORTABLE_PLAINTEXT_BYTES) {
            "حجم النسخة الاحتياطية يتجاوز الحد الآمن."
        }
        val salt = ByteArray(16).also { SecureRandom().nextBytes(it) }
        val iv = ByteArray(12).also { SecureRandom().nextBytes(it) }
        val saltText = Base64.encodeToString(salt, Base64.NO_WRAP)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(
            Cipher.ENCRYPT_MODE,
            derivePortableKey(password, salt),
            GCMParameterSpec(128, iv)
        )
        cipher.updateAAD(portableAad(PORTABLE_FORMAT, saltText))
        val ciphertext = cipher.doFinal(plaintext)
        return JSONObject()
            .put("format", PORTABLE_FORMAT)
            .put("version", PORTABLE_VERSION)
            .put("kdf", PORTABLE_KDF)
            .put("iterations", PORTABLE_ITERATIONS)
            .put("cipher", PORTABLE_CIPHER)
            .put("salt", saltText)
            .put("iv", Base64.encodeToString(iv, Base64.NO_WRAP))
            .put("ciphertext", Base64.encodeToString(ciphertext, Base64.NO_WRAP))
    }

    private fun derivePortableKey(password: String, salt: ByteArray): SecretKeySpec {
        require(password.length in MIN_EXPORT_PASSWORD_LENGTH..MAX_EXPORT_PASSWORD_LENGTH) {
            "عبارة المرور يجب أن تتراوح بين 12 و2048 محرفًا."
        }
        // Implement PBKDF2 directly over UTF-8 bytes so this matches WebCrypto's
        // TextEncoder behavior on Arabic passwords, including older Android providers.
        val passwordBytes = password.toByteArray(StandardCharsets.UTF_8)
        val mac = Mac.getInstance("HmacSHA256")
        return try {
            mac.init(SecretKeySpec(passwordBytes, "HmacSHA256"))
            val firstBlock = ByteArray(salt.size + 4)
            salt.copyInto(firstBlock)
            firstBlock[firstBlock.lastIndex - 3] = 0
            firstBlock[firstBlock.lastIndex - 2] = 0
            firstBlock[firstBlock.lastIndex - 1] = 0
            firstBlock[firstBlock.lastIndex] = 1
            var u = mac.doFinal(firstBlock)
            val derived = u.copyOf()
            try {
                repeat(PORTABLE_ITERATIONS - 1) {
                    u = mac.doFinal(u)
                    for (index in derived.indices) {
                        derived[index] = (derived[index].toInt() xor u[index].toInt()).toByte()
                    }
                }
                SecretKeySpec(derived, "AES")
            } finally {
                u.fill(0)
                derived.fill(0)
                firstBlock.fill(0)
            }
        } finally {
            passwordBytes.fill(0)
        }
    }

    private fun portableAad(format: String, salt: String): ByteArray =
        listOf(format, PORTABLE_VERSION, PORTABLE_KDF, PORTABLE_CIPHER, PORTABLE_ITERATIONS, salt)
            .joinToString("|").toByteArray(StandardCharsets.UTF_8)

    private fun decryptPortableBackup(password: String, envelope: JSONObject): String {
        val format = envelope.optString("format")
        require(format == PORTABLE_FORMAT) {
            "صيغة النسخة الاحتياطية غير مدعومة."
        }
        require(envelope.optInt("version", -1) == PORTABLE_VERSION) {
            "إصدار النسخة الاحتياطية غير مدعوم."
        }
        require(envelope.optString("kdf") == PORTABLE_KDF &&
            envelope.optString("cipher") == PORTABLE_CIPHER &&
            envelope.optInt("iterations", -1) == PORTABLE_ITERATIONS) {
            "إعدادات تشفير النسخة غير مدعومة."
        }
        val saltText = envelope.optString("salt")
        val salt = Base64.decode(saltText, Base64.NO_WRAP)
        val iv = Base64.decode(envelope.optString("iv"), Base64.NO_WRAP)
        val ciphertext = Base64.decode(envelope.optString("ciphertext"), Base64.NO_WRAP)
        require(salt.size == 16 && iv.size == 12 && ciphertext.size in 16..MAX_PORTABLE_CIPHERTEXT_BYTES) {
            "بنية ملف النسخة الاحتياطية غير صالحة أو يتجاوز حجمها الحد الآمن."
        }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(
            Cipher.DECRYPT_MODE,
            derivePortableKey(password, salt),
            GCMParameterSpec(128, iv)
        )
        cipher.updateAAD(portableAad(format, saltText))
        val plaintext = cipher.doFinal(ciphertext)
        require(plaintext.size <= MAX_PORTABLE_PLAINTEXT_BYTES) {
            "محتوى النسخة الاحتياطية يتجاوز الحد الآمن."
        }
        return String(plaintext, StandardCharsets.UTF_8)
    }

    private fun buildPortableSnapshot(): String {
        val array = JSONArray()
        notes.forEach { note ->
            array.put(JSONObject()
                .put("id", note.id)
                .put("title", note.title)
                .put("type", note.type)
                .put("text", note.text)
                .put("pin", note.pinned)
                .put("ts", note.updatedAt)
                .put("font", if (note.font == "sans-serif") "Cairo" else "Amiri")
                .put("size", note.sizeSp)
                .put("textColor", note.textColor)
                .put("paper", externalPwaPaper(note.paper))
                .put("history", historyToPortableJson(note.history)))
        }
        return JSONObject()
            .put("snapshotFormat", PORTABLE_FORMAT)
            .put("snapshotVersion", PORTABLE_VERSION)
            .put("createdAt", System.currentTimeMillis())
            .put("notes", array)
            .toString()
    }

    private fun historyToPortableJson(history: List<HistoryVersion>): JSONArray {
        val array = JSONArray()
        history.takeLast(MAX_HISTORY).forEach { version ->
            array.put(JSONObject()
                .put("title", version.title)
                .put("type", version.type)
                .put("html", plainTextToHtml(version.text))
                .put("text", version.text)
                .put("ts", version.updatedAt)
                .put("font", if (version.font == "sans-serif") "Cairo" else "Amiri")
                .put("size", version.sizeSp)
                .put("textColor", version.textColor)
                .put("paper", externalPwaPaper(version.paper))
                .put("pin", version.pinned))
        }
        return array
    }

    private fun plainTextToHtml(value: String): String {
        val escaped = value.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\"", "&quot;")
        return escaped.split("\n").joinToString("") { line ->
            if (line.isEmpty()) "<div><br></div>" else "<div>$line</div>"
        }
    }

    private fun externalPwaPaper(value: String): String = when (value) {
        "cream" -> "framed"
        "parchment" -> "poetry"
        "mint", "blue", "rose" -> "ruled"
        else -> "plain"
    }

    private fun parsePortableNotes(plaintext: String): List<Note> {
        require(plaintext.toByteArray(StandardCharsets.UTF_8).size <= MAX_PORTABLE_PLAINTEXT_BYTES) {
            "حجم بيانات النسخة الاحتياطية يتجاوز الحد الآمن."
        }
        val root = JSONObject(plaintext)
        val array = root.optJSONArray("notes") ?: throw IllegalStateException("قائمة الأعمال غير موجودة في النسخة.")
        require(array.length() <= MAX_NOTES) { "عدد الأعمال في النسخة يتجاوز الحد الأقصى وهو 2500." }
        val parsed = ArrayList<Note>(array.length())
        val ids = HashSet<String>()
        for (index in 0 until array.length()) {
            val item = array.optJSONObject(index) ?: throw IllegalStateException("يوجد عمل غير صالح في النسخة.")
            val idFromFile = item.optString("id").trim().take(80)
            val id = if (idFromFile.isBlank() || !ids.add(idFromFile)) UUID.randomUUID().toString().also { ids.add(it) } else idFromFile
            val body = noteTextFromJson(item)
            require(body.isNotBlank() && body.length <= MAX_CONTENT_LENGTH) {
                "يوجد عمل فارغ أو يتجاوز حد 450 ألف حرف؛ لم نستورد أي عمل."
            }
            val rawFont = item.optString("font", "Amiri")
            val size = item.optInt("size", 20).coerceIn(16, 28)
            val rawPaper = item.optString("paper", "plain")
            val stamp = item.optLong("ts", System.currentTimeMillis()).takeIf { it > 0L }
                ?: System.currentTimeMillis()
            parsed.add(Note(
                id = id,
                title = item.optString("title", "").take(MAX_TITLE_LENGTH),
                type = item.optString("type", "text").takeIf { it in ALLOWED_TYPES } ?: "text",
                text = body,
                pinned = item.optBoolean("pin", false),
                updatedAt = stamp,
                font = nativeFontFromExternal(rawFont),
                sizeSp = size,
                textColor = item.optInt("textColor", Color.rgb(35, 48, 58)),
                paper = nativePaperFromExternal(rawPaper),
                history = parseHistory(item.optJSONArray("history"))
            ))
        }
        return parsed
    }

    private fun mergeImportedNotes(imported: List<Note>, replaceExisting: Boolean) {
        if (!storageAvailable) return
        val previous = notes.toList()
        val next = if (replaceExisting) {
            imported
        } else {
            val ids = notes.map { it.id }.toMutableSet()
            val additions = imported.map { item ->
                if (ids.add(item.id)) item else item.copy(id = UUID.randomUUID().toString()).also { ids.add(it.id) }
            }
            notes + additions
        }
        if (next.size > MAX_NOTES) {
            Toast.makeText(this, "سيؤدي الدمج إلى تجاوز 2500 عمل. اختر الاستبدال أو قسّم النسخة.", Toast.LENGTH_LONG).show()
            return
        }
        notes.clear()
        notes.addAll(next)
        if (!saveEncryptedState()) {
            notes.clear()
            notes.addAll(previous)
            Toast.makeText(this, storageMessage, Toast.LENGTH_LONG).show()
            return
        }
        renderNotes()
        Toast.makeText(
            this,
            if (replaceExisting) "تم استبدال الأعمال بعد التحقق من النسخة وحفظها محليًا."
            else "تم دمج الأعمال المستوردة مع الأعمال الحالية.",
            Toast.LENGTH_LONG
        ).show()
    }

    private fun chooseImportMode(imported: List<Note>) {
        if (imported.isEmpty()) {
            Toast.makeText(this, "النسخة لا تحتوي على أعمال قابلة للاستيراد.", Toast.LENGTH_LONG).show()
            return
        }
        AlertDialog.Builder(this)
            .setTitle("كيف تريد استيراد الأعمال؟")
            .setItems(arrayOf("دمج مع الأعمال الحالية", "استبدال الأعمال الحالية")) { _, which ->
                if (which == 0) {
                    mergeImportedNotes(imported, replaceExisting = false)
                } else {
                    AlertDialog.Builder(this)
                        .setTitle("تأكيد استبدال الأعمال")
                        .setMessage("سيتم استبدال قائمة الأعمال الحالية بعد أن تكون النسخة قد فُكّت وفُحصت. ستُحفظ الحالة المشفرة الحالية كسجل احتياطي.")
                        .setPositiveButton("استبدال") { _, _ -> mergeImportedNotes(imported, replaceExisting = true) }
                        .setNegativeButton("إلغاء", null)
                        .show()
                }
            }
            .setNegativeButton("إلغاء", null)
            .show()
    }

    private fun readLimited(input: InputStream, maxBytes: Int): ByteArray {
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(8192)
        var total = 0
        while (true) {
            val count = input.read(buffer)
            if (count < 0) break
            total += count
            require(total <= maxBytes) { "حجم ملف النسخة يتجاوز الحد الآمن." }
            output.write(buffer, 0, count)
        }
        return output.toByteArray()
    }

    private fun handleImportFile(uri: android.net.Uri) {
        val raw = try {
            contentResolver.openInputStream(uri)?.use { input ->
                String(readLimited(input, MAX_PORTABLE_FILE_BYTES), StandardCharsets.UTF_8)
            } ?: throw IllegalStateException("تعذّرت قراءة ملف النسخة.")
        } catch (error: Exception) {
            Toast.makeText(this, error.message ?: "تعذّرت قراءة الملف.", Toast.LENGTH_LONG).show()
            return
        }
        pendingImportJson = raw
        askPassphrase("فك تشفير النسخة الاحتياطية", confirm = false) { password ->
            val imported = try {
                val envelope = JSONObject(pendingImportJson ?: throw IllegalStateException("انتهى ملف الاستيراد."))
                val plaintext = decryptPortableBackup(password, envelope)
                parsePortableNotes(plaintext)
            } catch (error: Exception) {
                Toast.makeText(this, error.message ?: "كلمة المرور غير صحيحة أو النسخة تالفة.", Toast.LENGTH_LONG).show()
                pendingImportJson = null
                return@askPassphrase
            }
            pendingImportJson = null
            chooseImportMode(imported)
        }
    }

    private fun persistExportFile(uri: android.net.Uri) {
        val value = pendingExportJson ?: return
        try {
            val bytes = value.toByteArray(StandardCharsets.UTF_8)
            contentResolver.openOutputStream(uri, "w")?.use { output ->
                output.write(bytes)
                output.flush()
            } ?: throw IllegalStateException("تعذّر فتح ملف الوجهة للكتابة.")
            val readBack = contentResolver.openInputStream(uri)?.use { input ->
                readLimited(input, MAX_PORTABLE_FILE_BYTES)
            } ?: throw IllegalStateException("تعذّرت مراجعة الملف بعد التصدير.")
            require(readBack.contentEquals(bytes)) { "لم تتطابق مراجعة ملف النسخة المصدّرة." }
            pendingExportJson = null
            Toast.makeText(this, "تم حفظ نسخة مشفرة والتحقق من تطابق الملف.", Toast.LENGTH_LONG).show()
        } catch (error: Exception) {
            pendingExportJson = null
            Toast.makeText(this, error.message ?: "تعذّر تصدير النسخة.", Toast.LENGTH_LONG).show()
        }
    }

    @Deprecated("Uses the Android document picker for broad device compatibility.")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (resultCode != RESULT_OK) {
            if (requestCode == REQUEST_EXPORT) pendingExportJson = null
            if (requestCode == REQUEST_IMPORT) pendingImportJson = null
            return
        }
        val uri = data?.data
        if (uri == null) {
            if (requestCode == REQUEST_EXPORT) pendingExportJson = null
            if (requestCode == REQUEST_IMPORT) pendingImportJson = null
            return
        }
        when (requestCode) {
            REQUEST_EXPORT -> persistExportFile(uri)
            REQUEST_IMPORT -> handleImportFile(uri)
        }
    }

    private fun showOptionPicker(
        title: String,
        options: List<Pair<String, String>>,
        selected: String,
        onSelected: (String) -> Unit
    ) {
        val selectedIndex = options.indexOfFirst { it.first == selected }.coerceAtLeast(0)
        AlertDialog.Builder(this)
            .setTitle(title)
            .setSingleChoiceItems(options.map { it.second }.toTypedArray(), selectedIndex) { dialog, which ->
                options.getOrNull(which)?.first?.let(onSelected)
                dialog.dismiss()
            }
            .setNegativeButton("إلغاء", null)
            .show()
    }

    private fun fontLabel(key: String): String =
        fontChoices.firstOrNull { it.first == key }?.second ?: "نسخي"

    private fun fontTypeface(key: String): Typeface =
        Typeface.create(if (key == "sans-serif") "sans-serif" else "serif", Typeface.NORMAL)

    private fun textColorFor(key: String): Int = when (key) {
        "black" -> Color.rgb(18, 18, 18)
        "navy" -> Color.rgb(24, 55, 95)
        "green" -> Color.rgb(24, 83, 62)
        "brown" -> Color.rgb(105, 69, 39)
        "wine" -> Color.rgb(115, 45, 56)
        else -> Color.rgb(35, 48, 58)
    }

    private fun textColorLabel(key: String): String =
        textColorChoices.firstOrNull { it.first == key }?.second ?: "فحمي"

    private fun paperLabel(key: String): String =
        paperChoices.firstOrNull { it.first == key }?.second ?: "أبيض"

    private fun paperColor(key: String): Int = when (key) {
        "cream" -> Color.rgb(255, 253, 247)
        "parchment" -> Color.rgb(248, 239, 220)
        "mint" -> Color.rgb(237, 246, 239)
        "blue" -> Color.rgb(238, 244, 251)
        "rose" -> Color.rgb(252, 239, 242)
        else -> Color.WHITE
    }

    private fun paperBorderColor(key: String): Int = when (key) {
        "parchment" -> Color.rgb(211, 190, 151)
        "mint" -> Color.rgb(190, 218, 197)
        "blue" -> Color.rgb(190, 210, 232)
        "rose" -> Color.rgb(231, 197, 205)
        "cream" -> Color.rgb(228, 218, 193)
        else -> border
    }

    private fun paperBackground(key: String, radius: Int): GradientDrawable =
        rounded(intArrayOf(paperColor(key), paperColor(key)), radius, paperBorderColor(key))

    private fun typeName(type: String): String = when (type) {
        "poem" -> "قصيدة"
        "idea" -> "فكرة"
        else -> "نص"
    }

    private fun typeIcon(type: String): String = when (type) {
        "poem" -> "🪶"
        "idea" -> "💡"
        else -> "📜"
    }

    private fun formatDate(timestamp: Long): String =
        DateFormat.getDateInstance(DateFormat.MEDIUM, Locale("ar")).format(Date(timestamp))

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
        onClick: () -> Unit
    ): TextView = TextView(this).apply {
        text = label
        textSize = 13f
        setTextColor(textColor)
        gravity = Gravity.CENTER
        textAlignment = View.TEXT_ALIGNMENT_CENTER
        typeface = Typeface.create("sans-serif", Typeface.BOLD)
        setPadding(dp(12), dp(9), dp(12), dp(9))
        background = rounded(intArrayOf(backgroundColor, backgroundColor), 11)
        isClickable = true
        isFocusable = true
        setOnClickListener { onClick() }
    }

    private fun rounded(colors: IntArray, radius: Int, stroke: Int? = null) =
        GradientDrawable(GradientDrawable.Orientation.TL_BR, colors).apply {
            cornerRadius = dp(radius).toFloat()
            if (stroke != null) setStroke(dp(1), stroke)
        }

    private fun marginTop(value: Int) = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
    ).apply { topMargin = dp(value) }

    private fun marginBottom(value: Int) = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
    ).apply { bottomMargin = dp(value) }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density + 0.5f).toInt()

    private val preferences by lazy {
        getSharedPreferences(PREFERENCES_NAME, MODE_PRIVATE)
    }

    companion object {
        private const val PREFERENCES_NAME = "anwar_native_notebook_v1"
        private const val PRIMARY_KEY = "notes_primary_v1"
        private const val BACKUP_KEY = "notes_backup_v1"
        private const val KEY_ALIAS = "anwar_mofakira_notebook_aes_gcm_v1"
        private const val FORMAT_VERSION = 1
        private const val PAGE_SIZE = 50
        private const val MAX_NOTES = 2500
        private const val MAX_TITLE_LENGTH = 300
        private const val MAX_CONTENT_LENGTH = 450_000
        private const val MAX_PLAINTEXT_BYTES = 6 * 1024 * 1024
        private const val MAX_HISTORY = 15
        // Shared envelope format lets PWA and Android open each other's encrypted backups.
        private const val PORTABLE_FORMAT = "anwar-vault"
        private const val PORTABLE_VERSION = 1
        private const val PORTABLE_KDF = "PBKDF2-HMAC-SHA-256"
        private const val PORTABLE_CIPHER = "AES-256-GCM"
        private const val PORTABLE_ITERATIONS = 600_000
        private const val MIN_EXPORT_PASSWORD_LENGTH = 12
        private const val MAX_EXPORT_PASSWORD_LENGTH = 2048
        private const val MAX_PORTABLE_PLAINTEXT_BYTES = 8 * 1024 * 1024
        private const val MAX_PORTABLE_CIPHERTEXT_BYTES = 8 * 1024 * 1024
        private const val MAX_PORTABLE_FILE_BYTES = 12 * 1024 * 1024
        private const val REQUEST_EXPORT = 7301
        private const val REQUEST_IMPORT = 7302
        private val ALLOWED_TYPES = setOf("poem", "text", "idea")
    }
}
