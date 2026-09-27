import { defaultPeriods, type Period } from "./Period";
import { DEFAULT_ACCENT, normalizeAccentColor, type AccentColor } from "../value-objects/AccentColor";
import { paletteAt } from "../value-objects/RingPalette";

export interface Settings {
  periods: Period[];
  accentColor: AccentColor;
  paletteIndex: number;
  colorClock: boolean;
  colorNotification: boolean;
  colorActiveBars: boolean;
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  wallpaperBlur: number;
  wallpaperUri: string | null;
  lastNotifiedPeriodId: string | null;
}

export interface SettingsShape {
  periods?: Period[];
  accentColor?: AccentColor;
  paletteIndex?: number;
  colorClock?: boolean;
  colorNotification?: boolean;
  colorActiveBars?: boolean;
  soundEnabled?: boolean;
  notificationsEnabled?: boolean;
  wallpaperBlur?: number;
  wallpaperUri?: string | null;
  lastNotifiedPeriodId?: string | null;
}

export function defaultSettings(): Settings {
  return {
    periods: defaultPeriods(),
    accentColor: DEFAULT_ACCENT,
    paletteIndex: 0,
    colorClock: false,
    colorNotification: false,
    colorActiveBars: true,
    soundEnabled: true,
    notificationsEnabled: true,
    wallpaperBlur: 0,
    wallpaperUri: null,
    lastNotifiedPeriodId: null,
  };
}

export function settingsWith(overrides: SettingsShape): Settings {
  const base = defaultSettings();
  return {
    periods: overrides.periods ?? base.periods,
    accentColor: normalizeAccentColor(overrides.accentColor ?? base.accentColor),
    paletteIndex: overrides.paletteIndex ?? base.paletteIndex,
    colorClock: overrides.colorClock ?? base.colorClock,
    colorNotification: overrides.colorNotification ?? base.colorNotification,
    colorActiveBars: overrides.colorActiveBars ?? base.colorActiveBars,
    soundEnabled: overrides.soundEnabled ?? base.soundEnabled,
    notificationsEnabled: overrides.notificationsEnabled ?? base.notificationsEnabled,
    wallpaperBlur: clampBlur(overrides.wallpaperBlur ?? base.wallpaperBlur),
    wallpaperUri: overrides.wallpaperUri ?? base.wallpaperUri,
    lastNotifiedPeriodId: overrides.lastNotifiedPeriodId ?? base.lastNotifiedPeriodId,
  };
}

export function clampBlur(blur: number): number {
  if (!Number.isFinite(blur)) return 0;
  return Math.max(0, Math.min(100, Math.round(blur)));
}

export function normalizeSettings(shape: Partial<SettingsShape> | null | undefined): Settings {
  if (!shape) return defaultSettings();
  return settingsWith(shape);
}

export { paletteAt };