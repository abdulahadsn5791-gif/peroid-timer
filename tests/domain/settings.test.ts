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
    expect(s.soundEnabled).toBe(true);
    expect(s.alarmSoundUri).toBeNull();
    expect(s.wallpaperUri).toBeNull();
    expect(s.lastNotifiedKey).toBeNull();
  });

  test("normalizeSettings fills every missing field", () => {
    const s = normalizeSettings({});
    expect(s.weekSchedule).toHaveLength(7);
    expect(s.soundEnabled).toBe(true);
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
    expect(s.soundEnabled).toBe(true);
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
