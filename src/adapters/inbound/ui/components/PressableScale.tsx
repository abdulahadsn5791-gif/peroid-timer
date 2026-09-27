import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { tokens } from "../design-system/tokens";

type HapticFeedback = "selection" | "light" | "medium" | "none";

interface Props extends Omit<PressableProps, "onPressIn" | "onPressOut" | "style"> {
  style?: StyleProp<ViewStyle>;
  /** Scale applied while the finger is down. Defaults to 0.97. */
  scaleTo?: number;
  /** Optional haptic fired on press. */
  haptic?: HapticFeedback;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Pressable with native-feel press feedback: a quick scale (and nothing else)
 * animated with the design-system motion curve. Optionally plays a haptic.
 */
export function PressableScale({
  children,
  style,
  onPress,
  disabled,
  scaleTo = 0.97,
  haptic = "none",
  ...rest
}: Props) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: disabled ? 1 : scale.value }],
  }));

  const handlePressIn = () => {
    if (disabled) return;
    const easing = Easing.bezier(0.32, 0.72, 0, 1);
    scale.value = withTiming(scaleTo, { duration: tokens.motion.press, easing });
  };

  const handlePressOut = () => {
    if (disabled) return;
    const easing = Easing.bezier(0.32, 0.72, 0, 1);
    scale.value = withTiming(1, { duration: tokens.motion.press, easing });
  };

  const handlePress = (event: Parameters<NonNullable<PressableProps["onPress"]>>[0]) => {
    if (haptic !== "none") {
      if (haptic === "selection") {
        void Haptics.selectionAsync();
      } else if (haptic === "light") {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else if (haptic === "medium") {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    }
    onPress?.(event);
  };

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}