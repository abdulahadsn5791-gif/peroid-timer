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