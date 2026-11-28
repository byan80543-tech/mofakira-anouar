package com.anwar.mofakira

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.drawable.GradientDrawable
import android.util.Base64
import android.widget.ImageView

/**
 * Renders the exact tulip artwork already shipped with the audio library,
 * without loading HTML, SVG, JavaScript, or a WebView.
 *
 * The original SVG is a tiny container for an embedded WebP data URI.
 * Android decodes that same WebP into a Bitmap and displays it in an ImageView.
 */
internal object NativeAudioArtwork {
    private const val TULIP_ASSET = "audio/tulip-cutout.svg"
    private val embeddedWebp = Regex("""data:image/webp;base64,([A-Za-z0-9+/=]+)""")

    @Volatile
    private var cachedTulip: Bitmap? = null

    fun badge(
        context: Context,
        widthDp: Int,
        heightDp: Int,
        radiusDp: Int,
        borderColor: Int,
        backgroundColor: Int,
        circular: Boolean = false
    ): ImageView {
        val density = context.resources.displayMetrics.density
        fun px(value: Int) = (value * density + 0.5f).toInt()

        return ImageView(context).apply {
            setImageBitmap(loadTulip(context))
            minimumWidth = px(widthDp)
            minimumHeight = px(heightDp)
            scaleType = ImageView.ScaleType.FIT_CENTER
            setPadding(px(3), px(3), px(3), px(3))
            background = GradientDrawable().apply {
                shape = if (circular) GradientDrawable.OVAL else GradientDrawable.RECTANGLE
                setColor(backgroundColor)
                if (!circular) cornerRadius = px(radiusDp).toFloat()
                setStroke(px(1), borderColor)
            }
            contentDescription = null
            importantForAccessibility = ImageView.IMPORTANT_FOR_ACCESSIBILITY_NO
        }
    }

    private fun loadTulip(context: Context): Bitmap {
        cachedTulip?.let { return it }
        synchronized(this) {
            cachedTulip?.let { return it }
            val svg = context.assets.open(TULIP_ASSET).bufferedReader(Charsets.UTF_8).use { it.readText() }
            val encoded = embeddedWebp.find(svg)?.groupValues?.getOrNull(1)
                ?: throw IllegalStateException("The bundled tulip WebP data was not found.")
            val bytes = Base64.decode(encoded, Base64.DEFAULT)
            val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                ?: throw IllegalStateException("The bundled tulip WebP could not be decoded.")
            cachedTulip = bitmap
            return bitmap
        }
    }
}
