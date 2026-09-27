import type { ImagePickerPort, PickedImage } from "@application/ports/outbound/ImagePickerPort";

export class FakeImagePicker implements ImagePickerPort {
  result: PickedImage | null = null;
  calls = 0;

  constructor(result: PickedImage | null = null) {
    this.result = result;
  }

  async pickImage(): Promise<PickedImage | null> {
    this.calls++;
    return this.result;
  }
}