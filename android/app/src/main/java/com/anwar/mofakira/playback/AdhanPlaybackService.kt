package com.anwar.mofakira.playback

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import com.anwar.mofakira.MainActivity
import com.anwar.mofakira.PrayerSettings
import com.anwar.mofakira.R

class AdhanPlaybackService : Service() {
    private var player: MediaPlayer? = null
    private var focusRequest: Any? = null
    private var audioManager: AudioManager? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopPlayback()
            stopSelf(startId)
            return START_NOT_STICKY
        }
        if (intent?.action != ACTION_PLAY) {
            stopSelf(startId)
            return START_NOT_STICKY
        }

        val config = PrayerSettings.read(this)
        val voice = VoiceCatalog.get(config.voiceKey)
        if (!config.enabled || voice == null) {
            stopSelf(startId)
            return START_NOT_STICKY
        }

        val prayerName = intent.getStringExtra(EXTRA_PRAYER_NAME) ?: "الصلاة"
        startAsForeground(prayerName)
        stopPlayerOnly()
        requestAudioFocus()

        val media = MediaPlayer()
        player = media
        media.setWakeMode(applicationContext, PowerManager.PARTIAL_WAKE_LOCK)
        media.setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build()
        )
        media.setOnPreparedListener { prepared ->
            if (player === prepared) prepared.start()
        }
        media.setOnCompletionListener {
            stopPlayback()
            stopSelf()
        }
        media.setOnErrorListener { _, _, _ ->
            stopPlayback()
            stopSelf()
            true
        }

        try {
            val cached = VoiceCache.cachedFile(this, config.voiceKey)
            if (cached != null) media.setDataSource(cached.absolutePath)
            else media.setDataSource(voice.url)
            media.prepareAsync()
        } catch (_: Exception) {
            stopPlayback()
            stopSelf()
        }
        return START_NOT_STICKY
    }

    private fun startAsForeground(prayerName: String) {
        createNotificationChannel()
        val contentPending = PendingIntent.getActivity(
            this, 711, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val stopPending = PendingIntent.getService(
            this, 712, Intent(this, AdhanPlaybackService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_adhan)
            .setContentTitle("حان وقت صلاة $prayerName")
            .setContentText("مفكرة أنوار تشغّل الأذان")
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(contentPending)
            .addAction(R.drawable.ic_stat_adhan, "إيقاف الأذان", stopPending)
            .build()
        ServiceCompat.startForeground(
            this, NOTIFICATION_ID, notification,
            ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
        )
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)
            if (manager.getNotificationChannel(CHANNEL_ID) == null) {
                manager.createNotificationChannel(
                    NotificationChannel(
                        CHANNEL_ID, "أذان مفكرة أنوار", NotificationManager.IMPORTANCE_LOW
                    ).apply {
                        description = "إشعار يظهر أثناء تشغيل الأذان"
                        setSound(null, null)
                    }
                )
            }
        }
    }

    private fun requestAudioFocus() {
        audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val attributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build()
            val request = android.media.AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                .setAudioAttributes(attributes)
                .setOnAudioFocusChangeListener { }
                .build()
            focusRequest = request
            audioManager?.requestAudioFocus(request)
        } else {
            @Suppress("DEPRECATION")
            audioManager?.requestAudioFocus(
                null, AudioManager.STREAM_ALARM, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT
            )
        }
    }

    private fun stopPlayerOnly() {
        runCatching { player?.stop() }
        runCatching { player?.release() }
        player = null
    }

    private fun stopPlayback() {
        stopPlayerOnly()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            (focusRequest as? android.media.AudioFocusRequest)?.let {
                audioManager?.abandonAudioFocusRequest(it)
            }
        } else {
            @Suppress("DEPRECATION")
            audioManager?.abandonAudioFocus(null)
        }
        focusRequest = null
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
    }

    override fun onDestroy() {
        stopPlayback()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        const val ACTION_PLAY = "com.anwar.mofakira.action.PLAY_ADHAN"
        const val ACTION_STOP = "com.anwar.mofakira.action.STOP_ADHAN"
        const val EXTRA_PRAYER_NAME = "prayer_name"
        const val EXTRA_PRAYER_KEY = "prayer_key"
        const val EXTRA_EVENT_ID = "event_id"
        private const val CHANNEL_ID = "adhan_playback"
        private const val NOTIFICATION_ID = 7120
    }
}
