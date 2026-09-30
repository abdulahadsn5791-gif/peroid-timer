import { useCallback, useMemo, useRef, useState } from "react";
import { PanResponder, StyleSheet, Text, TextInput, View, type View as RNView } from "react-native";
import Svg, { Defs, Rect, Stop, LinearGradient as SvgGradient } from "react-native-svg";
import { tokens, themePalette } from "../../design-system/tokens";
import { usePal } from "./primitives";
import { PressableScale } from "../PressableScale";
import { isValidHexColor6 } from "@domain/value-objects/CustomColors";
import type { HexColor } from "@domain/value-objects/CustomColors";

/**
 * HSV → hex. h in [0,360), s/v in [0,1].
 */
export function hsvToHex(h: number, s: number, v: number): HexColor {
  const hh = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hh < 60) [r, g, b] = [c, x, 0];
  else if (hh < 120) [r, g, b] = [x, c, 0];
  else if (hh < 180) [r, g, b] = [0, c, x];
  else if (hh < 240) [r, g, b] = [0, x, c];
  else if (hh < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}

/** hex → {h,s,v}; invalid input → null. */
export function hexToHsv(hex: string): { h: number; s: number; v: number } | null {
  if (!isValidHexColor6(hex)) return null;
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

interface Props {
  value: HexColor | null;
  accent: string;
  savedSwatches: readonly HexColor[];
  /** Persisted user colors update as soon as one is picked. */
  onSaveSwatch?: (hex: HexColor) => void;
  onPick: (hex: HexColor) => void;
  onClear?: () => void;
  clearLabel?: string;
}

/**
 * Inline color picker: a hue×saturation pad with a brightness slider, a live
 * preview + hex entry, the starter presets, and the user's saved swatches.
 * Drag anywhere on the pad to pick; "Save color" stores it for next time.
 */
export function ColorPicker({
  value,
  accent,
  savedSwatches,
  onSaveSwatch,
  onPick,
  onClear,
  clearLabel = "Default color",
}: Props) {
  const pal = usePal();
  const initial = hexToHsv(value ?? accent) ?? { h: 220, s: 0.85, v: 0.95 };
  const [hsv, setHsv] = useState(initial);
  const [hexInput, setHexInput] = useState(value ?? accent);

  const padRef = useRef<RNView | null>(null);
  const padSizeRef = useRef({ w: 1, h: 1 });

  const currentHex = useMemo(() => hsvToHex(hsv.h, hsv.s, hsv.v), [hsv]);

  const pickFromPad = useCallback(
    (moveX: number, moveY: number) => {
      const { w, h: padH } = padSizeRef.current;
      const nx = Math.max(0, Math.min(1, moveX / Math.max(1, w)));
      const ny = Math.max(0, Math.min(1, moveY / Math.max(1, padH)));
      // The pad is hue (x) × saturation (y) at full brightness — one drag
      // covers the whole color space. Cursor math below mirrors these bounds.
      const hue = nx * 360;
      const sat = Math.max(0.06, 1 - ny * 0.85);
      setHsv({ h: hue, s: sat, v: 1 });
      onPick(hsvToHex(hue, sat, 1));
    },
    [onPick],
  );

  const padResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (_e, g) => {
          padRef.current?.measureInWindow((x, _y) => pickFromPad(g.moveX - x, g.moveY - _y));
        },
        onPanResponderMove: (_e, g) => {
          padRef.current?.measureInWindow((x, _y) => pickFromPad(g.moveX - x, g.moveY - _y));
        },
      }),
    [pickFromPad],
  );

  const hueStops = useMemo(
    () =>
      Array.from({ length: 13 }, (_, i) => {
        const hh = i * 30;
        return (
          <Stop key={hh} offset={`${(i / 12) * 100}%`} stopColor={hsvToHex(hh, 1, 1)} />
        );
      }),
    [],
  );

  const applyHex = (hex: string) => {
    const parsed = isValidHexColor6(hex) ? hex.toUpperCase() : null;
    if (parsed) {
      const next = hexToHsv(parsed);
      if (next) setHsv(next);
      onPick(parsed);
    }
    setHexInput(parsed ?? hex);
  };

  const selectSwatch = (hex: HexColor) => {
    const next = hexToHsv(hex);
    if (next) setHsv(next);
    setHexInput(hex);
    onPick(hex);
  };

  return (
    <View style={styles.wrap}>
      <View
        ref={padRef}
        {...padResponder.panHandlers}
        onLayout={(e) => {
          padSizeRef.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
        }}
        style={styles.pad}
        accessible
        accessibilityLabel="Color pad"
        accessibilityRole="adjustable"
      >
        <Svg style={StyleSheet.absoluteFill}>
          <Defs>
            <SvgGradient id="cpHue" x1="0" y1="0" x2="1" y2="0">
              {hueStops}
            </SvgGradient>
            <SvgGradient id="cpFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#00000000" />
              <Stop offset="100%" stopColor="#000000" />
            </SvgGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#cpHue)" rx={tokens.radius.sm} />
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#cpFade)" rx={tokens.radius.sm} />
        </Svg>
        <View
          style={[
            styles.padCursor,
            { left: `${(hsv.h / 360) * 100}%`, top: `${((1 - hsv.s) / 0.85) * 100}%` },
            { borderColor: pal.textPrimary },
          ]}
        />
      </View>

      <View style={styles.previewRow}>
        <View style={[styles.previewSwatch, { backgroundColor: currentHex }]} />
        <TextInput
          value={hexInput}
          onChangeText={setHexInput}
          onEndEditing={(e) => applyHex(e.nativeEvent.text.trim())}
          onSubmitEditing={(e) => applyHex(e.nativeEvent.text.trim())}
          style={[styles.hexInput, { backgroundColor: pal.inputBg, color: pal.textPrimary }]}
          placeholder="#2563EB"
          placeholderTextColor={pal.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={7}
          accessibilityLabel="Hex color"
        />
        {onSaveSwatch ? (
          <PressableScale
            onPress={() => onSaveSwatch(currentHex)}
            haptic="light"
            style={[styles.saveSwatchBtn, { backgroundColor: pal.inputBg }]}
            accessibilityRole="button"
            accessibilityLabel="Save this color"
          >
            <Text style={[styles.saveSwatchText, { color: pal.textPrimary }]}>Save</Text>
          </PressableScale>
        ) : null}
        {onClear ? (
          <PressableScale
            onPress={onClear}
            haptic="selection"
            style={[styles.saveSwatchBtn, { backgroundColor: pal.inputBg }]}
            accessibilityRole="button"
            accessibilityLabel={clearLabel}
          >
            <Text style={[styles.saveSwatchText, { color: pal.danger }]}>{clearLabel}</Text>
          </PressableScale>
        ) : null}
      </View>

      <View style={styles.swatchRow}>
        {savedSwatches.map((hex) => {
          const selected = value?.toLowerCase() === hex.toLowerCase();
          return (
            <PressableScale
              key={hex}
              onPress={() => selectSwatch(hex)}
              haptic="selection"
              hitSlop={2}
              accessibilityLabel={`Color ${hex}`}
              style={[styles.swatch, { backgroundColor: hex }, selected ? styles.swatchSelected : styles.swatchIdle]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: tokens.spacing.md },
  pad: {
    height: 140,
    borderRadius: tokens.radius.sm,
    overflow: "hidden",
  },
  padCursor: {
    position: "absolute",
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2.5,
    marginLeft: -11,
    marginTop: -11,
    backgroundColor: "transparent",
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  previewSwatch: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.15)",
  },
  hexInput: {
    flex: 1,
    minWidth: 90,
    minHeight: tokens.tap - 6,
    borderRadius: tokens.radius.sm,
    paddingHorizontal: tokens.spacing.sm,
    fontSize: tokens.text.subtext,
    fontVariant: ["tabular-nums"],
  },
  saveSwatchBtn: {
    minHeight: tokens.tap - 6,
    justifyContent: "center",
    paddingHorizontal: tokens.spacing.md,
    borderRadius: tokens.radius.sm,
  },
  saveSwatchText: {
    fontSize: tokens.text.subtext,
    fontWeight: "600",
  },
  swatchRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  swatchSelected: {
    borderWidth: 2.5,
    borderColor: "rgba(0,0,0,0.7)",
  },
  swatchIdle: {
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
});
