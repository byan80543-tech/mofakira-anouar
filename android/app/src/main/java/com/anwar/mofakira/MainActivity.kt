package com.anwar.mofakira

import android.app.Activity
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
 * First native gateway for Anwar.
 *
 * Keep this landing page deliberately calm: notebook and radio are the two
 * primary destinations, a few working shortcuts remain close at hand, and
 * the complete devotional area is grouped behind ReligiousGateActivity.
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

        content.addView(brandHeader())
        content.addView(notebookCard(), marginTop(20))
        content.addView(radioCard(), marginTop(13))
        content.addView(sectionTitle("اختصارات سريعة"), marginTop(22))
        content.addView(quickShortcuts(), marginTop(8))
        content.addView(religionGatewayCard(), marginTop(19))
        content.addView(
            text(
                "مساحتك الخاصة للكلمة، وصوت يرافق يومك، وبوابة تجمع أعمال العبادة.",
                11f,
                muted,
                top = 17,
                bottom = 3
            )
        )
        return scroll
    }

    private fun brandHeader(): View {
        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            gravity = Gravity.CENTER_VERTICAL
        }
        val emblem = TextView(this).apply {
            text = "أ"
            textSize = 26f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            typeface = Typeface.create("serif", Typeface.BOLD)
            background = rounded(intArrayOf(navy, green), 18, gold)
            elevation = dp(2).toFloat()
            contentDescription = "شعار مفكرة أنوار"
        }
        header.addView(emblem, LinearLayout.LayoutParams(dp(54), dp(54)))

        val titles = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(12), 0, 0, 0)
        }
        titles.addView(text("مفكرة أنوار", 27f, navy, true, bottom = 3))
        titles.addView(text("رفيقك للكلمة والسكينة", 13f, muted))
        header.addView(titles, LinearLayout.LayoutParams(0, dp(58), 1f))
        return header
    }

    private fun notebookCard(): View {
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            setPadding(dp(18), dp(17), dp(18), dp(16))
            background = ripple(intArrayOf(Color.WHITE, Color.rgb(255, 253, 248)), 20, gold)
            elevation = dp(2).toFloat()
            isClickable = true
            isFocusable = true
            contentDescription = "فتح المفكرة"
            setOnClickListener {
                startActivity(Intent(this@MainActivity, NativeNotebookActivity::class.java))
            }
        }

        val heading = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            gravity = Gravity.CENTER_VERTICAL
        }
        val icon = iconBubble("🖋️", paleGold)
        heading.addView(icon, LinearLayout.LayoutParams(dp(62), dp(62)))
        val label = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(13), 0, 0, 0)
        }
        label.addView(text("المفكرة", 21f, navy, true, bottom = 4))
        label.addView(text("قصائدك ونصوصك وأفكارك في مكانك الخاص", 12f, muted))
        heading.addView(label, LinearLayout.LayoutParams(0, dp(66), 1f))
        card.addView(heading)
        card.addView(actionPill("افتح مفكرتك", gold, navy), marginTop(13))
        return card
    }

    private fun radioCard(): View {
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(17), dp(15), dp(17), dp(15))
            background = ripple(intArrayOf(green, navy), 18, gold)
            elevation = dp(2).toFloat()
            isClickable = true
            isFocusable = true
            contentDescription = "فتح إذاعة أنوار"
            setOnClickListener { openRadio() }
        }
        val icon = iconBubble("📻", Color.argb(32, 255, 255, 255), Color.WHITE)
        card.addView(icon, LinearLayout.LayoutParams(dp(56), dp(56)))

        val labels = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(12), 0, dp(8), 0)
        }
        labels.addView(text("إذاعة أنوار", 18f, Color.WHITE, true, bottom = 4))
        labels.addView(text("القرآن والابتهالات بصوت يرافق يومك", 11f, Color.rgb(236, 235, 224)))
        card.addView(labels, LinearLayout.LayoutParams(0, dp(58), 1f))
        card.addView(text("‹", 32f, gold, true))
        return card
    }

    private fun quickShortcuts(): View {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
        }
        val shortcuts = listOf(
            Triple("🕌", "المواقيت") {
                startActivity(Intent(this, NativePrayerActivity::class.java))
            },
            Triple("📖", "القرآن") {
                startActivity(
                    Intent(this, NativeAudioActivity::class.java)
                        .putExtra(NativeAudioActivity.EXTRA_MODE, NativeAudioActivity.MODE_QURAN)
                )
            },
            Triple("📿", "السبحة") {
                startActivity(Intent(this, NativeTasbihActivity::class.java))
            }
        )
        shortcuts.forEach { (glyph, label, action) ->
            val tile = quickShortcut(glyph, label, action)
            row.addView(tile, LinearLayout.LayoutParams(0, dp(102), 1f).apply {
                marginStart = dp(4)
                marginEnd = dp(4)
            })
        }
        return row
    }

    private fun quickShortcut(glyph: String, label: String, onClick: () -> Unit): View {
        val tile = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            gravity = Gravity.CENTER
            setPadding(dp(6), dp(10), dp(6), dp(9))
            background = ripple(intArrayOf(Color.WHITE, Color.rgb(255, 253, 248)), 16, Color.rgb(231, 224, 207))
            elevation = dp(1).toFloat()
            isClickable = true
            isFocusable = true
            contentDescription = label
            setOnClickListener { onClick() }
        }
        tile.addView(text(glyph, 29f, green, true, bottom = 7).apply {
            gravity = Gravity.CENTER
        })
        tile.addView(text(label, 12f, ink, true).apply {
            gravity = Gravity.CENTER
            textAlignment = View.TEXT_ALIGNMENT_CENTER
        })
        return tile
    }

    private fun religionGatewayCard(): View {
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(17), dp(16), dp(17), dp(16))
            background = ripple(intArrayOf(navy, green), 19, gold)
            elevation = dp(2).toFloat()
            isClickable = true
            isFocusable = true
            contentDescription = "فتح بوابة الدين"
            setOnClickListener {
                startActivity(Intent(this@MainActivity, ReligiousGateActivity::class.java))
            }
        }
        val icon = iconBubble("🕌", Color.argb(38, 255, 255, 255), Color.WHITE)
        card.addView(icon, LinearLayout.LayoutParams(dp(58), dp(58)))

        val labels = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(12), 0, dp(8), 0)
        }
        labels.addView(text("بوابة الدين", 19f, Color.WHITE, true, bottom = 4))
        labels.addView(text("القرآن والدروس والأذكار وسائر الخدمات", 11f, Color.rgb(238, 237, 226)))
        card.addView(labels, LinearLayout.LayoutParams(0, dp(62), 1f))
        card.addView(text("‹", 32f, gold, true))
        return card
    }

    private fun iconBubble(
        glyph: String,
        backgroundColor: Int,
        foregroundColor: Int = green
    ): TextView = TextView(this).apply {
        text = glyph
        textSize = 29f
        setTextColor(foregroundColor)
        gravity = Gravity.CENTER
        background = rounded(intArrayOf(backgroundColor, backgroundColor), 18)
    }

    private fun actionPill(label: String, backgroundColor: Int, textColor: Int): TextView =
        TextView(this).apply {
            text = label
            textSize = 13f
            setTextColor(textColor)
            gravity = Gravity.CENTER
            typeface = Typeface.create("sans-serif", Typeface.BOLD)
            setPadding(dp(17), dp(10), dp(17), dp(10))
            background = rounded(intArrayOf(backgroundColor, backgroundColor), 13)
        }

    private fun sectionTitle(value: String): TextView =
        text(value, 16f, green, true, bottom = 1)

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
        includeFontPadding = true
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

    private fun openRadio() {
        startActivity(
            Intent(this, NativeAudioActivity::class.java)
                .putExtra(NativeAudioActivity.EXTRA_MODE, NativeAudioActivity.MODE_RADIO)
        )
    }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density + 0.5f).toInt()

    private val paleGold: Int
        get() = Color.rgb(249, 241, 222)
}
