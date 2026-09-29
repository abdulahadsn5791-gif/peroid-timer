export interface SoundPort {
  prepare(): Promise<void>;
  playEndSound(): Promise<void>;
  /** Silences a currently-ringing end-of-period alarm. */
  stopEndSound(): Promise<void>;
  /**
   * True when "Stop alarm" was pressed on the notification since this was last
   * called. The notification action can only cancel the native alarm, never the
   * JS player, so the native side leaves a signal that JS consumes here to
   * silence its own tone. Consuming clears it.
   */
  consumeStopSignal(): Promise<boolean>;
}