import type { PhaseIndex } from "@domain/value-objects/PhaseColor";
import type { CustomRingColors, HexColor } from "@domain/value-objects/CustomColors";
import type { AppTheme, ClockStyle } from "@domain/entities/Settings";

export type RowStatus = "passed" | "current" | "upcoming";

export type RingIndicator = "active" | "between" | "idle";

export interface RingViewModel {
  periodName: string;
  timeText: string;
  statusText: string;
  showHours: boolean;
  ringHex: string;
  clockHex: string | null;
  /** Fraction of the ring already consumed, 0..1. */
  progressElapsed: number;
  indicator: RingIndicator;
  /** Current period's teacher; null when unset or not in a period. */
  teacher: string | null;
  /** Current period's room; null when unset or not in a period. */
  room: string | null;
  /** Up-next period's teacher (between-periods state). */
  nextTeacher: string | null;
  /** Up-next period's room (between-periods state). */
  nextRoom: string | null;
  nextName: string | null;
}

export interface ScheduleRowViewModel {
  id: string;
  name: string;
  rangeText: string;
  status: RowStatus;
  countdownText: string | null;
  progressElapsed: number;
  phaseIndex: PhaseIndex | null;
  phaseHex: string | null;
  teacher: string | null;
  room: string | null;
}

export interface HomeView {
  todayLabel: string;
  /** 0 = Sunday … 6 = Saturday — the weekday the view is showing. */
  weekday: number;
  /** True when today's preset has no lectures (empty preset). */
  isEmptyDay: boolean;
  /** Clock ring size as a percent of the layout default: 60..130, 100 = auto. */
  ringSizeScale: number;
  /** Flat home background when no wallpaper photo is set; null = theme default. */
  homeBgColor: HexColor | null;
  hasWallpaper: boolean;
  /** Home timer look: the analog progress ring or big digital text. */
  clockStyle: ClockStyle;
  /** Whether the today's-schedule list renders under the home clock. */
  showScheduleList: boolean;
  wallpaperUri: string | null;
  wallpaperBlur: number;
  /** Home look without a wallpaper; a wallpaper always uses frosted glass. */
  theme: AppTheme;
  colorActiveBars: boolean;
  accentHex: string;
  paletteName: string;
  ring: RingViewModel;
  rows: ScheduleRowViewModel[];
}

export interface PeriodDraftVM {
  id: string;
  name: string;
  start: string;
  end: string;
  startLabel: string;
  endLabel: string;
  teacher: string | null;
  room: string | null;
}

export interface SettingsDraftVM {
  accentColor: string;
  paletteIndex: number;
  /** Per-phase ring color overrides; null = use the selected palette. */
  customRingColors: CustomRingColors;
  /** Flat home background when no wallpaper is set; null = theme default. */
  homeBgColor: HexColor | null;
  /** User-saved swatches, newest first. */
  savedSwatches: HexColor[];
  /** Clock ring size as a percent of the layout default: 60..130. */
  ringSizeScale: number;
  /** Home timer look: the analog progress ring or big digital text. */
  clockStyle: ClockStyle;
  /** Whether the today's-schedule list renders under the home clock. */
  showScheduleList: boolean;
  /** Upcoming-lecture alert lead time in hours; 0 = off. */
  upcomingAlertHours: number;
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  colorClock: boolean;
  colorNotification: boolean;
  colorActiveBars: boolean;
  wallpaperBlur: number;
  wallpaperPreviewUri: string | null;
  hasWallpaper: boolean;
  theme: AppTheme;
  /** 0 = Sunday … 6 = Saturday — the weekday tab being edited. */
  weekday: number;
  /** One row list per weekday; index 0 = Sunday … 6 = Saturday. */
  weekPeriods: PeriodDraftVM[][];
  /** Kept for convenience: the rows of the active weekday tab. */
  periods: PeriodDraftVM[];
  alarmSoundUri: string | null;
  dirty: boolean;
}

export interface PeriodEndTickResult {
  justEnded: boolean;
  periodName: string | null;
}
