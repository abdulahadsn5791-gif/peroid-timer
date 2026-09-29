import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import { NativeModules } from "react-native";
import type { SoundPort } from "@application/ports/outbound/SoundPort";

const BUILTIN_TONE = require("../../../../assets/period-end.wav");

/**
 * End-of-period alarm sound. Plays the user's chosen ringtone
 * (settings.alarmSoundUri) and falls back to the bundled three-beat tone
 * (assets/period-end.wav) when no custom sound is set or it fails to load.
 */
export class ExpoAudioPlayer implements SoundPort {
  private readonly builtinPlayer = createAudioPlayer(BUILTIN_TONE);
  private customPlayer: ReturnType<typeof createAudioPlayer> | null = null;
  private customUri: string | null = null;

  async prepare(): Promise<void> {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "duckOthers",
    });
  }

  /** Swaps the custom ringtone at runtime (called on settings changes). */
  setCustomSource(uri: string | null): void {
    if (uri === this.customUri) return;
    this.customUri = uri;
    try {
      this.customPlayer?.release();
    } catch {
      // player already released
    }
    this.customPlayer = null;
    if (uri) {
      try {
        this.customPlayer = createAudioPlayer({ uri });
      } catch {
        this.customPlayer = null;
      }
    }
  }

  async playEndSound(): Promise<void> {
    const player = this.customUri ? this.customPlayer : this.builtinPlayer;
    if (!player) return;
    try {
      player.seekTo(0);
      player.play();
    } catch {
      // Sound is best-effort; the native alert notification carries its own tone.
      try {
        this.builtinPlayer.seekTo(0);
        this.builtinPlayer.play();
      } catch {
        // give up silently
      }
    }
  }

  async stopEndSound(): Promise<void> {
    for (const player of [this.customPlayer, this.builtinPlayer]) {
      if (!player) continue;
      try {
        player.pause();
        player.seekTo(0);
      } catch {
        // player already released
      }
    }
    // The loud background alarm lives natively; ask it to stop as well.
    try {
      NativeModules.PeriodTimerScheduler?.stopAlarm();
    } catch {
      // native module unavailable (iOS / not prebuilt) — nothing else to stop
    }
  }

  async consumeStopSignal(): Promise<boolean> {
    // A stop pressed on the notification only reaches the native alarm, so the
    // native side records it for us to pick up here.
    try {
      return (NativeModules.PeriodTimerScheduler?.consumeAlarmStopSignal?.() ?? 0) > 0;
    } catch {
      return false;
    }
  }
}
