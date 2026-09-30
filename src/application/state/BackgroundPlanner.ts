import type { Settings } from "@domain/entities/Settings";
import { buildDayTimeline, type DayTimeline } from "@domain/services/buildDayTimeline";
import { isEmptyDay } from "@domain/entities/WeekSchedule";
import type { ClockPort } from "@application/ports/outbound/ClockPort";
import type { AlertSchedulerPort } from "@application/ports/outbound/AlertSchedulerPort";
import type { LockScreenSnapshotPort } from "@application/ports/outbound/LockScreenSnapshotPort";

/**
 * Rewrites the native snapshot and the transition alarms, then ensures the
 * live progress notification is running. Called after every settings save,
 * once each morning (when the day boundary rolls over), at boot, and after a
 * reboot. Native code only ever reads this snapshot.
 *
 * v7 snapshot: the whole alarm horizon (today + 7 days) travels in one file,
 * so the native midnight-rollover alarm can re-arm every future day without
 * this app process ever running again.
 *
 * Empty preset = no lectures today: the snapshot still carries the day entry,
 * but with zero segments; the native side treats that as "nothing scheduled"
 * and stops the live notification — no alarms, no beeps that day.
 */
export class BackgroundPlanner {
  constructor(
    private readonly clock: ClockPort,
    private readonly snapshot: LockScreenSnapshotPort,
    private readonly alerts: AlertSchedulerPort,
  ) {}

  async apply(settings: Settings): Promise<void> {
    const boundary = this.todayBoundary();
    const nowSec = Math.floor(this.clock.now().epochMs / 1000);
    const timeline: DayTimeline = buildDayTimeline(settings, boundary, nowSec);
    await this.snapshot.write(timeline);
    await this.alerts.scheduleTransitionAlerts(timeline);
    await this.alerts.scheduleEndOfPeriodAlert(timeline);
    const todayWeekday = this.clock.todayParts().weekday;
    if (isEmptyDay(settings.weekSchedule, todayWeekday)) {
      await this.alerts.stopLiveNotification();
    } else {
      await this.alerts.startLiveNotification();
    }
  }

  todayBoundary(): number {
    return this.clock.todayBoundaryEpochSec();
  }
}
