package com.periodtimer

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Fires on each scheduled transition (start or end of a segment) and on each
 * end-of-period ALARM — even when the app process and its JS are backgrounded
 * or dead. Keeps the widget fresh, re-arms the live notification service,
 * rings the end-of-period alarm, and converges inexact alarms. This receiver
 * has no schedule rules of its own; everything is a snapshot lookup.
 */
class TimerAlarmReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: AlarmSchedulerCore.ACTION_ALARM

        // "Stop alarm" must work even if the snapshot has since been rewritten
        // or removed, so it is handled before the snapshot is read.
        if (action == EndAlertNotifier.ACTION_STOP) {
            onStopAlarm(context, intent)
            return
        }

        val snapshot = SnapshotStore.load(context) ?: return
        val now = System.currentTimeMillis() / 1000L

        when (action) {
            AlarmSchedulerCore.ACTION_END_ALERT -> onEndAlert(context, snapshot, intent, now)
            else -> onTransition(context, snapshot, now)
        }
    }

    /**
     * The alarm notification's "Stop alarm" action: silence the ringtone and
     * take the notification down. Deduped periods re-arm their alarm for the
     * next day, so stopping here never disables future alerts.
     */
    private fun onStopAlarm(context: Context, intent: Intent) {
        val id = intent.getIntExtra(EndAlertNotifier.EXTRA_NOTIFICATION_ID, 0)
        // Cancelling the notification stops its channel sound, so that alone is
        // enough; clear any other stray alarm too.
        if (id != 0) EndAlertNotifier.cancel(context, id)
        EndAlertNotifier.cancelAllAlarms(context)
        // The app is usually still running with its end-of-period toast on
        // screen, and this action cannot reach JS. Leave a signal so that tick
        // drops the toast as well.
        SnapshotStore.setStopSignal(context)
    }

    /**
     * The loud end-of-period alert, on an exact alarm. The ringing decision,
     * both toggles and the `weekday:periodId` dedupe all live in
     * EndAlertNotifier.ringIfJustEnded, which the foreground service calls too —
     * so whichever watcher gets there first rings and the other is a no-op, and
     * a repeated delivery (inexact alarm retry, a service tick) can never ring
     * twice. Weekly presets rotate the weekday inside the key, so the same
     * period rings again tomorrow.
     */
    private fun onEndAlert(context: Context, snapshot: TimelineSnapshot, intent: Intent, now: Long) {
        val segId = intent.getStringExtra(AlarmSchedulerCore.EXTRA_SEGMENT_ID) ?: return
        val ended = snapshot.segments.firstOrNull { it.id == segId } ?: return
        EndAlertNotifier.ringIfJustEnded(context, snapshot, ended, SnapshotStore.lookup(snapshot, now).next, now)
    }

    private fun onTransition(context: Context, snapshot: TimelineSnapshot, now: Long) {
        val lookup = SnapshotStore.lookup(snapshot, now)

        TimerWidgetProvider.requestUpdate(context)
        if (lookup.current != null || lookup.next != null) {
            PeriodTimerSchedulerModule.startForegroundServiceSafe(context)
        }

        // Re-arm anything we just crossed so a slightly-delayed device still converges.
        if (!AlarmSchedulerCore.hasExactAlarmAccess(context)) {
            AlarmSchedulerCore.scheduleAll(context, snapshot)
        }
    }
}
