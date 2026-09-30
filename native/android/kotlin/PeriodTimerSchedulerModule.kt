package com.periodtimer

import android.content.Context
import android.content.Intent
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule
import org.json.JSONObject

/**
 * Bridge between the JS app and the native notification stack. JS hands us the
 * DayTimeline snapshot JSON (already written to disk by the JS FileSnapshotWriter);
 * the module only schedules alarms / starts the live progress notification /
 * refreshes the widget. All "what should happen" decisions live in the app;
 * this module just executes them.
 */
@ReactModule(name = PeriodTimerSchedulerModule.NAME)
class PeriodTimerSchedulerModule(
    reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    /** (Re)schedules all transition alarms for the given snapshot JSON. */
    @ReactMethod(isBlockingSynchronousMethod = true)
    fun scheduleTransitions(timelineJson: String?): Boolean {
        val snapshot = timelineJson?.let { parseTimeline(it) } ?: return false
        val app = reactApplicationContext
        AlarmSchedulerCore.scheduleAll(app, snapshot)
        TimerWidgetProvider.requestUpdate(app)
        return true
    }

    /**
     * Arms one exact "alarm clock" per period end: on fire, the receiver rings
     * the alarm ringtone and posts a heads-up notification — even when the app
     * process is dead. Empty preset (no segments) arms nothing.
     */
    @ReactMethod(isBlockingSynchronousMethod = true)
    fun scheduleEndOfPeriodAlerts(timelineJson: String?): Boolean {
        val snapshot = timelineJson?.let { parseTimeline(it) } ?: return false
        AlarmSchedulerCore.scheduleEndAlerts(reactApplicationContext, snapshot)
        return true
    }

    /**
     * Silences a currently-ringing period-end alarm and takes its notification
     * down. Backs the in-app "Stop alarm" control, so the user is never stuck
     * with a tone they can only end from the notification shade.
     */
    @ReactMethod(isBlockingSynchronousMethod = true)
    fun stopAlarm(): Boolean {
        val app = reactApplicationContext
        // Cancelling the alarm-channel notification stops its channel sound.
        EndAlertNotifier.cancelAllAlarms(app)
        return true
    }

    /**
     * Consumes a "Stop alarm" pressed from the notification action, which
     * cannot reach the JS audio player. Returns the timestamp of the pending
     * stop, or 0 when there is none. The signal is cleared on read, so the JS
     * side silences its player exactly once per stop.
     */
    @ReactMethod(isBlockingSynchronousMethod = true)
    fun consumeAlarmStopSignal(): Double {
        return SnapshotStore.consumeStopSignal(reactApplicationContext).toDouble()
    }

    /** Starts the foreground service that holds the live progress notification. */
    @ReactMethod(isBlockingSynchronousMethod = true)
    fun startLive(): Boolean {
        val app = reactApplicationContext
        // Nothing scheduled (fresh install, or an empty preset day): there is no
        // countdown to show, so starting the service would only have it promote a
        // placeholder and stop again.
        val snapshot = SnapshotStore.load(app)
        if (snapshot == null || snapshot.segments.isEmpty()) return true
        startForegroundServiceSafe(app)
        return true
    }

    /**
     * Arms the nightly 00:00 rollover from JS. scheduleAll/scheduleEndAlerts
     * already arm it themselves on every apply; this exists so the boot path
     * can force it even when both schedules come back empty.
     */
    @ReactMethod(isBlockingSynchronousMethod = true)
    fun scheduleRollover(): Boolean {
        AlarmSchedulerCore.scheduleRolloverAlarm(reactApplicationContext)
        return true
    }

    /** Stops the live progress notification service and its notification. */
    @ReactMethod(isBlockingSynchronousMethod = true)
    fun stopLive(): Boolean {
        val app = reactApplicationContext
        app.stopService(Intent(app, PeriodForegroundService::class.java))
        OngoingNotifier.clear(app)
        return true
    }

    /** Cancels every scheduled alarm. */
    @ReactMethod(isBlockingSynchronousMethod = true)
    fun cancelAll(): Boolean {
        val app = reactApplicationContext
        SnapshotStore.load(app)?.let { AlarmSchedulerCore.cancelAll(app, it) }
        return true
    }

    @ReactMethod
    fun hasExactAlarmAccess(promise: Promise) {
        promise.resolve(AlarmSchedulerCore.hasExactAlarmAccess(reactApplicationContext))
    }

    @ReactMethod
    fun requestExactAlarmAccess(promise: Promise) {
        if (!AlarmSchedulerCore.hasExactAlarmAccess(reactApplicationContext)) {
            AlarmSchedulerCore.requestExactAlarmAccess(reactApplicationContext)
            promise.resolve(false)
        } else {
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun updateWidget(promise: Promise) {
        TimerWidgetProvider.requestUpdate(reactApplicationContext)
        promise.resolve(null)
    }

    private fun parseTimeline(json: String): TimelineSnapshot {
        return SnapshotStore.fromJson(JSONObject(json))
    }

    companion object {
        const val NAME = "PeriodTimerScheduler"

        fun startForegroundServiceSafe(context: Context) {
            val intent = Intent(context, PeriodForegroundService::class.java)
            try {
                context.startForegroundService(intent)
            } catch (_: Exception) {
                // Foreground-service start can be blocked by OEMs or on some
                // versions; the transition alarms + widget still function.
            }
        }

        /** Best-effort stop used when nothing is scheduled anymore. */
        fun stopLiveSafe(context: Context) {
            try {
                context.stopService(Intent(context, PeriodForegroundService::class.java))
            } catch (_: Exception) {
                // nothing to stop
            }
        }
    }
}
