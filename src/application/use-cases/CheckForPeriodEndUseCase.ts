import { normalizeSettings } from "@domain/entities/Settings";
import { periodJustEnded } from "@domain/services/periodEnd";
import type { PeriodEndTickResult } from "@application/ports/view-models/ViewModels";
import type { CheckForPeriodEndPort } from "@application/ports/inbound/BackgroundPorts";
import type { ClockPort } from "@application/ports/outbound/ClockPort";
import type { SettingsRepositoryPort } from "@application/ports/outbound/SettingsRepositoryPort";
import type { SoundPort } from "@application/ports/outbound/SoundPort";

export class CheckForPeriodEndUseCase implements CheckForPeriodEndPort {
  constructor(
    private readonly clock: ClockPort,
    private readonly settingsRepository: SettingsRepositoryPort,
    private readonly sound: SoundPort,
  ) {}

  async tick(): Promise<PeriodEndTickResult> {
    const settings = normalizeSettings(this.settingsRepository.load());
    const now = this.clock.now();
    const event = periodJustEnded(settings.periods, now.secondsOfDay, settings.lastNotifiedPeriodId);
    if (!event) return { justEnded: false, periodName: null };
    if (settings.soundEnabled) {
      await this.sound.playEndSound();
    }
    this.settingsRepository.save({ ...settings, lastNotifiedPeriodId: event.periodId });
    return { justEnded: true, periodName: event.periodName };
  }
}