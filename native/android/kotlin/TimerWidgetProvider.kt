package com.periodtimer

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.widget.RemoteViews

/**
 * Home-screen widget: shows the current period name + a live countdown,
 * refreshed at each segment transition (by the alarm receiver), on boot and on
 * widget updates. Empty preset (zero segments) shows "No lectures today".
 *
 * The countdown is a statically rendered H:MM:SS / MM:SS string, recomputed
 * from the snapshot on every update. The old implementation delegated ticking
 * to the system Chronometer in count-down mode: whenever the widget went
 * un-refreshed for a while (reboot without boot delivery, OEM battery kicks),
 * its base went stale and it rendered garbage like "12132:34:324". A computed
 * string can never show anything but a real remaining time; the trade-off is
 * that it updates only when a transition alarm fires — always correct, just
 * not per-second.
 */
class TimerWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        requestUpdate(context)
    }

    override fun onEnabled(context: Context) {
        requestUpdate(context)
    }

    companion object {
        private val GRAY = 0xFF9CA3AF.toInt()

        fun requestUpdate(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(
                android.content.ComponentName(context, TimerWidgetProvider::class.java),
            )
            if (ids.isEmpty()) return

            val snapshot = SnapshotStore.load(context)
            if (snapshot == null) {
                // No snapshot (fresh install, storage cleared): show a real
                // state instead of whatever was rendered last — a stale
                // "frozen countdown" is worse than an honest empty state.
                for (id in ids) {
                    val views = RemoteViews(context.packageName, R.layout.timer_widget)
                    views.setTextViewText(R.id.widget_name, "Period Timer")
                    views.setTextViewText(R.id.widget_countdown, "—")
                    views.setTextViewText(R.id.widget_status, "Open the app to set up")
                    views.setInt(R.id.widget_progress, "setProgress", 0)
                    views.setInt(R.id.widget_accent_dot, "setColorFilter", GRAY)
                    manager.updateAppWidget(id, views)
                }
                return
            }
            val lookup = SnapshotStore.lookup(snapshot, System.currentTimeMillis() / 1000L)

            val views = RemoteViews(context.packageName, R.layout.timer_widget)
            val current = lookup.current
            if (snapshot.segments.isEmpty()) {
                views.setTextViewText(R.id.widget_name, "No lectures today")
                views.setTextViewText(R.id.widget_countdown, "—")
                views.setTextViewText(R.id.widget_status, "Enjoy the free day")
                views.setInt(R.id.widget_progress, "setProgress", 0)
                views.setInt(R.id.widget_accent_dot, "setColorFilter", GRAY)
            } else if (current != null) {
                views.setTextViewText(R.id.widget_name, current.name)
                views.setTextViewText(R.id.widget_countdown, format((current.endUnixSec - lookup.now).coerceAtLeast(0L)))
                val pct = remainingPercent(current, lookup.now)
                views.setTextViewText(R.id.widget_status, pctText(pct, current))
                views.setInt(R.id.widget_progress, "setProgress", pct)
                views.setInt(R.id.widget_accent_dot, "setColorFilter", parseColor(current.color(lookup.now), 0xFF2563EB.toInt()))
            } else if (lookup.next != null) {
                views.setTextViewText(R.id.widget_name, "Up next · " + lookup.next.name)
                views.setTextViewText(R.id.widget_countdown, format((lookup.next.startUnixSec - lookup.now).coerceAtLeast(0L)))
                views.setTextViewText(R.id.widget_status, "Countdown to next period")
                views.setInt(R.id.widget_progress, "setProgress", 0)
                views.setInt(R.id.widget_accent_dot, "setColorFilter", parseColor(snapshot.accentHex, GRAY))
            } else {
                views.setTextViewText(R.id.widget_name, "All periods complete")
                views.setTextViewText(R.id.widget_countdown, "—")
                views.setTextViewText(R.id.widget_status, "See you tomorrow")
                views.setInt(R.id.widget_progress, "setProgress", 0)
                views.setInt(R.id.widget_accent_dot, "setColorFilter", GRAY)
            }
            for (id in ids) {
                manager.updateAppWidget(id, views)
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
            else String.format("%02d:%02d", mins, secs)
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
