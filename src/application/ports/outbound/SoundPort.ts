export interface SoundPort {
  prepare(): Promise<void>;
  /**
   * Rings the end-of-period alarm. The native alarm channel owns the sound in a
   * real build, so this is only used by builds without the native scheduler
   * (Expo Go, web, iOS) — where it is the only thing that would make a sound.
   * The user silences the tone with the volume buttons (ALARM stream).
   */
  playEndSound(): Promise<void>;
  /** Silences the JS fallback player (no native stop signal anymore). */
  stopEndSound(): Promise<void>;
}
