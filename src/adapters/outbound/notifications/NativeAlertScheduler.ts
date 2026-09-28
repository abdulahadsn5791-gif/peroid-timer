import { NativeModules } from "react-native";
import type { DayTimeline } from "@domain/services/buildDayTimeline";
import type { AlertSchedulerPort } from "@application/ports/outbound/AlertSchedulerPort";

interface NativeScheduler {
  scheduleTransitions(timelineJson: string): void;
  scheduleEndOfPeriodAlerts(timelineJson: string): void;
  startLive(): void;
  stopLive(): void;
  hasExactAlarmAccess(): Promise<boolean>;
  requestExactAlarmAccess(): Promise<boolean>;
}

const CHANNEL_ID = "period-timer";

/**
 * Bridges to the native PeriodTimerScheduler module (Kotlin). The native side
 * holds NO schedule rules — it receives this day's transition list and, on each
 * alarm tick, looks up "what is true at time T" inside the snapshot the app
 * already wrote to disk. Falls back to a no-op with a console warning when the
 * native module isn't present (e.g. iOS or not yet prebuilt).
 */
export class NativeAlertScheduler implements AlertSchedulerPort {
  private native(): NativeScheduler | null {
    return NativeModules.PeriodTimerScheduler ?? null;
  }

  async scheduleTransitionAlerts(timeline: DayTimeline): Promise<void> {
    const mod = this.native();
    if (!mod) {
      console.warn("PeriodTimerScheduler native module not available — alerts are disabled.");
      return;
    }
    mod.scheduleTransitions(JSON.stringify(timeline));
  }

  async scheduleEndOfPeriodAlert(timeline: DayTimeline): Promise<void> {
    const mod = this.native();
    if (!mod) return;
    mod.scheduleEndOfPeriodAlerts(JSON.stringify(timeline));
  }

  async startLiveNotification(): Promise<void> {
    this.native()?.startLive();
  }

  async stopLiveNotification(): Promise<void> {
    this.native()?.stopLive();
  }

  async hasExactAlarmAccess(): Promise<boolean> {
    const mod = this.native();
    if (!mod) return false;
    return mod.hasExactAlarmAccess();
  }

  async requestExactAlarmAccess(): Promise<boolean> {
    const mod = this.native();
    if (!mod) return false;
    return mod.requestExactAlarmAccess();
  }
}

export { CHANNEL_ID };
