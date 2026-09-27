import type { SettingsDraftVM } from "../view-models/ViewModels";

export interface PeriodPatch {
  name?: string;
  start?: string;
  end?: string;
}

export interface DraftPeriodsPort {
  updatePeriod(id: string, patch: PeriodPatch): SettingsDraftVM;
  moveUp(index: number): SettingsDraftVM;
  moveDown(index: number): SettingsDraftVM;
  remove(index: number): SettingsDraftVM;
  addDefault(): SettingsDraftVM;
}