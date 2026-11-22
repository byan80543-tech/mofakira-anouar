package com.anwar.mofakira

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

/**
 * Native Android entry point.
 *
 * The full existing notebook remains available through LegacyWebActivity while
 * its features are migrated to native screens incrementally. This keeps all
 * current services reachable and avoids removing the proven web experience
 * before native feature parity is reached.
 */
class MainActivity : Activity() {
    private val navy = Color.rgb(9, 38, 77)
    private val green = Color.rgb(13, 59, 50)
    private val gold = Color.rgb(201, 169, 106)
    private val cream = Color.rgb(247, 243, 234)
    private val ink = Color.rgb(35, 48, 58)
    private val muted = Color.rgb(101, 112, 120)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = navy
        window.navigationBarColor = navy
        window.decorView.layoutDirection = View.LAYOUT_DIRECTION_RTL
        setContentView(buildHome())
    }

    private fun buildHome(): View {
        val scroll = ScrollView(this).apply {
            setBackgroundColor(cream)
            isFillViewport = true
            clipToPadding = false
        }
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            setPadding(dp(18), dp(22), dp(18), dp(28))
        }
        scroll.addView(content)

        content.addView(text(
            "مفكرة أنوار",
            size = 28f,
            color = navy,
            bold = true,
            bottom = 3
        ))
        content.addView(text(
            "القرآن والكتابة والأذكار",
            size = 14f,
            color = muted,
            bottom = 18
        ))

        content.addView(heroCard())
        content.addView(sectionTitle("خدمات المفكرة"))
        content.addView(featureGrid())
        content.addView(migrationNote())

        val openLegacy = actionButton("فتح جميع خدمات المفكرة", gold, navy) {
            startActivity(Intent(this, LegacyWebActivity::class.java))
        }
        content.addView(openLegacy, marginTop(14))

        content.addView(text(
            "تُفتح النسخة الحالية كاملة للحفاظ على جميع الخدمات والبيانات أثناء نقلها تدريجيًا إلى الواجهات الأصلية.",
            size = 11f,
            color = muted,
            top = 14,
            bottom = 4
        ))
        return scroll
    }

    private fun heroCard(): View {
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.END
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            setPadding(dp(20), dp(21), dp(20), dp(20))
            background = rounded(
                intArrayOf(Color.rgb(13, 59, 50), Color.rgb(9, 38, 77)),
                22
            )
        }
        card.addView(text("رفيقك اليومي مع القرآن والذكر", 20f, Color.WHITE, true, bottom = 7))
        card.addView(text(
            "القرآن والكتابة والقصائد والمواقيت والأذكار في رفيق واحد.",
            13f,
            Color.rgb(239, 235, 222),
            bottom = 0
        ))
        return card
    }

    private fun sectionTitle(value: String): TextView =
        text(value, 17f, green, true, top = 23, bottom = 10)

    private fun featureGrid(): View {
        val rows = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
        }
        val items = listOf(
            "🕌" to "مواقيت الصلاة والأذان",
            "📖" to "القرآن الكريم والقراء",
            "📻" to "الإذاعات والابتهالات",
            "🎧" to "الدروس والمحاضرات",
            "🤲" to "أذكار التحصين",
            "📿" to "السبحة",
            "🖋️" to "دفتر الكتابة"
        )
        items.chunked(2).forEach { pair ->
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                layoutDirection = View.LAYOUT_DIRECTION_RTL
            }
            pair.forEach { (icon, label) ->
                val tile = TextView(this).apply {
                    text = "$icon\n$label"
                    textSize = 13f
                    setTextColor(ink)
                    gravity = Gravity.CENTER
                    textAlignment = View.TEXT_ALIGNMENT_CENTER
                    typeface = Typeface.create("sans-serif", Typeface.BOLD)
                    setPadding(dp(8), dp(14), dp(8), dp(14))
                    background = rounded(intArrayOf(Color.WHITE, Color.rgb(255, 253, 247)), 15)
                    elevation = dp(1).toFloat()
                    isClickable = true
                    isFocusable = true
                    setOnClickListener {
                        when (label) {
                            "مواقيت الصلاة والأذان" ->
                                startActivity(Intent(this@MainActivity, NativePrayerActivity::class.java))
                            "القرآن الكريم والقراء" ->
                                startActivity(Intent(this@MainActivity, NativeAudioActivity::class.java)
                                    .putExtra(NativeAudioActivity.EXTRA_MODE, NativeAudioActivity.MODE_QURAN))
                            "الإذاعات والابتهالات" ->
                                startActivity(Intent(this@MainActivity, NativeAudioActivity::class.java)
                                    .putExtra(NativeAudioActivity.EXTRA_MODE, NativeAudioActivity.MODE_RADIO))
                            "الدروس والمحاضرات" ->
                                startActivity(Intent(this@MainActivity, NativeAudioActivity::class.java)
                                    .putExtra(NativeAudioActivity.EXTRA_MODE, NativeAudioActivity.MODE_LESSONS))
                            "أذكار التحصين" ->
                                startActivity(Intent(this@MainActivity, NativeAdhkarActivity::class.java))
                            "السبحة" ->
                                startActivity(Intent(this@MainActivity, NativeTasbihActivity::class.java))
                            "دفتر الكتابة" ->
                                startActivity(Intent(this@MainActivity, NativeNotebookActivity::class.java))
                            else -> startActivity(Intent(this@MainActivity, LegacyWebActivity::class.java))
                        }
                    }
                }
                row.addView(tile, LinearLayout.LayoutParams(0, dp(86), 1f).apply {
                    marginEnd = dp(5)
                    marginStart = dp(5)
                    bottomMargin = dp(9)
                })
            }
            if (pair.size == 1) {
                row.addView(View(this), LinearLayout.LayoutParams(0, dp(86), 1f))
            }
            rows.addView(row)
        }
        return rows
    }

    private fun migrationNote(): View {
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            setPadding(dp(15), dp(13), dp(15), dp(13))
            background = rounded(intArrayOf(Color.rgb(255, 249, 234), Color.rgb(255, 249, 234)), 13, gold)
        }
        box.addView(text("مرحلة الانتقال إلى التطبيق الأصلي", 13f, navy, true, bottom = 5))
        box.addView(text(
            "أصبحت هذه الشاشة نقطة الدخول الأصلية لأندرويد. تبقى جميع أقسام المفكرة الحالية متاحة من زر فتح الخدمات، ولن يُحذف أي قسم قبل اكتمال نقله واختباره.",
            11f,
            muted
        ))
        return box
    }

    private fun actionButton(label: String, backgroundColor: Int, textColor: Int, onClick: () -> Unit): TextView =
        TextView(this).apply {
            text = label
            textSize = 15f
            setTextColor(textColor)
            gravity = Gravity.CENTER
            typeface = Typeface.create("sans-serif", Typeface.BOLD)
            setPadding(dp(16), dp(15), dp(16), dp(15))
            background = rounded(intArrayOf(backgroundColor, backgroundColor), 14)
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

    private fun marginTop(value: Int) = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
    ).apply { topMargin = dp(value) }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density + 0.5f).toInt()
}
