import { normalizeSettings } from "@domain/entities/Settings";
import type { SettingsDraftVM } from "@application/ports/view-models/ViewModels";
import type { GetSettingsDraftPort, OpenSettingsPort } from "@application/ports/inbound/SettingsDraftPorts";
import type { SettingsRepositoryPort } from "@application/ports/outbound/SettingsRepositoryPort";
import type { WallpaperStorePort } from "@application/ports/outbound/WallpaperStorePort";
import { SettingsDraftStore } from "@application/state/SettingsDraftStore";
import { toHHMM, minutesOfDayToLabel } from "@domain/value-objects/TimeOfDay";

export interface SettingsDraftVmBuilder {
  buildDraftVM(): SettingsDraftVM;
}

export function draftVmFromStore(
  store: SettingsDraftStore,
  wallpaperStore: WallpaperStorePort,
): SettingsDraftVM {
  const draft = store.getDraft();
  const weekPeriods = draft.weekSchedule.map((day) =>
    day.map((p) => ({
      id: p.id,
      name: p.name,
      start: toHHMM(p.start),
      end: toHHMM(p.end),
      startLabel: minutesOfDayToLabel(p.start.minutes),
      endLabel: minutesOfDayToLabel(p.end.minutes),
      teacher: p.teacher ?? null,
      room: p.room ?? null,
    })),
  );
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
    weekday: draft.weekday,
    weekPeriods,
    periods: weekPeriods[draft.weekday] ?? [],
    alarmSoundUri: draft.alarmSoundUri,
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
