import { useEffect, useMemo, useRef } from "react";
import { Image, StyleSheet, Text, View, useWindowDimensions, type View as RNView } from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { BlurTargetView, BlurView } from "expo-blur";
import { tokens, adaptiveColors, panelMaterial } from "../design-system/tokens";
import { Header } from "../components/Header";
import { Ring, ringSizeFor } from "../components/Ring";
import { DigitalClock } from "../components/DigitalClock";
import { ScheduleList } from "../components/ScheduleList";
import { SettingsFlow } from "../components/settings/SettingsFlow";
import { FlashLayer } from "../components/FlashLayer";
import { useHomeViewModel, useSettingsDraft, useSettingsOpenState } from "../hooks/useViewModel";
import type { AppDeps } from "../ports";

export function HomeScreen({ deps }: { deps: AppDeps }) {
  const { width, height } = useWindowDimensions();
  const isWide = width >= 768;
  const { isOpen, openSheet, closeSheet } = useSettingsOpenState();
  const { view, flash } = useHomeViewModel(deps);
  const draft = useSettingsDraft(deps);

  /**
   * The wallpaper-only target keeps the frosted chips over the photo cheap
   * and scoped; the scene-wide target wraps the home content. Settings is a
   * fully opaque page and samples neither.
   */
  const wallpaperBlur = useRef<RNView | null>(null);
  const sceneBlur = useRef<RNView | null>(null);

  const sheetOpen = isOpen && !!draft;

  // The user-scaled ring: ringSizeFor gives the layout default, the scale
  // (60–130%) is the Settings slider value. Kept in the same useMemo so the
  // drag updates exactly like the blur slider does.
  const ringSize = useMemo(
    () => Math.round(ringSizeFor(isWide ? width * 0.5 : width, height) * (view.ringSizeScale / 100)),
    [width, height, isWide, view.ringSizeScale],
  );

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const zoom = useAnimatedStyle(() => {
    const progress = interpolate(scrollY.value, [0, Math.max(1, ringSize * 1.1)], [0, 1], "clamp");
    return {
      transform: [{ scale: 1 - 0.4 * progress }],
      opacity: 1 - 0.35 * progress,
    };
  });

  const open = () => {
    deps.openSettings();
    openSheet();
  };
  const dismiss = () => closeSheet();

  return (
    <SafeAreaView
      style={[
        styles.screen,
        {
          // Background precedence: wallpaper photo > user-picked flat color
          // (no-wallpaper mode only) > theme default (white/black). The old
          // code ignored the user's color choice entirely.
          backgroundColor: view.hasWallpaper
            ? "#000"
            : view.homeBgColor ?? (view.theme === "dark" ? "#000000" : tokens.color.surface1),
        },
      ]}
    >
      <StatusBar hidden style={view.hasWallpaper || view.theme === "dark" ? "light" : "dark"} />

      <BlurTargetView ref={sceneBlur} style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {view.hasWallpaper && view.wallpaperUri ? (
          <>
            <BlurTargetView ref={wallpaperBlur} style={StyleSheet.absoluteFill} pointerEvents="none">
              <Image source={{ uri: view.wallpaperUri }} style={styles.wallpaper} resizeMode="cover" />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.28)" }]} />
            </BlurTargetView>
            {view.wallpaperBlur > 0 ? (
              <BlurView
                blurTarget={wallpaperBlur}
                intensity={view.wallpaperBlur}
                tint="dark"
                blurMethod="dimezisBlurViewSdk31Plus"
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
            ) : null}
          </>
        ) : null}

        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Header todayLabel={view.todayLabel} hasWallpaper={view.hasWallpaper} accentHex={view.accentHex} wallpaperBlur={view.wallpaperBlur} blurTarget={wallpaperBlur} theme={view.theme} onOpenSettings={open} />

          <View style={isWide ? styles.widePane : styles.narrowPane}>
            <Animated.View style={[styles.ringSlot, zoom, isWide && styles.wideRingSlot]}>
              {view.clockStyle === "digital" ? (
                <DigitalClock
                  vm={view.ring}
                  width={isWide ? Math.min(width * 0.45, 480) : width - tokens.spacing.xl * 2}
                  hasWallpaper={view.hasWallpaper}
                  theme={view.theme}
                />
              ) : (
                <Ring vm={view.ring} size={ringSize} hasWallpaper={view.hasWallpaper} colorActiveBars={view.colorActiveBars} theme={view.theme} />
              )}
            </Animated.View>
            {isWide && view.showScheduleList ? (
              <View style={{ flex: 1, paddingTop: 8 }}>
                <ScheduleList rows={view.rows} accentHex={view.accentHex} hasWallpaper={view.hasWallpaper} wallpaperBlur={view.wallpaperBlur} blurTarget={wallpaperBlur} theme={view.theme} />
              </View>
            ) : null}
          </View>

          {!isWide && view.showScheduleList ? (
            <View style={styles.narrowListWrap}>
              {view.isEmptyDay ? (
                <View
                  style={[
                    styles.emptyDayCard,
                    panelMaterial(view.hasWallpaper, view.theme),
                    { borderWidth: StyleSheet.hairlineWidth },
                  ]}
                >
                  <Text
                    style={[
                      styles.emptyDayTitle,
                      { color: adaptiveColors(view.hasWallpaper, view.theme).primary },
                    ]}
                  >
                    No lectures today
                  </Text>
                  <Text
                    style={[
                      styles.emptyDaySub,
                      { color: adaptiveColors(view.hasWallpaper, view.theme).secondary },
                    ]}
                  >
                    This weekday's preset is empty — alarms and notifications are off. Add periods in
                    Settings to schedule this day.
                  </Text>
                </View>
              ) : (
                <ScheduleList rows={view.rows} accentHex={view.accentHex} hasWallpaper={view.hasWallpaper} wallpaperBlur={view.wallpaperBlur} blurTarget={wallpaperBlur} theme={view.theme} />
              )}
            </View>
          ) : null}
        </Animated.ScrollView>

      </BlurTargetView>

      <FlashLayer
        active={flash.key > 0 && flash.periodName !== null}
        periodName={flash.periodName}
        flashKey={flash.key}
        tint={view.ring.ringHex}
      />

      {/* Full-screen opaque settings — no blur, so it never interacts with
          the scene's BlurTargetView. */}
      {sheetOpen && draft ? (
        <SettingsFlow draft={draft} deps={deps} onDismiss={dismiss} isWide={isWide} />
      ) : null}
    </SafeAreaView>
  );
}

const SKELETON_ROW_H = 54;

function SkeletonPulse({ children }: { children: React.ReactNode }) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = 1;
    opacity.value = withRepeat(withTiming(0.45, { duration: 820, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => {
      opacity.value = 1;
    };
  }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

function SkeletonBar({ width, height, radius, color }: { width: number | `${number}%`; height: number; radius?: number; color?: string }) {
  return (
    <View
      style={{
        width,
        height,
        borderRadius: radius ?? tokens.radius.sm,
        backgroundColor: color ?? "rgba(0,0,0,0.08)",
      }}
    />
  );
}

/** Full-screen skeleton that mirrors the home layout while the app boots. */
export function AppLoading() {
  const { width } = useWindowDimensions();
  const ringSize = ringSizeFor(width, 812);
  const skeletonRows = Array.from({ length: 5 }, (_, i) => i);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: tokens.color.surface1 }]}>
      <View style={styles.loadHeader}>
        <View style={styles.loadHeaderLeft}>
          <SkeletonBar width={92} height={26} radius={tokens.radius.md} />
          <View style={styles.loadChip}>
            <View style={styles.loadDot} />
            <SkeletonBar width={120} height={10} radius={tokens.radius.sm} color="rgba(0,0,0,0.06)" />
          </View>
        </View>
        <View style={styles.loadGear} />
      </View>

      <SkeletonPulse>
        <View style={styles.loadRingWrap}>
          <View style={[styles.loadRing, { width: ringSize, height: ringSize, borderRadius: ringSize / 2 }]}>
            <View style={[styles.loadHub, { width: ringSize * 0.3, height: ringSize * 0.3, borderRadius: (ringSize * 0.3) / 2 }]} />
          </View>
        </View>
        <View style={styles.loadList}>
          {skeletonRows.map((i) => (
            <View key={i} style={styles.loadCard}>
              <View style={styles.loadLed} />
              <View style={styles.loadCardBody}>
                <SkeletonBar width="55%" height={12} radius={tokens.radius.sm} />
                <SkeletonBar width="32%" height={9} radius={tokens.radius.sm} color="rgba(0,0,0,0.06)" />
              </View>
              <SkeletonBar width={34} height={34} radius={tokens.radius.md} />
            </View>
          ))}
        </View>
      </SkeletonPulse>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  emptyDayCard: {
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.xl,
    alignItems: "center",
    gap: 6,
  },
  emptyDayTitle: {
    fontSize: tokens.text.body,
    fontWeight: "600",
    color: tokens.color.text.secondary,
  },
  emptyDaySub: {
    fontSize: tokens.text.micro,
    color: tokens.color.text.tertiary,
    textAlign: "center",
  },
  loadHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: tokens.spacing.xl,
    paddingTop: tokens.spacing.lg + tokens.spacing.md,
    paddingBottom: tokens.spacing.sm,
  },
  loadHeaderLeft: { gap: tokens.spacing.xs },
  loadChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.color.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.hairlineStrong,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  loadDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: tokens.color.accent },
  loadGear: {
    width: tokens.tap,
    height: tokens.tap,
    borderRadius: tokens.tap / 2,
    backgroundColor: tokens.color.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.hairline,
  },
  loadRingWrap: { alignItems: "center", paddingTop: tokens.spacing.lg, paddingHorizontal: tokens.spacing.lg },
  loadRing: {
    borderWidth: tokens.radius.sm / 2,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: tokens.color.surface1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadHub: { backgroundColor: "rgba(0,0,0,0.06)" },
  loadList: { paddingHorizontal: tokens.spacing.lg, marginTop: tokens.spacing.xl, gap: tokens.spacing.md, paddingBottom: tokens.spacing.xxl },
  loadCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.md,
    minHeight: SKELETON_ROW_H,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.hairline,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  loadLed: { width: 10, height: 10, borderRadius: 5, backgroundColor: "rgba(0,0,0,0.10)" },
  loadCardBody: { flex: 1, gap: 6 },
  wallpaper: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  scrollContent: { paddingBottom: tokens.spacing.xxl },
  narrowPane: {
    alignItems: "center",
    paddingTop: tokens.spacing.lg,
  },
  widePane: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: tokens.spacing.xl,
    paddingHorizontal: tokens.spacing.xl,
    paddingTop: tokens.spacing.lg,
  },
  ringSlot: { paddingHorizontal: tokens.spacing.lg },
  wideRingSlot: { flex: 1, alignItems: "center", paddingLeft: 0, paddingRight: 0 },
  narrowListWrap: {
    paddingHorizontal: tokens.spacing.lg,
    marginTop: tokens.spacing.xl,
  },
});
