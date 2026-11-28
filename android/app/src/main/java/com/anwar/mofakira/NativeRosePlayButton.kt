package com.anwar.mofakira

import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.animation.PropertyValuesHolder
import android.content.Context
import android.view.View
import android.view.animation.DecelerateInterpolator
import android.view.animation.OvershootInterpolator
import android.widget.ImageView
import kotlin.math.roundToInt

/**
 * Android-native version of Anwar's original closed/open rose play control.
 * The artwork is rasterized from the two original SVGs without changing their
 * gradients, outlines, integrated play mark, or petal proportions.
 */
internal class NativeRosePlayButton(
    context: Context,
    private val itemLabel: String,
    viewSizeDp: Int = 42,
    artworkSizeDp: Int = 31,
    private val onClick: () -> Unit
) : ImageView(context) {
    private var playing = false
    private var bloomAnimator: AnimatorSet? = null

    init {
        val density = context.resources.displayMetrics.density
        val inset = (((viewSizeDp - artworkSizeDp).coerceAtLeast(0) / 2f) * density).roundToInt()
        setPadding(inset, inset, inset, inset)
        setImageResource(R.drawable.anwar_rose_closed)
        scaleType = ScaleType.FIT_CENTER
        background = null
        minimumWidth = (viewSizeDp * density).roundToInt()
        minimumHeight = (viewSizeDp * density).roundToInt()
        cameraDistance = density * 1_800f
        isClickable = true
        isFocusable = true
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_YES
        contentDescription = "تشغيل: $itemLabel"
        setOnClickListener { onClick() }
    }

    fun setPlaybackActive(active: Boolean, animate: Boolean = true) {
        if (playing == active) return
        playing = active
        bloomAnimator?.cancel()
        bloomAnimator = null
        setImageResource(
            if (active) R.drawable.anwar_rose_open else R.drawable.anwar_rose_closed
        )
        contentDescription = if (active) {
            "إيقاف مؤقت: $itemLabel"
        } else {
            "تشغيل: $itemLabel"
        }

        if (active && animate) {
            playBloomAnimation()
        } else {
            resetTransform()
        }
    }

    private fun playBloomAnimation() {
        alpha = 0.35f
        scaleX = 0.34f
        scaleY = 0.34f
        rotationX = 38f

        val bloom = AnimatorSet().apply {
            playTogether(
                ObjectAnimator.ofPropertyValuesHolder(
                    this@NativeRosePlayButton,
                    PropertyValuesHolder.ofFloat(View.SCALE_X, 0.34f, 1.12f),
                    PropertyValuesHolder.ofFloat(View.SCALE_Y, 0.34f, 1.12f),
                    PropertyValuesHolder.ofFloat(View.ROTATION_X, 38f, -5f),
                    PropertyValuesHolder.ofFloat(View.ALPHA, 0.35f, 1f)
                )
            )
            duration = 278L
            interpolator = DecelerateInterpolator(1.5f)
        }
        val settle = AnimatorSet().apply {
            playTogether(
                ObjectAnimator.ofFloat(this@NativeRosePlayButton, View.SCALE_X, 1.12f, 0.97f),
                ObjectAnimator.ofFloat(this@NativeRosePlayButton, View.SCALE_Y, 1.12f, 0.97f),
                ObjectAnimator.ofFloat(this@NativeRosePlayButton, View.ROTATION_X, -5f, 2f)
            )
            duration = 163L
            interpolator = OvershootInterpolator(0.25f)
        }
        val finish = AnimatorSet().apply {
            playTogether(
                ObjectAnimator.ofFloat(this@NativeRosePlayButton, View.SCALE_X, 0.97f, 1f),
                ObjectAnimator.ofFloat(this@NativeRosePlayButton, View.SCALE_Y, 0.97f, 1f),
                ObjectAnimator.ofFloat(this@NativeRosePlayButton, View.ROTATION_X, 2f, 0f),
                ObjectAnimator.ofFloat(this@NativeRosePlayButton, View.ALPHA, 1f, 1f)
            )
            duration = 139L
            interpolator = DecelerateInterpolator()
        }
        bloomAnimator = AnimatorSet().apply {
            playSequentially(bloom, settle, finish)
            start()
        }
    }

    private fun resetTransform() {
        alpha = 1f
        scaleX = 1f
        scaleY = 1f
        rotationX = 0f
    }
}
