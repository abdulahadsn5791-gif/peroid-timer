package com.periodtimer

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * After a reboot every alarm is gone. Rebuild the snapshot-based transition
 * schedule and re-arm the live progress notification so lock-screen presence
 * survives restarts. Pure re-scheduling — no rules live here.
 */
class TimerBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED ||
            intent.action == "com.periodtimer.ACTION_RESCHEDULE"
        ) {
            val snapshot = SnapshotStore.load(context) ?: return
            AlarmSchedulerCore.scheduleAll(context, snapshot)
            val now = System.currentTimeMillis() / 1000L
            val lookup = SnapshotStore.lookup(snapshot, now)
            if (lookup.current != null || lookup.next != null) {
                PeriodTimerSchedulerModule.startForegroundServiceSafe(context)
            }
            TimerWidgetProvider.requestUpdate(context)
        }
    }

    companion object {
        fun reschedule(context: Context) {
            val intent = Intent(context, TimerBootReceiver::class.java)
                .setAction("com.periodtimer.ACTION_RESCHEDULE")
            context.sendBroadcast(intent)
        }
    }
}