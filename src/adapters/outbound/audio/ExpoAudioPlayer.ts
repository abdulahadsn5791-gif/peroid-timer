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
 * There is one deliberate exception, and it exists because a native alarm is
 * delivered AS a notification: when the OS blocks notifications (Android 13+
 * POST_NOTIFICATIONS denied), notify() posts nothing at all, so the native
 * channel cannot make the sound either. Then, and only then, the bundled tone
 * plays in-app — the app is open, because a notification that was never
 * delivered is never something the user tapped. In every other case the native
 * alarm is the single source.
 */
export class ExpoAudioPlayer implements SoundPort {
  private customPlayer: ReturnType<typeof createAudioPlayer> | null = null;
  private customUri: string | null = null;
  private builtinPlayer: ReturnType<typeof createAudioPlayer> | null = null;

  /**
   * @param notificationsPermitted whether the OS would let us post a
   * notification right now. Required, so the wiring cannot be forgotten.
   */
  constructor(private readonly notificationsPermitted: () => Promise<boolean>) {
    // createAudioPlayer can throw on devices where the audio module failed to
    // initialize — this runs during app construction, and an unguarded throw
    // here would blank-screen the whole app on launch. The player is created
    // lazily on first use instead; a missing tone is recoverable, a dead app
    // is not.
    try {
      this.builtinPlayer = createAudioPlayer(BUILTIN_TONE);
      // Only the fallback loops, and only until it is stopped: the native alarm
      // is a one-shot notification whose sound dies with the notification.
      this.builtinPlayer.loop = true;
    } catch {
      this.builtinPlayer = null;
    }
  }

  /** Lazily-created built-in tone player; null when audio init failed. */
  private builtin(): ReturnType<typeof createAudioPlayer> | null {
    if (this.builtinPlayer == null) {
      try {
        this.builtinPlayer = createAudioPlayer(BUILTIN_TONE);
        this.builtinPlayer.loop = true;
      } catch {
        this.builtinPlayer = null;
      }
    }
    return this.builtinPlayer;
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
    // would double it and be the copy no stop button can reach. But it rings it
    // by posting a notification, so when the OS blocks notifications it is silent
    // — and a blocked notification never reached the shade either, so nobody has
    // stopped anything: this is the one case where the JS tone is the only sound
    // there can be.
    if (this.nativeAlarmAvailable() && (await this.notificationsPermitted())) return;
    const player = (this.customUri ? this.customPlayer : null) ?? this.builtin();
    if (!player) return; // audio init failed everywhere; stay silent rather than crash
    try {
      player.seekTo(0);
      player.play();
    } catch {
      // Sound is best-effort; fall back to the bundled tone, which is the one
      // that is guaranteed to be bundled with the app.
      const fallback = this.builtin();
      try {
        fallback?.seekTo(0);
        fallback?.play();
      } catch {
        // give up silently
      }
    }
  }

  async stopEndSound(): Promise<void> {
    for (const player of [this.customPlayer, this.builtin()]) {
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
