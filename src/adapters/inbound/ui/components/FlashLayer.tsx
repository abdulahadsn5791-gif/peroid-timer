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
 *
 * The pulse and the toast animate separately on purpose. The pulse is
 * decoration that runs 0.85 -> 0 three times and therefore ENDS at 0, so the
 * toast used to inherit that opacity and faded out of sight (taking the button
 * with it) about two seconds after the period ended. The toast now fades in on
 * its own and holds, staying readable and tappable until the alarm is stopped.
 */
export function FlashLayer({ active, periodName, flashKey, alarmEnabled, onStopAlarm }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;
    pulse.stopAnimation();
    pulse.setValue(0);
    const pulses: Animated.CompositeAnimation[] = [];
    for (let i = 0; i < 3; i++) {
      pulses.push(Animated.timing(pulse, { toValue: 0.85, duration: 300, useNativeDriver: true }));
      pulses.push(Animated.timing(pulse, { toValue: 0, duration: 300, useNativeDriver: true }));
      if (i < 2) pulses.push(Animated.delay(150));
    }
    Animated.sequence(pulses).start();
  }, [active, flashKey, pulse]);

  useEffect(() => {
    if (!periodName) {
      toastOpacity.setValue(0);
      return;
    }
    toastOpacity.stopAnimation();
    Animated.timing(toastOpacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [periodName, flashKey, toastOpacity]);

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: tokens.color.danger, opacity: pulse },
        ]}
      />
      {periodName ? (
        <Animated.View
          pointerEvents="box-none"
          style={[styles.toastWrap, { opacity: toastOpacity }]}
        >
          <View style={styles.toast}>
            <BlurView
              intensity={48}
              tint="dark"
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <Text style={styles.toastText}>{periodName} ended</Text>
            {alarmEnabled ? (
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onStopAlarm();
                }}
                style={styles.stopBtn}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Stop alarm"
              >
                <Text style={styles.stopText}>Stop alarm</Text>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </View>
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
    marginTop: 6,
    // 44px floor: the design rules' minimum tap target. A 32px control sitting
    // on a translucent pill over a moving background is a miss waiting to
    // happen, and a missed tap on the only in-app stop reads as a dead button.
    minHeight: tokens.tap,
    paddingHorizontal: tokens.spacing.xl,
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.color.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  stopText: {
    color: tokens.color.white,
    fontSize: tokens.text.subtext,
    fontWeight: "600",
  },
});