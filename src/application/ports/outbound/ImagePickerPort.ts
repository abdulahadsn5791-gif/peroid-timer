export interface PickedImage {
  uri: string;
  width: number;
  height: number;
}

export interface ImagePickerPort {
  pickImage(): Promise<PickedImage | null>;
}