import { useState } from "react";
import { StyleSheet, Text, TextInput, View, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { tokens } from "../../design-system/tokens";
import { usePal } from "./primitives";
import { PressableScale } from "../PressableScale";
import { ACCENT_PRESETS } from "@domain/value-objects/AccentColor";
import { RING_PALETTES } from "@domain/value-objects/RingPalette";
import type { SettingsActions } from "../../ports";
import type { SettingsDraftVM } from "@application/ports/view-models/ViewModels";
import {
  BlurSlider,
  Card,
  CardRow,
  Hint,
  PageBody,
  PageScroll,
  SectionHeader,
  ToggleRow,
  WallpaperPreview,
} from "./primitives";

interface Props {
  draft: SettingsDraftVM;
  actions: SettingsActions;
  isWide: boolean;
  bottomInset: number;
}

/** Wallpaper, accent color, ring palettes and the "what gets colored" toggles. */
export function LookPage({ draft, actions, isWide, bottomInset }: Props) {
  const accent = draft.accentColor;
  const pal = usePal();
  const [customHex, setCustomHex] = useState(draft.accentColor);

  return (
    <PageScroll bottomInset={bottomInset}>
      <PageBody isWide={isWide}>
        <SectionHeader
          title="Home theme"
          subtitle="Used when no wallpaper is set — a wallpaper always renders frosted glass"
        />
        <Card>
          <View style={styles.segmentedWrap}>
            <View style={[styles.segmentedRow, { backgroundColor: pal.inputBg }]}>
              {(["light", "dark"] as const).map((t) => {
                const selected = draft.theme === t;
                return (
                  <PressableScale
                    key={t}
                    onPress={() => actions.previewTheme(t)}
                    haptic="selection"
                    style={[styles.segmentBtn, selected && { backgroundColor: accent }]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>
                      {t === "light" ? "Light" : "Dark"}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>
          </View>
        </Card>
        <Hint>The home screen flips between the white and the dark look live as you toggle.</Hint>

        <SectionHeader title="App background" subtitle="Wallpaper behind the home screen only" />
        <Card>
          <View style={styles.backgroundRow}>
            <WallpaperPreview previewUri={draft.wallpaperPreviewUri} blur={draft.wallpaperBlur} label="Home" />
            <View style={styles.backgroundControls}>
              <Text style={styles.sliderLabel}>Blur {draft.wallpaperBlur}%</Text>
              <BlurSlider value={draft.wallpaperBlur} accent={accent} onValueChange={(v) => actions.previewWallpaperBlur(v)} />
              <Text style={styles.sliderHint}>Drag to blur the wallpaper behind the app&apos;s frosted glass.</Text>
            </View>
          </View>
          <View style={styles.btnRow}>
            <PressableScale
              onPress={() => void actions.pickWallpaper()}
 haptic="light"
              style={[styles.halfBtn, { backgroundColor: pal.inputBg }, styles.btnFlex]}
              accessibilityRole="button"
            >
              <Text style={[styles.halfBtnText, { color: pal.textPrimary }]}>Choose photo</Text>
            </PressableScale>
            <PressableScale
              onPress={() => actions.removeWallpaper()}
              haptic="selection"
              style={[styles.halfBtn, { backgroundColor: pal.inputBg }, styles.btnFlex]}
              accessibilityRole="button"
            >                  <Text style={[styles.halfBtnText, { color: tokens.color.danger }]}>Remove</Text>
            </PressableScale>
          </View>

        </Card>
        <Hint>Shown only behind the app home screen — it never touches your phone&apos;s wallpaper.</Hint>

        <SectionHeader title="Accent color" subtitle="Buttons, switches and the current-period highlight" />
        <Card style={styles.looseCard}>
          <View style={styles.swatchRow}>
            {ACCENT_PRESETS.map((hex) => {
              const selected = hex.toLowerCase() === accent.toLowerCase();
              return (
                <PressableScale
                  key={hex}
                  onPress={() => {
                    setCustomHex(hex);
                    actions.previewAccent(hex);
                  }}
                  haptic="selection"
                  accessibilityLabel={`Accent ${hex}`}
                  hitSlop={2}
                  style={[styles.swatch, { backgroundColor: hex }, selected ? styles.swatchSelected : styles.swatchIdle]}
                />
              );
            })}
            <View style={[styles.customSwatch, { backgroundColor: pal.inputBg }]}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path d="M12 5v14M5 12h14" stroke={pal.textTertiary} strokeWidth={2} strokeLinecap="round" />
              </Svg>
              <TextInput
                value={customHex}
                onChangeText={(t) => {
                  setCustomHex(t);
                  if (/^#[0-9a-fA-F]{6}$/.test(t)) actions.previewAccent(t);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.hexInput, { color: pal.textPrimary }]}
                accessibilityLabel="Custom accent hex"
              />
            </View>
          </View>
        </Card>

        <SectionHeader title="Ring colors" subtitle="How the timer ring changes as time runs out" />
        <Card style={styles.looseCard}>
          <View style={styles.paletteGrid}>
            {RING_PALETTES.map((palette, index) => {
              const selected = index === draft.paletteIndex;
              return (
                <PressableScale
                  key={palette.id}
                  onPress={() => actions.previewPalette(index)}
                  haptic="selection"
                  style={[styles.paletteCard, basePaletteStyle(accent, selected)].filter(Boolean) as ViewStyle[]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={styles.paletteName}>{palette.name}</Text>
                  <View style={styles.paletteDots}>
                    {palette.colors.map((c) => (
                      <View key={c} style={[styles.paletteDot, { backgroundColor: c }]} />
                    ))}
                  </View>
                </PressableScale>
              );
            })}
          </View>
        </Card>
        <Hint>Color 1 until 30% left · color 2 until 15% · color 3 in the last 15%.</Hint>

        <SectionHeader title="Colored elements" subtitle="Choose what the accent reaches" />
        <Card>
          <ToggleRow
            label="Also color the clock numbers"
            value={draft.colorClock}
            accent={accent}
            onChange={(v) => actions.previewColorClock(v)}
          />
          <ToggleRow
            label="Color the notification"
            value={draft.colorNotification}
            accent={accent}
            onChange={(v) => actions.previewColorNotification(v)}
          />
          <ToggleRow
            label="Color active bars"
            sublabel="Light up the ring ticks you have already elapsed"
            value={draft.colorActiveBars}
            accent={accent}
            onChange={(v) => actions.previewColorActiveBars(v)}
            last
          />
        </Card>
        <Hint>Watch the home screen behind this page change as you toggle.</Hint>
      </PageBody>
    </PageScroll>
  );
}

function basePaletteStyle(accent: string, selected: boolean): ViewStyle | undefined {
  if (selected) {
    return {
      borderColor: accent,
      borderWidth: 1.5,
    };
  }
  return { borderColor: tokens.color.hairlineStrong, borderWidth: 1 };
}

const styles = StyleSheet.create({
  segmentedWrap: { padding: tokens.spacing.md },
  segmentedRow: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: tokens.radius.md,
    padding: 3,
    gap: 3,
  },
  segmentBtn: {
    flex: 1,
    minHeight: tokens.tap - 6,
    borderRadius: tokens.radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentText: {
    fontSize: tokens.text.subtext,
    fontWeight: "600",
    color: tokens.color.text.secondary,
  },
  segmentTextActive: { color: tokens.color.white },
  backgroundRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.lg,
    padding: tokens.spacing.md,
  },
  backgroundControls: {
    flex: 1,
    gap: tokens.spacing.xs,
  },
  sliderLabel: {
    fontSize: tokens.text.subtext,
    fontWeight: "600",
    color: tokens.color.text.primary,
  },
  sliderHint: {
    fontSize: tokens.text.micro,
    color: tokens.color.text.tertiary,
  },
  btnRow: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    paddingBottom: tokens.spacing.md,
  },
  halfBtn: {
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: 10,
    borderRadius: tokens.radius.md,
    backgroundColor: "rgba(0,0,0,0.04)",
    minHeight: tokens.tap,
    alignItems: "center",
    justifyContent: "center",
  },
  halfBtnText: {
    fontSize: tokens.text.subtext,
    fontWeight: "500",
    color: tokens.color.text.primary,
  },
  btnFlex: { flex: 1 },
  looseCard: { padding: tokens.spacing.md },
  swatchRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
  },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  swatchSelected: {
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.7)",
  },
  swatchIdle: {
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  customSwatch: {
    height: 40,
    backgroundColor: "rgba(0,0,0,0.04)",
    borderRadius: tokens.radius.md,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    gap: 6,
    flexBasis: 130,
  },
  hexInput: {
    fontSize: tokens.text.subtext,
    color: tokens.color.text.primary,
    minWidth: 70,
    padding: 0,
  },
  paletteGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  paletteCard: {
    flexGrow: 1,
    flexBasis: "45%",
    padding: tokens.spacing.md,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
  },
  paletteName: {
    fontSize: tokens.text.subtext,
    fontWeight: "500",
    color: tokens.color.text.primary,
    marginBottom: tokens.spacing.sm,
  },
  paletteDots: { flexDirection: "row", gap: 6 },
  paletteDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.1)",
  },
});
