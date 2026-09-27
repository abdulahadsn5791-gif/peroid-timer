import type { SettingsDraftVM } from "../view-models/ViewModels";

export interface OpenSettingsPort {
  open(): SettingsDraftVM;
}

export interface GetSettingsDraftPort {
  getDraft(): SettingsDraftVM;
}