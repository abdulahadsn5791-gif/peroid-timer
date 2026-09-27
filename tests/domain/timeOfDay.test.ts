import { describe, expect, test } from "bun:test";
import { addMinutes, minutesToHour12, parseTimeHHMM, timeOfDay, toHHMM, toSeconds } from "@domain/value-objects/TimeOfDay";

describe("TimeOfDay", () => {
  test("parses HH:MM into minutes of day", () => {
    expect(parseTimeHHMM("08:30").minutes).toBe(510);
    expect(parseTimeHHMM("11:25").minutes).toBe(685);
    expect(parseTimeHHMM("00:00").minutes).toBe(0);
    expect(parseTimeHHMM("23:59").minutes).toBe(1439);
  });

  test("invalid input defaults to midnight", () => {
    expect(parseTimeHHMM("").minutes).toBe(0);
    expect(parseTimeHHMM("nope").minutes).toBe(0);
  });

  test("formats back to zero-padded HH:MM", () => {
    expect(toHHMM({ minutes: 510 })).toBe("08:30");
    expect(toHHMM({ minutes: 685 })).toBe("11:25");
  });

  test("wraps out-of-range minutes into the day", () => {
    expect(timeOfDay(1440).minutes).toBe(0);
    expect(timeOfDay(-5).minutes).toBe(1435);
    expect(timeOfDay(25 * 60).minutes).toBe(60);
  });

  test("converts to seconds", () => {
    expect(toSeconds({ minutes: 90 })).toBe(5400);
  });

  test("addMinutes wraps across midnight", () => {
    expect(addMinutes({ minutes: 1430 }, 20).minutes).toBe(10);
  });

  test("minutesToHour12 returns 12-hour labels", () => {
    expect(minutesToHour12(510)).toEqual({ hour12: 8, minutes: 30, period: "AM" });
    expect(minutesToHour12(685)).toEqual({ hour12: 11, minutes: 25, period: "AM" });
    expect(minutesToHour12(720)).toEqual({ hour12: 12, minutes: 0, period: "PM" });
    expect(minutesToHour12(0)).toEqual({ hour12: 12, minutes: 0, period: "AM" });
  });
});