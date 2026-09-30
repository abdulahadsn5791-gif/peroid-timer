import type {
  HomeView,
  SettingsDraftVM,
  PeriodEndTickResult,
} from "@application/ports/view-models/ViewModels";

export interface PeriodPatch {
  name?: string;
  start?: string;
  end?: string;
  teacher?: string | null;
  room?: string | null;
}

/**
 * The full dependency surface the composition root hands to the UI. Bound in
 * src/composition-root.ts (the only file that news up adapters).
 */
export interface AppDeps {
  getHomeView(): HomeView;
  openSettings(): void;
  settingsIsOpen(): boolean;
  getDraft(): SettingsDraftVM;
  subscribeDraft(listener: () => void): () => void;
  settingsActions: SettingsActions;
  checkPeriodEnd(): Promise<PeriodEndTickResult>;
  onBackgroundTick(): void;
  runBootstrap(): Promise<void>;
}

/**
 * The UI-facing surface for the settings sheet. Implementations delegate to
 * application use cases; the sheet renders only, never decides behavior.
 */
export interface SettingsActions {
  previewPalette(index: number): void;
  /** Live-updates the clock ring size (60–130% of the layout default). */
  previewRingSize(scale: number): void;
  /** Sets/clears one phase's custom ring color (null = use the palette). */
  previewRingPhaseColor(phase: 0 | 1 | 2, hex: string | null): void;
  /** Sets/clears the flat home background used when no wallpaper is set. */
  previewHomeBgColor(hex: string | null): void;
  /** Records a picked color into the user's saved swatches. */
  saveSwatch(hex: string): void;
  previewAccent(hex: string): void;
  previewColorClock(enabled: boolean): void;
  previewColorNotification(enabled: boolean): void;
  previewColorActiveBars(enabled: boolean): void;
  previewSound(enabled: boolean): void;
  /** Switches the no-wallpaper home look between light and dark. */
  previewTheme(theme: "light" | "dark"): void;
  previewWallpaperBlur(blur: number): void;
  previewNotifications(enabled: boolean): void;
  updatePeriod(id: string, patch: PeriodPatch): void;
  moveUp(index: number): void;
  moveDown(index: number): void;
  remove(index: number): void;
  addPeriod(): void;
  /** Switches the weekday tab being edited (0 = Sunday … 6 = Saturday). */
  setWeekday(weekday: number): void;
  /** Empties the active weekday — the "no lectures" preset. */
  clearDay(): void;
  /** Copies the active weekday's periods to every other day. */
  copyToAllDays(): void;
  /** Opens the system picker for a custom alarm ringtone. */
  pickAlarmSound(): void;
  /** Reverts to the built-in alarm tone. */
  clearAlarmSound(): void;
  pickWallpaper(): Promise<void>;
  removeWallpaper(): void;
  save(): Promise<void>;
  close(): void;
}
