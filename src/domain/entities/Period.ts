import { parseTimeHHMM, timeOfDay, toHHMM, toSeconds, type TimeOfDay } from "../value-objects/TimeOfDay";

export interface Period {
  id: string;
  name: string;
  start: TimeOfDay;
  end: TimeOfDay;
}

export function createPeriod(id: string, name: string, startHHMM: string, endHHMM: string): Period {
  return {
    id,
    name: name.trim() || "Period",
    start: parseTimeHHMM(startHHMM),
    end: parseTimeHHMM(endHHMM),
  };
}

export function periodDurationSeconds(p: Period): number {
  return Math.max(1, toSeconds(p.end) - toSeconds(p.start));
}

export function clonePeriod(p: Period): Period {
  return { id: p.id, name: p.name, start: timeOfDay(p.start.minutes), end: timeOfDay(p.end.minutes) };
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