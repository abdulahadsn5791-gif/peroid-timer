package com.periodtimer

import android.app.Notification
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager

/**
 * The foreground service behind the live progress notification. While a period
 * is running or upcoming it republishes a Google Maps-style notification every
 * second with a real progress bar; it stops itself the moment the day is over.
 * All "what is true at time T" values come from the snapshot the app writes.
 */
class PeriodForegroundService : Service() {

    private val handler = Handler(Looper.getMainLooper())
    private val tick = object : Runnable {
        override fun run() {
            onTick()
            handler.postDelayed(this, tickIntervalMs())
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        OngoingNotifier.ensureChannel(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val snapshot = SnapshotStore.load(this)
        val startupNotification = if (snapshot != null) {
            val lookup = SnapshotStore.lookup(snapshot, System.currentTimeMillis() / 1000L)
            OngoingNotifier.compose(this, snapshot, lookup)
        } else {
            buildPlaceholder()
        }
        startForeground(OngoingNotifier.NOTIFICATION_ID, startupNotification)
        if (!handler.hasCallbacks(tick)) handler.postDelayed(tick, 0L)
        return START_STICKY
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }

    private fun onTick() {
        val snapshot = SnapshotStore.load(this)
        if (snapshot == null) {
            stopSelfAndClear()
            return
        }
        val now = System.currentTimeMillis() / 1000L
        val lookup = SnapshotStore.lookup(snapshot, now)
        if (lookup.current == null && lookup.next == null) {
            stopSelfAndClear()
            return
        }
        startForeground(OngoingNotifier.NOTIFICATION_ID, OngoingNotifier.compose(this, snapshot, lookup))
    }

    /** Battery-friendly: 1s while the screen is on, 5s once it's asleep. */
    private fun tickIntervalMs(): Long {
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        return if (pm.isInteractive) 1_000L else 5_000L
    }

    private fun stopSelfAndClear() {
        stopForeground(STOP_FOREGROUND_REMOVE)
        OngoingNotifier.clear(this)
        stopSelf()
    }

    private fun buildPlaceholder(): Notification {
        return androidx.core.app.NotificationCompat.Builder(this, OngoingNotifier.CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle("Period timer")
            .setContentText("Setting up today's schedule…")
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setVisibility(androidx.core.app.NotificationCompat.VISIBILITY_PUBLIC)
            .setCategory(androidx.core.app.NotificationCompat.CATEGORY_ALARM)
            .setColor(0xFF2563EB.toInt())
            .build()
    }
}