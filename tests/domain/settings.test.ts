import { describe, expect, test } from "bun:test";
import { defaultSettings, normalizeSettings, settingsWith } from "@domain/entities/Settings";
import { DEFAULT_ACCENT, isValidHexColor, normalizeAccentColor, ACCENT_PRESETS } from "@domain/value-objects/AccentColor";
import { paletteAt } from "@domain/value-objects/RingPalette";

describe("Settings", () => {
  test("defaults are the documented light setup", () => {
    const s = defaultSettings();
    expect(s.periods).toHaveLength(4);
    expect(s.accentColor).toBe(DEFAULT_ACCENT);
    expect(s.paletteIndex).toBe(0);
    expect(s.colorClock).toBe(false);
    expect(s.soundEnabled).toBe(true);
    expect(s.wallpaperUri).toBeNull();
    expect(s.lastNotifiedPeriodId).toBeNull();
  });

  test("normalizeSettings fills every missing field", () => {
    const s = normalizeSettings({});
    expect(s.periods).toHaveLength(4);
    expect(s.soundEnabled).toBe(true);
    expect(s.wallpaperUri).toBeNull();
    expect(normalizeSettings(null)).toEqual(defaultSettings());
  });

  test("settingsWith merges only provided overrides", () => {
    const s = settingsWith({});
    expect(s.accentColor).toBe(DEFAULT_ACCENT);
    expect(s.soundEnabled).toBe(true);
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