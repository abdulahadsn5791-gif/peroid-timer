package com.periodtimer

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings

/**
 * Warn: exact alarms on Android 12+ need the SCHEDULE_EXACT_ALARM runtime grant.
 * We always prefer exact (cheap, wakes at the transition) and fall back to
 * inexact alarms when the user hasn't granted access — the UI surface is the
 * same, timing can drift up to ~10 minutes on some devices.
 */
object AlarmSchedulerCore {
    const val ACTION_ALARM = "com.periodtimer.ACTION_ALARM"
    const val EXTRA_SEGMENT_ID = "segmentId"
    const val EXTRA_TRANSITION = "transition" // "start" | "end"
    const val EXTRA_AT_UNIX_SEC = "atUnixSec"

    fun hasExactAlarmAccess(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        return am.canScheduleExactAlarms()
    }

    fun requestExactAlarmAccess(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return
        val intent = Intent(
            Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
            Uri.parse("package:" + context.packageName),
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try {
            context.startActivity(intent)
        } catch (_: Exception) {
            // Settings screen missing on some OEM builds; inexact fallback stays active.
        }
    }

    /** Schedules one alarm (start or end of a segment) at the given epoch second. */
    fun schedule(
        context: Context,
        segmentId: String,
        transition: String,
        atUnixSec: Long,
    ) {
        val atMillis = atUnixSec * 1000L
        if (atMillis - System.currentTimeMillis() < 1500L) return // already past
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val pi = pendingIntent(context, segmentId, transition, atUnixSec)
        val exact = hasExactAlarmAccess(context)
        if (exact) {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMillis, pi)
        } else {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMillis, pi)
        }
    }

    /** Replaces all transition alarms with fresh ones derived from the snapshot. */
    fun scheduleAll(context: Context, snapshot: TimelineSnapshot): Int {
        cancelAll(context, snapshot)
        val now = System.currentTimeMillis() / 1000L
        var scheduled = 0
        for (seg in snapshot.segments) {
            if (seg.startUnixSec > now) {
                schedule(context, seg.id, "start", seg.startUnixSec)
                scheduled++
            }
            if (seg.endUnixSec > now) {
                schedule(context, seg.id, "end", seg.endUnixSec)
                scheduled++
            }
        }
        return scheduled
    }

    /** Cancels every transition alarm exactly as it was scheduled. */
    fun cancelAll(context: Context, snapshot: TimelineSnapshot) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        for (seg in snapshot.segments) {
            for (transition in listOf("start", "end")) {
                val at = if (transition == "start") seg.startUnixSec else seg.endUnixSec
                am.cancel(pendingIntent(context, seg.id, transition, at))
            }
        }
    }

    private fun pendingIntent(
        context: Context,
        segId: String,
        transition: String,
        atUnixSec: Long,
    ): PendingIntent {
        val intent = Intent(context, TimerAlarmReceiver::class.java)
            .setAction(ACTION_ALARM)
            .putExtra(EXTRA_SEGMENT_ID, segId)
            .putExtra(EXTRA_TRANSITION, transition)
            .putExtra(EXTRA_AT_UNIX_SEC, atUnixSec)
        // One PendingIntent per (segment, transition) so cancellations don't collide.
        val code = (segId.hashCode() * 31 + transition.hashCode()) and 0x7fffffff
        return PendingIntent.getBroadcast(context, code, intent, flags())
    }

    private fun flags(): Int {
        return PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    }
}