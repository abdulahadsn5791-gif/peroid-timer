import { describe, expect, test } from "bun:test";
import { currentIndexAt, nextIndexAt } from "@domain/entities/Schedule";
import { defaultPeriods, type Period } from "@domain/entities/Period";

// Defaults: 08:30-09:10, 09:15-09:55, 10:00-10:40, 10:45-11:25
const periods: Period[] = defaultPeriods();

describe("Schedule lookup", () => {
  test("currentIndexAt during a period", () => {
    expect(currentIndexAt({ periods }, 8 * 60 + 31)).toBe(0);
    expect(currentIndexAt({ periods }, 9 * 60 + 30)).toBe(1);
    expect(currentIndexAt({ periods }, 11 * 60 + 24)).toBe(3);
  });

  test("currentIndexAt boundary: start is inclusive, end is exclusive", () => {
    expect(currentIndexAt({ periods }, 8 * 60 + 30)).toBe(0);
    expect(currentIndexAt({ periods }, 9 * 60 + 10)).toBe(-1); // period 1 done at exactly end
    expect(currentIndexAt({ periods }, 9 * 60 + 15)).toBe(1);
  });

  test("nextIndexAt between and after periods", () => {
    expect(nextIndexAt({ periods }, 9 * 60 + 12)).toBe(1);
    expect(nextIndexAt({ periods }, 7 * 60)).toBe(0); // before first
    expect(nextIndexAt({ periods }, 12 * 60)).toBe(-1); // all done
    expect(nextIndexAt({ periods }, 8 * 60 + 45)).toBe(-1); // inside a period
  });

  test("empty schedule has no current or next", () => {
    expect(currentIndexAt({ periods: [] }, 500)).toBe(-1);
    expect(nextIndexAt({ periods: [] }, 500)).toBe(-1);
  });
});