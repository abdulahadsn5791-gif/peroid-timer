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
    // Atomic replace: the old delete-then-write left a window where a crash
    // (or an OEM kill) destroyed the only schedule snapshot on disk — the app
    // then came back with zero alarms and a dead widget. Writing a temp file
    // and renaming over the target makes every write all-or-nothing.
    const tmp = new File(Paths.document, `${SNAPSHOT_NAME}.tmp`);
    tmp.write(JSON.stringify(timeline));
    if (file.exists) file.delete();
    try {
      tmp.move(file);
    } catch {
      // Rename fallback: direct overwrite beats losing the update.
      file.write(JSON.stringify(timeline));
      if (tmp.exists) tmp.delete();
    }
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