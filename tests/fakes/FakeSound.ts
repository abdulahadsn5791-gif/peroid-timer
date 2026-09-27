import type { SoundPort } from "@application/ports/outbound/SoundPort";

export class FakeSound implements SoundPort {
  prepareCount = 0;
  playCount = 0;

  async prepare(): Promise<void> {
    this.prepareCount++;
  }

  async playEndSound(): Promise<void> {
    this.playCount++;
  }
}