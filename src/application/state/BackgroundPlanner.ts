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
 * Empty preset = no lectures today: the snapshot still carries the weekday,
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
    const weekday = this.clock.todayParts().weekday;
    const timeline: DayTimeline = buildDayTimeline(settings, boundary, nowSec, weekday);
    await this.snapshot.write(timeline);
    await this.alerts.scheduleTransitionAlerts(timeline);
    await this.alerts.scheduleEndOfPeriodAlert(timeline);
    if (isEmptyDay(settings.weekSchedule, weekday)) {
      await this.alerts.stopLiveNotification();
    } else {
      await this.alerts.startLiveNotification();
    }
  }

  todayBoundary(): number {
    return this.clock.todayBoundaryEpochSec();
  }
}
