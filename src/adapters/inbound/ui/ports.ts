import type {
  HomeView,
  SettingsDraftVM,
  PeriodEndTickResult,
} from "@application/ports/view-models/ViewModels";

export interface PeriodPatch {
  name?: string;
  start?: string;
  end?: string;
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
  previewAccent(hex: string): void;
  previewColorClock(enabled: boolean): void;
  previewColorNotification(enabled: boolean): void;
  previewColorActiveBars(enabled: boolean): void;
  previewSound(enabled: boolean): void;
  previewWallpaperBlur(blur: number): void;
  previewNotifications(enabled: boolean): void;
  updatePeriod(id: string, patch: PeriodPatch): void;
  moveUp(index: number): void;
  moveDown(index: number): void;
  remove(index: number): void;
  addPeriod(): void;
  pickWallpaper(): Promise<void>;
  removeWallpaper(): void;
  save(): Promise<void>;
  close(): void;
}