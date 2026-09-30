package com.periodtimer

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat

/**
 * Composes the "live progress" notification — Google Maps navigation style:
 * ongoing, above the lock screen, with a real progress bar that the foreground
 * service republishes every second. All numbers come from the snapshot data;
 * the only arithmetic here is the time-relative progress at a given moment.
 */
object OngoingNotifier {
    const val CHANNEL_ID = "period-timer"
    const val NOTIFICATION_ID = 1001

    fun ensureChannel(context: Context) {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Period timer",
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = "Live period countdown with progress; setShowWhenLocked keeps it visible above the lock screen."
            setSound(null, null)
            setShowBadge(false)
            enableVibration(false)
        }
        manager.createNotificationChannel(channel)
    }

    fun post(context: Context, snapshot: TimelineSnapshot, lookup: Lookup) {
        ensureChannel(context)
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, compose(context, snapshot, lookup))
    }

    /** Builds the current notification without posting (used by the foreground service). */
    fun compose(context: Context, snapshot: TimelineSnapshot, lookup: Lookup): Notification {
        ensureChannel(context)
        val builder = composeBuilder(context, snapshot, lookup)
        return builder.build()
    }

    fun clear(context: Context) {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.cancel(NOTIFICATION_ID)
    }

    /**
     * A silent placeholder for the instant between startForegroundService() and
     * deciding there is nothing worth showing.
     *
     * Android allows a startForegroundService()'d service about five seconds to
     * call startForeground(); stopping itself instead of promoting is a
     * ForegroundServiceDidNotStartInTimeException, and the system kills the app
     * process over it. So the foreground service has to promote even on the
     * paths where it is about to stop — a fresh install hits one of those on
     * every launch, because it has no snapshot yet.
     *
     * It is a real notification because startForeground() will not accept
     * anything else, but it exists only to honour that contract: the service
     * removes it within the same call, so the user never sees it.
     */
    fun composeIdle(context: Context): Notification {
        ensureChannel(context)
        return NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_clock)
            .setContentTitle("Period timer")
            .setContentText("Nothing scheduled")
            .setOngoing(true)
            .setShowWhen(false)
            .setOnlyAlertOnce(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setDefaults(0)
            .build()
    }

    private fun composeBuilder(
        context: Context,
        snapshot: TimelineSnapshot,
        lookup: Lookup,
    ): NotificationCompat.Builder {
        val current = lookup.current
        val accent = compatColor(snapshot.accentHex, 0xFF2563EB.toInt())
        // "Color the notification": when enabled the notification follows the
        // current phase palette color (like the ring), otherwise it uses the
        // static accent.
        val color = if (snapshot.colorNotification) {
            current?.let { compatColor(it.color(lookup.now), accent) } ?: accent
        } else {
            accent
        }
        val contentIntent = PendingIntent.getActivity(
            context,
            0,
            context.packageManager.getLaunchIntentForPackage(context.packageName)
                ?: Intent(context, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_clock)
            .setContentTitle(title(lookup))
            .setContentText(subtitle(lookup))
            .setContentIntent(contentIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setColor(color)
        if (android.os.Build.VERSION.SDK_INT >= 26) {
            builder.setColorized(true)
        }

        val target: Long
        val started: Boolean
        if (current != null) {
            target = current.endUnixSec * 1000L
            started = true
            val remaining = SnapshotStore.remainingFraction(current, lookup.now)
            builder.setProgress(100, (remaining * 100).toInt().coerceIn(0, 100), false)
        } else if (lookup.next != null) {
            target = lookup.next.startUnixSec * 1000L
            started = true
            builder.setProgress(100, 0, false)
        } else {
            target = System.currentTimeMillis()
            started = false
        }
        if (started) {
            builder.setWhen(target)
            builder.setUsesChronometer(true)
            // countDown requires API 24+; on older devices it shows a count-up.
            if (android.os.Build.VERSION.SDK_INT >= 24) {
                builder.setChronometerCountDown(true)
            }
        }

        builder.setStyle(bigText(snapshot, lookup))
        return builder
    }

    private fun bigText(snapshot: TimelineSnapshot, lookup: Lookup): NotificationCompat.BigTextStyle {
        val current = lookup.current
        return if (current != null) {
            val lines = buildString {
                appendLine(title(lookup))
                appendLine(subtitle(lookup))
                if (current.endLabel.isNotBlank()) appendLine("Ends at ${current.endLabel}")
                lookup.next?.let { appendLine("Up next: ${it.name}") }
            }
            NotificationCompat.BigTextStyle().bigText(lines.trimEnd())
        } else if (lookup.next != null) {
            val lines = buildString {
                appendLine(title(lookup))
                appendLine(subtitle(lookup))
                if (lookup.next.startLabel.isNotBlank()) appendLine("Starts at ${lookup.next.startLabel}")
                appendLine("See you at ${lookup.next.name}")
            }
            NotificationCompat.BigTextStyle().bigText(lines.trimEnd())
        } else {
            NotificationCompat.BigTextStyle().bigText("All periods complete — see you tomorrow.")
        }
    }

    private fun title(lookup: Lookup): String {
        val current = lookup.current
        return when {
            current != null -> current.name
            lookup.next != null -> "Up next: " + lookup.next.name
            else -> "All periods complete"
        }
    }

    private fun subtitle(lookup: Lookup): String {
        val current = lookup.current
        return when {
            current != null -> {
                val s = (current.endUnixSec - lookup.now).coerceAtLeast(0L)
                val pct = percent(current, lookup.now)
                "Ends in ${format(s)} · $pct% left"
            }
            lookup.next != null -> startsIn(lookup.next, lookup.now)
            else -> "See you tomorrow."
        }
    }

    private fun percent(seg: SegmentSnapshot, now: Long): Int {
        return (SnapshotStore.remainingFraction(seg, now) * 100).toInt().coerceIn(0, 100)
    }

    private fun startsIn(seg: SegmentSnapshot, now: Long): String {
        val s = (seg.startUnixSec - now).coerceAtLeast(0L)
        return "Starts in ${format(s)}"
    }

    private fun format(sec: Long): String {
        val hours = sec / 3600
        val mins = (sec % 3600) / 60
        val secs = sec % 60
        return if (hours > 0) String.format("%d:%02d:%02d", hours, mins, secs)
        else String.format("%d:%02d", mins, secs)
    }

    private fun compatColor(hex: String, fallback: Int): Int {
        return try {
            android.graphics.Color.parseColor(hex)
        } catch (e: IllegalArgumentException) {
            fallback
        }
    }
}