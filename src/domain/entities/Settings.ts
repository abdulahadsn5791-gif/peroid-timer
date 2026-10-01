import { type Period } from "./Period";
import {
  defaultWeekSchedule,
  normalizeWeekSchedule,
  weekScheduleEveryDay,
  type WeekSchedule,
} from "./WeekSchedule";
import { DEFAULT_ACCENT, normalizeAccentColor, type AccentColor } from "../value-objects/AccentColor";
import { paletteAt } from "../value-objects/RingPalette";
import {
  DEFAULT_CUSTOM_RING_COLORS,
  normalizeCustomRingColors,
  normalizeOptionalHex,
  normalizeSavedSwatches,
  STARTER_SWATCHES,
  type CustomRingColors,
  type HexColor,
} from "../value-objects/CustomColors";

export type AppTheme = "light" | "dark";

export function normalizeTheme(value: unknown): AppTheme {
  return value === "dark" ? "dark" : "light";
}

/** How the home screen renders the live timer: the analog ring or big digital text. */
export type ClockStyle = "ring" | "digital";

export function normalizeClockStyle(value: unknown): ClockStyle {
  return value === "digital" ? "digital" : "ring";
}

export interface Settings {
  /** One period list per weekday; an empty list = no lectures that day. */
  weekSchedule: WeekSchedule;
  accentColor: AccentColor;
  paletteIndex: number;
  /** Per-phase ring color overrides; null = use the selected palette's color. */
  customRingColors: CustomRingColors;
  /**
   * Home background when no wallpaper photo is set ("none" = the default
   * white/dark look). Ignored entirely when a wallpaper is set — a photo
   * always replaces the flat color.
   */
  homeBgColor: HexColor | null;
  /** Colors the user saved from the pickers, newest first. */
  savedSwatches: HexColor[];
  /** Clock ring size as a percent of the layout default: 60..130, 100 = auto. */
  ringSizeScale: number;
  /** Home timer look: "ring" (analog progress circle) or "digital" (big text). */
  clockStyle: ClockStyle;
  /** Whether the today's-schedule list renders under the home clock. */
  showScheduleList: boolean;
  colorClock: boolean;
  colorNotification: boolean;
  colorActiveBars: boolean;
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  /** Custom alarm ringtone (file/content URI); null = the built-in tone. */
  alarmSoundUri: string | null;
  wallpaperBlur: number;
  wallpaperUri: string | null;
  /** Base look for the no-wallpaper home screen (wallpaper mode stays glassy). */
  theme: AppTheme;
  /**
   * Hours before the next lecture's start for the heads-up "upcoming"
   * notification; 0 = off. 1..100 (100 covers a weekend of notice).
   */
  upcomingAlertHours: number;
  /** "YYYY-MM-DD:periodId" of the last fired end-of-period alert (per-day dedupe). */
  lastNotifiedKey: string | null;
}

export interface SettingsShape {
  weekSchedule?: WeekSchedule;
  /** Legacy single-list shape; still accepted and applied to every day. */
  periods?: Period[];
  accentColor?: AccentColor;
  paletteIndex?: number;
  customRingColors?: CustomRingColors;
  homeBgColor?: HexColor | null;
  savedSwatches?: HexColor[];
  ringSizeScale?: number;
  clockStyle?: ClockStyle;
  showScheduleList?: boolean;
  upcomingAlertHours?: number;
  colorClock?: boolean;
  colorNotification?: boolean;
  colorActiveBars?: boolean;
  soundEnabled?: boolean;
  notificationsEnabled?: boolean;
  alarmSoundUri?: string | null;
  wallpaperBlur?: number;
  wallpaperUri?: string | null;
  theme?: AppTheme;
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
    customRingColors: DEFAULT_CUSTOM_RING_COLORS,
    homeBgColor: null,
    savedSwatches: [...STARTER_SWATCHES],
    ringSizeScale: DEFAULT_RING_SIZE_SCALE,
    clockStyle: "ring",
    showScheduleList: true,
    upcomingAlertHours: 0,
    colorClock: false,
    colorNotification: false,
    colorActiveBars: true,
    // Fresh installs ship with the alarm OFF: a new user should never get a
    // surprise ring on day one — sound is an explicit opt-in in Settings.
    soundEnabled: false,
    notificationsEnabled: true,
    alarmSoundUri: null,
    wallpaperBlur: 0,
    wallpaperUri: null,
    theme: "light",
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
    customRingColors: normalizeCustomRingColors(overrides.customRingColors),
    homeBgColor: normalizeOptionalHex(overrides.homeBgColor),
    savedSwatches:
      overrides.savedSwatches != null
        ? normalizeSavedSwatches(overrides.savedSwatches)
        : base.savedSwatches,
    ringSizeScale: clampRingSizeScale(overrides.ringSizeScale ?? base.ringSizeScale),
    clockStyle: normalizeClockStyle(overrides.clockStyle ?? base.clockStyle),
    showScheduleList: overrides.showScheduleList ?? base.showScheduleList,
    upcomingAlertHours: clampUpcomingAlertHours(overrides.upcomingAlertHours ?? base.upcomingAlertHours),
    colorClock: overrides.colorClock ?? base.colorClock,
    colorNotification: overrides.colorNotification ?? base.colorNotification,
    colorActiveBars: overrides.colorActiveBars ?? base.colorActiveBars,
    soundEnabled: overrides.soundEnabled ?? base.soundEnabled,
    notificationsEnabled: overrides.notificationsEnabled ?? base.notificationsEnabled,
    alarmSoundUri: normalizeAlarmSoundUri(overrides.alarmSoundUri ?? base.alarmSoundUri),
    wallpaperBlur: clampBlur(overrides.wallpaperBlur ?? base.wallpaperBlur),
    wallpaperUri: overrides.wallpaperUri ?? base.wallpaperUri,
    theme: normalizeTheme(overrides.theme ?? base.theme),
    lastNotifiedKey: overrides.lastNotifiedKey ?? base.lastNotifiedKey,
  };
}

export function clampBlur(blur: number): number {
  if (!Number.isFinite(blur)) return 0;
  return Math.max(0, Math.min(100, Math.round(blur)));
}

/** Bounds of the clock ring size slider: 60% … 130% of the layout default. */
export const RING_SIZE_MIN = 60;
export const RING_SIZE_MAX = 130;
export const DEFAULT_RING_SIZE_SCALE = 100;

export function clampRingSizeScale(scale: number): number {
  if (!Number.isFinite(scale)) return DEFAULT_RING_SIZE_SCALE;
  return Math.max(RING_SIZE_MIN, Math.min(RING_SIZE_MAX, Math.round(scale)));
}

/** Upcoming-lecture lead time: 0 = off, 1..100 hours before the next start. */
export const UPCOMING_ALERT_MAX_HOURS = 100;

export function clampUpcomingAlertHours(hours: number): number {
  if (!Number.isFinite(hours)) return 0;
  return Math.max(0, Math.min(UPCOMING_ALERT_MAX_HOURS, Math.round(hours)));
}

export function normalizeSettings(shape: Partial<SettingsShape> | null | undefined): Settings {
  if (!shape) return defaultSettings();
  return settingsWith(shape);
}

export { paletteAt };
