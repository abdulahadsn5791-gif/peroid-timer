package com.periodtimer

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings

/**
 * Exact alarms on Android 12+ need the SCHEDULE_EXACT_ALARM runtime grant.
 * We always prefer exact (cheap, wakes at the transition) and fall back to
 * inexact alarms when the user hasn't granted access — the UI surface is the
 * same, timing can drift up to ~10 minutes on the worst devices.
 *
 * Every set* call is wrapped in a SecurityException guard: access can be
 * revoked between the canScheduleExactAlarms() check and the alarm call, and
 * an uncaught SecurityException inside a receiver crashes the app.
 */
object AlarmSchedulerCore {
    const val ACTION_ALARM = "com.periodtimer.ACTION_ALARM"
    const val ACTION_END_ALERT = "com.periodtimer.ACTION_END_ALERT"
    const val ACTION_UPCOMING = "com.periodtimer.ACTION_UPCOMING_ALERT"
    const val ACTION_ROLLOVER = "com.periodtimer.ACTION_ROLLOVER"
    const val EXTRA_SEGMENT_ID = "segmentId"
    const val EXTRA_TRANSITION = "transition" // "start" | "end"
    const val EXTRA_AT_UNIX_SEC = "atUnixSec"
    const val EXTRA_PERIOD_NAME = "periodName"

    private const val ROLLOVER_RC = 0x5B00
    private val FLAGS = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE

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

    /**
     * Arms the self-rearming 00:00 rollover: every night this fires, the
     * receiver cancels stale alarms and re-arms the whole week from the
     * snapshot. This is what keeps the widget, the alarms and the live
     * notification correct with the app process long dead — the old build went
     * stale exactly because only the app itself could re-arm anything.
     */
    fun scheduleRolloverAlarm(context: Context) {
        val at = SnapshotStore.nextMidnightEpochSec(System.currentTimeMillis() / 1000L)
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val pi = PendingIntent.getBroadcast(
            context,
            ROLLOVER_RC,
            Intent(context, TimerAlarmReceiver::class.java).setAction(ACTION_ROLLOVER),
            FLAGS,
        )
        setBestEffort(am, at * 1000L, pi)
    }

    /** Exact when allowed, inexact otherwise; never throws. */
    private fun setBestEffort(am: AlarmManager, atMillis: Long, pi: PendingIntent) {
        val exact = try {
            hasExactAlarmAccessGuarded(am)
        } catch (_: Exception) {
            false
        }
        try {
            if (exact) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMillis, pi)
            } else {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMillis, pi)
            }
        } catch (se: SecurityException) {
            // Exact-alarm access revoked between the check and the call —
            // degrade to inexact rather than crash inside the receiver.
            runCatching { am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMillis, pi) }
        }
    }

    /** setBestEffort for callers that only have a context (e.g. UpcomingAlertNotifier). */
    private fun setBestEffortAm(context: Context, atUnixSec: Long, pi: PendingIntent) {
        val atMillis = atUnixSec * 1000L
        if (atMillis - System.currentTimeMillis() < 1500L) return // already past
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        setBestEffort(am, atMillis, pi)
    }

    private fun hasExactAlarmAccessGuarded(am: AlarmManager): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
        return am.canScheduleExactAlarms()
    }

    /** Schedules one alarm (start or end of a segment) at the given epoch second. */
    fun schedule(context: Context, segmentId: String, transition: String, atUnixSec: Long) {
        val atMillis = atUnixSec * 1000L
        if (atMillis - System.currentTimeMillis() < 1500L) return // already past
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val pi = pendingIntent(context, segmentId, transition, atUnixSec)
        setBestEffort(am, atMillis, pi)
    }

    /**
     * Replaces all transition + end-alert alarms with fresh ones derived from
     * the WHOLE snapshot horizon (8 days), then arms the nightly rollover.
     */
    fun scheduleAll(context: Context, snapshot: TimelineSnapshot): Int {
        cancelAll(context, snapshot)
        val now = System.currentTimeMillis() / 1000L
        var scheduled = 0
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        for (seg in snapshot.segments) {
            if (seg.startUnixSec > now) {
                setBestEffort(am, seg.startUnixSec * 1000L, pendingIntent(context, seg.id, "start", seg.startUnixSec))
                scheduled++
            }
            if (seg.endUnixSec > now) {
                setBestEffort(am, seg.endUnixSec * 1000L, pendingIntent(context, seg.id, "end", seg.endUnixSec))
                scheduled++
            }
        }
        scheduleRolloverAlarm(context)
        return scheduled
    }

    /**
     * Arms one "alarm clock" per period end ACROSS ALL DAYS: fires
     * ACTION_END_ALERT, which rings the alarm ringtone and posts a heads-up
     * notification — even when the app process is dead. PendingIntent request
     * codes are derived from segment id + fire time, so different days never
     * collide, and a period id rings again on its next calendar day.
     *
     * This is the one native entry point every snapshot-apply path already
     * calls (save, boot, rollover, module), so the upcoming-lecture reminder
     * alarms are armed here too — arming them anywhere later would leave the
     * feature silent until the next midnight rollover.
     */
    fun scheduleEndAlerts(context: Context, snapshot: TimelineSnapshot): Int {
        EndAlertNotifier.publishChannel(context, snapshot.alarmSoundUri)
        val now = System.currentTimeMillis() / 1000L
        var scheduled = 0
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        for (seg in snapshot.segments) {
            if (seg.endUnixSec <= now) continue
            setBestEffort(am, seg.endUnixSec * 1000L, endAlertPendingIntent(context, seg.id, seg.name, seg.endUnixSec))
            scheduled++
        }
        UpcomingAlertNotifier.scheduleAll(context, snapshot)
        scheduleRolloverAlarm(context)
        return scheduled
    }

    /**
     * Arms one silent reminder alarm per lecture start (minus lead time). The
     * receiver posts the heads-up via UpcomingAlertNotifier.onAlarm.
     */
    fun scheduleUpcoming(
        context: Context,
        segId: String,
        periodName: String,
        atUnixSec: Long,
    ) {
        setBestEffortAm(context, atUnixSec, upcomingPendingIntent(context, segId, periodName, atUnixSec))
    }

    fun upcomingPendingIntent(
        context: Context,
        segId: String,
        periodName: String,
        atUnixSec: Long,
    ): PendingIntent {
        val intent = Intent(context, TimerAlarmReceiver::class.java)
            .setAction(ACTION_UPCOMING)
            .putExtra(EXTRA_SEGMENT_ID, segId)
            .putExtra(EXTRA_PERIOD_NAME, periodName)
            .putExtra(EXTRA_AT_UNIX_SEC, atUnixSec)
        val code = (segId.hashCode() * 31 + "upcoming".hashCode() + atUnixSec.toInt()) and 0x7fffffff
        return PendingIntent.getBroadcast(context, code, intent, FLAGS)
    }

    /** Cancels every transition + end-alert + upcoming alarm exactly as it was scheduled. */
    fun cancelAll(context: Context, snapshot: TimelineSnapshot) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        for (seg in snapshot.segments) {
            for (transition in listOf("start", "end")) {
                val at = if (transition == "start") seg.startUnixSec else seg.endUnixSec
                am.cancel(pendingIntent(context, seg.id, transition, at))
            }
            am.cancel(endAlertPendingIntent(context, seg.id, seg.name, seg.endUnixSec))
        }
        UpcomingAlertNotifier.cancelAll(context, snapshot)
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
        // One PendingIntent per (segment, transition, FIRE TIME). The fire time
        // MUST be part of the code: the v7 snapshot holds the same period id on
        // every day of the week, and without the time Monday's "p1 start" and
        // Tuesday's "p1 start" would share one PendingIntent — each arm would
        // replace the previous alarm and only the last-armed day would fire.
        val code = (
            segId.hashCode() * 31 +
                transition.hashCode() * 1_000_003 +
                atUnixSec.hashCode()
            ) and 0x7fffffff
        return PendingIntent.getBroadcast(context, code, intent, FLAGS)
    }

    private fun endAlertPendingIntent(
        context: Context,
        segId: String,
        periodName: String,
        atUnixSec: Long,
    ): PendingIntent {
        val intent = Intent(context, TimerAlarmReceiver::class.java)
            .setAction(ACTION_END_ALERT)
            .putExtra(EXTRA_SEGMENT_ID, segId)
            .putExtra(EXTRA_PERIOD_NAME, periodName)
            .putExtra(EXTRA_AT_UNIX_SEC, atUnixSec)
        val code = (segId.hashCode() * 31 + atUnixSec.toInt()) and 0x7fffffff
        return PendingIntent.getBroadcast(context, code, intent, FLAGS)
    }
}
