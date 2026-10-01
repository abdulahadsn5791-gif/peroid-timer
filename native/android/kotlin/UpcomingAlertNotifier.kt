package com.periodtimer

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat

/**
 * The "upcoming lecture" heads-up: one silent notification per lecture,
 * posted leadSec before its start (lead time comes from the snapshot the app
 * writes — 1h, 2h, up to 100h).
 *
 * It posts on its own IMPORTANCE_LOW channel so it never buzzes; the loud
 * channel stays reserved for the period-END alarm. It honors the same
 * notificationsEnabled toggle as the end-of-period alert: notifications off
 * means a completely silent day.
 *
 * Dedupe is date-scoped like the end alert ("YYYY-MM-DD:periodId") but kept
 * in its own file, so an upcoming alert and an end alert for the same period
 * never suppress each other.
 */
object UpcomingAlertNotifier {
    /**
     * Own IMPORTANCE_LOW channel instead of riding the live-countdown one:
     * "setOnlyAlertOnce" only suppresses the alert for REPOSTS OF THE SAME
     * notification id — every new reminder has its own id, so sharing the
     * countdown channel made each reminder peel off the shade as a new
     * head-up-style entry and stay there forever ("not following the rule").
     * On its own silent channel a reminder behaves like a normal heads-up:
     * it shows briefly, then moves to the shade, and is cancelled outright
     * once the lecture starts.
     */
    const val CHANNEL_ID = "period-timer-upcoming"
    private const val BASE_NOTIFICATION_ID = 3001

    fun scheduleAll(context: Context, snapshot: TimelineSnapshot) {
        val leadSec = snapshot.upcomingAlertLeadSec
        if (leadSec <= 0L) return // feature off
        val now = System.currentTimeMillis() / 1000L
        for (seg in snapshot.segments) {
            val at = seg.startUnixSec - leadSec
            if (at <= now) continue
            AlarmSchedulerCore.scheduleUpcoming(
                context,
                seg.id,
                seg.name,
                at,
            )
        }
    }

    fun cancelAll(context: Context, snapshot: TimelineSnapshot) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        for (seg in snapshot.segments) {
            am.cancel(pendingIntent(context, seg.id, seg.name, seg.startUnixSec - snapshot.upcomingAlertLeadSec))
        }
    }

    /**
     * Fires on the exact alarm leadSec before a lecture starts. Deduped per
     * day+period, so an inexact-alarm redelivery can never double-post.
     */
    fun onAlarm(context: Context, snapshot: TimelineSnapshot, segId: String, atUnixSec: Long) {
        if (snapshot.upcomingAlertLeadSec <= 0L) return
        if (!snapshot.notificationsEnabled) return
        val seg = snapshot.segments.firstOrNull {
            it.id == segId && it.startUnixSec - snapshot.upcomingAlertLeadSec == atUnixSec
        } ?: return
        val now = System.currentTimeMillis() / 1000L
        if (now >= seg.startUnixSec) return // already started — nothing to remind about

        val dayKey = SnapshotStore.dateKeyOf(snapshot, seg)
        val key = "$dayKey:${seg.id}"
        if (SnapshotStore.lastUpcomingKey(context) == key) return
        SnapshotStore.setLastUpcomingKey(context, key)

        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        ensureChannel(context)
        val contentIntent = PendingIntent.getActivity(
            context,
            0,
            context.packageManager.getLaunchIntentForPackage(context.packageName)
                ?: Intent(context, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val until = seg.startUnixSec - now
        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_clock)
            .setContentTitle("Up next: ${seg.name}")
            .setContentText("Starts at ${seg.startLabel} · in ${format(until.coerceAtLeast(0L))}")
            .setStyle(
                NotificationCompat.BigTextStyle()
                    .bigText("Starts at ${seg.startLabel} — ${format(until.coerceAtLeast(0L))} from now."),
            )
            .setContentIntent(contentIntent)
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_EVENT)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setColor(compatColor(snapshot.accentHex))
            .setDefaults(0)
        manager.notify(notificationId(seg.id), builder.build())
        TimerWidgetProvider.requestUpdate(context)
    }

    /**
     * Takes down every reminder once its lecture has started. Called from the
     * transition receiver ("start" alarms) and the foreground service tick —
     * the two paths that reliably wake at the lecture boundary.
     */
    fun cancelStarted(context: Context, snapshot: TimelineSnapshot, now: Long) {
        if (snapshot.upcomingAlertLeadSec <= 0L) return
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        for (seg in snapshot.segments) {
            if (seg.startUnixSec <= now) manager.cancel(notificationId(seg.id))
        }
    }

    fun ensureChannel(context: Context) {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Upcoming lectures",
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = "Silent heads-up before a scheduled period starts."
            setSound(null, null)
            enableVibration(false)
            setShowBadge(false)
            lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
        }
        manager.createNotificationChannel(channel)
    }

    private fun notificationId(segId: String): Int =
        BASE_NOTIFICATION_ID + (segId.hashCode() and 0x7fffffff) % 1000

    private fun pendingIntent(context: Context, segId: String, periodName: String, atUnixSec: Long): PendingIntent =
        AlarmSchedulerCore.upcomingPendingIntent(context, segId, periodName, atUnixSec)

    private fun format(sec: Long): String {
        val hours = sec / 3600
        val mins = (sec % 3600) / 60
        val secs = sec % 60
        return if (hours > 0) String.format("%d:%02d:%02d", hours, mins, secs)
        else String.format("%d:%02d", mins, secs)
    }

    private fun compatColor(hex: String): Int = try {
        android.graphics.Color.parseColor(hex)
    } catch (e: IllegalArgumentException) {
        0xFF2563EB.toInt()
    }
}
