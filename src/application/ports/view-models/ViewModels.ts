import type { PhaseIndex } from "@domain/value-objects/PhaseColor";

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
}

export interface HomeView {
  todayLabel: string;
  /** 0 = Sunday … 6 = Saturday — the weekday the view is showing. */
  weekday: number;
  /** True when today's preset has no lectures (empty preset). */
  isEmptyDay: boolean;
  hasWallpaper: boolean;
  wallpaperUri: string | null;
  wallpaperBlur: number;
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
}

export interface SettingsDraftVM {
  accentColor: string;
  paletteIndex: number;
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  colorClock: boolean;
  colorNotification: boolean;
  colorActiveBars: boolean;
  wallpaperBlur: number;
  wallpaperPreviewUri: string | null;
  hasWallpaper: boolean;
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
