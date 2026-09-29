import { useEffect, useMemo } from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import Svg, { Circle, Line } from "react-native-svg";
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from "react-native-reanimated";
import { tokens, adaptiveColors, type ThemeName } from "../design-system/tokens";
import { hexToRgba } from "../utils/color";
import type { RingViewModel } from "@application/ports/view-models/ViewModels";

const RING_CIRCUMFERENCE = 2 * Math.PI * 92;
const TIP_RADIUS = 92;
const TICK_ARC_RADIUS = 82;
const EASING = Easing.bezier(0.32, 0.72, 0, 1);

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  vm: RingViewModel;
  size: number;
  hasWallpaper: boolean;
  /** Color the tick bars that span the elapsed portion (dynamic bars). */
  colorActiveBars: boolean;
  /** Base look without a wallpaper; a wallpaper always renders glassy. */
  theme?: ThemeName;
  style?: ViewStyle;
}

/**
 * Watch-face ring: 60 minute ticks with stronger marks every five minutes, a
 * soft progress band that animates smoothly on the UI thread, a tip dot that
 * rides the arc end, and a centered stack of period-name chip, live clock and
 * status line. Flat fills only — all depth comes from layering and tint.
 */
export function Ring({ vm, size, hasWallpaper, colorActiveBars, theme = "light", style }: Props) {
  const adaptive = adaptiveColors(hasWallpaper, theme);
  // On a photo the blur hides stroke weight, so the band can stay bold; on a
  // flat canvas the same weight reads bulky — slim it down there.
  const bandStroke = hasWallpaper ? 8 : 6;
  const tickStroke = hasWallpaper ? 1.8 : 1.4;
  const tickMajorStroke = hasWallpaper ? 3 : 2.2;
  const chipFont = size * 0.05;
  const timeSize = vm.showHours ? size * 0.15 : size * 0.21;
  const statusSize = size * 0.046;

  const progress = useSharedValue(vm.progressElapsed);

  useEffect(() => {
    progress.value = withTiming(Math.min(1, Math.max(0, vm.progressElapsed)), { duration: 800, easing: EASING });
  }, [progress, vm.progressElapsed]);

  const arcProps = useAnimatedProps(() => {
    const p = Math.min(1, Math.max(0, progress.value));
    return {
      strokeDashoffset: RING_CIRCUMFERENCE * (1 - p),
      opacity: p > 0.001 ? 1 : 0,
    };
  });

  const tipProps = useAnimatedProps(() => {
    const p = Math.min(1, Math.max(0, progress.value));
    const rad = p * Math.PI * 2;
    return {
      cx: 100 + TIP_RADIUS * Math.cos(rad),
      cy: 100 + TIP_RADIUS * Math.sin(rad),
      opacity: p > 0.001 ? 1 : 0,
    };
  });

  const ticks = useMemo(() => {
    const els = [];
    const activeCount = colorActiveBars
      ? Math.max(0, Math.min(60, Math.round(vm.progressElapsed * 60)))
      : 0;
    for (let i = 0; i < 60; i++) {
      const a = (i * 6 * Math.PI) / 180;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      const major = i % 5 === 0;
      const inner = major ? 72.5 : 77;
      const active = i < activeCount;
      els.push(
        <Line
          key={i}
          x1={100 + TICK_ARC_RADIUS * cos}
          y1={100 + TICK_ARC_RADIUS * sin}
          x2={100 + inner * cos}
          y2={100 + inner * sin}
          stroke={active ? vm.ringHex : major ? adaptive.ringTickStrong : adaptive.ringTick}
          strokeWidth={major ? tickMajorStroke : tickStroke}
          strokeLinecap="round"
          opacity={active ? 1 : 0.85}
        />,
      );
    }
    return els;
  }, [adaptive.ringTick, adaptive.ringTickStrong, vm.ringHex, colorActiveBars, vm.progressElapsed]);

  const chipBg = hexToRgba(vm.ringHex, hasWallpaper ? 0.28 : 0.1);
  const chipBorder = hasWallpaper ? "rgba(255,255,255,0.30)" : tokens.color.hairlineStrong;

  return (
    <View style={[{ width: size, height: size, alignSelf: "center" }, style]}>
      <Svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        style={{ position: "absolute", top: 0, left: 0, transform: [{ rotate: "-90deg" }] }}
      >
        <Circle cx={100} cy={100} r={92} fill="none" stroke={adaptive.ringTrack} strokeWidth={bandStroke} />
        {ticks}
        <AnimatedCircle
          cx={100}
          cy={100}
          r={92}
          fill="none"
          stroke={vm.ringHex}
          strokeWidth={bandStroke}
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          animatedProps={arcProps}
        />
        <AnimatedCircle r={hasWallpaper ? 8 : 7} fill={vm.ringHex} fillOpacity={0.22} animatedProps={tipProps} />
        <AnimatedCircle r={hasWallpaper ? 4.5 : 4} fill={vm.ringHex} animatedProps={tipProps} />
      </Svg>
      <View
        style={[
          StyleSheet.absoluteFill,
          { alignItems: "center", justifyContent: "center", paddingHorizontal: size * 0.185 },
        ]}
      >
        {vm.periodName ? (
          <View style={[styles.chip, { backgroundColor: chipBg, borderColor: chipBorder, maxWidth: size * 0.5 }]}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              style={{
                color: adaptive.primary,
                fontSize: chipFont,
                textTransform: "uppercase",
                fontWeight: "600",
                letterSpacing: 0.8,
              }}
            >
              {vm.periodName}
            </Text>
          </View>
        ) : null}
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          style={{
            color: vm.clockHex ?? adaptive.primary,
            fontSize: timeSize,
            fontWeight: "200",
            fontVariant: ["tabular-nums"],
            letterSpacing: -1.5,
            lineHeight: timeSize * 1.08,
            marginVertical: size * 0.015,
          }}
        >
          {vm.timeText}
        </Text>
        <View style={[styles.statusRow, { marginTop: 4 }]}>
          <View style={[styles.statusDot, { backgroundColor: vm.ringHex }]} />
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            style={{ color: adaptive.secondary, fontSize: statusSize, maxWidth: "100%" }}
          >
            {vm.statusText}
          </Text>
        </View>
        {
          // Teacher + room under the status line. During a period it shows the
          // current one; between periods it previews the up-next period's.
          (vm.teacher || vm.room) && vm.indicator === "active" ? (
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.65}
              style={{ color: adaptive.secondary, fontSize: statusSize * 0.92, marginTop: 3, fontWeight: "500" }}
            >
              {[vm.teacher, vm.room].filter(Boolean).join(" · ")}
            </Text>
          ) : vm.nextName && vm.indicator === "between" && (vm.nextTeacher || vm.nextRoom) ? (
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.65}
              style={{ color: adaptive.secondary, fontSize: statusSize * 0.92, marginTop: 3, fontWeight: "500" }}
            >
              {`${vm.nextName} · ${[vm.nextTeacher, vm.nextRoom].filter(Boolean).join(" · ")}`}
            </Text>
          ) : null
        }
      </View>
    </View>
  );
}

export { RING_CIRCUMFERENCE };

export function ringSizeFor(width: number, vh?: number): number {
  const max = 480;
  const base = Math.min(width * 0.88, vh ?? width, max);
  return Math.max(200, base);
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: tokens.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    maxWidth: "100%",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    marginTop: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
});