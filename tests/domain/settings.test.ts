import { describe, expect, test } from "bun:test";
import { defaultSettings, normalizeSettings, settingsWith } from "@domain/entities/Settings";
import { DEFAULT_ACCENT, isValidHexColor, normalizeAccentColor, ACCENT_PRESETS } from "@domain/value-objects/AccentColor";
import { paletteAt } from "@domain/value-objects/RingPalette";

describe("Settings", () => {
  test("defaults are the documented light setup (weekly)", () => {
    const s = defaultSettings();
    expect(s.weekSchedule).toHaveLength(7);
    expect(s.weekSchedule.every((day) => day.length === 4)).toBe(true);
    expect(s.accentColor).toBe(DEFAULT_ACCENT);
    expect(s.paletteIndex).toBe(0);
    expect(s.colorClock).toBe(false);
    // Fresh installs ship with the alarm sound OFF — no surprise ring on day one.
    expect(s.soundEnabled).toBe(false);
    expect(s.notificationsEnabled).toBe(true);
    expect(s.ringSizeScale).toBe(100);
    expect(s.alarmSoundUri).toBeNull();
    expect(s.wallpaperUri).toBeNull();
    expect(s.lastNotifiedKey).toBeNull();
  });

  test("normalizeSettings fills every missing field", () => {
    const s = normalizeSettings({});
    expect(s.weekSchedule).toHaveLength(7);
    // Explicitly disabled sound stays disabled (normalize never re-enables).
    expect(s.soundEnabled).toBe(false);
    expect(s.wallpaperUri).toBeNull();
    expect(normalizeSettings(null)).toEqual(defaultSettings());
  });

  test("legacy single-list shape migrates to every-day", () => {
    const s = settingsWith({ periods: defaultSettings().weekSchedule[1] });
    expect(s.weekSchedule.every((day) => day.length === 4)).toBe(true);
  });

  test("settingsWith merges only provided overrides", () => {
    const s = settingsWith({});
    expect(s.accentColor).toBe(DEFAULT_ACCENT);
    // The fresh-install default is alarm OFF; an explicit true stays true.
    expect(s.soundEnabled).toBe(false);
    expect(settingsWith({ soundEnabled: true }).soundEnabled).toBe(true);
  });

  test("ringSizeScale clamps to 60–130 and rounds", () => {
    expect(settingsWith({ ringSizeScale: 10 }).ringSizeScale).toBe(60);
    expect(settingsWith({ ringSizeScale: 500 }).ringSizeScale).toBe(130);
    expect(settingsWith({ ringSizeScale: 87.4 }).ringSizeScale).toBe(87);
    expect(settingsWith({ ringSizeScale: NaN }).ringSizeScale).toBe(100);
  });

  test("alarmSoundUri accepts only file/content URIs", () => {
    expect(settingsWith({ alarmSoundUri: "file:///ring.mp3" }).alarmSoundUri).toBe("file:///ring.mp3");
    expect(settingsWith({ alarmSoundUri: "content://media/ring" }).alarmSoundUri).toBe("content://media/ring");
    expect(settingsWith({ alarmSoundUri: "https://example.com/ring.mp3" }).alarmSoundUri).toBeNull();
    expect(settingsWith({ alarmSoundUri: "garbage" }).alarmSoundUri).toBeNull();
    expect(settingsWith({ alarmSoundUri: undefined }).alarmSoundUri).toBeNull();
  });
});

describe("AccentColor", () => {
  test("validation + normalization", () => {
    expect(isValidHexColor("#2563EB")).toBe(true);
    expect(isValidHexColor("2563EB")).toBe(false);
    expect(isValidHexColor("#25G3EB")).toBe(false);
    expect(normalizeAccentColor("#0EA5E9")).toBe("#0EA5E9");
    expect(normalizeAccentColor("bogus")).toBe(DEFAULT_ACCENT);
    expect(ACCENT_PRESETS).toContain(DEFAULT_ACCENT);
  });
});

describe("RingPalette", () => {
  test("paletteAt falls back to Classic out of range", () => {
    expect(paletteAt(99).id).toBe("classic");
    expect(paletteAt(0).id).toBe("classic");
    expect(paletteAt(3).id).toBe("lagoon");
  });
});
