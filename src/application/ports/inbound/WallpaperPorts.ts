import type { SettingsDraftVM } from "../view-models/ViewModels";

export interface PickWallpaperPort {
  pick(): Promise<SettingsDraftVM>;
}

export interface RemoveWallpaperPort {
  removeWallpaper(): SettingsDraftVM;
}