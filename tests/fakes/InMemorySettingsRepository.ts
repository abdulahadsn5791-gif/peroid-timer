import { normalizeSettings, type Settings } from "@domain/entities/Settings";
import type { SettingsRepositoryPort } from "@application/ports/outbound/SettingsRepositoryPort";

export class InMemorySettingsRepository implements SettingsRepositoryPort {
  private current: Settings;

  constructor(initial?: Settings) {
    this.current = normalizeSettings(initial);
  }

  load(): Settings {
    return normalizeSettings({ ...this.current });
  }

  save(settings: Settings): void {
    this.current = normalizeSettings(settings);
  }
}