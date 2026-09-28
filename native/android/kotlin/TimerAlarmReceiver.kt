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
        val snapshot = SnapshotStore.load(context) ?: return
        val action = intent.action ?: AlarmSchedulerCore.ACTION_ALARM
        val now = System.currentTimeMillis() / 1000L

        when (action) {
            AlarmSchedulerCore.ACTION_END_ALERT -> onEndAlert(context, snapshot, intent, now)
            else -> onTransition(context, snapshot, now)
        }
    }

    /**
     * The loud end-of-period alert. Deduped per weekday+period so a repeated
     * delivery (inexact alarm retry) cannot ring twice; weekly presets rotate
     * the weekday inside the key, so the same period rings again tomorrow.
     */
    private fun onEndAlert(context: Context, snapshot: TimelineSnapshot, intent: Intent, now: Long) {
        if (snapshot.segments.isEmpty()) return // empty preset day: never ring
        if (!snapshot.soundEnabled) return

        val segId = intent.getStringExtra(AlarmSchedulerCore.EXTRA_SEGMENT_ID) ?: return
        val ended = snapshot.segments.firstOrNull { it.id == segId } ?: return

        val key = "${snapshot.weekday}:$segId"
        if (SnapshotStore.lastNotifiedKey(context) == key) return
        SnapshotStore.setLastNotifiedKey(context, key)

        val lookup = SnapshotStore.lookup(snapshot, now)
        EndAlertNotifier.updateChannelSound(context, snapshot.alarmSoundUri)
        EndAlertNotifier.post(context, snapshot, ended, lookup.next, now)
        TimerWidgetProvider.requestUpdate(context)
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
