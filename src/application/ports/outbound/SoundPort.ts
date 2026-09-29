export interface SoundPort {
  prepare(): Promise<void>;
  playEndSound(): Promise<void>;
  /** Silences a currently-ringing end-of-period alarm. */
  stopEndSound(): Promise<void>;
}