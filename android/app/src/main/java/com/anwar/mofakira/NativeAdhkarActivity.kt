package com.anwar.mofakira

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.text.InputFilter
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

/**
 * Native personal protective-adhkar notebook.
 *
 * Entries are private to this app installation. The legacy web store is left
 * untouched and remains reachable until a separately tested import/export
 * bridge is available.
 */
class NativeAdhkarActivity : Activity() {
    private data class Entry(
        val id: String,
        val text: String,
        val updatedAt: Long
    )

    private val green = Color.rgb(13, 59, 50)
    private val navy = Color.rgb(9, 38, 77)
    private val gold = Color.rgb(201, 169, 106)
    private val cream = Color.rgb(247, 243, 234)
    private val ink = Color.rgb(35, 48, 58)
    private val muted = Color.rgb(101, 112, 120)
    private val border = Color.rgb(229, 222, 208)

    private val entries = mutableListOf<Entry>()
    private var storageAvailable = true
    private var storageFailureMessage = ""

    private lateinit var listContainer: LinearLayout
    private lateinit var countLabel: TextView
    private lateinit var manageButton: TextView

    private var managerDialog: AlertDialog? = null
    private var managerContent: LinearLayout? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = navy
        window.navigationBarColor = navy
        window.decorView.layoutDirection = View.LAYOUT_DIRECTION_RTL
        loadEntries()
        setContentView(buildScreen())
        renderEntries()
    }

    private fun buildScreen(): View {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            setBackgroundColor(cream)
        }

        val scroll = ScrollView(this).apply {
            isFillViewport = true
            clipToPadding = false
        }
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            setPadding(dp(18), dp(18), dp(18), dp(28))
        }
        scroll.addView(content)
        root.addView(scroll, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            0,
            1f
        ))

        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
        }
        header.addView(button("رجوع", Color.WHITE, green) { finish() },
            LinearLayout.LayoutParams(dp(76), dp(42)))
        header.addView(text("أذكار التحصين", 21f, navy, true),
            LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        content.addView(header)

        content.addView(text(
            "مساحتك الخاصة لحفظ الأذكار التي تختارها",
            13f,
            muted,
            top = 9,
            bottom = 14
        ))

        val privacyCard = card(Color.rgb(255, 250, 239))
        privacyCard.addView(text(
            "خصوصية وحفظ محلي",
            13f,
            green,
            true,
            bottom = 5
        ))
        privacyCard.addView(text(
            "النصوص التي تضيفها هنا تحفظ داخل هذا التطبيق على جهازك، ولا تُنشر ولا تُرسل إلى خادم.",
            12f,
            muted
        ))
        content.addView(privacyCard)

        countLabel = text("لا توجد أذكار محفوظة بعد", 12f, muted, top = 18, bottom = 8)
        content.addView(countLabel)

        content.addView(button("＋  إضافة ذكر", green, Color.WHITE) {
            showEditor(null)
        }, marginTop(3))

        manageButton = button("إدارة الأذكار المحفوظة (0)", Color.WHITE, green) {
            showManager()
        }
        content.addView(manageButton, marginTop(9))

        listContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
        }
        content.addView(listContainer, marginTop(14))

        val legacyCard = card(Color.rgb(255, 249, 234), gold)
        legacyCard.addView(text(
            "الأذكار المحفوظة في النسخة السابقة",
            13f,
            navy,
            true,
            bottom = 5
        ))
        legacyCard.addView(text(
            "تبقى محفوظة في شاشة المفكرة الكاملة، ولم نغيّرها أو ننقلها تلقائيًا. افتح النسخة الكاملة للوصول إليها وإلى خيارات الخطوط.",
            11f,
            muted
        ))
        legacyCard.addView(button("فتح النسخة الكاملة", Color.WHITE, navy) {
            startActivity(Intent(this, LegacyWebActivity::class.java))
        }, marginTop(10))
        content.addView(legacyCard, marginTop(18))

        return root
    }

    private fun renderEntries() {
        listContainer.removeAllViews()
        val size = entries.size
        countLabel.text = if (size == 0) {
            "لا توجد أذكار محفوظة بعد"
        } else {
            "الأذكار المحفوظة على هذا الجهاز: " + size
        }
        manageButton.text = "إدارة الأذكار المحفوظة (" + size + ")"

        if (entries.isEmpty()) {
            val empty = card(Color.WHITE)
            empty.addView(text(
                "لم تضف أي ذكر بعد",
                15f,
                green,
                true,
                bottom = 6
            ))
            empty.addView(text(
                "اضغط «إضافة ذكر» لكتابة النص الذي تريد الاحتفاظ به.",
                12f,
                muted
            ))
            listContainer.addView(empty)
            return
        }

        if (!storageAvailable) {
            val warning = card(Color.rgb(255, 244, 234), Color.rgb(224, 184, 157))
            warning.addView(text(storageFailureMessage, 12f, Color.rgb(133, 63, 43), true))
            listContainer.addView(warning)
            manageButton.isEnabled = false
            manageButton.alpha = 0.45f
            return
        }

        entries.forEachIndexed { index, entry ->
            val item = card(Color.WHITE)
            item.addView(text("ذكر " + (index + 1), 10f, muted, bottom = 6))
            item.addView(text(entry.text, 18f, ink).apply {
                setLineSpacing(dp(5).toFloat(), 1f)
                setTextIsSelectable(true)
            })
            listContainer.addView(item, marginTop(8))
        }
    }

    private fun showEditor(existing: Entry?) {
        if (!storageAvailable) {
            Toast.makeText(this, storageFailureMessage, Toast.LENGTH_LONG).show()
            return
        }
        val editor = EditText(this).apply {
            setText(existing?.text.orEmpty())
            textSize = 17f
            setTextColor(ink)
            setHintTextColor(muted)
            hint = "اكتب نص الذكر هنا"
            gravity = Gravity.TOP or Gravity.END
            textAlignment = View.TEXT_ALIGNMENT_VIEW_END
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            inputType = InputType.TYPE_CLASS_TEXT or
                InputType.TYPE_TEXT_FLAG_MULTI_LINE or
                InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
            minLines = 4
            maxLines = 9
            filters = arrayOf(InputFilter.LengthFilter(MAX_TEXT_LENGTH))
            setPadding(dp(13), dp(12), dp(13), dp(12))
            background = rounded(Color.WHITE, 12, border)
        }
        val frame = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(19), dp(8), dp(19), dp(4))
            addView(editor, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ))
            addView(text(
                "نص واحد بلا عنوان. الحد الأقصى " + MAX_TEXT_LENGTH + " محرف.",
                10f,
                muted,
                top = 7
            ))
        }

        val dialog = AlertDialog.Builder(this)
            .setTitle(if (existing == null) "إضافة ذكر" else "تعديل الذكر")
            .setView(frame)
            .setPositiveButton("حفظ", null)
            .setNegativeButton("إلغاء", null)
            .create()

        dialog.setOnShowListener {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                val value = editor.text.toString()
                    .replace("\r\n", "\n")
                    .trim()
                if (value.isBlank()) {
                    editor.error = "اكتب نص الذكر أولًا"
                    editor.requestFocus()
                    return@setOnClickListener
                }
                if (value.length > MAX_TEXT_LENGTH) {
                    editor.error = "تجاوز النص الحد المسموح"
                    return@setOnClickListener
                }

                val previousEntries = entries.toList()
                if (existing == null) {
                    if (entries.size >= MAX_ENTRIES) {
                        Toast.makeText(
                            this,
                            "بلغت الحد الأقصى وهو " + MAX_ENTRIES + " ذكرًا",
                            Toast.LENGTH_LONG
                        ).show()
                        return@setOnClickListener
                    }
                    entries.add(0, Entry(UUID.randomUUID().toString(), value, System.currentTimeMillis()))
                } else {
                    val index = entries.indexOfFirst { it.id == existing.id }
                    if (index < 0) {
                        Toast.makeText(this, "لم نعثر على الذكر المطلوب تعديله", Toast.LENGTH_LONG).show()
                        dialog.dismiss()
                        return@setOnClickListener
                    }
                    entries[index] = existing.copy(text = value, updatedAt = System.currentTimeMillis())
                }
                if (!saveEntries()) {
                    entries.clear()
                    entries.addAll(previousEntries)
                    Toast.makeText(this, storageFailureMessage, Toast.LENGTH_LONG).show()
                    renderEntries()
                    return@setOnClickListener
                }
                renderEntries()
                managerContent?.let { populateManager(it) }
                dialog.dismiss()
                Toast.makeText(this, "حُفظ الذكر مشفرًا على هذا الجهاز", Toast.LENGTH_SHORT).show()
            }
        }
        dialog.show()
        editor.requestFocus()
    }

    private fun showManager() {
        if (!storageAvailable) {
            Toast.makeText(this, storageFailureMessage, Toast.LENGTH_LONG).show()
            return
        }
        val body = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            setPadding(dp(15), dp(5), dp(15), dp(5))
        }
        val scroll = ScrollView(this).apply {
            addView(body)
            isFillViewport = true
        }
        val dialog = AlertDialog.Builder(this)
            .setTitle("إدارة أذكارك")
            .setView(scroll)
            .setNegativeButton("إغلاق", null)
            .create()
        managerDialog = dialog
        managerContent = body
        dialog.setOnDismissListener {
            if (managerDialog === dialog) {
                managerDialog = null
                managerContent = null
            }
        }
        dialog.show()
        populateManager(body)
    }

    private fun populateManager(container: LinearLayout) {
        container.removeAllViews()
        if (entries.isEmpty()) {
            container.addView(text("لا توجد عناصر لإدارتها.", 13f, muted, bottom = 8))
            return
        }

        entries.toList().forEachIndexed { index, entry ->
            val item = card(Color.WHITE)
            item.addView(text("ذكر " + (index + 1), 10f, muted, bottom = 4))
            item.addView(text(entry.text, 13f, ink).apply {
                maxLines = 3
                ellipsize = android.text.TextUtils.TruncateAt.END
            })
            val actions = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                layoutDirection = View.LAYOUT_DIRECTION_RTL
            }
            actions.addView(button("تعديل", Color.rgb(236, 242, 237), green) {
                showEditor(entry)
            }, LinearLayout.LayoutParams(0, dp(38), 1f).apply {
                marginEnd = dp(4)
            })
            actions.addView(button("حذف", Color.rgb(250, 238, 235), Color.rgb(143, 62, 52)) {
                confirmDelete(entry)
            }, LinearLayout.LayoutParams(0, dp(38), 1f).apply {
                marginStart = dp(4)
            })
            item.addView(actions, marginTop(9))
            container.addView(item, marginTop(if (index == 0) 0 else 8))
        }
    }

    private fun confirmDelete(entry: Entry) {
        if (!storageAvailable) return
        AlertDialog.Builder(this)
            .setTitle("حذف الذكر")
            .setMessage("سيُحذف هذا النص من أذكارك المحفوظة على هذا الجهاز.")
            .setPositiveButton("حذف") { _, _ ->
                val previousEntries = entries.toList()
                entries.removeAll { it.id == entry.id }
                if (!saveEntries()) {
                    entries.clear()
                    entries.addAll(previousEntries)
                    Toast.makeText(this, storageFailureMessage, Toast.LENGTH_LONG).show()
                }
                renderEntries()
                managerContent?.let { populateManager(it) }
            }
            .setNegativeButton("إلغاء", null)
            .show()
    }

    private fun loadEntries() {
        entries.clear()
        try {
            val raw = AnwarEncryptedStore.readOrMigrate(
                this,
                STORE_NAMESPACE,
                PREFS_NAME,
                KEY_ENTRIES,
                "[]"
            ) ?: "[]"
            val array = JSONArray(raw)
            for (index in 0 until array.length()) {
                val item = array.optJSONObject(index) ?: continue
                val id = item.optString("id").takeIf { it.isNotBlank() } ?: continue
                val value = item.optString("text").trim()
                if (value.isBlank() || value.length > MAX_TEXT_LENGTH) continue
                entries.add(Entry(id, value, item.optLong("updatedAt", 0L)))
                if (entries.size >= MAX_ENTRIES) break
            }
        } catch (error: Exception) {
            entries.clear()
            storageAvailable = false
            storageFailureMessage = error.message
                ?: "تعذّر فتح الأذكار المشفرة. احتفظنا بالبيانات القديمة وأوقفنا التعديل."
        }
    }

    private fun saveEntries(): Boolean {
        if (!storageAvailable) return false
        val array = JSONArray()
        entries.take(MAX_ENTRIES).forEach { entry ->
            array.put(JSONObject()
                .put("id", entry.id)
                .put("text", entry.text)
                .put("updatedAt", entry.updatedAt))
        }
        return try {
            AnwarEncryptedStore.write(this, STORE_NAMESPACE, array.toString())
            true
        } catch (error: Exception) {
            storageAvailable = false
            storageFailureMessage = error.message
                ?: "تعذّر حفظ الأذكار المشفرة. أوقفنا التعديل حمايةً لبياناتك."
            false
        }
    }

    private fun card(backgroundColor: Int, stroke: Int? = border) = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        layoutDirection = View.LAYOUT_DIRECTION_RTL
        setPadding(dp(14), dp(12), dp(14), dp(12))
        background = rounded(backgroundColor, 14, stroke)
        elevation = dp(1).toFloat()
    }

    private fun text(
        value: String,
        size: Float,
        color: Int,
        bold: Boolean = false,
        top: Int = 0,
        bottom: Int = 0
    ) = TextView(this).apply {
        text = value
        textSize = size
        setTextColor(color)
        gravity = Gravity.END
        textAlignment = View.TEXT_ALIGNMENT_VIEW_END
        layoutDirection = View.LAYOUT_DIRECTION_RTL
        if (bold) typeface = Typeface.create("sans-serif", Typeface.BOLD)
        setPadding(0, dp(top), 0, dp(bottom))
    }

    private fun button(
        label: String,
        backgroundColor: Int,
        textColor: Int,
        action: () -> Unit
    ) = TextView(this).apply {
        text = label
        textSize = 12f
        setTextColor(textColor)
        gravity = Gravity.CENTER
        typeface = Typeface.create("sans-serif", Typeface.BOLD)
        setPadding(dp(10), dp(9), dp(10), dp(9))
        background = rounded(backgroundColor, 12, if (backgroundColor == Color.WHITE) border else null)
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

    private fun marginTop(value: Int) = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
    ).apply { topMargin = dp(value) }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density + 0.5f).toInt()

    companion object {
        private const val PREFS_NAME = "anwar_personal_adhkar"
        private const val KEY_ENTRIES = "entries_v1"
        private const val STORE_NAMESPACE = "personal.adhkar.entries.v1"
        private const val MAX_TEXT_LENGTH = 3000
        private const val MAX_ENTRIES = 100
    }
}
