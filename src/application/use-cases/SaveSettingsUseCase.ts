import { normalizeSettings } from "@domain/entities/Settings";
import type { SettingsRepositoryPort } from "@application/ports/outbound/SettingsRepositoryPort";
import type { WallpaperStorePort } from "@application/ports/outbound/WallpaperStorePort";
import type { SaveSettingsPort } from "@application/ports/inbound/BackgroundPorts";
import { SettingsDraftStore } from "@application/state/SettingsDraftStore";
import { BackgroundPlanner } from "@application/state/BackgroundPlanner";

export class SaveSettingsUseCase implements SaveSettingsPort {
  constructor(
    private readonly settingsRepository: SettingsRepositoryPort,
    private readonly wallpaperStore: WallpaperStorePort,
    private readonly draftStore: SettingsDraftStore,
    private readonly planner: BackgroundPlanner,
  ) {}

  async save(): Promise<void> {
    const draft = this.draftStore.getDraft();
    if (!this.draftStore.isOpen()) {
      await this.planner.apply(this.settingsRepository.load());
      return;
    }
    if (!draft.weekSchedule.some((day) => day.length > 0)) {
      throw new Error("At least one day needs at least one period.");
    }

    const hasPreview = this.wallpaperStore.hasPreview();
    let storedUri: string | null;
    if (draft.wallpaperUri == null) {
      if (hasPreview) this.wallpaperStore.rollbackPreview();
      await this.wallpaperStore.removeStored();
      storedUri = null;
    } else if (hasPreview) {
      storedUri = await this.wallpaperStore.commitPreview();
    } else {
      storedUri = this.wallpaperStore.getStoredUri();
    }

    const next = normalizeSettings({
      weekSchedule: draft.weekSchedule,
      accentColor: draft.accentColor,
      paletteIndex: draft.paletteIndex,
      ringSizeScale: draft.ringSizeScale,
      colorClock: draft.colorClock,
      colorNotification: draft.colorNotification,
      colorActiveBars: draft.colorActiveBars,
      soundEnabled: draft.soundEnabled,
      notificationsEnabled: draft.notificationsEnabled,
      alarmSoundUri: draft.alarmSoundUri,
      wallpaperBlur: draft.wallpaperBlur,
      wallpaperUri: storedUri,
      theme: draft.theme,
      lastNotifiedKey: this.settingsRepository.load().lastNotifiedKey,
    });

    this.settingsRepository.save(next);
    await this.planner.apply(next);
    this.draftStore.commitFromSettings(next);
  }
}
