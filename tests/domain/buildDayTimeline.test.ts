import { describe, expect, test } from "bun:test";
import { buildDayTimeline, type DayTimeline } from "@domain/services/buildDayTimeline";
import { settingsWith } from "@domain/entities/Settings";
import { paletteAt } from "@domain/value-objects/RingPalette";

const BOUNDARY = 1_800_000_000; // arbitrary local midnight epoch sec
const NOW = BOUNDARY + 8 * 3600 + 45 * 60; // 08:45

describe("buildDayTimeline (snapshot v6)", () => {
  test("maps periods to absolute epoch segments with thresholds + duration as data", () => {
    const settings = settingsWith({});
    const tl: DayTimeline = buildDayTimeline(settings, BOUNDARY, NOW, 3);

    expect(tl.version).toBe(6);
    expect(tl.weekday).toBe(3);
    expect(tl.boundaryUnixSec).toBe(BOUNDARY);
    expect(tl.generatedAtUnixSec).toBe(NOW);
    expect(tl.accentHex).toBe(settings.accentColor);
    expect(tl.soundEnabled).toBe(true);
    expect(tl.notificationsEnabled).toBe(true);
    expect(tl.colorNotification).toBe(false);
    expect(tl.alarmSoundUri).toBeNull();
    expect(tl.segments).toHaveLength(4);

    const first = tl.segments[0];
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
      3,
    );
    expect(both.soundEnabled).toBe(false);
    expect(both.notificationsEnabled).toBe(true);

    const neither = buildDayTimeline(
      settingsWith({ soundEnabled: false, notificationsEnabled: false }),
      BOUNDARY,
      NOW,
      3,
    );
    expect(neither.soundEnabled).toBe(false);
    expect(neither.notificationsEnabled).toBe(false);
  });

  test("serializes to plain JSON the native side can parse", () => {
    const tl = buildDayTimeline(settingsWith({}), BOUNDARY, NOW, 3);
    const roundTrip = JSON.parse(JSON.stringify(tl)) as DayTimeline;
    expect(roundTrip.segments[0].startUnixSec).toBe(tl.segments[0].startUnixSec);
    expect(roundTrip.segments[0].durationSec).toBe(tl.segments[0].durationSec);
    expect(roundTrip.segments[0].colors).toEqual(tl.segments[0].colors);
    expect(roundTrip.weekday).toBe(3);
  });
});
