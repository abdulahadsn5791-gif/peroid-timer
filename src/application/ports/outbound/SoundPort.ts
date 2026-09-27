export interface SoundPort {
  prepare(): Promise<void>;
  playEndSound(): Promise<void>;
}