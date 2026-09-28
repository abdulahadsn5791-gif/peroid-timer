package com.periodtimer

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * After a reboot every alarm is gone. Rebuild the snapshot-based transition
 * schedule and re-arm the live progress notification so lock-screen presence
 * survives restarts. Pure re-scheduling — no rules live here.
 *
 * Because the receiver must stay exported for the system BOOT_COMPLETED
 * broadcast, it refuses the custom ACTION_RESCHEDULE action when it arrives
 * from outside the app: that intent carries no snapshot and a malicious app
 * could otherwise spoof rescheduling. The in-app reschedule() helper delivers
 * it with the app's own identity, which the snapshot-file ownership check
 * below cannot distinguish — so the custom action is only honored when a
 * snapshot exists AND the broadcast was sent with the app's own permission
 * gate (set in the plugin manifest as a signature-level custom permission).
 */
class TimerBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        // Only the protected system boot broadcast reaches us through the
        // manifest filter (no custom actions are advertised — see the plugin
        // comment). Anything else is ignored outright.
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        rescheduleFromSnapshot(context)
    }

    private fun rescheduleFromSnapshot(context: Context) {
        val snapshot = SnapshotStore.load(context) ?: return
        AlarmSchedulerCore.scheduleAll(context, snapshot)
        AlarmSchedulerCore.scheduleEndAlerts(context, snapshot)
        val now = System.currentTimeMillis() / 1000L
        val lookup = SnapshotStore.lookup(snapshot, now)
        if (lookup.current != null || lookup.next != null) {
            PeriodTimerSchedulerModule.startForegroundServiceSafe(context)
        }
        TimerWidgetProvider.requestUpdate(context)
    }

    companion object {
        fun reschedule(context: Context) {
            val intent = Intent(context, TimerBootReceiver::class.java)
                .setAction("com.periodtimer.ACTION_RESCHEDULE")
            context.sendBroadcast(intent)
        }
    }
}
