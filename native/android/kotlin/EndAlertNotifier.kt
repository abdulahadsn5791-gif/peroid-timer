package com.periodtimer

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import androidx.core.app.NotificationCompat

/**
 * The "period ended" ALARM — the loud one. Posts a heads-up, sound-and-vibrate
 * notification on a dedicated alarm channel, using the user's custom ringtone
 * (snapshot.alarmSoundUri) or the built-in alarm sound. Fired from
 * TimerAlarmReceiver on an exact alarm, so it rings even when the app process
 * is dead and the phone is locked.
 */
object EndAlertNotifier {
    const val CHANNEL_ID = "period-timer-alarm"
    private const val BASE_NOTIFICATION_ID = 2001

    fun ensureChannel(context: Context) {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Period-end alarm",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "Loud alarm with the chosen ringtone when a period ends."
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 400, 250, 400, 250, 400)
            setBypassDnd(false)
            lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
        }
        manager.createNotificationChannel(channel)
    }

    /**
     * Posts the alarm notification for the period that just ended. Returns the
     * notification id used, so callers can cancel it later if needed.
     */
    fun post(context: Context, snapshot: TimelineSnapshot, ended: SegmentSnapshot, next: SegmentSnapshot?, now: Long): Int {
        ensureChannel(context)
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val contentIntent = PendingIntent.getActivity(
            context,
            0,
            context.packageManager.getLaunchIntentForPackage(context.packageName)
                ?: Intent(context, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

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

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_clock)
            .setContentTitle("⏰ ${ended.name} ended")
            .setContentText(if (next != null) "Up next: ${next.name} at ${next.startLabel}" else "All periods complete")
            .setStyle(NotificationCompat.BigTextStyle().bigText(lines.trimEnd()))
            .setContentIntent(contentIntent)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setColor(accent)
            .setColorized(true)

        // Custom ringtone (file/content URI) or the platform's default alarm
        // sound. Channel sound is the fallback for Android 8+; the in-call
        // AUDIO_USAGE_ALARM attribute makes it ring on the alarm stream.
        val soundUri = snapshot.alarmSoundUri ?: defaultAlarmSound(context)
        try {
            builder.setSound(android.net.Uri.parse(soundUri), android.media.AudioManager.STREAM_ALARM)
        } catch (_: Exception) {
            // malformed uri — channel defaults still apply
        }

        val id = BASE_NOTIFICATION_ID + (ended.id.hashCode() and 0x7fffffff) % 1000
        manager.notify(id, builder.build())
        return id
    }

    fun cancel(context: Context, id: Int) {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.cancel(id)
    }

    /**
     * Applies the ringtone to the alarm channel. Must run AFTER
     * setSound on the builder has been considered: Android 8+ plays the
     * channel's sound, so keep the channel in sync with the chosen ringtone.
     */
    fun updateChannelSound(context: Context, alarmSoundUri: String?) {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channel = manager.getNotificationChannel(CHANNEL_ID) ?: return
        val uri = try {
            android.net.Uri.parse(alarmSoundUri ?: defaultAlarmSound(context))
        } catch (_: Exception) {
            null
        }
        channel.setSound(
            uri,
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build(),
        )
        manager.createNotificationChannel(channel)
    }

    private fun defaultAlarmSound(context: Context): String {
        return RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM).toString()
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
