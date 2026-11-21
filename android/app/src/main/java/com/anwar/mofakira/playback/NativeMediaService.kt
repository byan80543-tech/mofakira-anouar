package com.anwar.mofakira.playback

import android.os.Bundle
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService

/**
 * Shared native playback engine for Quran recitations, live radio, lessons,
 * and devotional recordings.
 *
 * Media3 owns the player and session in this service, not in an Activity.
 * That lets playback and Android's system media controls survive screen changes
 * and the app UI leaving the foreground.
 */
class NativeMediaService : MediaSessionService() {
    private var mediaSession: MediaSession? = null
    private var player: ExoPlayer? = null

    override fun onCreate() {
        super.onCreate()

        val exoPlayer = ExoPlayer.Builder(this)
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(C.USAGE_MEDIA)
                    .setContentType(C.AUDIO_CONTENT_TYPE_SPEECH)
                    .build(),
                true
            )
            .setHandleAudioBecomingNoisy(true)
            .build()

        exoPlayer.repeatMode = Player.REPEAT_MODE_OFF
        player = exoPlayer
        mediaSession = MediaSession.Builder(this, exoPlayer)
            .setId("anwar-native-audio")
            .build()
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? =
        mediaSession

    override fun onDestroy() {
        mediaSession?.release()
        mediaSession = null
        player?.release()
        player = null
        super.onDestroy()
    }
}
