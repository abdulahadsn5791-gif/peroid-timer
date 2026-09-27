import type { SettingsDraftVM } from "../view-models/ViewModels";

export interface PreviewPalettePort {
  preview(index: number): SettingsDraftVM;
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

export interface PreviewWallpaperBlurPort {
  preview(blur: number): SettingsDraftVM;
}

export interface PreviewNotificationsPort {
  preview(enabled: boolean): SettingsDraftVM;
}