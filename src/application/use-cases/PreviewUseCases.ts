import type { SettingsDraftVM } from "@application/ports/view-models/ViewModels";
import type {
  PreviewAccentPort,
  PreviewColorClockPort,
  PreviewColorNotificationPort,
  PreviewColorActiveBarsPort,
  PreviewNotificationsPort,
  PreviewPalettePort,
  PreviewRingSizePort,
  PreviewSoundPort,
  PreviewThemePort,
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

/** Live-updates the clock ring size (60–130% of the layout default). */
export class PreviewRingSizeUseCase implements PreviewRingSizePort {
  constructor(private readonly draftStore: SettingsDraftStore, private readonly wallpaper: WallpaperStorePort) {}
  preview(scale: number): SettingsDraftVM {
    this.draftStore.setRingSizeScale(scale);
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

/**
 * Live-updates the draft's custom ringtone without opening the picker (used by
 * the "use built-in sound" reset action).
 */
export class PreviewAlarmSoundUseCase {
  constructor(private readonly draftStore: SettingsDraftStore, private readonly wallpaper: WallpaperStorePort) {}
  preview(uri: string | null): SettingsDraftVM {
    this.draftStore.setAlarmSound(uri);
    return vm(this.draftStore, this.wallpaper);
  }
}

export class PreviewThemeUseCase implements PreviewThemePort {
  constructor(private readonly draftStore: SettingsDraftStore, private readonly wallpaper: WallpaperStorePort) {}
  preview(theme: "light" | "dark"): SettingsDraftVM {
    this.draftStore.setTheme(theme);
    return vm(this.draftStore, this.wallpaper);
  }
}
