import { createMMKV, type MMKV } from "react-native-mmkv";
import { normalizeSettings, type Settings } from "@domain/entities/Settings";
import type { SettingsRepositoryPort } from "@application/ports/outbound/SettingsRepositoryPort";

const SETTINGS_KEY = "period-timer.settings.v1";

/**
 * MMKV-backed settings store (synchronous, fast). Storage is an adapter; all
 * schema/semantics live in the domain Settings entity.
 *
 * MMKV v4 is a Nitro module: it needs the native NitroModules binary, which
 * only exists in a real Android/iOS build (dev build, not Expo Go / web). When
 * the native module is missing we fall back to an in-memory store so the app
 * still boots during preview; usage degrades, storage is not persisted.
 */
export class MmkvSettingsRepository implements SettingsRepositoryPort {
  private readonly store: MMKV | null;
  private readonly memory = new Map<string, string>();

  constructor() {
    try {
      this.store = createMMKV({ id: "period-timer-settings" });
    } catch {
      this.store = null;
      console.warn("MMKV (Nitro module) unavailable — using in-memory settings storage.");
    }
  }

  private get(key: string): string | null {
    if (this.store) {
      try {
        return this.store.getString(key) ?? null;
      } catch {
        return this.memory.get(key) ?? null;
      }
    }
    return this.memory.get(key) ?? null;
  }

  private set(key: string, value: string): void {
    this.memory.set(key, value);
    if (this.store) {
      try {
        this.store.set(key, value);
      } catch {
        // persist to memory only; native write failed
      }
    }
  }

  load(): Settings {
    const raw = this.get(SETTINGS_KEY);
    if (!raw) return normalizeSettings(null);
    try {
      return normalizeSettings(JSON.parse(raw));
    } catch {
      return normalizeSettings(null);
    }
  }

  save(settings: Settings): void {
    this.set(SETTINGS_KEY, JSON.stringify(normalizeSettings(settings)));
  }
}