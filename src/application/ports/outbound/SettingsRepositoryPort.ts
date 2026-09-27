import type { Settings } from "@domain/entities/Settings";

export interface SettingsRepositoryPort {
  load(): Settings;
  save(settings: Settings): void;
}