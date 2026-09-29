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
 * v6: weekly timetables. The snapshot always describes ONE resolved day;
 * an empty `segments` list means that weekday's preset is empty — no lectures,
 * so no alarms, no live notification, nothing rings that day.
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

data class TimelineSnapshot(
    val version: Int,
    val generatedAtUnixSec: Long,
    val boundaryUnixSec: Long,
    val weekday: Int,
    val accentHex: String,
    val soundEnabled: Boolean,
    val notificationsEnabled: Boolean,
    val colorNotification: Boolean,
    val alarmSoundUri: String?,
    val segments: List<SegmentSnapshot>,
)

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

    fun fromJson(o: JSONObject): TimelineSnapshot {
        val segs = o.getJSONArray("segments")
        val segments = (0 until segs.length()).map { i -> segmentFromJson(segs.getJSONObject(i)) }
        return TimelineSnapshot(
            version = o.optInt("version", 6),
            generatedAtUnixSec = o.optLong("generatedAtUnixSec", 0L),
            boundaryUnixSec = o.optLong("boundaryUnixSec", 0L),
            weekday = o.optInt("weekday", 0),
            accentHex = o.optString("accentHex", "#2563EB"),
            soundEnabled = o.optBoolean("soundEnabled", true),
            notificationsEnabled = o.optBoolean("notificationsEnabled", true),
            colorNotification = o.optBoolean("colorNotification", false),
            alarmSoundUri = if (o.has("alarmSoundUri") && !o.isNull("alarmSoundUri"))
                o.getString("alarmSoundUri")
            else
                null,
            segments = segments,
        )
    }

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

    fun lookup(s: TimelineSnapshot, now: Long): Lookup {
        var current: SegmentSnapshot? = null
        var doneCount = 0
        var previous: SegmentSnapshot? = null
        var next: SegmentSnapshot? = null

        for (seg in s.segments) {
            if (now < seg.startUnixSec) {
                next = seg
                break
            }
            if (now < seg.endUnixSec) {
                current = seg
                break
            }
            previous = seg
            doneCount++
        }
        // next may already be assigned; if the loop broke early it's correct.
        return Lookup(s, current, next, previous, doneCount, now)
    }

    // --- per-day end-of-period alert dedupe ("weekday:periodId") ---

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
