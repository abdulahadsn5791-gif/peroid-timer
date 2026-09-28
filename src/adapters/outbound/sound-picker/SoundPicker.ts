import type { SoundPickerPort } from "@application/ports/outbound/SoundPickerPort";

export interface PickedSound {
  uri: string;
  name: string;
}

/**
 * Picks an alarm ringtone via the system document picker (audio MIME) and
 * copies it into the app's documents directory under a versioned name so the
 * URI survives across sessions and cache clears. Returns null when the user
 * cancels or the copy fails.
 */
export class DocumentPickerSoundPicker implements SoundPickerPort {
  async pickSound(): Promise<PickedSound | null> {
    const { getDocumentAsync } = await import("expo-document-picker");
    const { File, Paths } = await import("expo-file-system");
    try {
      const result = await getDocumentAsync({
        type: "audio/*",
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.length) return null;
      const asset = result.assets[0];
      const stamp = Date.now();
      const safeName = (asset.name ?? "ringtone").replace(/[^\w.\- ]+/g, "_").slice(0, 60);
      const destination = new File(Paths.document, `alarm-${stamp}-${safeName}`);
      await new File(asset.uri).copy(destination);
      return destination.exists ? { uri: destination.uri, name: safeName } : null;
    } catch {
      return null;
    }
  }
}
