package com.anwar.mofakira

import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Paint
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.Bundle
import android.os.ParcelFileDescriptor
import android.provider.OpenableColumns
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.SeekBar
import android.widget.TextView
import android.widget.Toast
import java.util.concurrent.Executors
import kotlin.math.sqrt

/**
 * Native, local-only PDF reader for books selected by the user.
 *
 * No catalogue files are bundled until a direct source and reuse licence are verified.
 * The existing complete library remains available through the compatibility route.
 */
class NativePdfLibraryActivity : Activity() {
    private val navy = Color.rgb(9, 38, 77)
    private val green = Color.rgb(13, 59, 50)
    private val gold = Color.rgb(201, 169, 106)
    private val cream = Color.rgb(247, 243, 234)
    private val muted = Color.rgb(101, 112, 120)
    private val border = Color.rgb(224, 216, 200)

    private val renderExecutor = Executors.newSingleThreadExecutor()
    private val renderLock = Any()
    private var pdfRenderer: PdfRenderer? = null
    private var fileDescriptor: ParcelFileDescriptor? = null
    private var currentUri: Uri? = null
    private var currentName = ""
    private var currentPage = 0
    private var zoomFactor = 1f
    private var renderGeneration = 0

    private lateinit var pageImage: ImageView
    private lateinit var pageLabel: TextView
    private lateinit var statusLabel: TextView
    private lateinit var previousButton: TextView
    private lateinit var nextButton: TextView
    private lateinit var zoomLabel: TextView
    private lateinit var zoomSeekBar: SeekBar
    private lateinit var pageScroll: ScrollView
    private lateinit var pageHorizontalScroll: HorizontalScrollView
    private lateinit var openLastButton: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = navy
        window.navigationBarColor = navy
        window.decorView.layoutDirection = View.LAYOUT_DIRECTION_RTL
        setContentView(buildScreen())
        updateLastBookAction()
    }

    override fun onDestroy() {
        renderGeneration += 1
        closeDocument()
        renderExecutor.shutdownNow()
        super.onDestroy()
    }

    private fun buildScreen(): View {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            setBackgroundColor(cream)
            setPadding(dp(13), dp(12), dp(13), dp(10))
        }

        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
        }
        header.addView(actionButton("رجوع", Color.WHITE, navy) { finish() },
            LinearLayout.LayoutParams(dp(66), dp(42)))
        header.addView(text("قارئ الكتب PDF", 19f, navy, true),
            LinearLayout.LayoutParams(0, dp(46), 1f).apply { marginEnd = dp(10) })
        root.addView(header)

        root.addView(text(
            "افتح ملف PDF من جهازك. تتم القراءة على الهاتف دون رفع الملف إلى خادم.",
            11f, muted, top = 5, bottom = 10
        ))

        val actions = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
        }
        actions.addView(actionButton("اختيار كتاب PDF", gold, navy) {
            openDocumentPicker()
        }, LinearLayout.LayoutParams(0, dp(44), 1f).apply {
            marginStart = dp(4)
            marginEnd = dp(4)
        })
        openLastButton = actionButton("آخر كتاب", Color.WHITE, navy) {
            openLastDocument()
        }
        actions.addView(openLastButton, LinearLayout.LayoutParams(0, dp(44), 1f).apply {
            marginStart = dp(4)
            marginEnd = dp(4)
        })
        root.addView(actions)

        statusLabel = text("لم يُفتح كتاب بعد.", 10f, muted, top = 8, bottom = 5)
        root.addView(statusLabel)
        pageLabel = text("—", 11f, green, true, bottom = 4)
        root.addView(pageLabel)

        val zoomRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
        }
        zoomRow.addView(text("تكبير", 10f, muted, true),
            LinearLayout.LayoutParams(dp(48), dp(35)))
        zoomSeekBar = SeekBar(this).apply {
            max = 100
            progress = DEFAULT_ZOOM_PROGRESS
            setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                    zoomFactor = zoomForProgress(progress)
                    zoomLabel.text = (zoomFactor * 100).toInt().toString() + "٪"
                }
                override fun onStartTrackingTouch(seekBar: SeekBar?) = Unit
                override fun onStopTrackingTouch(seekBar: SeekBar?) {
                    if (currentUri != null) renderCurrentPage()
                }
            })
        }
        zoomRow.addView(zoomSeekBar, LinearLayout.LayoutParams(0, dp(35), 1f))
        zoomLabel = text("100٪", 10f, navy, true)
        zoomRow.addView(zoomLabel, LinearLayout.LayoutParams(dp(52), dp(35)))
        root.addView(zoomRow)

        pageImage = ImageView(this).apply {
            adjustViewBounds = true
            scaleType = ImageView.ScaleType.FIT_CENTER
            setBackgroundColor(Color.WHITE)
            contentDescription = "صفحة كتاب PDF"
        }
        pageHorizontalScroll = HorizontalScrollView(this).apply {
            isFillViewport = true
            isHorizontalScrollBarEnabled = true
            addView(pageImage, FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
            ))
        }
        pageScroll = ScrollView(this).apply {
            isFillViewport = true
            clipToPadding = false
            setPadding(dp(3), dp(3), dp(3), dp(3))
            setBackgroundColor(Color.rgb(232, 229, 220))
            addView(pageHorizontalScroll, FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            ))
        }
        root.addView(pageScroll, LinearLayout.LayoutParams(0, 0, 1f).apply {
            topMargin = dp(7)
            bottomMargin = dp(8)
        })

        val pageControls = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            gravity = Gravity.CENTER
        }
        previousButton = actionButton("الصفحة السابقة", Color.WHITE, navy) {
            changePage(-1)
        }
        nextButton = actionButton("الصفحة التالية", Color.WHITE, navy) {
            changePage(1)
        }
        pageControls.addView(previousButton, LinearLayout.LayoutParams(0, dp(42), 1f).apply {
            marginStart = dp(4)
            marginEnd = dp(4)
        })
        pageControls.addView(nextButton, LinearLayout.LayoutParams(0, dp(42), 1f).apply {
            marginStart = dp(4)
            marginEnd = dp(4)
        })
        root.addView(pageControls)
        updatePageControls(enabled = false)
        return root
    }

    private fun openDocumentPicker() {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = PDF_MIME
        }
        runCatching { startActivityForResult(intent, REQUEST_OPEN_PDF) }
            .onFailure { error ->
                statusLabel.text = error.message ?: "تعذّر فتح منتقي الملفات."
            }
    }

    private fun openLastDocument() {
        val value = preferences.getString(KEY_LAST_URI, null)
        val uri = runCatching { value?.let(Uri::parse) }.getOrNull()
        if (uri == null) {
            Toast.makeText(this, "لم تفتح كتاباً من قبل.", Toast.LENGTH_SHORT).show()
            return
        }
        openPdf(uri, restoreLastPage = true)
    }

    @Deprecated("Uses Android document picker for broad device compatibility.")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != REQUEST_OPEN_PDF || resultCode != RESULT_OK) return
        val uri = data?.data ?: return
        val grantedFlags = data.flags and Intent.FLAG_GRANT_READ_URI_PERMISSION
        if (grantedFlags != 0) {
            runCatching { contentResolver.takePersistableUriPermission(uri, grantedFlags) }
        }
        openPdf(uri, restoreLastPage = false)
    }

    private fun openPdf(uri: Uri, restoreLastPage: Boolean) {
        closeDocument()
        statusLabel.text = "جارٍ فتح ملف PDF…"
        try {
            val descriptor = contentResolver.openFileDescriptor(uri, "r")
                ?: throw IllegalStateException("تعذّر فتح الملف للقراءة.")
            val fileSize = descriptor.statSize
            if (fileSize <= 0L) {
                descriptor.close()
                throw IllegalArgumentException(
                    "تعذّر التحقق من حجم ملف PDF. احفظ نسخة محلية معروفة الحجم ثم أعد اختيارها."
                )
            }
            if (fileSize > MAX_PDF_FILE_BYTES) {
                descriptor.close()
                throw IllegalArgumentException("حجم الكتاب يتجاوز 100 ميغابايت. اختر نسخة أصغر.")
            }
            val renderer = try {
                PdfRenderer(descriptor)
            } catch (error: Exception) {
                descriptor.close()
                throw error
            }
            if (renderer.pageCount <= 0) {
                renderer.close()
                descriptor.close()
                throw IllegalStateException("هذا الملف لا يحتوي صفحات PDF قابلة للعرض.")
            }
            if (renderer.pageCount > MAX_PDF_PAGES) {
                val count = renderer.pageCount
                renderer.close()
                descriptor.close()
                throw IllegalArgumentException("الكتاب يحتوي على $count صفحة، والحد الحالي $MAX_PDF_PAGES صفحة.")
            }
            synchronized(renderLock) {
                fileDescriptor = descriptor
                pdfRenderer = renderer
            }
            currentUri = uri
            currentName = queryDisplayName(uri) ?: uri.lastPathSegment ?: "كتاب PDF"
            val storedUri = preferences.getString(KEY_LAST_URI, null)
            currentPage = if (restoreLastPage && storedUri == uri.toString()) {
                preferences.getInt(KEY_LAST_PAGE, 0).coerceIn(0, renderer.pageCount - 1)
            } else {
                0
            }
            preferences.edit()
                .putString(KEY_LAST_URI, uri.toString())
                .putString(KEY_LAST_NAME, currentName)
                .putInt(KEY_LAST_PAGE, currentPage)
                .apply()
            statusLabel.text = "كتاب محلي: " + currentName
            updatePageControls(enabled = true)
            renderCurrentPage()
        } catch (error: Exception) {
            closeDocument()
            currentUri = null
            statusLabel.text = error.message ?: "تعذّر قراءة ملف PDF. قد يكون محمياً بكلمة مرور أو تالفاً."
            updatePageControls(enabled = false)
        }
        updateLastBookAction()
    }

    private fun queryDisplayName(uri: Uri): String? =
        runCatching {
            contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val column = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    if (column >= 0) cursor.getString(column) else null
                } else null
            }
        }.getOrNull()

    private fun changePage(delta: Int) {
        val renderer = pdfRenderer ?: return
        val next = (currentPage + delta).coerceIn(0, renderer.pageCount - 1)
        if (next == currentPage) return
        currentPage = next
        preferences.edit().putInt(KEY_LAST_PAGE, currentPage).apply()
        renderCurrentPage()
    }

    private fun renderCurrentPage() {
        val renderer = pdfRenderer ?: return
        val index = currentPage
        val generation = ++renderGeneration
        val targetWidth = (resources.displayMetrics.widthPixels * 0.92f * zoomFactor)
            .toInt()
            .coerceIn(MIN_RENDER_WIDTH, MAX_RENDER_WIDTH)
        statusLabel.text = "جارٍ تجهيز الصفحة " + (index + 1) + "…"

        renderExecutor.execute {
            val result = runCatching {
                synchronized(renderLock) {
                    require(pdfRenderer === renderer) { "تم تغيير الكتاب المفتوح." }
                    renderer.openPage(index).use { page ->
                        var width = targetWidth
                        var height = (width.toDouble() * page.height / page.width).toInt().coerceAtLeast(1)
                        val pixels = width.toLong() * height.toLong()
                        if (pixels > MAX_BITMAP_PIXELS) {
                            val shrink = sqrt(MAX_BITMAP_PIXELS.toDouble() / pixels.toDouble())
                            width = (width * shrink).toInt().coerceAtLeast(1)
                            height = (height * shrink).toInt().coerceAtLeast(1)
                        }
                        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
                        bitmap.eraseColor(Color.WHITE)
                        page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                        bitmap
                    }
                }
            }
            runOnUiThread {
                if (generation != renderGeneration || isFinishing || isDestroyed) {
                    result.getOrNull()?.recycle()
                    return@runOnUiThread
                }
                result.onSuccess { bitmap ->
                    pageImage.setImageBitmap(bitmap)
                    pageImage.layoutParams = pageImage.layoutParams.apply {
                        width = bitmap.width
                        height = bitmap.height
                    }
                    pageLabel.text = "الصفحة " + (currentPage + 1) + " من " + renderer.pageCount
                    statusLabel.text = currentName
                    updatePageControls(enabled = true)
                    pageScroll.post { pageScroll.scrollTo(0, 0) }
                }.onFailure { error ->
                    statusLabel.text = error.message ?: "تعذّر عرض الصفحة."
                }
            }
        }
    }

    private fun updatePageControls(enabled: Boolean) {
        val count = pdfRenderer?.pageCount ?: 0
        pageLabel.text = if (count > 0) "الصفحة " + (currentPage + 1) + " من " + count else "—"
        previousButton.isEnabled = enabled && currentPage > 0
        previousButton.alpha = if (previousButton.isEnabled) 1f else 0.45f
        nextButton.isEnabled = enabled && currentPage < count - 1
        nextButton.alpha = if (nextButton.isEnabled) 1f else 0.45f
    }

    private fun updateLastBookAction() {
        val uri = preferences.getString(KEY_LAST_URI, null)
        val name = preferences.getString(KEY_LAST_NAME, null)
        openLastButton.isEnabled = !uri.isNullOrBlank()
        openLastButton.alpha = if (openLastButton.isEnabled) 1f else 0.45f
        if (!name.isNullOrBlank() && statusLabel.text == "لم يُفتح كتاب بعد.") {
            statusLabel.text = "آخر كتاب: " + name
        }
    }

    private fun closeDocument() {
        synchronized(renderLock) {
            runCatching { pdfRenderer?.close() }
            pdfRenderer = null
            runCatching { fileDescriptor?.close() }
            fileDescriptor = null
        }
        currentUri = null
        currentName = ""
        pageImage.setImageDrawable(null)
        pageLabel.text = "—"
    }

    private fun zoomForProgress(progress: Int): Float =
        MIN_ZOOM + (MAX_ZOOM - MIN_ZOOM) * progress.coerceIn(0, 100) / 100f

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
        gravity = Gravity.END or Gravity.CENTER_VERTICAL
        textAlignment = View.TEXT_ALIGNMENT_VIEW_END
        layoutDirection = View.LAYOUT_DIRECTION_RTL
        if (bold) typeface = android.graphics.Typeface.create("sans-serif", android.graphics.Typeface.BOLD)
        setPadding(0, dp(top), 0, dp(bottom))
    }

    private fun actionButton(label: String, backgroundColor: Int, textColor: Int, onClick: () -> Unit): TextView =
        TextView(this).apply {
            text = label
            textSize = 12f
            setTextColor(textColor)
            gravity = Gravity.CENTER
            textAlignment = View.TEXT_ALIGNMENT_CENTER
            typeface = android.graphics.Typeface.create("sans-serif", android.graphics.Typeface.BOLD)
            setPadding(dp(8), dp(8), dp(8), dp(8))
            background = android.graphics.drawable.GradientDrawable().apply {
                setColor(backgroundColor)
                cornerRadius = dp(11).toFloat()
                setStroke(dp(1), border)
            }
            isClickable = true
            isFocusable = true
            setOnClickListener { onClick() }
        }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density + 0.5f).toInt()

    private val preferences by lazy {
        getSharedPreferences(PREFERENCES_NAME, MODE_PRIVATE)
    }

    companion object {
        private const val PREFERENCES_NAME = "anwar_native_pdf_library_v1"
        private const val KEY_LAST_URI = "last_pdf_uri"
        private const val KEY_LAST_NAME = "last_pdf_name"
        private const val KEY_LAST_PAGE = "last_pdf_page"
        private const val PDF_MIME = "application/pdf"
        private const val REQUEST_OPEN_PDF = 8121
        private const val DEFAULT_ZOOM_PROGRESS = 17
        private const val MIN_ZOOM = 0.75f
        private const val MAX_ZOOM = 2.25f
        private const val MIN_RENDER_WIDTH = 480
        private const val MAX_RENDER_WIDTH = 2400
        private const val MAX_BITMAP_PIXELS = 8_000_000L
        private const val MAX_PDF_FILE_BYTES = 100L * 1024L * 1024L
        private const val MAX_PDF_PAGES = 2_000
    }
}
