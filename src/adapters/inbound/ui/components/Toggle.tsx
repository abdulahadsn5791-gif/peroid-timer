import { useEffect } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, { Easing, interpolate, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

interface Props {
  value: boolean;
  accent: string;
  onValueChange: (next: boolean) => void;
  accessibilityLabel?: string;
}

const TRACK_WIDTH = 44;
const TRACK_HEIGHT = 24;
const THUMB_SIZE = 20;
const TRAVEL = TRACK_WIDTH - THUMB_SIZE - 4;
const EASING = Easing.bezier(0.32, 0.72, 0, 1);

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Native-style switch: track color interpolates to the accent and the thumb
 * springs across, driven by reanimated on the UI thread. Plays a selection
 * haptic when toggled.
 */
export function Toggle({ value, accent, onValueChange, accessibilityLabel }: Props) {
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: 200, easing: EASING });
  }, [value, progress]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], ["rgba(0,0,0,0.10)", accent]),
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [0, TRAVEL]) }],
  }));

  return (
    <AnimatedPressable
      onPress={() => {
        void Haptics.selectionAsync();
        onValueChange(!value);
      }}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
      style={[styles.track, trackStyle]}
    >
      <Animated.View style={[styles.thumb, thumbStyle]} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    padding: 2,
    justifyContent: "center",
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: "#fff",
    shadowColor: "rgba(16,24,40,0.3)",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
    elevation: 2,
  },
});