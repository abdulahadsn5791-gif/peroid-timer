import type { Period } from "./Period";
import { clonePeriod, defaultPeriods } from "./Period";

/**
 * Weekly timetable. Every weekday holds its own period list; an empty list
 * means "no lectures this day" — the day is simply skipped by alarms,
 * notifications and the live countdown. Day 0 = Sunday … 6 = Saturday, matching
 * Date.getDay() and ClockPort.todayParts().weekday.
 */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const WEEKDAY_COUNT = 7;

export type WeekSchedule = readonly Period[][];

export function weekdayOf(weekday: number): Weekday {
  const wrapped = ((Math.round(weekday) % WEEKDAY_COUNT) + WEEKDAY_COUNT) % WEEKDAY_COUNT;
  return wrapped as Weekday;
}

/**
 * Validates/normalizes raw persisted data into a full 7-day schedule.
 *
 * Ids are only required to be unique *within* a day — the schedule editor
 * tracks the open card by id and the store patches by id, both scoped to the
 * active weekday, and the alert dedupe key is "weekday:periodId". Older builds
 * minted `draft-N` from a counter that reset on every launch, so a timetable can
 * legitimately hold two same-id periods on one day; {@link dedupeDay} hands the
 * later one a fresh id so editing never hits both at once.
 */
export function normalizeWeekSchedule(value: unknown): WeekSchedule {
  if (!Array.isArray(value) || value.length !== WEEKDAY_COUNT) {
    return defaultWeekSchedule();
  }
  return value.map((day) => (Array.isArray(day) ? dedupeDay(day.map(clonePeriod)) : [])) as WeekSchedule;
}

/** Re-ids any period that repeats an id already used earlier in the same day. */
function dedupeDay(day: Period[]): Period[] {
  const seen = new Set<string>();
  return day.map((p) => {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      return p;
    }
    let n = 2;
    let fresh = `${p.id}-${n}`;
    while (seen.has(fresh)) fresh = `${p.id}-${++n}`;
    seen.add(fresh);
    return { ...p, id: fresh };
  });
}

/**
 * Fresh install: the sample timetable on every day (so day one shows live
 * periods whatever weekday it is). Fresh device installs land here; a legacy
 * single-list timetable migrates to "every day" as well, so a first weekly
 * upgrade never hides the user's periods behind an empty weekend.
 */
export function defaultWeekSchedule(): WeekSchedule {
  return weekScheduleEveryDay(defaultPeriods());
}

/** Same period list (independent copies) on all seven days. */
export function weekScheduleEveryDay(periods: readonly Period[]): WeekSchedule {
  return weekScheduleFromFactory(() => periods.map(clonePeriod));
}

/**
 * Builds a week schedule from a factory so each weekday gets independent
 * Period objects (deep-shared arrays would alias across days).
 */
export function weekScheduleFromFactory(make: (weekday: Weekday) => Period[]): WeekSchedule {
  return Array.from({ length: WEEKDAY_COUNT }, (_, i) => make(i as Weekday));
}

export function cloneWeekSchedule(schedule: WeekSchedule): WeekSchedule {
  return schedule.map((day) => day.map(clonePeriod)) as WeekSchedule;
}

export function periodsFor(schedule: WeekSchedule, weekday: number): Period[] {
  return schedule[weekdayOf(weekday)] ?? [];
}

export function isEmptyDay(schedule: WeekSchedule, weekday: number): boolean {
  return periodsFor(schedule, weekday).length === 0;
}
