import type { SettingsDraftVM } from "@application/ports/view-models/ViewModels";
import type { SoundPickerPort } from "@application/ports/outbound/SoundPickerPort";
import type { WallpaperStorePort } from "@application/ports/outbound/WallpaperStorePort";
import { SettingsDraftStore } from "@application/state/SettingsDraftStore";
import { draftVmFromStore } from "./OpenSettingsUseCase";

function vm(store: SettingsDraftStore, wallpaper: WallpaperStorePort): SettingsDraftVM {
  return draftVmFromStore(store, wallpaper);
}

/**
 * Picks a custom alarm ringtone and stages it in the draft. The picked file is
 * copied into the documents directory by the adapter, so the URI stays valid
 * after restarts; committing happens with the normal Save & apply flow.
 */
export class PickAlarmSoundUseCase {
  constructor(
    private readonly soundPicker: SoundPickerPort,
    private readonly draftStore: SettingsDraftStore,
    private readonly wallpaper: WallpaperStorePort,
  ) {}

  async pick(): Promise<SettingsDraftVM> {
    const picked = await this.soundPicker.pickSound();
    if (picked) this.draftStore.setAlarmSound(picked.uri);
    return vm(this.draftStore, this.wallpaper);
  }
}

export class ClearAlarmSoundUseCase {
  constructor(
    private readonly draftStore: SettingsDraftStore,
    private readonly wallpaper: WallpaperStorePort,
  ) {}

  clear(): SettingsDraftVM {
    this.draftStore.setAlarmSound(null);
    return vm(this.draftStore, this.wallpaper);
  }
}
