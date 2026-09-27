import { describe, expect, test } from "bun:test";
import { createPeriod, defaultPeriods, periodDurationSeconds, DEFAULT_PERIOD_HHMM_PAIRS } from "@domain/entities/Period";

describe("Period", () => {
  test("default periods match the documented schedule", () => {
    const names = DEFAULT_PERIOD_HHMM_PAIRS.map(([name]) => name);
    expect(names).toEqual(["Period 1", "Period 2", "Period 3", "Period 4"]);
    const p = defaultPeriods();
    expect(p).toHaveLength(4);
    expect(p[0].start.minutes).toBe(8 * 60 + 30);
    expect(p[3].end.minutes).toBe(11 * 60 + 25);
  });

  test("createPeriod trims names and falls back to Period", () => {
    expect(createPeriod("x", "  Math  ", "07:00", "07:45").name).toBe("Math");
    expect(createPeriod("x", "", "07:00", "07:45").name).toBe("Period");
  });

  test("duration is at least one second", () => {
    expect(periodDurationSeconds(createPeriod("x", "A", "08:00", "08:30"))).toBe(1800);
    expect(periodDurationSeconds(createPeriod("x", "A", "08:00", "08:00"))).toBe(1);
  });
});