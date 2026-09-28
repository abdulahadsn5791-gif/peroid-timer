import type { DayTimeline } from "@domain/services/buildDayTimeline";

/**
 * Android implementation: one exact AlarmManager alarm per schedule
 * transition plus a foreground service that keeps a Google Maps-style live
 * progress notification (title, countdown, progress bar) updated every second
 * while a period is running or upcoming. The receiving Kotlin code only looks
 * the snapshot up at time T — no schedule rules live in the adapter.
 */
export interface AlertSchedulerPort {
  scheduleTransitionAlerts(timeline: DayTimeline): Promise<void>;
  /**
   * Arms one exact alarm per period end that fires the alarm-ringtone
   * notification natively — it rings even when the app process is dead.
   */
  scheduleEndOfPeriodAlert(timeline: DayTimeline): Promise<void>;
  startLiveNotification(): Promise<void>;
  stopLiveNotification(): Promise<void>;
  hasExactAlarmAccess(): Promise<boolean>;
  requestExactAlarmAccess(): Promise<boolean>;
}
