import type { AlertSchedulerPort } from "@application/ports/outbound/AlertSchedulerPort";
import type { DayTimeline } from "@domain/services/buildDayTimeline";

export class InMemoryAlertScheduler implements AlertSchedulerPort {
  scheduled: DayTimeline[] = [];
  endAlerts: DayTimeline[] = [];
  startLiveCalls = 0;
  stopLiveCalls = 0;
  exactAccess = true;

  async scheduleTransitionAlerts(timeline: DayTimeline): Promise<void> {
    this.scheduled.push(timeline);
  }

  async scheduleEndOfPeriodAlert(timeline: DayTimeline): Promise<void> {
    this.endAlerts.push(timeline);
  }

  async startLiveNotification(): Promise<void> {
    this.startLiveCalls++;
  }

  async stopLiveNotification(): Promise<void> {
    this.stopLiveCalls++;
  }

  async hasExactAlarmAccess(): Promise<boolean> {
    return this.exactAccess;
  }

  async requestExactAlarmAccess(): Promise<boolean> {
    this.exactAccess = true;
    return true;
  }
}
