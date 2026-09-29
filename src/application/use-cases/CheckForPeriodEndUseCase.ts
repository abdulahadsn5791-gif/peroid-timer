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
    // No tone is played here on purpose. The end-of-period sound is owned end to
    // end by the native alarm channel, so it plays on the alarm stream and works
    // with the app closed. Playing a second copy from JS meant two overlapping
    // tones, and the notification's "Stop alarm" action could only cancel the
    // native one, leaving the JS tone ringing with no way to silence it.
    this.settingsRepository.save({ ...settings, lastNotifiedKey: event.notifyKey });
    return { justEnded: true, periodName: event.periodName };
  }

  /** Silences a ringing end-of-period alarm without touching the schedule. */
  async stop(): Promise<void> {
    await this.sound.stopEndSound();
  }
}
