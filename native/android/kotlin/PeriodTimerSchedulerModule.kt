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

    /** Starts the foreground service that holds the live progress notification. */
    @ReactMethod(isBlockingSynchronousMethod = true)
    fun startLive(): Boolean {
        val app = reactApplicationContext
        startForegroundServiceSafe(app)
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
    }
}