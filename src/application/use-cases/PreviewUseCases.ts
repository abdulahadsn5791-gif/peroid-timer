import type { SettingsDraftVM } from "@application/ports/view-models/ViewModels";
import type {
  PreviewAccentPort,
  PreviewColorClockPort,
  PreviewColorNotificationPort,
  PreviewColorActiveBarsPort,
  PreviewNotificationsPort,
  PreviewPalettePort,
  PreviewSoundPort,
  PreviewWallpaperBlurPort,
} from "@application/ports/inbound/PreviewPorts";
import type { WallpaperStorePort } from "@application/ports/outbound/WallpaperStorePort";
import { SettingsDraftStore } from "@application/state/SettingsDraftStore";
import { draftVmFromStore } from "./OpenSettingsUseCase";
import { clampBlur } from "@domain/entities/Settings";

function vm(store: SettingsDraftStore, wallpaper: WallpaperStorePort): SettingsDraftVM {
  return draftVmFromStore(store, wallpaper);
}

export class PreviewPaletteUseCase implements PreviewPalettePort {
  constructor(private readonly draftStore: SettingsDraftStore, private readonly wallpaper: WallpaperStorePort) {}
  preview(index: number): SettingsDraftVM {
    this.draftStore.setPalette(index);
    return vm(this.draftStore, this.wallpaper);
  }
}

export class PreviewAccentUseCase implements PreviewAccentPort {
  constructor(private readonly draftStore: SettingsDraftStore, private readonly wallpaper: WallpaperStorePort) {}
  preview(hex: string): SettingsDraftVM {
    this.draftStore.setAccent(hex);
    return vm(this.draftStore, this.wallpaper);
  }
}

export class PreviewColorClockUseCase implements PreviewColorClockPort {
  constructor(private readonly draftStore: SettingsDraftStore, private readonly wallpaper: WallpaperStorePort) {}
  preview(enabled: boolean): SettingsDraftVM {
    this.draftStore.setColorClock(enabled);
    return vm(this.draftStore, this.wallpaper);
  }
}

export class PreviewSoundUseCase implements PreviewSoundPort {
  constructor(private readonly draftStore: SettingsDraftStore, private readonly wallpaper: WallpaperStorePort) {}
  preview(enabled: boolean): SettingsDraftVM {
    this.draftStore.setSound(enabled);
    return vm(this.draftStore, this.wallpaper);
  }
}

export class PreviewColorNotificationUseCase implements PreviewColorNotificationPort {
  constructor(private readonly draftStore: SettingsDraftStore, private readonly wallpaper: WallpaperStorePort) {}
  preview(enabled: boolean): SettingsDraftVM {
    this.draftStore.setColorNotification(enabled);
    return vm(this.draftStore, this.wallpaper);
  }
}

export class PreviewColorActiveBarsUseCase implements PreviewColorActiveBarsPort {
  constructor(private readonly draftStore: SettingsDraftStore, private readonly wallpaper: WallpaperStorePort) {}
  preview(enabled: boolean): SettingsDraftVM {
    this.draftStore.setColorActiveBars(enabled);
    return vm(this.draftStore, this.wallpaper);
  }
}

export class PreviewWallpaperBlurUseCase implements PreviewWallpaperBlurPort {
  constructor(private readonly draftStore: SettingsDraftStore, private readonly wallpaper: WallpaperStorePort) {}
  preview(blur: number): SettingsDraftVM {
    this.draftStore.setWallpaperBlur(clampBlur(blur));
    return vm(this.draftStore, this.wallpaper);
  }
}

export class PreviewNotificationsUseCase implements PreviewNotificationsPort {
  constructor(private readonly draftStore: SettingsDraftStore, private readonly wallpaper: WallpaperStorePort) {}
  preview(enabled: boolean): SettingsDraftVM {
    this.draftStore.setNotificationsEnabled(enabled);
    return vm(this.draftStore, this.wallpaper);
  }
}