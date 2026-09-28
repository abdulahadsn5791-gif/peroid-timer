import type { SettingsDraftVM } from "../view-models/ViewModels";

export interface OpenSettingsPort {
  open(): SettingsDraftVM;
}

export interface GetSettingsDraftPort {
  getDraft(): SettingsDraftVM;
}

export interface SetWeekdayPort {
  setWeekday(weekday: number): SettingsDraftVM;
}

export interface ClearDayPort {
  clearDay(): SettingsDraftVM;
}

export interface CopyToAllDaysPort {
  copyToAllDays(): SettingsDraftVM;
}

export interface PreviewAlarmSoundPort {
  previewAlarmSound(uri: string | null): SettingsDraftVM;
}
