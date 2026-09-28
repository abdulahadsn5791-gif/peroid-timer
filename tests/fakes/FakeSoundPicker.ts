import type { PickedSound, SoundPickerPort } from "@application/ports/outbound/SoundPickerPort";

export class FakeSoundPicker implements SoundPickerPort {
  result: PickedSound | null = null;
  calls = 0;

  constructor(result: PickedSound | null = null) {
    this.result = result;
  }

  async pickSound(): Promise<PickedSound | null> {
    this.calls++;
    return this.result;
  }
}
