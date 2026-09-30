package com.periodtimer

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Fires on each scheduled transition (start or end of a segment), on each
 * end-of-period ALARM — even when the app process and its JS are backgrounded
 * or dead — and once every night at 00:00 to re-arm the whole week. Keeps the
 * widget fresh, re-arms the live notification service, rings the end-of-period
 * alarm, and converges inexact alarms. This receiver has no schedule rules of
 * its own; everything is a snapshot lookup.
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
            AlarmSchedulerCore.ACTION_ROLLOVER -> onRollover(context, snapshot, now)
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
     * both toggles and the date-scoped dedupe all live in
     * EndAlertNotifier.ringIfJustEnded, which the foreground service calls too —
     * so whichever watcher gets there first rings and the other is a no-op, and
     * a repeated delivery (inexact alarm retry, a service tick) can never ring
     * twice. The date key rotates per calendar day, so the same period rings
     * again on its next occurrence.
     */
    private fun onEndAlert(context: Context, snapshot: TimelineSnapshot, intent: Intent, now: Long) {
        val segId = intent.getStringExtra(AlarmSchedulerCore.EXTRA_SEGMENT_ID) ?: return
        // Match on id AND fire time: the v7 snapshot repeats every period id on
        // each day of the week, so matching by id alone would grab the FIRST
        // day's segment — the wrong dedupe key (a later occurrence gets
        // swallowed) and wrong "up next" times in the alert body.
        val at = intent.getLongExtra(AlarmSchedulerCore.EXTRA_AT_UNIX_SEC, -1L)
        val ended = snapshot.segments.firstOrNull { it.id == segId && (at == -1L || it.endUnixSec == at) }
            ?: return
        EndAlertNotifier.ringIfJustEnded(
            context,
            snapshot,
            ended,
            SnapshotStore.lookup(snapshot, now).next,
            now,
        )
    }

    /**
     * Midnight rollover: the nightly self-rearm. Cancels everything, then
     * re-arms the remaining days of the snapshot horizon straight from the
     * file the app last wrote — no app process needed. This is the fix for the
     * stale widget/dead alarms overnight: the v6 build only ever re-armed from
     * the app itself, so one process death froze everything until reopen.
     *
     * The snapshot horizon is 8 days and the rollover re-arms every night, so
     * the future days it arms are always at most one day stale — and every app
     * open/save/boot refreshes the horizon anyway.
     */
    private fun onRollover(context: Context, snapshot: TimelineSnapshot, now: Long) {
        AlarmSchedulerCore.scheduleAll(context, snapshot)
        AlarmSchedulerCore.scheduleEndAlerts(context, snapshot)
        TimerWidgetProvider.requestUpdate(context)
        val lookup = SnapshotStore.lookup(snapshot, now)
        if (lookup.current != null || lookup.next != null) {
            PeriodTimerSchedulerModule.startForegroundServiceSafe(context)
        }
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
