import type { LockScreenSnapshotPort } from "@application/ports/outbound/LockScreenSnapshotPort";
import type { DayTimeline } from "@domain/services/buildDayTimeline";

export class InMemorySnapshotWriter implements LockScreenSnapshotPort {
  last: DayTimeline | null = null;

  async write(timeline: DayTimeline): Promise<void> {
    this.last = timeline;
  }

  read(): DayTimeline | null {
    return this.last;
  }
}