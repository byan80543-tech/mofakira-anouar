package com.anwar.mofakira

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

/**
 * Second gateway: the devotional and religious tools stay grouped here.
 * The system Back action and the visible home control both return to the
 * first Anwar gateway without discarding the first screen.
 */
class ReligiousGateActivity : Activity() {
    private val navy = Color.rgb(9, 38, 77)
    private val green = Color.rgb(13, 59, 50)
    private val gold = Color.rgb(201, 169, 106)
    private val cream = Color.rgb(247, 243, 234)
    private val ink = Color.rgb(35, 48, 58)
    private val muted = Color.rgb(101, 112, 120)

    private data class PortalItem(
        val glyph: String,
        val title: String,
        val description: String,
        val action: () -> Unit
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = navy
        window.navigationBarColor = navy
        window.decorView.layoutDirection = View.LAYOUT_DIRECTION_RTL
        setContentView(buildPortal())
    }

    private fun buildPortal(): View {
        val scroll = ScrollView(this).apply {
            setBackgroundColor(cream)
            isFillViewport = true
            clipToPadding = false
        }
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            setPadding(dp(17), dp(17), dp(17), dp(26))
        }
        scroll.addView(content)

        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            gravity = Gravity.CENTER_VERTICAL
        }
        header.addView(text("الخدمات القرآنية والدينية", 18f, navy, true), LinearLayout.LayoutParams(0, dp(48), 1f))
        val home = TextView(this).apply {
            text = "×"
            textSize = 26f
            setTextColor(navy)
            gravity = Gravity.CENTER
            background = ripple(intArrayOf(Color.WHITE, Color.rgb(255, 253, 248)), 14, gold)
            isClickable = true
            isFocusable = true
            contentDescription = "إغلاق الخدمات والعودة إلى المفكرة"
            setOnClickListener { finish() }
        }
        header.addView(home, LinearLayout.LayoutParams(dp(46), dp(46)))
        content.addView(header)

        content.addView(text("الأقسام الرئيسية", 16f, green, true, top = 18, bottom = 10))
        content.addView(serviceGrid())
        content.addView(actionButton("المكتبة", Color.WHITE, navy) {
            openLibraryOptions()
        }, marginTop(8))
        return scroll
    }

    private fun openLibraryOptions() {
        val options = arrayOf(
            "قارئ الكتب PDF الأصلي من الجهاز",
            "المكتبة الكاملة الحالية"
        )
        AlertDialog.Builder(this)
            .setTitle("مكتبة أنوار")
            .setItems(options) { _, which ->
                when (which) {
                    0 -> startActivity(Intent(this, NativePdfLibraryActivity::class.java))
                    1 -> startActivity(Intent(this, LegacyWebActivity::class.java))
                }
            }
            .setNegativeButton("إغلاق", null)
            .show()
    }

    private fun serviceGrid(): View {
        val rows = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
        }
        val items = listOf(
            PortalItem("🎙️", "أصوات الأذان", "اختيار الصوت والتنبيهات") {
                startActivity(Intent(this, NativePrayerActivity::class.java))
            },
            PortalItem("📖", "القرآن الكريم", "السور والقراء والتلاوات") {
                openAudio(NativeAudioActivity.MODE_QURAN)
            },
            PortalItem("📻", "الإذاعات", "محطات البث المباشر") {
                openAudio(NativeAudioActivity.MODE_RADIO)
            },
            PortalItem("🎧", "الدروس والمحاضرات", "السلاسل والدروس الصوتية") {
                openAudio(NativeAudioActivity.MODE_LESSONS)
            },
            PortalItem("🤲", "أذكار التحصين", "الأذكار اليومية والرقية") {
                startActivity(Intent(this, NativeAdhkarActivity::class.java))
            },
            PortalItem("📿", "السبحة", "") {
                startActivity(Intent(this, NativeTasbihActivity::class.java))
            }
        )

        items.chunked(2).forEach { pair ->
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                layoutDirection = View.LAYOUT_DIRECTION_RTL
            }
            pair.forEach { item ->
                row.addView(serviceTile(item), LinearLayout.LayoutParams(0, dp(143), 1f).apply {
                    marginStart = dp(5)
                    marginEnd = dp(5)
                    bottomMargin = dp(10)
                })
            }
            if (pair.size == 1) row.addView(View(this), LinearLayout.LayoutParams(0, dp(143), 1f))
            rows.addView(row)
        }
        return rows
    }

    private fun serviceTile(item: PortalItem): View {
        val tile = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            gravity = Gravity.CENTER
            setPadding(dp(10), dp(12), dp(10), dp(10))
            background = ripple(intArrayOf(Color.WHITE, Color.rgb(255, 253, 248)), 17, Color.rgb(231, 224, 207))
            elevation = dp(1).toFloat()
            isClickable = true
            isFocusable = true
            contentDescription = item.title
            setOnClickListener { item.action() }
        }
        val icon = TextView(this).apply {
            text = item.glyph
            textSize = 27f
            setTextColor(green)
            gravity = Gravity.CENTER
            background = rounded(intArrayOf(Color.rgb(249, 241, 222), Color.rgb(249, 241, 222)), 17)
        }
        tile.addView(icon, LinearLayout.LayoutParams(dp(52), dp(52)))
        tile.addView(text(item.title, 14f, navy, true, top = 8, bottom = 3).apply {
            gravity = Gravity.CENTER
            textAlignment = View.TEXT_ALIGNMENT_CENTER
        })
        if (item.description.isNotBlank()) {
            tile.addView(text(item.description, 10f, muted).apply {
                gravity = Gravity.CENTER
                textAlignment = View.TEXT_ALIGNMENT_CENTER
                maxLines = 2
            })
        }
        return tile
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

    private fun rounded(colors: IntArray, radius: Int, stroke: Int? = null): GradientDrawable =
        GradientDrawable(GradientDrawable.Orientation.TL_BR, colors).apply {
            cornerRadius = dp(radius).toFloat()
            if (stroke != null) setStroke(dp(1), stroke)
        }

    private fun ripple(colors: IntArray, radius: Int, stroke: Int? = null): RippleDrawable =
        RippleDrawable(
            ColorStateList.valueOf(Color.argb(36, 9, 38, 77)),
            rounded(colors, radius, stroke),
            null
        )

    private fun marginTop(value: Int) = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
    ).apply { topMargin = dp(value) }

    private fun openAudio(mode: String) {
        startActivity(
            Intent(this, NativeAudioActivity::class.java)
                .putExtra(NativeAudioActivity.EXTRA_MODE, mode)
        )
    }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density + 0.5f).toInt()
}
