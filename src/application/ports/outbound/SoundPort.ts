export interface SoundPort {
  prepare(): Promise<void>;
  /**
   * Rings the end-of-period alarm. The native alarm channel owns the sound in a
   * real build, so this is only used by builds without the native scheduler
   * (Expo Go, web, iOS) — where it is the only thing that would make a sound.
   */
  playEndSound(): Promise<void>;
  /** Silences a currently-ringing end-of-period alarm. */
  stopEndSound(): Promise<void>;
  /**
   * True when "Stop alarm" was pressed on the notification since this was last
   * called, so the UI can drop its end-of-period toast. Consuming clears it.
   * The alarm itself is already silent by then — the notification action cancels
   * the ringing notification directly, which is what stops the sound.
   */
  consumeStopSignal(): Promise<boolean>;
}
