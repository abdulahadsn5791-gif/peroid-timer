import { normalizeSettings } from "@domain/entities/Settings";
import type { ApplyBackgroundPlanPort } from "@application/ports/inbound/BackgroundPorts";
import type { SettingsRepositoryPort } from "@application/ports/outbound/SettingsRepositoryPort";
import type { SoundPort } from "@application/ports/outbound/SoundPort";
import type { BackgroundPlanner } from "@application/state/BackgroundPlanner";

/**
 * Rewrites the snapshot + alarms on boot / once each morning. Also prepares
 * the sound so the first end-of-period alert plays without loading latency.
 */
export class ApplyBackgroundPlanUseCase implements ApplyBackgroundPlanPort {
  constructor(
    private readonly settingsRepository: SettingsRepositoryPort,
    private readonly planner: BackgroundPlanner,
    private readonly sound: SoundPort,
  ) {}

  async run(): Promise<void> {
    const settings = normalizeSettings(this.settingsRepository.load());
    await this.planner.apply(settings);
    await this.sound.prepare();
  }
}