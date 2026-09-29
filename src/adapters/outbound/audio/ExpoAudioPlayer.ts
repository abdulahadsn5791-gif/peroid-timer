import { setAudioModeAsync } from "expo-audio";
import { NativeModules } from "react-native";
import type { SoundPort } from "@application/ports/outbound/SoundPort";

/**
 * End-of-period alarm control.
 *
 * The tone itself is NOT played from here. It belongs to the native alarm
 * notification channel (`EndAlertNotifier`), which plays on the alarm stream and
 * still rings when the app process is dead. Playing a JS copy as well produced
 * two overlapping tones, and only the native one could be stopped from the
 * notification's "Stop alarm" action — the JS tone kept ringing with no way to
 * silence it. This port therefore only stops the alarm.
 */
export class ExpoAudioPlayer implements SoundPort {
  async prepare(): Promise<void> {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "duckOthers",
    });
  }

  async stopEndSound(): Promise<void> {
    // The loud background alarm lives natively; ask it to stop as well.
    try {
      NativeModules.PeriodTimerScheduler?.stopAlarm();
    } catch {
      // native module unavailable (iOS / not prebuilt) — nothing else to stop
    }
  }
}
