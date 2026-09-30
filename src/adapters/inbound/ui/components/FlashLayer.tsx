import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { tokens } from "../design-system/tokens";

interface Props {
  active: boolean;
  periodName: string | null;
  flashKey: number;
}

/**
 * The end-of-period flash: three quick translucent danger pulses over the whole
 * screen, mirroring the web app's timer-flash animation, with a frosted "ended"
 * toast that mirrors the native notification chip.
 *
 * The toast is informational only — no stop control. The alarm plays on the
 * ALARM stream, so the phone's volume buttons silence it instantly.
 *
 * The pulse and the toast animate separately on purpose. The pulse is
 * decoration that runs 0.85 -> 0 three times and therefore ENDS at 0, so the
 * toast used to inherit that opacity and faded out of sight (taking the button
 * with it) about two seconds after the period ended. The toast now fades in on
 * its own and holds, staying readable and tappable until the alarm is stopped.
 */
export function FlashLayer({ active, periodName, flashKey }: Props) {
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
            {/* Informational toast only — no stop control. The alarm plays on
              the ALARM stream, so the phone's volume buttons silence it, and
              the toast auto-dismisses. A button users never needed was pure
              clutter (and overlapped the clock/schedule). */}
            <Text style={styles.toastText}>{periodName} ended</Text>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  toastWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    // Sits between the header ("Today" + date) and the clock ring, with
    // vertical margins on both sides so it can never overlap either — the
    // old top: 84 without clearance collided with the header chip above and
    // the ring below on taller date labels.
    top: 96,
    paddingHorizontal: tokens.spacing.xl,
    // Auto-drop without any user action: there is no button on the toast, so
    // it must dismiss itself (4s) rather than linger over the clock.
    pointerEvents: "none" as const,
  },
  toast: {
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    minHeight: 48,
    // Breathing room inside the pill: content no longer touches its edges.
    paddingHorizontal: tokens.spacing.xl,
    paddingVertical: tokens.spacing.md,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.35)",
  },
  toastText: {
    color: "#fff",
    fontSize: tokens.text.body,
    fontWeight: "600",
    textAlign: "center",
  },
});