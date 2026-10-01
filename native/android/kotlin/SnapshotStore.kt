package com.periodtimer

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * Native mirror of the DayTimeline snapshot the app writes to its documents
 * folder. This is data only — schedule *rules* never exist on the native side,
 * only "what is true at time T" lookups against these numbers.
 *
 * v7 — WHOLE WEEK. The old v6 snapshot described one day, and every alarm was
 * one-shot: when Android killed the process overnight (normal, not a bug),
 * nothing re-armed anything for the morning — the widget, the alarms and the
 * live notification all showed stale data until the app was reopened. v7
 * carries `days` — 8 consecutive local midnights — so the native side can arm
 * every alarm for the whole horizon and re-arm itself at each midnight
 * rollover (AlarmSchedulerCore.scheduleRolloverAlarm) with no app process.
 * `alarmSoundUri` carries the user's custom ringtone; null/absent = built-in.
 * `soundEnabled` rings the alarm, `notificationsEnabled` posts the alert;
 * either one off silences that half of the period-end alert.
 */
data class SegmentSnapshot(
    val id: String,
    val name: String,
    val startUnixSec: Long,
    val endUnixSec: Long,
    val durationSec: Long,
    val startLabel: String,
    val endLabel: String,
    val colors: List<String>,
    val phaseOneUntilRemaining: Double,
    val phaseTwoUntilRemaining: Double,
) {
    /** Remaining fraction of the period: 1 = just started, 0 = just ended. */
    fun remainingFraction(nowUnixSec: Long): Double {
        val remaining = (endUnixSec - nowUnixSec).coerceAtLeast(0L).toDouble()
        return (remaining / durationSec).coerceIn(0.0, 1.0)
    }

    /** Palette phase index for the current remaining fraction (0, 1, or 2). */
    fun phaseIndex(nowUnixSec: Long): Int {
        val r = remainingFraction(nowUnixSec)
        return when {
            r <= phaseTwoUntilRemaining -> 2
            r <= phaseOneUntilRemaining -> 1
            else -> 0
        }
    }

    fun color(nowUnixSec: Long): String {
        val idx = phaseIndex(nowUnixSec).coerceIn(0, colors.size - 1)
        return colors[idx]
    }
}

/** One resolved day inside the week snapshot. */
data class DayEntry(
    val boundaryUnixSec: Long,
    val weekday: Int,
    /** ISO date of this entry ("2026-09-30"); null in legacy v6 files. */
    val dateKey: String?,
    val segments: List<SegmentSnapshot>,
)

data class TimelineSnapshot(
    val version: Int,
    val generatedAtUnixSec: Long,
    val accentHex: String,
    val soundEnabled: Boolean,
    val notificationsEnabled: Boolean,
    val colorNotification: Boolean,
    val alarmSoundUri: String?,
    /** Heads-up alert before the next lecture's start; null/leadSec 0 = off. */
    val upcomingAlertLeadSec: Long,
    val days: List<DayEntry>,
) {
    /** All segments of all days, chronological by construction. */
    val segments: List<SegmentSnapshot>
        get() = days.flatMap { it.segments }
}

/** Everything known "at time T" — what native drawing/alert code may consume. */
data class Lookup(
    val snapshot: TimelineSnapshot,
    val current: SegmentSnapshot?,
    val next: SegmentSnapshot?,
    val previous: SegmentSnapshot?,
    val doneCount: Int,
    val now: Long,
) {
    val isRunning: Boolean get() = current != null
}

object SnapshotStore {
    private const val NAME = "period-timer-snapshot.json"
    private const val LAST_NOTIFIED_NAME = "period-timer-last-notified.txt"
    private const val STOP_SIGNAL_NAME = "period-timer-stop-signal.txt"

    fun load(context: Context): TimelineSnapshot? {
        val file = File(context.filesDir, NAME)
        if (!file.exists()) return null
        return try {
            fromJson(JSONObject(file.readText()))
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Atomic write: content goes to a temp file that is fsynced and then
     * renamed over the target. The old write deleted the snapshot first, so a
     * crash (or an OEM process kill) in that window left NO snapshot on disk —
     * the app then came back to zero alarms, a dead widget and silence until
     * the next manual open.
     */
    fun save(context: Context, json: String) {
        val target = File(context.filesDir, NAME)
        val tmp = File(context.filesDir, "$NAME.tmp")
        try {
            tmp.writeText(json)
            if (!tmp.renameTo(target)) {
                // Rename can fail across odd filesystems; fall back to a
                // direct overwrite rather than losing the update entirely.
                target.writeText(json)
                tmp.delete()
            }
        } catch (e: Exception) {
            tmp.delete()
            throw e
        }
    }

    fun fromJson(o: JSONObject): TimelineSnapshot {
        val daysJson = o.optJSONArray("days")
        val days: List<DayEntry> = if (daysJson != null) {
            (0 until daysJson.length()).map { i -> dayFromJson(daysJson.getJSONObject(i)) }
        } else {
            // Back-compat: a v6 flat single-day snapshot maps to one entry.
            listOf(
                DayEntry(
                    boundaryUnixSec = o.optLong("boundaryUnixSec", 0L),
                    weekday = o.optInt("weekday", 0),
                    dateKey = null,
                    segments = segmentListFromJson(o.getJSONArray("segments")),
                ),
            )
        }
        return TimelineSnapshot(
            version = o.optInt("version", 7),
            generatedAtUnixSec = o.optLong("generatedAtUnixSec", 0L),
            accentHex = o.optString("accentHex", "#2563EB"),
            soundEnabled = o.optBoolean("soundEnabled", true),
            notificationsEnabled = o.optBoolean("notificationsEnabled", true),
            colorNotification = o.optBoolean("colorNotification", false),
            alarmSoundUri = if (o.has("alarmSoundUri") && !o.isNull("alarmSoundUri"))
                o.getString("alarmSoundUri")
            else
                null,
            // "upcomingAlert": { leadSec } — absent or 0 = the feature is off.
            upcomingAlertLeadSec = o.optJSONObject("upcomingAlert")?.optLong("leadSec", 0L) ?: 0L,
            days = days,
        )
    }

    private fun dayFromJson(o: JSONObject): DayEntry = DayEntry(
        boundaryUnixSec = o.optLong("boundaryUnixSec", 0L),
        weekday = o.optInt("weekday", 0),
        dateKey = if (o.has("dateKey") && !o.isNull("dateKey")) o.getString("dateKey") else null,
        segments = segmentListFromJson(o.getJSONArray("segments")),
    )

    private fun segmentListFromJson(segs: JSONArray): List<SegmentSnapshot> =
        (0 until segs.length()).map { i -> segmentFromJson(segs.getJSONObject(i)) }

    private fun segmentFromJson(o: JSONObject): SegmentSnapshot {
        val colorsJson = o.getJSONArray("colors")
        val colors = (0 until colorsJson.length()).map { colorsJson.getString(it) }
        val start = o.optLong("startUnixSec", 0L)
        val end = o.optLong("endUnixSec", 0L)
        return SegmentSnapshot(
            id = o.optString("id", ""),
            name = o.optString("name", "Period"),
            startUnixSec = start,
            endUnixSec = end,
            durationSec = o.optLong("durationSec", maxOf(1L, end - start)),
            startLabel = o.optString("startLabel", ""),
            endLabel = o.optString("endLabel", ""),
            colors = colors,
            phaseOneUntilRemaining = o.optDouble("phaseOneUntilRemaining", 0.30),
            phaseTwoUntilRemaining = o.optDouble("phaseTwoUntilRemaining", 0.15),
        )
    }

    /** Remaining fraction of the period: 1 = just started, 0 = just ended. */
    fun remainingFraction(seg: SegmentSnapshot, nowUnixSec: Long): Double {
        return seg.remainingFraction(nowUnixSec)
    }

    /**
     * "What is true at time T" across the whole snapshot horizon. The day for
     * T is found by walking each day's segments in order; because every
     * segment carries absolute epoch seconds, a lookup never needs to know
     * which calendar day it is.
     */
    fun lookup(s: TimelineSnapshot, now: Long): Lookup {
        var current: SegmentSnapshot? = null
        var previous: SegmentSnapshot? = null
        var next: SegmentSnapshot? = null
        var doneCount = 0

        loop@ for (day in s.days) {
            for (seg in day.segments) {
                when {
                    now < seg.startUnixSec -> {
                        next = seg
                        break@loop
                    }
                    now < seg.endUnixSec -> {
                        current = seg
                        break@loop
                    }
                    else -> {
                        previous = seg
                        doneCount++
                    }
                }
            }
        }
        return Lookup(s, current, next, previous, doneCount, now)
    }

    /**
     * The next local midnight after `nowEpochSec`, computed with the same
     * local-calendar arithmetic as the JS clock adapter — NOT a fixed 86400s
     * add, which drifts across DST changes.
     */
    fun nextMidnightEpochSec(nowEpochSec: Long): Long {
        val d = java.util.Calendar.getInstance()
        d.timeInMillis = nowEpochSec * 1000L
        d.set(java.util.Calendar.HOUR_OF_DAY, 0)
        d.set(java.util.Calendar.MINUTE, 0)
        d.set(java.util.Calendar.SECOND, 0)
        d.set(java.util.Calendar.MILLISECOND, 0)
        d.add(java.util.Calendar.DAY_OF_MONTH, 1)
        return d.timeInMillis / 1000L
    }

    // --- end-of-period alert dedupe ("YYYY-MM-DD:periodId") ---

    private const val UPCOMING_NAME = "period-timer-upcoming-notified.txt"

    /** Dedupe key of the last posted upcoming-lecture alert ("dateKey:periodId"). */
    fun lastUpcomingKey(context: Context): String? {
        val file = File(context.filesDir, UPCOMING_NAME)
        if (!file.exists()) return null
        return try {
            file.readText().trim().ifEmpty { null }
        } catch (e: Exception) {
            null
        }
    }

    fun setLastUpcomingKey(context: Context, key: String?) {
        val file = File(context.filesDir, UPCOMING_NAME)
        if (key == null) {
            file.delete()
            return
        }
        file.writeText(key)
    }

    fun lastNotifiedKey(context: Context): String? {
        val file = File(context.filesDir, LAST_NOTIFIED_NAME)
        if (!file.exists()) return null
        return try {
            file.readText().trim().ifEmpty { null }
        } catch (e: Exception) {
            null
        }
    }

    fun setLastNotifiedKey(context: Context, key: String?) {
        val file = File(context.filesDir, LAST_NOTIFIED_NAME)
        if (key == null) {
            file.delete()
            return
        }
        file.writeText(key)
    }

    /**
     * "YYYY-MM-DD" of the day a segment belongs to — matches the JS-side
     * date-scoped dedupe key and expires naturally, so the same period alerts
     * again next week. Prefers the `dateKey` written next to the segment's day
 *     entry; falls back to local-calendar arithmetic of the segment's own
     * start-second for legacy v6 snapshots.
     */
    fun dateKeyOf(snapshot: TimelineSnapshot, seg: SegmentSnapshot): String {
        snapshot.days.firstOrNull { it.segments.any { s -> s === seg || (s.id == seg.id && s.endUnixSec == seg.endUnixSec) } }
            ?.dateKey?.let { return it }
        val d = java.util.Calendar.getInstance()
        d.timeInMillis = seg.startUnixSec * 1000L
        val y = d.get(java.util.Calendar.YEAR)
        val m = d.get(java.util.Calendar.MONTH) + 1
        val day = d.get(java.util.Calendar.DAY_OF_MONTH)
        return "%04d-%02d-%02d".format(y, m, day)
    }

    // --- "Stop alarm" pressed natively, waiting for JS to silence its player ---

    /**
     * The end-of-period tone is also played from JS (expo-audio, media stream),
     * and the notification's "Stop alarm" action can only cancel the native
     * alarm notification — it has no way to reach the JS player. So a native
     * stop leaves a signal here, and the JS tick picks it up and silences its
     * own player. Without this the notification button removed the
     * notification while the tone rang on with no way to stop it.
     */
    fun setStopSignal(context: Context) {
        try {
            File(context.filesDir, STOP_SIGNAL_NAME).writeText(System.currentTimeMillis().toString())
        } catch (e: Exception) {
            // best effort: the native side is already silenced either way
        }
    }

    /** Returns the pending stop signal and clears it, so it is handled once. */
    fun consumeStopSignal(context: Context): Long {
        val file = File(context.filesDir, STOP_SIGNAL_NAME)
        if (!file.exists()) return 0L
        val at = try {
            file.readText().trim().toLong()
        } catch (e: Exception) {
            0L
        }
        file.delete()
        return at
    }
}
