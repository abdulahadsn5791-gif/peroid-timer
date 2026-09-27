import { useEffect, useMemo, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationBar } from "expo-navigation-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { createApp } from "./src/composition-root";
import { HomeScreen, AppLoading } from "./src/adapters/inbound/ui/screens/HomeScreen";
import type { AppDeps } from "./src/adapters/inbound/ui/ports";

/**
 * Boots the composition root once, then mounts the single home screen. All the
 * real work happens through AppDeps ports; App.tsx holds no logic. System bars
 * (status + Android navigation) are hidden so the timer is fully immersive.
 */
export default function App() {
  const deps: AppDeps = useMemo(() => createApp(), []);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void deps
      .runBootstrap()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((err) => {
        console.error("Bootstrap failed", err);
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [deps]);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" hidden />
      <NavigationBar hidden />
      {ready ? <HomeScreen deps={deps} /> : <AppLoading />}
    </SafeAreaProvider>
  );
}
