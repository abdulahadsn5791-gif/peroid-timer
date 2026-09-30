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
 * TimerAlarmReceiver on an exact alarm and from PeriodForegroundService on its
 * own tick, so it rings even when the app process is dead and the phone is
 * locked — and even when exact-alarm access was never granted.
 *
 * The tone is the CHANNEL's sound with `USAGE_ALARM` attributes: Android 8+
 * ignores `setSound` on a notification builder once the channel exists, so the
 * channel's own sound is the only thing that decides what plays, and it plays on
 * the alarm stream rather than media volume. The channel is published by
 * [publishChannel] when the day plan is applied, and the "Stop alarm" action
 * silences it by cancelling the notification.
 */
object EndAlertNotifier {
    const val CHANNEL_ID = "period-timer-alarm"
    const val ACTION_STOP = "com.periodtimer.ACTION_STOP_ALARM"
    private const val BASE_NOTIFICATION_ID = 2001

    /** End-of-period alert ids are derived from BASE_NOTIFICATION_ID. */
    private val ALERT_ID_RANGE = BASE_NOTIFICATION_ID..(BASE_NOTIFICATION_ID + 999)

    /** Read back by TimerAlarmReceiver when the "Stop alarm" action fires. */
    const val EXTRA_NOTIFICATION_ID = "notificationId"

    /**
     * (Re)publishes the alarm channel with the given ringtone on the ALARM
     * audio stream. A no-op caller passes null to keep the platform default
     * alarm tone.
     *
     * Android only honours the sound a channel is FIRST created with, so a new
     * ringtone means deleting and recreating the channel. That swap must never
     * happen in the same breath as posting an alert: the notification manager
     * can hand a freshly posted notification to the channel record it still has
     * cached, so an alert posted across a channel swap comes out SILENT — the
     * heads-up appears with its "Stop alarm" button and makes no sound at all.
     * So this runs when the day plan is applied (boot, save, midnight) and
     * [post] only ever creates the channel when it is missing. The swap is also
     * skipped outright while an alert is on screen, so a new ringtone can never
     * cut off an alarm that is still ringing.
     */
    fun publishChannel(context: Context, alarmSoundUri: String?) {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val uri = resolveAlarmUri(context, alarmSoundUri)

        if (android.os.Build.VERSION.SDK_INT >= 26) {
            val existing = manager.getNotificationChannel(CHANNEL_ID)
            if (existing != null && existing.sound != uri) {
                // Deleting a channel takes its notifications down with it, which
                // would silence a ring the user has not stopped yet. The next plan
                // apply picks the new ringtone up.
                if (isAlertShowing(manager)) return
                manager.deleteNotificationChannel(CHANNEL_ID)
            }
        }

        manager.createNotificationChannel(buildChannel(uri))
    }

    /**
     * The single place a period end becomes an alarm.
     *
     * Both watchers funnel through here — the exact-alarm broadcast and the
     * foreground service — and the `weekday:periodId` dedupe key means whichever
     * one gets there first rings and the other is a no-op, so a period can never
     * ring twice. Returns true when this call was the one that rang.
     *
     * Both toggles are honoured independently: the notification toggle stops
     * the alert entirely, the sound toggle stops just the ringtone.
     */
    fun ringIfJustEnded(
        context: Context,
        snapshot: TimelineSnapshot,
        ended: SegmentSnapshot,
        next: SegmentSnapshot?,
        now: Long,
    ): Boolean {
        if (snapshot.segments.isEmpty()) return false // empty preset day: never ring
        if (!snapshot.soundEnabled && !snapshot.notificationsEnabled) return false

        val key = "${snapshot.weekday}:${ended.id}"
        if (SnapshotStore.lastNotifiedKey(context) == key) return false
        SnapshotStore.setLastNotifiedKey(context, key)

        if (!snapshot.notificationsEnabled) {
            // Silent day end: nothing posts, and any still-ringing alarm stops.
            cancelAllAlarms(context)
            return true
        }

        post(context, snapshot, ended, next, now)
        TimerWidgetProvider.requestUpdate(context)
        return true
    }

    /** Creates the channel only when it does not exist yet — the safe path used while an alert is going out. */
    private fun ensureChannel(context: Context, alarmSoundUri: String?) {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (android.os.Build.VERSION.SDK_INT >= 26 && manager.getNotificationChannel(CHANNEL_ID) != null) {
            return
        }
        manager.createNotificationChannel(buildChannel(resolveAlarmUri(context, alarmSoundUri)))
    }

    private fun buildChannel(uri: android.net.Uri): NotificationChannel =
        NotificationChannel(
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
                uri,
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build(),
            )
        }

    /**
     * Posts the alarm notification for the period that just ended. Only
     * [ringIfJustEnded] calls this, so an alert is never posted without the
     * toggles and the dedupe having been applied first.
     */
    private fun post(context: Context, snapshot: TimelineSnapshot, ended: SegmentSnapshot, next: SegmentSnapshot?, now: Long) {
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

        // The channel owns the audio on Android 8+, so the sound toggle decides the
        // CHANNEL, not just the builder: the ringing alarm channel when sound is
        // on, and the app's silent countdown channel when it is off. Posting the
        // quiet alert on the alarm channel would still ring it.
        if (snapshot.soundEnabled) {
            // Only ever creates the channel when it is missing: the ringtone is
            // published by publishChannel() when the day plan is applied, so no
            // channel swap can race this alert into silence.
            ensureChannel(context, snapshot.alarmSoundUri)
            manager.notify(id, builder.build())
        } else {
            OngoingNotifier.ensureChannel(context)
            manager.notify(
                id,
                NotificationCompat.Builder(context, OngoingNotifier.CHANNEL_ID)
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
    }

    fun cancel(context: Context, id: Int) {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.cancel(id)
    }

    /**
     * Silences the alarm: cancelling the notification stops its channel sound,
     * so this is the whole of "stop". Exposed to JS for the in-app control.
     *
     * Matches both the ringing channel and the quiet variant, which is posted
     * on the app's silent countdown channel so it never rings.
     */
    fun cancelAllAlarms(context: Context) {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        for (n in manager.activeNotifications) {
            val isEndAlert = n.notification.channelId == CHANNEL_ID || n.id in ALERT_ID_RANGE
            if (isEndAlert) manager.cancel(n.id)
        }
    }

    /** True while one of our end-of-period alerts is on screen. */
    private fun isAlertShowing(manager: NotificationManager): Boolean =
        manager.activeNotifications.any { it.channelId == CHANNEL_ID || it.id in ALERT_ID_RANGE }

    private fun resolveAlarmUri(context: Context, alarmSoundUri: String?): android.net.Uri {
        if (!alarmSoundUri.isNullOrBlank()) {
            val parsed = runCatching { android.net.Uri.parse(alarmSoundUri) }.getOrNull()
            // The snapshot carries the JS-side copy of the chosen ringtone. If
            // that URI no longer opens (file cleared, or a scoped content:// the
            // notification manager cannot read) the channel would be handed an
            // unplayable sound and the alarm would post NOTIFICATION, NO SOUND.
            // So prove it opens before trusting it.
            if (parsed != null && parsed.scheme != null && opens(context, parsed)) return parsed
        }
        // Platform alarm tone, and the bundled end-of-period beep as the last
        // resort so the channel is never silent (getDefaultUri is null on some
        // devices and profiles that have no alarm ringtone).
        return RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            ?: android.net.Uri.parse("android.resource://${context.packageName}/${R.raw.period_end}")
    }

    private fun opens(context: Context, uri: android.net.Uri): Boolean = try {
        context.contentResolver.openInputStream(uri)?.use { it.read() >= 0 } ?: false
    } catch (e: Exception) {
        false
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
