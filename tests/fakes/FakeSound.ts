import type { SoundPort } from "@application/ports/outbound/SoundPort";

export class FakeSound implements SoundPort {
  prepareCount = 0;
  /**
   * Kept so tests can assert the use case never plays a tone itself: the
   * end-of-period sound belongs to the native alarm channel.
   */
  playCount = 0;
  stopCount = 0;

  async prepare(): Promise<void> {
    this.prepareCount++;
  }

  async playEndSound(): Promise<void> {
    this.playCount++;
  }

  async stopEndSound(): Promise<void> {
    this.stopCount++;
  }
}
