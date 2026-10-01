import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { tokens, adaptiveColors, type ThemeName } from "../design-system/tokens";
import { hexToRgba } from "../utils/color";
import type { RingViewModel } from "@application/ports/view-models/ViewModels";

interface Props {
  vm: RingViewModel;
  /** Width available for the block (drives the type scale). */
  width: number;
  hasWallpaper: boolean;
  theme?: ThemeName;
}

/**
 * The "digital" home timer: the same data the ring shows, drawn as type.
 * A thin phase-colored bar carries the elapsed progress, so the glance value
 * of the ring survives in a purely typographic form. Everything scales from
 * the available width, mirroring Ring.tsx's size-driven scaling.
 */
export function DigitalClock({ vm, width, hasWallpaper, theme = "light" }: Props) {
  const adaptive = adaptiveColors(hasWallpaper, theme);
  const timeSize = width * 0.22;
  const labelSize = width * 0.055;
  const metaSize = width * 0.042;

  const progress = useSharedValue(vm.progressElapsed);

  useEffect(() => {
    progress.value = withTiming(Math.min(1, Math.max(0, vm.progressElapsed)), {
      duration: 800,
      easing: Easing.bezier(0.32, 0.72, 0, 1),
    });
  }, [progress, vm.progressElapsed]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${Math.min(100, Math.max(0, progress.value * 100))}%`,
    opacity: progress.value > 0.001 ? 1 : 0,
  }));

  const chipBg = hexToRgba(vm.ringHex, hasWallpaper ? 0.28 : 0.1);

  return (
    <View style={[styles.wrap, { width: "100%", maxWidth: width }]}>
      {vm.periodName ? (
        <View style={[styles.chip, { backgroundColor: chipBg, maxWidth: width * 0.8 }]}>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            style={{ color: adaptive.primary, fontSize: labelSize, fontWeight: "600", letterSpacing: 0.8 }}
          >
            {vm.periodName}
          </Text>
        </View>
      ) : null}
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
        style={{
          color: vm.clockHex ?? adaptive.primary,
          fontSize: timeSize,
          fontWeight: "200",
          fontVariant: ["tabular-nums"],
          letterSpacing: -2,
          marginTop: 6,
        }}
      >
        {vm.timeText}
      </Text>
      <View style={[styles.statusRow, { marginTop: 6 }]}>
        <View style={[styles.dot, { backgroundColor: vm.ringHex }]} />
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={{ color: adaptive.secondary, fontSize: labelSize * 0.92 }}
        >
          {vm.statusText}
        </Text>
      </View>
      {(vm.teacher || vm.room) && vm.indicator === "active" ? (
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.65}
          style={{ color: adaptive.secondary, fontSize: metaSize, marginTop: 4, fontWeight: "500" }}
        >
          {[vm.teacher, vm.room].filter(Boolean).join(" · ")}
        </Text>
      ) : vm.nextName && vm.indicator === "between" && (vm.nextTeacher || vm.nextRoom) ? (
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.65}
          style={{ color: adaptive.secondary, fontSize: metaSize, marginTop: 4, fontWeight: "500" }}
        >
          {`${vm.nextName} · ${[vm.nextTeacher, vm.room].filter(Boolean).join(" · ")}`}
        </Text>
      ) : null}
      {vm.indicator !== "idle" ? (
        <View style={[styles.barTrack, { marginTop: 14 }]}>
          <Animated.View style={[styles.barFill, { backgroundColor: vm.ringHex }, barStyle]} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", alignSelf: "center" },
  chip: {
    flexDirection: "row",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.30)",
    borderRadius: tokens.radius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
    maxWidth: "100%",
  },
  statusRow: { flexDirection: "row", alignItems: "center", alignSelf: "center" },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  barTrack: {
    alignSelf: "stretch",
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.08)",
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 2 },
});
