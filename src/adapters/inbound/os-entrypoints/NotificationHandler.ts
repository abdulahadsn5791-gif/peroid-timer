import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/**
 * OS entry point for notification taps. When the user taps the ongoing
 * lock-screen notification (or any alert) the app surfaces to the foreground
 * and simply re-renders the live home view — there is no navigation state to
 * replay, so the handler only needs to trigger a refresh.
 */
export function registerNotificationResponseHandler(onResponse: () => void): void {
  Notifications.addNotificationResponseReceivedListener(() => onResponse());
}

export async function configureNotificationChannels(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("period-timer", {
    name: "Period timer",
    importance: Notifications.AndroidImportance.HIGH,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    vibrationPattern: [0, 250, 250, 250],
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/**
 * Whether the OS would actually let us post a notification right now.
 *
 * Android 13+ makes POST_NOTIFICATIONS a runtime permission, and a denied one
 * turns every notify() into a silent no-op. Since the native alarm channel is
 * where the alarm sound lives, that would mean a completely silent alarm, so the
 * audio adapter asks this before deciding the native alarm is the only sound.
 *
 * Not cached: the user can grant or revoke it between two period ends, and it is
 * only ever read on the one path where the answer changes what gets played.
 */
export async function notificationsPermitted(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  return current.granted;
}