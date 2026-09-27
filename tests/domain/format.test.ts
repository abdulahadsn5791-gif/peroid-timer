import { describe, expect, test } from "bun:test";
import { formatDuration, formatDurationWithUnits } from "@domain/services/formatDuration";
import { formatRange } from "@domain/services/formatRange";
import { todayLabel } from "@domain/services/todayLabel";
import { createPeriod } from "@domain/entities/Period";
import { periodJustEnded } from "@domain/services/periodEnd";

describe("Formatting", () => {
  test("formatDuration shows hours only when needed", () => {
    expect(formatDuration(90)).toEqual({ text: "01:30", hasHours: false });
    expect(formatDuration(3661)).toEqual({ text: "1:01:01", hasHours: true });
    expect(formatDuration(3660)).toEqual({ text: "1:01:00", hasHours: true });
    expect(formatDuration(3600)).toEqual({ text: "1:00:00", hasHours: true });
    expect(formatDuration(-5)).toEqual({ text: "00:00", hasHours: false });
  });

  test("formatDurationWithUnits can never read like a clock time", () => {
    expect(formatDurationWithUnits(14852)).toBe("4h 07m 32s");
    expect(formatDurationWithUnits(983)).toBe("16m 23s");
    expect(formatDurationWithUnits(9)).toBe("9s");
  });

  test("formatRange is 24h wall-clock like the phone status bar", () => {
    expect(formatRange(createPeriod("x", "A", "08:30", "09:10"))).toBe("08:30 – 09:10");
    expect(formatRange(createPeriod("x", "A", "08:30", "12:10"))).toBe("08:30 – 12:10");
  });

  test("todayLabel renders full names", () => {
    expect(todayLabel({ year: 2026, month: 9, day: 20, weekday: 0 })).toBe("Sunday, September 20");
  });
});

describe("periodJustEnded", () => {
  const period = createPeriod("p1", "Math", "08:00", "08:30");
  const end = 8 * 60 * 60 + 30 * 60;

  test("fires exactly once inside the 2s window", () => {
    expect(periodJustEnded([period], end, null)).toEqual({ periodId: "p1", periodName: "Math" });
    expect(periodJustEnded([period], end + 1, null, 2)).toEqual({ periodId: "p1", periodName: "Math" });
  });

  test("does not refire after being notified, or outside the window", () => {
    expect(periodJustEnded([period], end, "p1")).toBeNull();
    expect(periodJustEnded([period], end + 3, null, 2)).toBeNull();
    expect(periodJustEnded([period], end - 1, null, 2)).toBeNull();
  });
});