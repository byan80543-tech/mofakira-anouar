package com.anwar.mofakira

import android.app.Activity
import android.app.AlertDialog
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
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
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import java.text.DateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
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
    private data class Note(
        val id: String,
        val title: String,
        val type: String,
        val text: String,
        val pinned: Boolean,
        val updatedAt: Long
    )

    private val navy = Color.rgb(9, 38, 77)
    private val green = Color.rgb(13, 59, 50)
    private val gold = Color.rgb(201, 169, 106)
    private val cream = Color.rgb(247, 243, 234)
    private val ink = Color.rgb(35, 48, 58)
    private val muted = Color.rgb(101, 112, 120)
    private val border = Color.rgb(224, 216, 200)

    private val notes = mutableListOf<Note>()
    private var activeFilter = "all"
    private var storageAvailable = true
    private var storageMessage = ""

    private lateinit var rootContent: LinearLayout
    private lateinit var noteContainer: LinearLayout
    private lateinit var filterContainer: LinearLayout
    private lateinit var searchInput: EditText
    private lateinit var countLabel: TextView
    private lateinit var addButton: TextView
    private lateinit var storageNotice: TextView

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
        val scroll = ScrollView(this).apply {
            setBackgroundColor(cream)
            isFillViewport = true
            clipToPadding = false
        }
        rootContent = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            setPadding(dp(15), dp(16), dp(15), dp(28))
        }
        scroll.addView(rootContent)

        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
        }
        val heading = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
        }
        heading.addView(text("دفتر الكتابة", 24f, navy, true))
        heading.addView(text("قصائدك ونصوصك وأفكارك في مكان واحد", 12f, muted, top = 3))
        header.addView(heading, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        header.addView(actionButton("رجوع", Color.WHITE, navy) { finish() })
        rootContent.addView(header)

        val intro = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            setPadding(dp(16), dp(15), dp(16), dp(15))
            background = rounded(intArrayOf(green, navy), 18)
        }
        intro.addView(text("مساحة هادئة للكلمة", 17f, Color.WHITE, true, bottom = 5))
        intro.addView(text(
            "أنشئ قصيدة أو نصًا أو فكرة، واحتفظ بها محليًا على هذا الجهاز.",
            12f,
            Color.rgb(239, 235, 222)
        ))
        rootContent.addView(intro, marginTop(15))

        countLabel = text("", 11f, muted, top = 16, bottom = 7)
        rootContent.addView(countLabel)

        storageNotice = text("", 11f, Color.rgb(133, 63, 43), true)
        storageNotice.setPadding(dp(12), dp(10), dp(12), dp(10))
        storageNotice.background = rounded(intArrayOf(Color.rgb(255, 244, 234), Color.rgb(255, 244, 234)), 11, Color.rgb(224, 184, 157))
        storageNotice.visibility = View.GONE
        rootContent.addView(storageNotice, marginBottom(10))

        searchInput = EditText(this).apply {
            hint = "ابحث في العناوين والمحتوى…"
            textSize = 14f
            singleLine = true
            setTextColor(ink)
            setHintTextColor(muted)
            gravity = Gravity.CENTER_VERTICAL or Gravity.END
            textAlignment = View.TEXT_ALIGNMENT_VIEW_END
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
            setPadding(dp(13), dp(10), dp(13), dp(10))
            background = rounded(intArrayOf(Color.WHITE, Color.WHITE), 12, border)
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
        rootContent.addView(filterScroll, marginBottom(11))

        addButton = actionButton("＋ عمل جديد", gold, navy) { showEditor(null) }
        addButton.textSize = 15f
        rootContent.addView(addButton, marginBottom(12))

        noteContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
        }
        rootContent.addView(noteContainer)
        return scroll
    }

    private fun renderFilters() {
        filterContainer.removeAllViews()
        val filters = listOf(
            "all" to "الكل",
            "poem" to "قصائد",
            "text" to "نصوص",
            "idea" to "أفكار",
            "pinned" to "المثبتة"
        )
        filters.forEach { (key, label) ->
            val selected = activeFilter == key
            val chip = actionButton(
                label,
                if (selected) green else Color.WHITE,
                if (selected) Color.WHITE else ink
            ) {
                activeFilter = key
                renderFilters()
                renderNotes()
            }
            chip.textSize = 12f
            filterContainer.addView(chip, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                dp(38)
            ).apply {
                marginEnd = dp(5)
                marginStart = dp(5)
            })
        }
    }

    private fun renderNotes() {
        if (!::noteContainer.isInitialized) return
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

        if (!storageAvailable) {
            storageNotice.text = storageMessage
            storageNotice.visibility = View.VISIBLE
            addButton.isEnabled = false
            addButton.alpha = 0.45f
        } else {
            storageNotice.visibility = View.GONE
            addButton.isEnabled = true
            addButton.alpha = 1f
        }

        if (filtered.isEmpty()) {
            val empty = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER
                layoutDirection = View.LAYOUT_DIRECTION_RTL
                setPadding(dp(18), dp(24), dp(18), dp(24))
                background = rounded(intArrayOf(Color.WHITE, Color.WHITE), 15, border)
            }
            empty.addView(text(
                if (notes.isEmpty()) "لم تبدأ الكتابة بعد" else "لا توجد نتائج مطابقة",
                15f, green, true, bottom = 7
            ).apply { gravity = Gravity.CENTER })
            empty.addView(text(
                if (notes.isEmpty()) "اضغط «عمل جديد» لتكتب أول قصيدة أو نص أو فكرة." else "جرّب كلمة بحث أخرى أو غيّر نوع العرض.",
                11f, muted
            ).apply { gravity = Gravity.CENTER })
            noteContainer.addView(empty)
            return
        }

        filtered.forEachIndexed { index, note ->
            noteContainer.addView(noteCard(note), marginBottom(if (index == filtered.lastIndex) 0 else 9))
        }
    }

    private fun noteCard(note: Note): View {
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            setPadding(dp(14), dp(12), dp(14), dp(12))
            background = rounded(intArrayOf(Color.WHITE, Color.rgb(255, 253, 247)), 15, border)
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
        card.addView(text(
            preview.ifBlank { "لا يوجد محتوى نصي" },
            12f, ink
        ))
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
            textSize = 17f
            setTextColor(ink)
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
            background = rounded(intArrayOf(Color.WHITE, Color.WHITE), 12, border)
        }

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
                val updated = Note(
                    id = existing?.id ?: UUID.randomUUID().toString(),
                    title = title,
                    type = selectedType,
                    text = body,
                    pinned = existing?.pinned ?: false,
                    updatedAt = System.currentTimeMillis()
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
            require(id.isNotBlank() && id.length <= 80 && ids.add(id)) { "معرّف عمل مكرر أو غير صالح." }
            require(title.length <= MAX_TITLE_LENGTH) { "عنوان عمل يتجاوز الحد." }
            require(body.isNotBlank() && body.length <= MAX_CONTENT_LENGTH) { "محتوى عمل غير صالح أو يتجاوز الحد." }
            require(type in ALLOWED_TYPES) { "نوع عمل غير معروف." }
            require(timestamp > 0L) { "تاريخ عمل غير صالح." }
            parsed.add(Note(id, title, type, body, item.optBoolean("pin", false), timestamp))
        }
        return parsed
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
                .put("font", "Amiri")
                .put("size", 20)
                .put("paper", "plain"))
        }
        return JSONObject()
            .put("formatVersion", FORMAT_VERSION)
            .put("notes", array)
            .toString()
            .toByteArray(StandardCharsets.UTF_8)
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
        private const val MAX_NOTES = 2500
        private const val MAX_TITLE_LENGTH = 300
        private const val MAX_CONTENT_LENGTH = 450_000
        private const val MAX_PLAINTEXT_BYTES = 6 * 1024 * 1024
        private val ALLOWED_TYPES = setOf("poem", "text", "idea")
    }
}
