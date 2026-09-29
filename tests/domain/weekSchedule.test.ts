import { describe, expect, test } from "bun:test";
import {
  cloneWeekSchedule,
  defaultWeekSchedule,
  isEmptyDay,
  normalizeWeekSchedule,
  periodsFor,
  weekScheduleEveryDay,
  weekScheduleFromFactory,
  weekdayOf,
} from "@domain/entities/WeekSchedule";
import { createPeriod, defaultPeriods } from "@domain/entities/Period";

describe("WeekSchedule", () => {
  test("weekdayOf wraps negative and oversized values", () => {
    expect(weekdayOf(0)).toBe(0);
    expect(weekdayOf(6)).toBe(6);
    expect(weekdayOf(7)).toBe(0);
    expect(weekdayOf(-1)).toBe(6);
    expect(weekdayOf(9)).toBe(2);
  });

  test("defaults put the sample timetable on every day (any install weekday works)", () => {
    const week = defaultWeekSchedule();
    expect(week).toHaveLength(7);
    for (const day of week) {
      expect(day).toHaveLength(4);
      expect(day[0].name).toBe("Period 1");
    }
    // Each day holds independent objects — mutating one must not alias.
    expect(week[0][0]).not.toBe(week[1][0]);
  });

  test("weekScheduleEveryDay clones the source list per day", () => {
    const source = defaultPeriods();
    const week = weekScheduleEveryDay(source);
    expect(week[2]).toHaveLength(source.length);
    expect(week[2][0]).not.toBe(source[0]);
    expect(week[2][0].start).toEqual(source[0].start);
  });

  test("weekScheduleFromFactory builds independent days", () => {
    const week = weekScheduleFromFactory((d) => (d === 0 ? [] : [createPeriod(`p${d}`, "Math", "08:00", "09:00")]));
    expect(week[0]).toHaveLength(0);
    expect(week[1][0].id).toBe("p1");
    expect(week[6][0].id).toBe("p6");
  });

  test("periodsFor and isEmptyDay resolve the weekday preset", () => {
    const week = weekScheduleFromFactory((d) => (d === 3 ? [] : defaultPeriods()));
    expect(isEmptyDay(week, 3)).toBe(true);
    expect(isEmptyDay(week, 4)).toBe(false);
    expect(periodsFor(week, 4)).toHaveLength(4);
    expect(periodsFor(week, 10)).toHaveLength(0); // 10 wraps to weekday 3 — the empty preset
  });

  test("periodsFor(10) wraps to weekday 3", () => {
    const week = weekScheduleFromFactory((d) => [createPeriod(`p${d}`, "X", "08:00", "08:30")]);
    expect(periodsFor(week, 10)[0].id).toBe("p3");
  });

  test("normalizeWeekSchedule repairs malformed persisted data", () => {
    expect(normalizeWeekSchedule(null)).toHaveLength(7);
    expect(normalizeWeekSchedule([])).toHaveLength(7);
    expect(normalizeWeekSchedule([[createPeriod("a", "A", "08:00", "09:00")]])).toHaveLength(7);
    const fixed = normalizeWeekSchedule([
      [createPeriod("a", "A", "08:00", "09:00")],
      "not-an-array",
      [],
      [],
      [],
      [],
      [],
    ]);
    expect(fixed[0]).toHaveLength(1);
    expect(fixed[1]).toHaveLength(0);
  });

  test("normalizeWeekSchedule re-ids a day that repeats an id", () => {
    // Older builds minted draft ids from a counter that reset on every launch,
    // so a persisted day can hold the same id twice.
    const day = [
      createPeriod("draft-1", "First", "08:00", "08:40"),
      createPeriod("draft-1", "Second", "08:45", "09:25"),
      createPeriod("draft-1", "Third", "09:30", "10:10"),
    ];
    const fixed = normalizeWeekSchedule([day, [], [], [], [], [], []]);
    const ids = fixed[0].map((p) => p.id);
    expect(new Set(ids).size).toBe(3);
    expect(ids[0]).toBe("draft-1");
    // Content is untouched — only the colliding ids change.
    expect(fixed[0].map((p) => p.name)).toEqual(["First", "Second", "Third"]);
  });

  test("normalizeWeekSchedule keeps ids shared across different days", () => {
    // Ids only need to be unique within a day; "weekday:periodId" namespaces
    // them for the alert dedupe.
    const week = normalizeWeekSchedule([
      [createPeriod("p1", "A", "08:00", "09:00")],
      [createPeriod("p1", "A", "08:00", "09:00")],
      [],
      [],
      [],
      [],
      [],
    ]);
    expect(week[0][0].id).toBe("p1");
    expect(week[1][0].id).toBe("p1");
  });

  test("cloneWeekSchedule deep-clones periods", () => {
    const week = defaultWeekSchedule();
    const copy = cloneWeekSchedule(week);
    copy[1][0].name = "Changed";
    expect(week[1][0].name).toBe("Period 1");
  });
});
