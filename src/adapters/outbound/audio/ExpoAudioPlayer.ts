import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import type { SoundPort } from "@application/ports/outbound/SoundPort";

/**
 * End-of-period alert sound (a bundled three-beat tone, assets/period-end.wav).
 */
export class ExpoAudioPlayer implements SoundPort {
  private readonly player = createAudioPlayer(require("../../../../assets/period-end.wav"));

  async prepare(): Promise<void> {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "duckOthers",
    });
  }

  async playEndSound(): Promise<void> {
    try {
      this.player.seekTo(0);
      this.player.play();
    } catch {
      // Sound is best-effort; the full-screen alert carries its own tone.
    }
  }
}