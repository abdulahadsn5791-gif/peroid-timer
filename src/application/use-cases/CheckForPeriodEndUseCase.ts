import { normalizeSettings } from "@domain/entities/Settings";
import { periodsFor, weekdayOf, type Weekday } from "@domain/entities/WeekSchedule";
import { periodJustEnded } from "@domain/services/periodEnd";
import type { PeriodEndTickResult } from "@application/ports/view-models/ViewModels";
import type { CheckForPeriodEndPort } from "@application/ports/inbound/BackgroundPorts";
import type { ClockPort } from "@application/ports/outbound/ClockPort";
import type { SettingsRepositoryPort } from "@application/ports/outbound/SettingsRepositoryPort";
import type { SoundPort } from "@application/ports/outbound/SoundPort";

/**
 * Per-tick "period ended" check (the JS fallback watcher). The dedupe key now
 * carries the ISO date (`YYYY-MM-DD:periodId`), not just the weekday: a
 * weekday-only key stayed set forever, so the same period on the SAME weekday
 * was silently suppressed one week later. Date-scoping keeps the per-day
 * once-only behavior and lets the key expire naturally.
 */
export class CheckForPeriodEndUseCase implements CheckForPeriodEndPort {
  constructor(
    private readonly clock: ClockPort,
    private readonly settingsRepository: SettingsRepositoryPort,
    private readonly sound: SoundPort,
  ) {}

  async tick(): Promise<PeriodEndTickResult> {
    const settings = normalizeSettings(this.settingsRepository.load());
    const now = this.clock.now();
    const weekday = weekdayOf(this.clock.todayParts().weekday) as Weekday;
    const today = periodsFor(settings.weekSchedule, weekday);
    const dateKey = this.todayDateKey();
    const event = periodJustEnded(today, now.secondsOfDay, settings.lastNotifiedKey, dateKey);
    if (!event) return { justEnded: false, periodName: null };
    if (settings.soundEnabled && settings.notificationsEnabled) {
      await this.sound.playEndSound();
    }
    this.settingsRepository.save({ ...settings, lastNotifiedKey: event.notifyKey });
    return { justEnded: true, periodName: event.periodName };
  }

  /** Silences the JS fallback tone (the native alarm follows the volume buttons). */
  async stop(): Promise<void> {
    await this.sound.stopEndSound();
  }

  /** "YYYY-MM-DD" of today in local time — the per-day half of the dedupe key. */
  private todayDateKey(): string {
    const { year, month, day } = this.clock.todayParts();
    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    return `${year}-${mm}-${dd}`;
  }
}
