import { describe, expect, test } from "bun:test";
import { buildDayTimeline, type DayTimeline } from "@domain/services/buildDayTimeline";
import { settingsWith } from "@domain/entities/Settings";
import { paletteAt } from "@domain/value-objects/RingPalette";
import { DEFAULT_CUSTOM_RING_COLORS } from "@domain/value-objects/CustomColors";

const BOUNDARY = Math.floor(new Date(2026, 8, 30).getTime() / 1000); // a real local midnight
const NOW = BOUNDARY + 8 * 3600 + 45 * 60; // 08:45 of the boundary's day

describe("buildDayTimeline (snapshot v7)", () => {
  test("maps today's periods to absolute epoch segments with thresholds + duration as data", () => {
    const settings = settingsWith({});
    const tl: DayTimeline = buildDayTimeline(settings, BOUNDARY, NOW);

    expect(tl.version).toBe(7);
    expect(tl.days[0].boundaryUnixSec).toBe(BOUNDARY);
    expect(tl.generatedAtUnixSec).toBe(NOW);
    expect(tl.accentHex).toBe(settings.accentColor);
    expect(tl.soundEnabled).toBe(settings.soundEnabled); // fresh-install default: OFF
    expect(tl.notificationsEnabled).toBe(true);
    expect(tl.colorNotification).toBe(false);
    expect(tl.alarmSoundUri).toBeNull();
    expect(tl.upcomingAlert).toBeNull(); // feature default: off
    expect(tl.days[0].segments).toHaveLength(4);

    const first = tl.days[0].segments[0];
    expect(first.name).toBe("Period 1");
    expect(first.startUnixSec).toBe(BOUNDARY + (8 * 60 + 30) * 60);
    expect(first.endUnixSec).toBe(BOUNDARY + (9 * 60 + 10) * 60);
    expect(first.durationSec).toBe(40 * 60);
    expect(first.colors).toEqual(paletteAt(0).colors);
    expect(first.phaseOneUntilRemaining).toBe(0.3);
    expect(first.phaseTwoUntilRemaining).toBe(0.15);
  });

  test("carries both alert toggles so the native alarm can honour each one", () => {
    // The Kotlin receiver reads these two independently: soundEnabled gates the
    // ringtone, notificationsEnabled gates the alert itself.
    const both = buildDayTimeline(
      settingsWith({ soundEnabled: false, notificationsEnabled: true }),
      BOUNDARY,
      NOW,
    );
    expect(both.soundEnabled).toBe(false);
    expect(both.notificationsEnabled).toBe(true);

    const neither = buildDayTimeline(
      settingsWith({ soundEnabled: false, notificationsEnabled: false }),
      BOUNDARY,
      NOW,
    );
    expect(neither.soundEnabled).toBe(false);
    expect(neither.notificationsEnabled).toBe(false);
  });

  test("segment colors include the user's custom per-phase overrides (ring <-> notification sync)", () => {
    const settings = settingsWith({
      customRingColors: { ...DEFAULT_CUSTOM_RING_COLORS, phase2: "#123456" },
    });
    const tl = buildDayTimeline(settings, BOUNDARY, NOW);
    expect(tl.days[0].segments[0].colors).toEqual(["#2563EB", "#B45309", "#123456"]);
    // The live notification path (native phase color(now)) reads these colors,
    // so an override set in the app MUST change the notification color too.
  });

  test("upcomingAlert carries the lead time in seconds; 0 hours = off", () => {
    const on = buildDayTimeline(settingsWith({ upcomingAlertHours: 2 }), BOUNDARY, NOW);
    expect(on.upcomingAlert).toEqual({ leadSec: 2 * 3600 });

    const max = buildDayTimeline(settingsWith({ upcomingAlertHours: 100 }), BOUNDARY, NOW);
    expect(max.upcomingAlert).toEqual({ leadSec: 100 * 3600 });

    const off = buildDayTimeline(settingsWith({ upcomingAlertHours: 0 }), BOUNDARY, NOW);
    expect(off.upcomingAlert).toBeNull();
  });

  test("serializes to plain JSON the native side can parse", () => {
    const tl = buildDayTimeline(settingsWith({}), BOUNDARY, NOW);
    const roundTrip = JSON.parse(JSON.stringify(tl)) as DayTimeline;
    expect(roundTrip.days[0].segments[0].startUnixSec).toBe(tl.days[0].segments[0].startUnixSec);
    expect(roundTrip.days[0].segments[0].durationSec).toBe(tl.days[0].segments[0].durationSec);
    expect(roundTrip.days[0].segments[0].colors).toEqual(tl.days[0].segments[0].colors);
    expect(roundTrip.days[0].boundaryUnixSec).toBe(BOUNDARY);
  });
});
