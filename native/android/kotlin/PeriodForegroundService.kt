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
 * How long after a period's end this service still treats it as "just ended".
 * Must cover the 5s screen-off tick plus jitter, or a period that ends while the
 * phone is asleep goes unheard.
 */
private const val END_ALERT_WINDOW_SEC = 10L

/**
 * The foreground service behind the live progress notification. While a period
 * is running or upcoming it republishes a Google Maps-style notification every
 * second with a real progress bar; it stops itself the moment the day is over.
 * All "what is true at time T" values come from the snapshot the app writes.
 *
 * It is also the app's second watcher for a period end. The exact alarm covers
 * the case where this service is not running, and this service covers the case
 * where exact-alarm access was never granted (or the OEM throttled AlarmManager
 * minutes late) — it is already awake and already looking up "what is true at
 * time T", so the alarm is seconds late at worst. Both watchers share one dedupe
 * key, so a period can never ring twice.
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
        val now = System.currentTimeMillis() / 1000L
        val lookup = SnapshotStore.lookup(snapshot, now)
        // Before the self-stop check: this can be the tick that sees a period end.
        ringIfPeriodJustEnded(snapshot, lookup, now)
        if (lookup.current == null && lookup.next == null) {
            stopSelfAndClear()
            return START_NOT_STICKY
        }
        startForeground(OngoingNotifier.NOTIFICATION_ID, OngoingNotifier.compose(this, snapshot, lookup))
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
        // Before the self-stop check: this tick can be the one that sees the
        // last period of the day end, and that end still has to ring.
        ringIfPeriodJustEnded(snapshot, lookup, now)
        if (lookup.current == null && lookup.next == null) {
            stopSelfAndClear()
            return
        }
        startForeground(OngoingNotifier.NOTIFICATION_ID, OngoingNotifier.compose(this, snapshot, lookup))
    }

    /**
     * Rings the alarm if the period that just ended is still unannounced. The
     * window is wider than the 2s the JS tick uses because this loop slows to
     * 5s once the screen is asleep; the shared `weekday:periodId` dedupe in
     * EndAlertNotifier keeps this and the exact alarm from ringing twice.
     */
    private fun ringIfPeriodJustEnded(snapshot: TimelineSnapshot, lookup: Lookup, now: Long) {
        val ended = lookup.previous ?: return
        val sinceEnd = now - ended.endUnixSec
        if (sinceEnd < 0 || sinceEnd >= END_ALERT_WINDOW_SEC) return
        EndAlertNotifier.ringIfJustEnded(this, snapshot, ended, lookup.next, now)
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
