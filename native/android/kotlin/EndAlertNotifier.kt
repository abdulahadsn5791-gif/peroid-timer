package com.periodtimer

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import androidx.core.app.NotificationCompat

/**
 * The "period ended" ALARM — the loud one. Posts a heads-up notification on a
 * dedicated alarm channel, using the user's custom ringtone
 * (snapshot.alarmSoundUri) or the built-in alarm sound. Fired from
 * TimerAlarmReceiver on an exact alarm, so it rings even when the app process
 * is dead and the phone is locked.
 *
 * The tone is the CHANNEL's sound, and the channel is (re)published with
 * `USAGE_ALARM` attributes before every alert. Android 8+ ignores `setSound` on
 * a notification builder once the channel exists, so the channel's own sound is
 * the only thing that decides what plays — leaving it unset (or set by an older
 * build) is what made the alarm follow media volume instead of alarm volume.
 * Publishing it here keeps the ringtone on the alarm stream and lets the
 * "Stop alarm" action silence it by cancelling the notification.
 */
object EndAlertNotifier {
    const val CHANNEL_ID = "period-timer-alarm"
    const val ACTION_STOP = "com.periodtimer.ACTION_STOP_ALARM"
    private const val BASE_NOTIFICATION_ID = 2001
    private const val EXTRA_NOTIFICATION_ID = "notificationId"

    fun ensureChannel(context: Context) {
        applyChannelSound(context, null)
    }

    /**
     * (Re)publishes the alarm channel with the given ringtone on the ALARM
     * audio stream. A no-op caller passes null to keep the platform default
     * alarm tone. Must be called before notifying, since the channel is what
     * actually plays the sound on Android 8+.
     */
    fun applyChannelSound(context: Context, alarmSoundUri: String?) {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Period-end alarm",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "Loud alarm with the chosen ringtone when a period ends."
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 400, 250, 400, 250, 400)
            lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
            setBypassDnd(false)
            setSound(
                resolveAlarmUri(alarmSoundUri),
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build(),
            )
        }
        manager.createNotificationChannel(channel)
    }

    /**
     * Posts the alarm notification for the period that just ended. Returns the
     * notification id used, so callers can cancel it later if needed.
     */
    fun post(context: Context, snapshot: TimelineSnapshot, ended: SegmentSnapshot, next: SegmentSnapshot?, now: Long): Int {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val accent = compatColor(snapshot.accentHex, 0xFF2563EB.toInt())
        val lines = buildString {
            appendLine("${ended.name} ended at ${ended.endLabel}")
            if (next != null) {
                appendLine("Up next: ${next.name} · starts ${next.startLabel}")
                val until = next.startUnixSec - now
                append("Starts in ${format(until.coerceAtLeast(0L))}")
            } else {
                append("All done for today — see you next time.")
            }
        }

        val id = BASE_NOTIFICATION_ID + (ended.id.hashCode() and 0x7fffffff) % 1000
        val contentIntent = PendingIntent.getActivity(
            context,
            0,
            context.packageManager.getLaunchIntentForPackage(context.packageName)
                ?: Intent(context, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val stopIntent = PendingIntent.getBroadcast(
            context,
            id,
            Intent(context, TimerAlarmReceiver::class.java)
                .setAction(ACTION_STOP)
                .putExtra(EXTRA_NOTIFICATION_ID, id),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_clock)
            .setContentTitle("⏰ ${ended.name} ended")
            .setContentText(if (next != null) "Up next: ${next.name} at ${next.startLabel}" else "All periods complete")
            .setStyle(NotificationCompat.BigTextStyle().bigText(lines.trimEnd()))
            .setContentIntent(contentIntent)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setColor(accent)
            .setColorized(true)
            .addAction(R.drawable.ic_stat_clock, "Stop alarm", stopIntent)

        // The channel owns the audio on Android 8+; only post a notification
        // when there is something to ring, otherwise a silent end-of-period
        // would still buzz the phone.
        if (snapshot.soundEnabled) {
            applyChannelSound(context, snapshot.alarmSoundUri)
            manager.notify(id, builder.build())
        } else {
            // No sound: a quiet heads-up instead of the alarm channel.
            manager.notify(
                id,
                NotificationCompat.Builder(context, CHANNEL_ID)
                    .setSmallIcon(R.drawable.ic_stat_clock)
                    .setContentTitle("${ended.name} ended")
                    .setContentText(if (next != null) "Up next: ${next.name} at ${next.startLabel}" else "All periods complete")
                    .setContentIntent(contentIntent)
                    .setAutoCancel(true)
                    .setColor(accent)
                    .setCategory(NotificationCompat.CATEGORY_EVENT)
                    .setDefaults(0)
                    .build(),
            )
        }
        return id
    }

    fun cancel(context: Context, id: Int) {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.cancel(id)
    }

    /**
     * Silences the alarm: cancelling the notification stops its channel sound,
     * so this is the whole of "stop". Exposed to JS for the in-app control.
     */
    fun cancelAllAlarms(context: Context) {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        for (n in manager.activeNotifications) {
            if (n.notification.channelId == CHANNEL_ID) manager.cancel(n.id)
        }
    }

    private fun resolveAlarmUri(alarmSoundUri: String?): android.net.Uri {
        if (!alarmSoundUri.isNullOrBlank()) {
            runCatching { android.net.Uri.parse(alarmSoundUri) }
                .getOrNull()
                ?.takeIf { it.scheme != null }
                ?.let { return it }
        }
        return RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
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
