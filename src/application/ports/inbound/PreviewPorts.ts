import type { SettingsDraftVM } from "../view-models/ViewModels";

export interface PreviewPalettePort {
  preview(index: number): SettingsDraftVM;
}

export interface PreviewRingSizePort {
  preview(scale: number): SettingsDraftVM;
}

/** Sets/clears one phase's custom ring color (null = palette color). */
export interface PreviewRingPhaseColorPort {
  preview(phase: 0 | 1 | 2, hex: string | null): SettingsDraftVM;
}

/** Sets/clears the flat home background used when no wallpaper is set. */
export interface PreviewHomeBgColorPort {
  preview(hex: string | null): SettingsDraftVM;
}

/** Records a picked color into the saved swatches. */
export interface SaveSwatchPort {
  save(hex: string): SettingsDraftVM;
}

export interface PreviewAccentPort {
  preview(hex: string): SettingsDraftVM;
}

export interface PreviewColorClockPort {
  preview(enabled: boolean): SettingsDraftVM;
}

export interface PreviewColorNotificationPort {
  preview(enabled: boolean): SettingsDraftVM;
}

export interface PreviewColorActiveBarsPort {
  preview(enabled: boolean): SettingsDraftVM;
}

export interface PreviewSoundPort {
  preview(enabled: boolean): SettingsDraftVM;
}

export interface PreviewWallpaperBlurPort {
  preview(blur: number): SettingsDraftVM;
}

export interface PreviewNotificationsPort {
  preview(enabled: boolean): SettingsDraftVM;
}

export interface PreviewThemePort {
  preview(theme: "light" | "dark"): SettingsDraftVM;
}