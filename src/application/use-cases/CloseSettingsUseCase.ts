import type { CloseSettingsPort } from "@application/ports/inbound/BackgroundPorts";
import type { WallpaperStorePort } from "@application/ports/outbound/WallpaperStorePort";
import { SettingsDraftStore } from "@application/state/SettingsDraftStore";

export class CloseSettingsUseCase implements CloseSettingsPort {
  constructor(
    private readonly wallpaperStore: WallpaperStorePort,
    private readonly draftStore: SettingsDraftStore,
  ) {}

  close(): void {
    this.wallpaperStore.rollbackPreview();
    this.draftStore.close();
  }
}