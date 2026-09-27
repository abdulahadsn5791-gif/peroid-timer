import type { DayTimeline } from "@domain/services/buildDayTimeline";

export interface LockScreenSnapshotPort {
  write(timeline: DayTimeline): Promise<void>;
  read(): DayTimeline | null;
}