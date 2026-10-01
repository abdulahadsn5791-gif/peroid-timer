import type { SettingsDraftVM } from "@application/ports/view-models/ViewModels";
import type {
  PreviewAccentPort,
  PreviewClockStylePort,
  PreviewColorClockPort,
  PreviewColorNotificationPort,
  PreviewColorActiveBarsPort,
  PreviewHomeBgColorPort,
  PreviewNotificationsPort,
  PreviewPalettePort,
  PreviewRingPhaseColorPort,
  PreviewRingSizePort,
  PreviewShowScheduleListPort,
  PreviewSoundPort,
  PreviewThemePort,
  PreviewUpcomingAlertHoursPort,
  PreviewWallpaperBlurPort,
  SaveSwatchPort,
} from "@application/ports/inbound/PreviewPorts";
import type { WallpaperStorePort } from "@application/ports/outbound/WallpaperStorePort";
import { SettingsDraftStore } from "@application/state/SettingsDraftStore";
import { draftVmFromStore } from "./OpenSettingsUseCase";
import { clampBlur, type ClockStyle } from "@domain/entities/Settings";

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

/** Live-updates one phase's custom ring color (null = palette fallback). */
export class PreviewRingPhaseColorUseCase implements PreviewRingPhaseColorPort {
  constructor(private readonly draftStore: SettingsDraftStore, private readonly wallpaper: WallpaperStorePort) {}
  preview(phase: 0 | 1 | 2, hex: string | null): SettingsDraftVM {
    this.draftStore.setRingPhaseColor(phase, hex);
    return vm(this.draftStore, this.wallpaper);
  }
}

/** Live-updates the flat home background (no-wallpaper mode only). */
export class PreviewHomeBgColorUseCase implements PreviewHomeBgColorPort {
  constructor(private readonly draftStore: SettingsDraftStore, private readonly wallpaper: WallpaperStorePort) {}
  preview(hex: string | null): SettingsDraftVM {
    this.draftStore.setHomeBgColor(hex);
    return vm(this.draftStore, this.wallpaper);
  }
}

/** Records a picked color into the user's saved swatches. */
export class SaveSwatchUseCase implements SaveSwatchPort {
  constructor(private readonly draftStore: SettingsDraftStore, private readonly wallpaper: WallpaperStorePort) {}
  save(hex: string): SettingsDraftVM {
    this.draftStore.saveSwatch(hex);
    return vm(this.draftStore, this.wallpaper);
  }
}

/** Live-updates the home timer look (ring vs big digital clock). */
export class PreviewClockStyleUseCase implements PreviewClockStylePort {
  constructor(private readonly draftStore: SettingsDraftStore, private readonly wallpaper: WallpaperStorePort) {}
  preview(style: ClockStyle): SettingsDraftVM {
    this.draftStore.setClockStyle(style);
    return vm(this.draftStore, this.wallpaper);
  }
}

/** Live-updates whether the today's-schedule list renders on the home screen. */
export class PreviewShowScheduleListUseCase implements PreviewShowScheduleListPort {
  constructor(private readonly draftStore: SettingsDraftStore, private readonly wallpaper: WallpaperStorePort) {}
  preview(enabled: boolean): SettingsDraftVM {
    this.draftStore.setShowScheduleList(enabled);
    return vm(this.draftStore, this.wallpaper);
  }
}

/** Live-updates the upcoming-lecture alert lead time in hours (0 = off). */
export class PreviewUpcomingAlertHoursUseCase implements PreviewUpcomingAlertHoursPort {
  constructor(private readonly draftStore: SettingsDraftStore, private readonly wallpaper: WallpaperStorePort) {}
  preview(hours: number): SettingsDraftVM {
    this.draftStore.setUpcomingAlertHours(hours);
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
