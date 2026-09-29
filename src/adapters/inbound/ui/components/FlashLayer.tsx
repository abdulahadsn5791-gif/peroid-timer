import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { tokens } from "../design-system/tokens";

interface Props {
  active: boolean;
  periodName: string | null;
  flashKey: number;
  /** True when the alarm is allowed to ring at all (sound + notifications on). */
  alarmEnabled: boolean;
  onStopAlarm: () => void;
}

/**
 * The end-of-period flash: three quick translucent danger pulses over the whole
 * screen, mirroring the web app's timer-flash animation, with a frosted "ended"
 * toast that mirrors the native notification chip.
 *
 * The toast also carries the "Stop alarm" control — without it the only way to
 * end a ringing tone is the notification shade, which is easy to miss.
 */
export function FlashLayer({ active, periodName, flashKey, alarmEnabled, onStopAlarm }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;
    opacity.stopAnimation();
    const pulses: Animated.CompositeAnimation[] = [];
    for (let i = 0; i < 3; i++) {
      pulses.push(Animated.timing(opacity, { toValue: 0.85, duration: 300, useNativeDriver: true }));
      pulses.push(Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }));
      if (i < 2) pulses.push(Animated.delay(150));
    }
    Animated.sequence(pulses).start();
  }, [active, flashKey, opacity]);

  return (
    <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { opacity: active ? opacity : 0 }]}>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: tokens.color.danger, opacity: 0.14 },
        ]}
      />
      {periodName ? (
        <View pointerEvents="box-none" style={styles.toastWrap}>
          <View style={styles.toast}>
            <BlurView intensity={48} tint="dark" style={StyleSheet.absoluteFill} />
            <Text style={styles.toastText}>{periodName} ended</Text>
            {alarmEnabled ? (
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onStopAlarm();
                }}
                style={styles.stopBtn}
                accessibilityRole="button"
                accessibilityLabel="Stop alarm"
              >
                <Text style={styles.stopText}>Stop alarm</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toastWrap: {
    position: "absolute",
    top: 84,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  toast: {
    minHeight: 44,
    paddingHorizontal: tokens.spacing.xl,
    borderRadius: 22,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.35)",
  },
  toastText: {
    color: "#fff",
    fontSize: tokens.text.body,
    fontWeight: "600",
  },
  stopBtn: {
    marginTop: 4,
    minHeight: 32,
    paddingHorizontal: tokens.spacing.lg,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  stopText: {
    color: "#fff",
    fontSize: tokens.text.subtext,
    fontWeight: "600",
  },
});