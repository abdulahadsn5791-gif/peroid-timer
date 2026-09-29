import { Fragment, useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View, type View as RNView } from "react-native";
import { BlurView } from "expo-blur";
import Svg, { Path } from "react-native-svg";
import { tokens, adaptiveColors, panelMaterial, shadow, type ThemeName } from "../design-system/tokens";
import type { ScheduleRowViewModel } from "@application/ports/view-models/ViewModels";
import { hexToRgba } from "../utils/color";

interface Props {
  rows: ScheduleRowViewModel[];
  accentHex: string;
  hasWallpaper: boolean;
  /** Current wallpaper blur (0-100) so the panel matches the slate. */
  wallpaperBlur: number;
  /** Ref to the wallpaper `BlurTargetView` so the panel gets a real Android blur. */
  blurTarget?: React.RefObject<RNView | null> | null;
  /** Base look without a wallpaper; a wallpaper always renders glassy. */
  theme?: ThemeName;
}

/** "Ms. Khan · Room 12" — hides the separator when either part is missing. */
export function metaLabel(teacher: string | null, room: string | null): string | null {
  const parts = [teacher, room].filter((v): v is string => !!v);
  return parts.length ? parts.join(" · ") : null;
}

function TeacherIcon({ color }: { color: string }) {
  return (
    <Svg width={11} height={11} viewBox="0 0 24 24" fill="none">
      <Path d="M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M12 3a4 4 0 110 8 4 4 0 010-8z" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function RoomIcon({ color }: { color: string }) {
  return (
    <Svg width={11} height={11} viewBox="0 0 24 24" fill="none">
      <Path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ScheduleList({ rows, accentHex, hasWallpaper, wallpaperBlur, blurTarget, theme = "light" }: Props) {
  const adaptive = adaptiveColors(hasWallpaper, theme);
  const separatorColor = hasWallpaper ? "rgba(0,0,0,0.06)" : theme === "dark" ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)";
  const useBlur = hasWallpaper && !!blurTarget;
  const next = rows.find((row) => row.status === "upcoming");
  const content = [
    <View key="header" style={styles.panelHeader}>
      <Text style={[styles.panelHeaderTitle, { color: tokens.color.text.tertiary }]}>Today&apos;s schedule</Text>
      {next ? (
        <View style={styles.panelHeaderNext}>
          <View style={[styles.panelHeaderNextDot, { backgroundColor: accentHex }]} />
          <Text numberOfLines={1} style={[styles.panelHeaderNextText, { color: adaptive.secondary }]}>
            Next · {next.name}
            {next.room ? ` · ${next.room}` : ""}
          </Text>
        </View>
      ) : null}
    </View>,
    <View key="header-sep" style={[styles.separator, { backgroundColor: separatorColor }]} />,
    ...rows.map((row, index) => {
      const showSeparator = index > 0 && rows[index - 1].status !== "current" && row.status !== "current";
      return (
        <Fragment key={row.id}>
          {showSeparator ? <View style={[styles.separator, { backgroundColor: separatorColor }]} /> : null}
          <PeriodRow row={row} accentHex={accentHex} hasWallpaper={hasWallpaper} adaptive={adaptive} theme={theme} />
        </Fragment>
      );
    }),
  ];

  const panelBase = [
    styles.panel,
    panelMaterial(hasWallpaper, theme),
    shadow(1),
    { borderWidth: StyleSheet.hairlineWidth },
  ];

  if (useBlur) {
    return (
      <BlurView
        intensity={Math.max(24, wallpaperBlur)}
        tint="light"
        blurTarget={blurTarget ?? undefined}
        blurMethod="dimezisBlurViewSdk31Plus"
        style={[...panelBase, styles.panelClip]}
      >
        {content}
      </BlurView>
    );
  }

  return <View style={panelBase}>{content}</View>;
}

function PeriodRow({
  row,
  accentHex,
  hasWallpaper,
  adaptive,
  theme,
}: {
  row: ScheduleRowViewModel;
  accentHex: string;
  hasWallpaper: boolean;
  adaptive: ReturnType<typeof adaptiveColors>;
  theme: ThemeName;
}) {
  const meta = metaLabel(row.teacher, row.room);

  if (row.status === "passed") {
    return (
      <View style={styles.row}>
        <View style={[styles.statusCircle, { backgroundColor: hexToRgba(tokens.color.success, 0.12) }]}>
          <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
            <Path d="M20 6L9 17l-5-5" stroke={tokens.color.success} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>
        <View style={styles.rowTextWrap}>
          <Text numberOfLines={1} style={[styles.rowName, { color: adaptive.secondary, textDecorationLine: "line-through" }]}>
            {row.name}
          </Text>
          {meta ? (
            <Text numberOfLines={1} style={[styles.metaText, { color: adaptive.secondary }]}>
              {meta}
            </Text>
          ) : null}
        </View>
        <Text style={{ color: adaptive.secondary, fontSize: tokens.text.micro, flexShrink: 0 }}>Done</Text>
      </View>
    );
  }

  if (row.status === "current") {
    const tint = hexToRgba(accentHex, 0.1);
    const pillBg = hexToRgba(row.phaseHex ?? accentHex, hasWallpaper ? 0.3 : 0.14);
    return (
      <View style={[styles.currentRow, { backgroundColor: tint }]}>
        <View style={styles.currentHeader}>
          <PulseDot color={accentHex} />
          <View style={styles.rowTextWrap}>
            <Text numberOfLines={1} style={[styles.rowName, { color: adaptive.primary, fontWeight: "600" }]}>
              {row.name}
            </Text>
            <Text style={{ color: adaptive.secondary, fontSize: tokens.text.micro }}>{row.rangeText}</Text>
          </View>
          {row.countdownText ? (
            <View style={[styles.countdownPill, { backgroundColor: pillBg }]}>
              <Text style={[styles.countdown, { color: row.phaseHex ?? accentHex }]}>{row.countdownText}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.round(Math.min(1, Math.max(0, row.progressElapsed)) * 100)}%`,
                backgroundColor: row.phaseHex ?? accentHex,
              },
            ]}
          />
        </View>          {meta ? (
            <View style={styles.currentMetaRow}>
              {row.teacher ? (
                <View style={[styles.metaChip, { backgroundColor: theme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" }]}>
                  <TeacherIcon color={adaptive.secondary} />
                  <Text numberOfLines={1} style={[styles.metaChipText, { color: adaptive.secondary }]}>
                    {row.teacher}
                  </Text>
                </View>
              ) : null}
              {row.room ? (
                <View style={[styles.metaChip, { backgroundColor: theme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" }]}>
                  <RoomIcon color={adaptive.secondary} />
                  <Text numberOfLines={1} style={[styles.metaChipText, { color: adaptive.secondary }]}>
                    {row.room}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <View style={[styles.statusCircle, { backgroundColor: "transparent", borderWidth: 2, borderColor: adaptive.ringTick }]} />
      <View style={styles.rowTextWrap}>
        <Text numberOfLines={1} style={[styles.rowName, { color: adaptive.primary }]}>
          {row.name}
        </Text>
        {meta ? (
          <Text numberOfLines={1} style={[styles.metaText, { color: adaptive.secondary }]}>
            {meta}
          </Text>
        ) : null}
      </View>
      <Text style={{ color: adaptive.secondary, fontSize: tokens.text.micro, flexShrink: 0 }}>{row.rangeText}</Text>
    </View>
  );
}

function PulseDot({ color }: { color: string }) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.35, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={{
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: color,
        marginRight: tokens.spacing.md,
        opacity,
      }}
    />
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.sm,
  },
  panelClip: { overflow: "hidden" },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.xs,
    paddingBottom: tokens.spacing.sm,
  },
  panelHeaderTitle: {
    fontSize: tokens.text.micro,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  panelHeaderNext: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },
  panelHeaderNextDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  panelHeaderNextText: {
    fontSize: tokens.text.micro,
    fontWeight: "500",
    flexShrink: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(0,0,0,0.06)",
    marginLeft: tokens.spacing.xl,
    marginRight: tokens.spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    borderRadius: tokens.radius.md,
  },
  rowTextWrap: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  metaText: {
    fontSize: tokens.text.micro,
  },
  currentRow: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    borderRadius: tokens.radius.md,
  },
  currentHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  currentMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: "100%",
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: tokens.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  metaChipText: {
    fontSize: tokens.text.micro,
    fontWeight: "500",
    flexShrink: 1,
  },
  statusCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  rowName: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: tokens.text.body,
    color: tokens.color.text.primary,
  },
  countdownPill: {
    marginLeft: tokens.spacing.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: tokens.radius.full,
  },
  countdown: {
    fontSize: tokens.text.subtext,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    flexShrink: 0,
  },
  progressTrack: {
    marginTop: 10,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(0,0,0,0.10)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
});
