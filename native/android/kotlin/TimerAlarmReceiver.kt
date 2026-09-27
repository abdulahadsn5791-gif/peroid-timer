package com.periodtimer

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Fires on each scheduled transition (start or end of a segment) — even when
 * the app process and its JS are backgrounded or dead. Keeps the widget fresh,
 * re-arms the live notification service, and converges inexact alarms. This
 * receiver has no schedule rules of its own.
 */
class TimerAlarmReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val snapshot = SnapshotStore.load(context) ?: return
        val transition = intent.getStringExtra(AlarmSchedulerCore.EXTRA_TRANSITION) ?: return
        val now = System.currentTimeMillis() / 1000L
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