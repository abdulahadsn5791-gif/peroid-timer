import type { SettingsDraftVM } from "@application/ports/view-models/ViewModels";
import type {
  ClearDayPort,
  CopyToAllDaysPort,
  SetWeekdayPort,
} from "@application/ports/inbound/SettingsDraftPorts";
import type { WallpaperStorePort } from "@application/ports/outbound/WallpaperStorePort";
import { SettingsDraftStore } from "@application/state/SettingsDraftStore";
import { draftVmFromStore } from "./OpenSettingsUseCase";

function vm(store: SettingsDraftStore, wallpaper: WallpaperStorePort): SettingsDraftVM {
  return draftVmFromStore(store, wallpaper);
}

export class SetWeekdayUseCase implements SetWeekdayPort {
  constructor(
    private readonly draftStore: SettingsDraftStore,
    private readonly wallpaper: WallpaperStorePort,
  ) {}

  setWeekday(weekday: number): SettingsDraftVM {
    this.draftStore.setWeekday(weekday);
    return vm(this.draftStore, this.wallpaper);
  }
}

export class ClearDayUseCase implements ClearDayPort {
  constructor(
    private readonly draftStore: SettingsDraftStore,
    private readonly wallpaper: WallpaperStorePort,
  ) {}

  clearDay(): SettingsDraftVM {
    this.draftStore.clearDay();
    return vm(this.draftStore, this.wallpaper);
  }
}

export class CopyToAllDaysUseCase implements CopyToAllDaysPort {
  constructor(
    private readonly draftStore: SettingsDraftStore,
    private readonly wallpaper: WallpaperStorePort,
  ) {}

  copyToAllDays(): SettingsDraftVM {
    this.draftStore.copyToAllDays();
    return vm(this.draftStore, this.wallpaper);
  }
}
