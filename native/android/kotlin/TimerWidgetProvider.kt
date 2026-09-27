package com.periodtimer

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.os.Build
import android.widget.RemoteViews

/**
 * Home-screen widget: shows the current period name + a live countdown
 * Chronometer, refreshed at each segment transition (by the alarm receiver)
 * and on widget updates. The system Chronometer ticks itself, so the countdown
 * is live without per-second widget pushes. No schedule logic — just a
 * snapshot lookup.
 */
class TimerWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        requestUpdate(context)
    }

    override fun onEnabled(context: Context) {
        requestUpdate(context)
    }

    companion object {
        fun requestUpdate(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(
                android.content.ComponentName(context, TimerWidgetProvider::class.java),
            )
            if (ids.isEmpty()) return

            val snapshot = SnapshotStore.load(context) ?: return
            val lookup = SnapshotStore.lookup(snapshot, System.currentTimeMillis() / 1000L)

            val views = RemoteViews(context.packageName, R.layout.timer_widget)
            val current = lookup.current
            if (current != null) {
                views.setTextViewText(R.id.widget_name, current.name)
                setCountdown(views, current.endUnixSec, lookup.now)
                val pct = remainingPercent(current, lookup.now)
                views.setTextViewText(R.id.widget_status, pctText(pct, current))
                views.setInt(R.id.widget_progress, "setProgress", pct)
                views.setInt(R.id.widget_card, "setBackgroundColor", parseColor(current.color(lookup.now), 0xFF2563EB.toInt()))
            } else if (lookup.next != null) {
                views.setTextViewText(R.id.widget_name, "Up next · " + lookup.next.name)
                setCountdown(views, lookup.next.startUnixSec, lookup.now)
                views.setTextViewText(R.id.widget_status, "Countdown to next period")
                views.setInt(R.id.widget_progress, "setProgress", 0)
                views.setInt(R.id.widget_card, "setBackgroundColor", 0xFFF3F4F6.toInt())
            } else {
                views.setTextViewText(R.id.widget_name, "All periods complete")
                views.setTextViewText(R.id.widget_countdown, "—")
                views.setTextViewText(R.id.widget_status, "See you tomorrow")
                views.setInt(R.id.widget_progress, "setProgress", 0)
                views.setInt(R.id.widget_card, "setBackgroundColor", 0xFFF3F4F6.toInt())
            }
            for (id in ids) {
                manager.updateAppWidget(id, views)
            }
        }

        /**
         * Live countdown: use the system Chronometer's count-down mode where
         * available (API 24+). Without it the Chronometer would count *up* from
         * a future base (garbage "negative" time), so older devices get a
         * statically rendered value instead.
         */
        private fun setCountdown(views: RemoteViews, targetUnixSec: Long, now: Long) {
            if (Build.VERSION.SDK_INT >= 24) {
                views.setChronometerCountDown(R.id.widget_countdown, true)
                views.setChronometer(R.id.widget_countdown, targetUnixSec * 1000L, null, true)
            } else {
                val s = (targetUnixSec - now).coerceAtLeast(0L)
                views.setTextViewText(R.id.widget_countdown, format(s))
            }
        }

        private fun remainingPercent(seg: SegmentSnapshot, now: Long): Int {
            return (SnapshotStore.remainingFraction(seg, now) * 100).toInt().coerceIn(0, 100)
        }

        private fun pctText(pct: Int, seg: SegmentSnapshot): String {
            val at = if (seg.endLabel.isNotBlank()) " · ends ${seg.endLabel}" else ""
            return "$pct% left$at"
        }

        private fun format(sec: Long): String {
            val hours = sec / 3600
            val mins = (sec % 3600) / 60
            val secs = sec % 60
            return if (hours > 0) String.format("%d:%02d:%02d", hours, mins, secs)
            else String.format("%d:%02d", mins, secs)
        }

        private fun parseColor(hex: String, fallback: Int): Int {
            return try {
                android.graphics.Color.parseColor(hex)
            } catch (e: IllegalArgumentException) {
                fallback
            }
        }
    }
}