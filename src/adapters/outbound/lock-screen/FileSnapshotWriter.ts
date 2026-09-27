import { File, Paths } from "expo-file-system";
import type { DayTimeline } from "@domain/services/buildDayTimeline";
import type { LockScreenSnapshotPort } from "@application/ports/outbound/LockScreenSnapshotPort";

const SNAPSHOT_NAME = "period-timer-snapshot.json";

function snapshotFile(): File {
  return new File(Paths.document, SNAPSHOT_NAME);
}

/**
 * Writes the DayTimeline snapshot to the app's document directory. Native
 * Kotlin (foreground service, widget, alarm receiver) reads this same file from
 * its own filesDir and only ever does "what is true at time T" lookups.
 */
export class FileSnapshotWriter implements LockScreenSnapshotPort {
  async write(timeline: DayTimeline): Promise<void> {
    const file = snapshotFile();
    if (file.exists) file.delete();
    file.write(JSON.stringify(timeline));
  }

  read(): DayTimeline | null {
    const file = snapshotFile();
    if (!file.exists) return null;
    try {
      return JSON.parse(file.textSync()) as DayTimeline;
    } catch {
      return null;
    }
  }
}