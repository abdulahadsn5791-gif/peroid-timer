import type { SettingsDraftVM } from "@application/ports/view-models/ViewModels";
import type { PickWallpaperPort, RemoveWallpaperPort } from "@application/ports/inbound/WallpaperPorts";
import type { ImagePickerPort } from "@application/ports/outbound/ImagePickerPort";
import type { WallpaperStorePort } from "@application/ports/outbound/WallpaperStorePort";
import { SettingsDraftStore } from "@application/state/SettingsDraftStore";
import { draftVmFromStore } from "./OpenSettingsUseCase";

function vm(store: SettingsDraftStore, wallpaper: WallpaperStorePort): SettingsDraftVM {
  return draftVmFromStore(store, wallpaper);
}

export class PickWallpaperUseCase implements PickWallpaperPort {
  constructor(
    private readonly imagePicker: ImagePickerPort,
    private readonly wallpaperStore: WallpaperStorePort,
    private readonly draftStore: SettingsDraftStore,
  ) {}

  async pick(): Promise<SettingsDraftVM> {
    const picked = await this.imagePicker.pickImage();
    if (!picked) return vm(this.draftStore, this.wallpaperStore);
    const previewUri = await this.wallpaperStore.setPreviewImage(picked.uri);
    this.draftStore.setWallpaperUri(previewUri);
    return vm(this.draftStore, this.wallpaperStore);
  }
}

export class RemoveWallpaperUseCase implements RemoveWallpaperPort {
  constructor(
    private readonly wallpaperStore: WallpaperStorePort,
    private readonly draftStore: SettingsDraftStore,
  ) {}

  removeWallpaper(): SettingsDraftVM {
    this.wallpaperStore.clearPreview();
    this.draftStore.setWallpaperUri(null);
    return vm(this.draftStore, this.wallpaperStore);
  }
}