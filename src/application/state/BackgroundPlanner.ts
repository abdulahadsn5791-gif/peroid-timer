import type { Settings } from "@domain/entities/Settings";
import { buildDayTimeline, type DayTimeline } from "@domain/services/buildDayTimeline";
import type { ClockPort } from "@application/ports/outbound/ClockPort";
import type { AlertSchedulerPort } from "@application/ports/outbound/AlertSchedulerPort";
import type { LockScreenSnapshotPort } from "@application/ports/outbound/LockScreenSnapshotPort";

/**
 * Rewrites the native snapshot and the transition alarms, then ensures the
 * live progress notification is running. Called after every settings save,
 * once each morning (when the day boundary rolls over), at boot, and after a
 * reboot. Native code only ever reads this snapshot.
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
    await this.alerts.startLiveNotification();
    return Promise.resolve();
  }

  todayBoundary(): number {
    return this.clock.todayBoundaryEpochSec();
  }
}