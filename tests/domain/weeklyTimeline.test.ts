import { describe, expect, test } from "bun:test";
import { buildDayTimeline } from "@domain/services/buildDayTimeline";
import { periodJustEnded } from "@domain/services/periodEnd";
import { settingsWith } from "@domain/entities/Settings";
import { defaultWeekSchedule, weekScheduleFromFactory } from "@domain/entities/WeekSchedule";
import { createPeriod } from "@domain/entities/Period";

const BOUNDARY = 1_800_000_000; // arbitrary local midnight epoch sec
const NOW = BOUNDARY + 8 * 3600 + 45 * 60; // 08:45

function mondayOnly() {
  // weekday 1 = Monday has the sample timetable; all other days are empty.
  return weekScheduleFromFactory((d) => (d === 1 ? defaultWeekSchedule()[1] : []));
}

describe("buildDayTimeline (weekly, v5)", () => {
  test("resolves the requested weekday's preset into segments", () => {
    const settings = settingsWith({ weekSchedule: mondayOnly() });
    const monday = buildDayTimeline(settings, BOUNDARY, NOW, 1);
    expect(monday.version).toBe(5);
    expect(monday.weekday).toBe(1);
    expect(monday.segments).toHaveLength(4);
    expect(monday.segments[0].startUnixSec).toBe(BOUNDARY + (8 * 60 + 30) * 60);

    const tuesday = buildDayTimeline(settings, BOUNDARY, NOW, 2);
    expect(tuesday.weekday).toBe(2);
    expect(tuesday.segments).toHaveLength(0); // empty preset day
  });

  test("carries the custom alarm sound; null stays null", () => {
    const withSound = settingsWith({ weekSchedule: mondayOnly(), alarmSoundUri: "file:///ring.mp3" });
    expect(buildDayTimeline(withSound, BOUNDARY, NOW, 1).alarmSoundUri).toBe("file:///ring.mp3");

    const without = settingsWith({ weekSchedule: mondayOnly(), alarmSoundUri: null });
    expect(buildDayTimeline(without, BOUNDARY, NOW, 1).alarmSoundUri).toBeNull();
  });

  test("round-trips through JSON for the native parser", () => {
    const tl = buildDayTimeline(
      settingsWith({ alarmSoundUri: "content://media/ring", weekSchedule: mondayOnly() }),
      BOUNDARY,
      NOW,
      1,
    );
    const rt = JSON.parse(JSON.stringify(tl));
    expect(rt.weekday).toBe(1);
    expect(rt.alarmSoundUri).toBe("content://media/ring");
    expect(rt.segments).toHaveLength(4);
  });
});

describe("periodJustEnded (weekly dedupe)", () => {
  const math = createPeriod("p1", "Math", "08:00", "08:30");

  test("fires with a weekday-scoped key", () => {
    const event = periodJustEnded([math], 8 * 3600 + 30 * 60, null, 3, 2);
    expect(event).not.toBeNull();
    expect(event!.notifyKey).toBe("3:p1");
    expect(event!.periodName).toBe("Math");
  });

  test("same period on a different weekday is not suppressed", () => {
    // Monday (1) already alerted; Tuesday (2) must fire again for the same id.
    const event = periodJustEnded([math], 8 * 3600 + 30 * 60, "1:p1", 2, 2);
    expect(event).not.toBeNull();
    expect(event!.notifyKey).toBe("2:p1");
  });

  test("stays silent when the same weekday+period already alerted", () => {
    expect(periodJustEnded([math], 8 * 3600 + 30 * 60, "2:p1", 2, 2)).toBeNull();
  });

  test("window and non-end times unchanged", () => {
    expect(periodJustEnded([math], 8 * 3600 + 30 * 60 + 1, null, 2, 2)).not.toBeNull();
    expect(periodJustEnded([math], 8 * 3600 + 30 * 60 + 3, null, 2, 2)).toBeNull();
    expect(periodJustEnded([math], 8 * 3600 + 30 * 60 - 1, null, 2, 2)).toBeNull();
  });
});
