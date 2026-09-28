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
 *
 * Empty preset (weekday with no lectures): the snapshot has zero segments, so
 * the service stops immediately and stays off — no notification that day.
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
        if (snapshot == null || snapshot.segments.isEmpty()) {
            // Nothing scheduled (empty preset day or no snapshot yet): stop quietly.
            stopSelfAndClear()
            return START_NOT_STICKY
        }
        val lookup = SnapshotStore.lookup(snapshot, System.currentTimeMillis() / 1000L)
        val startupNotification = OngoingNotifier.compose(this, snapshot, lookup)
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
        if (snapshot == null || snapshot.segments.isEmpty()) {
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
}
