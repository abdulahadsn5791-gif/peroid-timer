import { parseTimeHHMM, timeOfDay, toHHMM, toSeconds, type TimeOfDay } from "../value-objects/TimeOfDay";

export interface Period {
  id: string;
  name: string;
  start: TimeOfDay;
  end: TimeOfDay;
  /** Teacher for this period; null when unset. */
  teacher: string | null;
  /** Room number/location for this period; null when unset. */
  room: string | null;
}

/** Trims to a bounded display string; empty → null so UI can hide the field. */
function normalizeMeta(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 80);
}

export function createPeriod(
  id: string,
  name: string,
  startHHMM: string,
  endHHMM: string,
  extra?: { teacher?: string | null; room?: string | null },
): Period {
  return {
    id,
    name: name.trim() || "Period",
    start: parseTimeHHMM(startHHMM),
    end: parseTimeHHMM(endHHMM),
    teacher: normalizeMeta(extra?.teacher) ?? null,
    room: normalizeMeta(extra?.room) ?? null,
  };
}

export function periodDurationSeconds(p: Period): number {
  return Math.max(1, toSeconds(p.end) - toSeconds(p.start));
}

/** Deep copy that also re-normalizes untrusted persisted teacher/room values. */
export function clonePeriod(p: Period): Period {
  return {
    id: p.id,
    name: p.name,
    start: timeOfDay(p.start.minutes),
    end: timeOfDay(p.end.minutes),
    teacher: normalizeMeta(p.teacher),
    room: normalizeMeta(p.room),
  };
}

export function periodToDraft(p: Period): { id: string; name: string; start: string; end: string } {
  return { id: p.id, name: p.name, start: toHHMM(p.start), end: toHHMM(p.end) };
}

export const DEFAULT_PERIOD_HHMM_PAIRS: ReadonlyArray<readonly [string, string, string]> = [
  ["Period 1", "08:30", "09:10"],
  ["Period 2", "09:15", "09:55"],
  ["Period 3", "10:00", "10:40"],
  ["Period 4", "10:45", "11:25"],
];

export function defaultPeriods(): Period[] {
  return DEFAULT_PERIOD_HHMM_PAIRS.map(([name, start, end], i) =>
    createPeriod(`p${i + 1}`, name, start, end),
  );
}
