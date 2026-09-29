import { StyleSheet, Text, View, type View as RNView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import Svg, { Path, Circle as SCircle, Line } from "react-native-svg";
import { tokens, adaptiveColors, panelMaterial, shadow, type ThemeName } from "../design-system/tokens";
import { PressableScale } from "./PressableScale";

interface Props {
  todayLabel: string;
  hasWallpaper: boolean;
  accentHex: string;
  /** Current wallpaper blur (0-100) so the chip matches the slate. */
  wallpaperBlur: number;
  /** Ref to the wallpaper `BlurTargetView` so the gear button gets a real Android blur. */
  blurTarget?: React.RefObject<RNView | null> | null;
  /** Base look without a wallpaper; a wallpaper always renders glassy. */
  theme?: ThemeName;
  onOpenSettings: () => void;
}

export function Header({ todayLabel, hasWallpaper, accentHex, wallpaperBlur, blurTarget, theme = "light", onOpenSettings }: Props) {
  const adaptive = adaptiveColors(hasWallpaper, theme);
  const material = panelMaterial(hasWallpaper, theme);
  const useBlur = hasWallpaper && !!blurTarget;
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + tokens.spacing.lg }]}>
      <View>
        <Text style={[styles.title, { color: adaptive.primary }]}>Today</Text>
        <View
          style={[
            styles.dateChip,
            {
              backgroundColor: hasWallpaper ? "rgba(255,255,255,0.14)" : material.background,
              borderColor: hasWallpaper ? "rgba(255,255,255,0.28)" : material.borderColor,
            },
          ]}
        >
          <View style={[styles.dateDot, { backgroundColor: accentHex }]} />
          <Text style={[styles.date, { color: adaptive.secondary }]}>{todayLabel}</Text>
        </View>
      </View>
      <PressableScale
        onPress={onOpenSettings}
        haptic="selection"
        accessibilityRole="button"
        accessibilityLabel="Settings"
        style={[
          styles.gearBtn,
          {
            borderColor: useBlur ? "rgba(255,255,255,0.30)" : material.borderColor,
            backgroundColor: useBlur ? "transparent" : material.background,
          },
          useBlur ? styles.gearBlurClip : shadow(0),
        ]}
      >
        {useBlur ? (
          <BlurView
            intensity={Math.max(24, wallpaperBlur)}
            tint="light"
            blurTarget={blurTarget ?? undefined}
            blurMethod="dimezisBlurViewSdk31Plus"
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <Line x1="4" y1="6" x2="20" y2="6" stroke={adaptive.secondary} strokeWidth={2} strokeLinecap="round" />
          <SCircle cx="14" cy="6" r="2" stroke={adaptive.secondary} strokeWidth={2} />
          <Line x1="4" y1="12" x2="20" y2="12" stroke={adaptive.secondary} strokeWidth={2} strokeLinecap="round" />
          <SCircle cx="8" cy="12" r="2" stroke={adaptive.secondary} strokeWidth={2} />
          <Line x1="4" y1="18" x2="20" y2="18" stroke={adaptive.secondary} strokeWidth={2} strokeLinecap="round" />
          <SCircle cx="16" cy="18" r="2" stroke={adaptive.secondary} strokeWidth={2} />
        </Svg>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: tokens.spacing.xl,
    paddingBottom: tokens.spacing.sm,
  },
  title: {
    fontSize: tokens.text.display,
    fontWeight: "700",
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  dateChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: tokens.spacing.xs,
    borderRadius: tokens.radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 6,
  },
  dateDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  date: {
    fontSize: tokens.text.micro,
    fontWeight: "500",
    letterSpacing: 0.2,
  },
  gearBtn: {
    width: tokens.tap,
    height: tokens.tap,
    borderRadius: tokens.tap / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  gearBlurClip: { overflow: "hidden" },
});