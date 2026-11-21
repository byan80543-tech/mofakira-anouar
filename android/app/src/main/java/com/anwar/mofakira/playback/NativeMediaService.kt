package com.anwar.mofakira.playback

import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import org.json.JSONArray
import org.json.JSONObject

/**
 * Shared native playback engine for Quran recitations, live radio, lessons,
 * and devotional recordings.
 *
 * Playback and MediaSession live in this service rather than an Activity.
 * The current queue and position are persisted locally; a restored queue is
 * prepared for the user but is never started automatically.
 */
class NativeMediaService : MediaSessionService() {
    private var mediaSession: MediaSession? = null
    private var player: ExoPlayer? = null

    private val handler = Handler(Looper.getMainLooper())
    private val persistTicker = object : Runnable {
        override fun run() {
            val current = player
            if (current?.isPlaying == true) {
                persistPlaybackState()
                handler.postDelayed(this, PERSIST_INTERVAL_MS)
            }
        }
    }

    private val playerListener = object : Player.Listener {
        override fun onIsPlayingChanged(isPlaying: Boolean) {
            handler.removeCallbacks(persistTicker)
            if (isPlaying) handler.postDelayed(persistTicker, PERSIST_INTERVAL_MS)
            else persistPlaybackState()
        }

        override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
            persistPlaybackState()
        }

        override fun onTimelineChanged(timeline: androidx.media3.common.Timeline, reason: Int) {
            persistPlaybackState()
        }

        override fun onPlaybackStateChanged(playbackState: Int) {
            persistPlaybackState()
        }

        override fun onPositionDiscontinuity(
            oldPosition: Player.PositionInfo,
            newPosition: Player.PositionInfo,
            reason: Int
        ) {
            persistPlaybackState()
        }
    }

    override fun onCreate() {
        super.onCreate()

        val exoPlayer = ExoPlayer.Builder(this).build()
        exoPlayer.setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(C.USAGE_MEDIA)
                .setContentType(C.AUDIO_CONTENT_TYPE_SPEECH)
                .build(),
            true
        )
        exoPlayer.setHandleAudioBecomingNoisy(true)
        exoPlayer.repeatMode = Player.REPEAT_MODE_OFF
        restorePlaybackState(exoPlayer)
        exoPlayer.addListener(playerListener)

        player = exoPlayer
        mediaSession = MediaSession.Builder(this, exoPlayer)
            .setId("anwar-native-audio")
            .build()
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? =
        if (controllerInfo.isTrusted) mediaSession else null

    override fun onTaskRemoved(rootIntent: android.content.Intent?) {
        persistPlaybackState()
        super.onTaskRemoved(rootIntent)
    }

    override fun onDestroy() {
        handler.removeCallbacks(persistTicker)
        persistPlaybackState()
        player?.removeListener(playerListener)
        mediaSession?.release()
        mediaSession = null
        player?.release()
        player = null
        super.onDestroy()
    }

    private fun persistPlaybackState() {
        val current = player ?: return
        val items = JSONArray()
        for (index in 0 until current.mediaItemCount) {
            val item = current.getMediaItemAt(index)
            val uri = item.localConfiguration?.uri?.toString().orEmpty()
            if (!uri.startsWith("https://", ignoreCase = true)) continue
            val metadata = item.mediaMetadata
            items.put(
                JSONObject()
                    .put("id", item.mediaId.take(200))
                    .put("uri", uri.take(2_000))
                    .put("title", metadata.title?.toString().orEmpty().take(160))
                    .put("artist", metadata.artist?.toString().orEmpty().take(160))
                    .put("album", metadata.albumTitle?.toString().orEmpty().take(160))
            )
        }

        val preferences = getSharedPreferences(PREFS, MODE_PRIVATE)
        if (items.length() == 0) {
            preferences.edit()
                .remove(KEY_QUEUE)
                .remove(KEY_INDEX)
                .remove(KEY_POSITION)
                .apply()
            return
        }

        preferences.edit()
            .putString(KEY_QUEUE, items.toString())
            .putInt(KEY_INDEX, current.currentMediaItemIndex.coerceIn(0, items.length() - 1))
            .putLong(KEY_POSITION, current.currentPosition.coerceAtLeast(0L))
            .apply()
    }

    private fun restorePlaybackState(target: ExoPlayer) {
        val preferences = getSharedPreferences(PREFS, MODE_PRIVATE)
        val raw = preferences.getString(KEY_QUEUE, null) ?: return
        val savedItems = runCatching { JSONArray(raw) }.getOrNull() ?: return
        if (savedItems.length() !in 1..MAX_RESTORED_ITEMS) return

        val items = ArrayList<MediaItem>(savedItems.length())
        for (index in 0 until savedItems.length()) {
            val saved = savedItems.optJSONObject(index) ?: continue
            val uriText = saved.optString("uri")
            val uri = runCatching { Uri.parse(uriText) }.getOrNull() ?: continue
            if (!uriText.startsWith("https://", ignoreCase = true) || uri.host.isNullOrBlank()) continue

            val metadata = MediaMetadata.Builder()
                .setTitle(saved.optString("title").take(160))
                .setArtist(saved.optString("artist").take(160))
                .setAlbumTitle(saved.optString("album").take(160))
                .build()
            items.add(
                MediaItem.Builder()
                    .setMediaId(saved.optString("id").take(200))
                    .setUri(uri)
                    .setMediaMetadata(metadata)
                    .build()
            )
        }
        if (items.isEmpty()) return

        val index = preferences.getInt(KEY_INDEX, 0).coerceIn(0, items.lastIndex)
        val position = preferences.getLong(KEY_POSITION, 0L).coerceAtLeast(0L)
        target.setMediaItems(items, index, position)
        // Deliberately do not call prepare() or play(): the user resumes explicitly.
    }

    companion object {
        private const val PREFS = "anwar_native_media"
        private const val KEY_QUEUE = "queue_v1"
        private const val KEY_INDEX = "current_index"
        private const val KEY_POSITION = "position_ms"
        private const val PERSIST_INTERVAL_MS = 15_000L
        private const val MAX_RESTORED_ITEMS = 600
    }
}
