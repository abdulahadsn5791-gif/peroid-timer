export interface PickedSound {
  uri: string;
  name: string;
}

/**
 * Chooses the custom alarm ringtone. Returns null when cancelled/unavailable;
 * the implementation is expected to persist a stable copy of the file and
 * hand back its URI.
 */
export interface SoundPickerPort {
  pickSound(): Promise<PickedSound | null>;
}
