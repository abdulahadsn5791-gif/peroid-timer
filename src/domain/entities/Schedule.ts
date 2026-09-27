import type { Period } from "./Period";
import type { TimeOfDay } from "../value-objects/TimeOfDay";

export interface Schedule {
  periods: Period[];
}

export function createSchedule(periods: Period[]): Schedule {
  return { periods: [...periods] };
}

export function currentIndexAt(schedule: Schedule, nowMinutes: number): number {
  for (let i = 0; i < schedule.periods.length; i++) {
    if (nowMinutes >= schedule.periods[i].start.minutes && nowMinutes < schedule.periods[i].end.minutes) {
      return i;
    }
  }
  return -1;
}

export function nextIndexAt(schedule: Schedule, nowMinutes: number): number {
  if (currentIndexAt(schedule, nowMinutes) !== -1) return -1;
  for (let i = 0; i < schedule.periods.length; i++) {
    if (schedule.periods[i].start.minutes > nowMinutes) return i;
  }
  return -1;
}

export function periodAt(schedule: Schedule, index: number): Period | null {
  return schedule.periods[index] ?? null;
}

// "Minutes" convenience overload for tests.
export function nowMinutesAt(t: TimeOfDay): number {
  return t.minutes;
}

export const computeStatus = (
  nowMinutes: number,
  schedule: Schedule,
): { currentIdx: number; nextIdx: number } => ({
  currentIdx: currentIndexAt(schedule, nowMinutes),
  nextIdx: nextIndexAt(schedule, nowMinutes),
});