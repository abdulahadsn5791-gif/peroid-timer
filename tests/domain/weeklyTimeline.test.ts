import { describe, expect, test } from "bun:test";
import {
  buildDayTimeline,
  SNAPSHOT_DAY_COUNT,
  type DayTimeline,
} from "@domain/services/buildDayTimeline";
import { periodJustEnded } from "@domain/services/periodEnd";
import { settingsWith } from "@domain/entities/Settings";
import { defaultWeekSchedule, weekScheduleFromFactory } from "@domain/entities/WeekSchedule";
import { createPeriod } from "@domain/entities/Period";

const BOUNDARY = localMidnight(2026, 9, 30); // a real local midnight (Wednesday)
const NOW = BOUNDARY + 8 * 3600 + 45 * 60; // 08:45 of the boundary's day

/** Local midnight of the given date, exactly like the clock adapter computes it. */
function localMidnight(year: number, month1: number, day: number): number {
  return Math.floor(new Date(year, month1 - 1, day).getTime() / 1000);
}

function mondayOnly() {
  // weekday 1 = Monday has the sample timetable; all other days are empty.
  return weekScheduleFromFactory((d) => (d === 1 ? defaultWeekSchedule()[1] : []));
}

describe("buildDayTimeline (v7, whole week)", () => {
  test("covers today plus the next 7 days (SNAPSHOT_DAY_COUNT entries)", () => {
    const tl = buildDayTimeline(settingsWith({ weekSchedule: mondayOnly() }), BOUNDARY, NOW);
    expect(tl.version).toBe(7);
    expect(tl.days).toHaveLength(SNAPSHOT_DAY_COUNT);
    // Consecutive LOCAL midnights: 86400 apart away from DST, but the test must
    // derive each day's boundary the same way the builder does (Date-based),
    // not assume a fixed step.
    for (let i = 0; i < tl.days.length; i++) {
      const d = new Date(2026, 8, 30 + i);
      expect(tl.days[i].boundaryUnixSec).toBe(Math.floor(d.getTime() / 1000));
    }
  });

  test("each day resolves its own weekday's preset into segments", () => {
    const tl = buildDayTimeline(settingsWith({ weekSchedule: mondayOnly() }), BOUNDARY, NOW);
    // 2026-09-30 is a Wednesday (weekday 3), so the Monday entry is 5 days ahead.
    const mondayIdx = 5;
    expect(tl.days[mondayIdx].weekday).toBe(1);
    expect(tl.days[mondayIdx].segments).toHaveLength(4);
    // All other days are the empty preset.
    const emptyCount = tl.days.filter((d) => d.segments.length === 0).length;
    expect(emptyCount).toBe(SNAPSHOT_DAY_COUNT - 1);
  });

  test("carries the custom alarm sound; null stays null", () => {
    const withSound = settingsWith({ weekSchedule: mondayOnly(), alarmSoundUri: "file:///ring.mp3" });
    expect(buildDayTimeline(withSound, BOUNDARY, NOW).alarmSoundUri).toBe("file:///ring.mp3");

    const without = settingsWith({ weekSchedule: mondayOnly(), alarmSoundUri: null });
    expect(buildDayTimeline(without, BOUNDARY, NOW).alarmSoundUri).toBeNull();
  });

  test("round-trips through JSON for the native parser", () => {
    const tl = buildDayTimeline(
      settingsWith({ alarmSoundUri: "content://media/ring", weekSchedule: mondayOnly() }),
      BOUNDARY,
      NOW,
    );
    const rt = JSON.parse(JSON.stringify(tl)) as DayTimeline;
    expect(rt.version).toBe(7);
    expect(rt.alarmSoundUri).toBe("content://media/ring");
    expect(rt.days).toHaveLength(8);
    expect(rt.days[0].segments).toHaveLength(0); // first day is not Monday here
  });
});

describe("periodJustEnded (date-scoped dedupe)", () => {
  const math = createPeriod("p1", "Math", "08:00", "08:30");
  const atEnd = 8 * 3600 + 30 * 60;

  test("fires with a date-scoped key", () => {
    const event = periodJustEnded([math], atEnd, null, "2026-09-30", 2);
    expect(event).not.toBeNull();
    expect(event!.notifyKey).toBe("2026-09-30:p1");
    expect(event!.periodName).toBe("Math");
  });

  test("same period next week fires again (key expires with the date)", () => {
    // A week ago's key must not suppress today's occurrence of the same period.
    const event = periodJustEnded([math], atEnd, "2026-09-23:p1", "2026-09-30", 2);
    expect(event).not.toBeNull();
    expect(event!.notifyKey).toBe("2026-09-30:p1");
  });

  test("stays silent when the same day+period already alerted", () => {
    expect(periodJustEnded([math], atEnd, "2026-09-30:p1", "2026-09-30", 2)).toBeNull();
  });

  test("window and non-end times unchanged", () => {
    expect(periodJustEnded([math], atEnd + 1, null, "2026-09-30", 2)).not.toBeNull();
    expect(periodJustEnded([math], atEnd + 3, null, "2026-09-30", 2)).toBeNull();
    expect(periodJustEnded([math], atEnd - 1, null, "2026-09-30", 2)).toBeNull();
  });
});
