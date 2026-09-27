package com.periodtimer

import android.content.Context
import org.json.JSONObject
import java.io.File

/**
 * Native mirror of the DayTimeline snapshot the app writes to its documents
 * folder. This is data only — schedule *rules* never exist on the native side,
 * only "what is true at time T" lookups against these numbers.
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
    val accentHex: String,
    val soundEnabled: Boolean,
    val colorNotification: Boolean,
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
            version = o.optInt("version", 4),
            generatedAtUnixSec = o.optLong("generatedAtUnixSec", 0L),
            boundaryUnixSec = o.optLong("boundaryUnixSec", 0L),
            accentHex = o.optString("accentHex", "#2563EB"),
            soundEnabled = o.optBoolean("soundEnabled", true),
            colorNotification = o.optBoolean("colorNotification", false),
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
}