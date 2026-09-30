import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import { NativeModules } from "react-native";
import type { SoundPort } from "@application/ports/outbound/SoundPort";

const BUILTIN_TONE = require("../../../../assets/period-end.wav");

/**
 * End-of-period alarm control.
 *
 * In a real build the sound is owned by the NATIVE alarm end to end: the exact
 * alarm and the foreground service both watch for a period end, post a heads-up
 * on the `period-timer-alarm` channel (USAGE_ALARM, so it follows the alarm
 * volume) and stop when that notification is cancelled. That single source is
 * what makes "Stop alarm" work from both the notification and the in-app toast —
 * a second, JS-only copy is unreachable from the notification shade, so it kept
 * ringing after the user had stopped the alarm.
 *
 * The bundled three-beat tone (assets/period-end.wav) is therefore only a
 * fallback for builds without the native scheduler (Expo Go, web, iOS, a dev
 * client built before `expo prebuild`), where nothing else would make a sound.
 */
export class ExpoAudioPlayer implements SoundPort {
  private readonly builtinPlayer = createAudioPlayer(BUILTIN_TONE);
  private customPlayer: ReturnType<typeof createAudioPlayer> | null = null;
  private customUri: string | null = null;

  constructor() {
    // No ringtone is wanted in a real build — that is the native alarm's job —
    // so only the fallback loops, until it is stopped.
    this.builtinPlayer.loop = true;
  }

  async prepare(): Promise<void> {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "duckOthers",
    });
  }

  /** Swaps the fallback ringtone at runtime (called on settings changes). */
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
        this.customPlayer.loop = true;
      } catch {
        this.customPlayer = null;
      }
    }
  }

  async playEndSound(): Promise<void> {
    // The native alarm already rings this same period end; a JS tone on top
    // would double it and be the copy no stop button can reach.
    if (this.nativeAlarmAvailable()) return;
    const player = (this.customUri ? this.customPlayer : null) ?? this.builtinPlayer;
    try {
      player.seekTo(0);
      player.play();
    } catch {
      // Sound is best-effort; fall back to the bundled tone, which is the one
      // that is guaranteed to be bundled with the app.
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
    // The loud alarm lives natively; cancelling its notification is the stop.
    try {
      NativeModules.PeriodTimerScheduler?.stopAlarm();
    } catch {
      // native module unavailable (iOS / not prebuilt) — nothing else to stop
    }
  }

  async consumeStopSignal(): Promise<boolean> {
    // A stop pressed on the notification reaches the native alarm directly; the
    // signal is here so the in-app toast can drop itself too, even though the
    // alarm itself is already silent by then.
    try {
      return (NativeModules.PeriodTimerScheduler?.consumeAlarmStopSignal?.() ?? 0) > 0;
    } catch {
      return false;
    }
  }

  private nativeAlarmAvailable(): boolean {
    return NativeModules.PeriodTimerScheduler != null;
  }
}
