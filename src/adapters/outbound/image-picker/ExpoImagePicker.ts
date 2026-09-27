import * as ImagePicker from "expo-image-picker";
import type {
  ImagePickerPort,
  PickedImage,
} from "@application/ports/outbound/ImagePickerPort";

export class ExpoImagePicker implements ImagePickerPort {
  async pickImage(): Promise<PickedImage | null> {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return null;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.82,
      allowsEditing: false,
    });
    if (result.canceled || result.assets.length === 0) return null;
    const asset = result.assets[0];
    return { uri: asset.uri, width: asset.width, height: asset.height };
  }
}