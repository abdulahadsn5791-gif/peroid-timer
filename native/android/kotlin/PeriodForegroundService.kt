package com.periodtimer

import android.app.Notification
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
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
            // Never let one bad tick kill the loop: a thrown exception here
            // would silently freeze the live notification until the next
            // start command. Reschedule in `finally` no matter what.
            try {
                onTick()
            } catch (_: Exception) {
                // tick is best-effort; the next one retries
            } finally {
                handler.postDelayed(this, tickIntervalMs())
            }
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        OngoingNotifier.ensureChannel(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        latestStartId = startId
        val snapshot = SnapshotStore.load(this)
        if (snapshot == null || snapshot.segments.isEmpty()) {
            // Nothing scheduled (empty preset day or no snapshot yet): stop quietly,
            // but promote first — every startForegroundService() carries a ~5s
            // deadline to call startForeground(), and missing it kills the app.
            promoteToForeground(null, null)
            stopSelfAndClear()
            return START_NOT_STICKY
        }
        val now = System.currentTimeMillis() / 1000L
        val lookup = SnapshotStore.lookup(snapshot, now)
        // Before the self-stop check: this can be the tick that sees a period end.
        ringIfPeriodJustEnded(snapshot, lookup, now)
        if (lookup.current == null && lookup.next == null) {
            // Same contract as above: the day is over, but this service was just
            // started, so it must promote before it may stop.
            promoteToForeground(snapshot, lookup)
            stopSelfAndClear()
            return START_NOT_STICKY
        }
        startForegroundTyped(OngoingNotifier.compose(this, snapshot, lookup))
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
        // A lecture just started on this tick: take its reminder down. (The
        // exact-alarm path cancels via TimerAlarmReceiver; this covers devices
        // where exact alarms are unavailable or the alarm was throttled.)
        if (lookup.current != null) {
            UpcomingAlertNotifier.cancelStarted(this, snapshot, now)
        }
        if (lookup.current == null && lookup.next == null) {
            stopSelfAndClear()
            return
        }
        // The live notification republishes here anyway; piggyback the widget
        // refresh so its countdown never drifts more than ~5s while this
        // service is alive — the widget previously only updated at transition
        // alarms, so it showed old data until the app was opened.
        TimerWidgetProvider.requestUpdate(this)
        startForegroundTyped(OngoingNotifier.compose(this, snapshot, lookup))
    }

    /**
     * startForeground with the manifest's specialUse type stated explicitly.
     * On Android 14+ the two-arg call can throw MissingForegroundServiceType-
     * Exception on some paths even when the manifest declares the type; the
     * three-arg form is the contract that always holds.
     */
    private fun startForegroundTyped(notification: Notification) {
        if (android.os.Build.VERSION.SDK_INT >= 34) {
            startForeground(
                OngoingNotifier.NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE,
            )
        } else {
            startForeground(OngoingNotifier.NOTIFICATION_ID, notification)
        }
    }

    /**
     * Rings the alarm if the period that just ended is still unannounced. The
     * window is wider than the 2s the JS tick uses because this loop slows to
     * 5s once the screen is asleep; the shared date-scoped dedupe in
     * EndAlertNotifier keeps this and the exact alarm from ringing twice.
     */
    private fun ringIfPeriodJustEnded(snapshot: TimelineSnapshot, lookup: Lookup, now: Long) {
        val ended = lookup.previous ?: return
        val sinceEnd = now - ended.endUnixSec
        if (sinceEnd < 0 || sinceEnd >= END_ALERT_WINDOW_SEC) return
        EndAlertNotifier.ringIfJustEnded(this, snapshot, ended, lookup.next, now)
    }

    /**
     * Calls startForeground(), which every startForegroundService() requires.
     * Falls back to a placeholder when there is no real countdown to show, so a
     * service that is about to stop can still honour that deadline instead of
     * throwing ForegroundServiceDidNotStartInTimeException and taking the app
     * process down with it.
     */
    private fun promoteToForeground(snapshot: TimelineSnapshot?, lookup: Lookup?) {
        val notification = if (snapshot != null && lookup != null) {
            OngoingNotifier.compose(this, snapshot, lookup)
        } else {
            OngoingNotifier.composeIdle(this)
        }
        startForegroundTyped(notification)
    }

    /** Battery-friendly: 1s while the screen is on, 5s once it's asleep. */
    private fun tickIntervalMs(): Long {
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        return if (pm.isInteractive) 1_000L else 5_000L
    }

    private fun stopSelfAndClear() {
        stopForeground(STOP_FOREGROUND_REMOVE)
        OngoingNotifier.clear(this)
        // stopSelf(int) with the latest startId: if another start command
        // arrived between this decision and the stop, the newer command keeps
        // the service alive instead of the stop killing its work mid-flight.
        stopSelf(latestStartId)
    }

    /** Start id of the most recent onStartCommand; see stopSelfAndClear. */
    private var latestStartId = 0
}
