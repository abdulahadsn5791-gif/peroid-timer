import { normalizeSettings } from "@domain/entities/Settings";
import { periodsFor } from "@domain/entities/WeekSchedule";
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
    const weekday = this.clock.todayParts().weekday;
    const today = periodsFor(settings.weekSchedule, weekday);
    const event = periodJustEnded(today, now.secondsOfDay, settings.lastNotifiedKey, weekday);
    if (!event) return { justEnded: false, periodName: null };
    if (settings.soundEnabled && settings.notificationsEnabled) {
      await this.sound.playEndSound();
    }
    this.settingsRepository.save({ ...settings, lastNotifiedKey: event.notifyKey });
    return { justEnded: true, periodName: event.periodName };
  }

  /** Silences a ringing end-of-period alarm without touching the schedule. */
  async stop(): Promise<void> {
    await this.sound.stopEndSound();
  }
}
