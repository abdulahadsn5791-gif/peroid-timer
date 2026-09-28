import { describe, expect, test } from "bun:test";
import { clonePeriod, createPeriod, defaultPeriods, periodDurationSeconds, DEFAULT_PERIOD_HHMM_PAIRS } from "@domain/entities/Period";

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

  test("teacher and room are optional, trimmed, and bounded", () => {
    const full = createPeriod("x", "A", "08:00", "08:30", { teacher: "  Ms. Khan ", room: " Room 12 " });
    expect(full.teacher).toBe("Ms. Khan");
    expect(full.room).toBe("Room 12");

    const bare = createPeriod("x", "A", "08:00", "08:30");
    expect(bare.teacher).toBeNull();
    expect(bare.room).toBeNull();

    const blank = createPeriod("x", "A", "08:00", "08:30", { teacher: "   ", room: "" });
    expect(blank.teacher).toBeNull();
    expect(blank.room).toBeNull();

    const long = createPeriod("x", "A", "08:00", "08:30", { teacher: "T".repeat(120) });
    expect(long.teacher).toHaveLength(80);
  });

  test("clonePeriod preserves and re-normalizes teacher/room", () => {
    const p = createPeriod("x", "A", "08:00", "08:30", { teacher: "Mr. Ali", room: "204" });
    const copy = clonePeriod(p);
    expect(copy.teacher).toBe("Mr. Ali");
    expect(copy.room).toBe("204");
    expect(copy).not.toBe(p);

    const dirty = { ...p, teacher: "  ", room: 42 as unknown as string };
    const cleaned = clonePeriod(dirty);
    expect(cleaned.teacher).toBeNull();
    expect(cleaned.room).toBeNull();
  });
});