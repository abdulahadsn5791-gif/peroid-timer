import { normalizeSettings } from "@domain/entities/Settings";
import type { SettingsDraftVM } from "@application/ports/view-models/ViewModels";
import type { GetSettingsDraftPort, OpenSettingsPort } from "@application/ports/inbound/SettingsDraftPorts";
import type { SettingsRepositoryPort } from "@application/ports/outbound/SettingsRepositoryPort";
import type { WallpaperStorePort } from "@application/ports/outbound/WallpaperStorePort";
import { SettingsDraftStore } from "@application/state/SettingsDraftStore";

export interface SettingsDraftVmBuilder {
  buildDraftVM(): SettingsDraftVM;
}

export function draftVmFromStore(
  store: SettingsDraftStore,
  wallpaperStore: WallpaperStorePort,
): SettingsDraftVM {
  const draft = store.getDraft();
  return {
    accentColor: draft.accentColor,
    paletteIndex: draft.paletteIndex,
    soundEnabled: draft.soundEnabled,
    notificationsEnabled: draft.notificationsEnabled,
    colorClock: draft.colorClock,
    colorNotification: draft.colorNotification,
    colorActiveBars: draft.colorActiveBars,
    wallpaperBlur: draft.wallpaperBlur,
    wallpaperPreviewUri: draft.wallpaperUri,
    hasWallpaper: draft.wallpaperUri != null,
    periods: store.toDraftPeriodVM(),
    dirty: store.isDirty,
  };
}

function buildVm(
  store: SettingsDraftStore,
  wallpaperStore: WallpaperStorePort,
): SettingsDraftVM {
  return draftVmFromStore(store, wallpaperStore);
}

export class OpenSettingsUseCase implements OpenSettingsPort, GetSettingsDraftPort {
  constructor(
    private readonly settingsRepository: SettingsRepositoryPort,
    private readonly wallpaperStore: WallpaperStorePort,
    private readonly draftStore: SettingsDraftStore,
  ) {}

  open(): SettingsDraftVM {
    this.draftStore.openWithWallpaper(this.wallpaperStore.getStoredUri());
    return buildVm(this.draftStore, this.wallpaperStore);
  }

  getDraft(): SettingsDraftVM {
    return buildVm(this.draftStore, this.wallpaperStore);
  }
}