import { type Period } from "./Period";
import {
  defaultWeekSchedule,
  normalizeWeekSchedule,
  weekScheduleEveryDay,
  type WeekSchedule,
} from "./WeekSchedule";
import { DEFAULT_ACCENT, normalizeAccentColor, type AccentColor } from "../value-objects/AccentColor";
import { paletteAt } from "../value-objects/RingPalette";

export interface Settings {
  /** One period list per weekday; an empty list = no lectures that day. */
  weekSchedule: WeekSchedule;
  accentColor: AccentColor;
  paletteIndex: number;
  colorClock: boolean;
  colorNotification: boolean;
  colorActiveBars: boolean;
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  /** Custom alarm ringtone (file/content URI); null = the built-in tone. */
  alarmSoundUri: string | null;
  wallpaperBlur: number;
  wallpaperUri: string | null;
  /** "weekday:periodId" of the last fired end-of-period alert (per-day dedupe). */
  lastNotifiedKey: string | null;
}

export interface SettingsShape {
  weekSchedule?: WeekSchedule;
  /** Legacy single-list shape; still accepted and applied to every day. */
  periods?: Period[];
  accentColor?: AccentColor;
  paletteIndex?: number;
  colorClock?: boolean;
  colorNotification?: boolean;
  colorActiveBars?: boolean;
  soundEnabled?: boolean;
  notificationsEnabled?: boolean;
  alarmSoundUri?: string | null;
  wallpaperBlur?: number;
  wallpaperUri?: string | null;
  lastNotifiedKey?: string | null;
}

/**
 * Only file/content URIs are accepted as alarm sounds; anything else (a stale
 * cache path, a web url, garbage) falls back to the built-in tone so a broken
 * ringtone can never silence the alarm.
 */
function normalizeAlarmSoundUri(uri: string | null | undefined): string | null {
  if (typeof uri !== "string") return null;
  const trimmed = uri.trim();
  if (trimmed.startsWith("file://") || trimmed.startsWith("content://")) return trimmed;
  return null;
}

export function defaultSettings(): Settings {
  return {
    weekSchedule: defaultWeekSchedule(),
    accentColor: DEFAULT_ACCENT,
    paletteIndex: 0,
    colorClock: false,
    colorNotification: false,
    colorActiveBars: true,
    soundEnabled: true,
    notificationsEnabled: true,
    alarmSoundUri: null,
    wallpaperBlur: 0,
    wallpaperUri: null,
    lastNotifiedKey: null,
  };
}

export function settingsWith(overrides: SettingsShape): Settings {
  const base = defaultSettings();
  const weekSchedule = overrides.weekSchedule
    ? normalizeWeekSchedule(overrides.weekSchedule)
    : overrides.periods
      ? weekScheduleEveryDay(overrides.periods)
      : base.weekSchedule;
  return {
    weekSchedule,
    accentColor: normalizeAccentColor(overrides.accentColor ?? base.accentColor),
    paletteIndex: overrides.paletteIndex ?? base.paletteIndex,
    colorClock: overrides.colorClock ?? base.colorClock,
    colorNotification: overrides.colorNotification ?? base.colorNotification,
    colorActiveBars: overrides.colorActiveBars ?? base.colorActiveBars,
    soundEnabled: overrides.soundEnabled ?? base.soundEnabled,
    notificationsEnabled: overrides.notificationsEnabled ?? base.notificationsEnabled,
    alarmSoundUri: normalizeAlarmSoundUri(overrides.alarmSoundUri ?? base.alarmSoundUri),
    wallpaperBlur: clampBlur(overrides.wallpaperBlur ?? base.wallpaperBlur),
    wallpaperUri: overrides.wallpaperUri ?? base.wallpaperUri,
    lastNotifiedKey: overrides.lastNotifiedKey ?? base.lastNotifiedKey,
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
