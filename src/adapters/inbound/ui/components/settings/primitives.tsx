import { Fragment, createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Image,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type View as RNView,
  type ViewStyle,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { BlurTargetView, BlurView } from "expo-blur";
import { tokens, themePalette, type ThemeName, type ThemePalette } from "../../design-system/tokens";
import { PressableScale } from "../PressableScale";
import { Toggle } from "../Toggle";
import { minutesOfDayToLabel, minutesToHour12, toHHMM } from "@domain/value-objects/TimeOfDay";
import type { PeriodDraftVM, WeekPeriodsVM } from "./types";

// ---------------------------------------------------------------------------
// Settings theme
// ---------------------------------------------------------------------------

const SettingsThemeContext = createContext<ThemeName>("light");

export function SettingsTheme({ theme, children }: { theme: ThemeName; children: ReactNode }) {
  return <SettingsThemeContext.Provider value={theme}>{children}</SettingsThemeContext.Provider>;
}

/** Palette for the surface the settings page is drawn on (light or dark). */
export function usePal(): ThemePalette {
  return themePalette(useContext(SettingsThemeContext));
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/**
 * Fixed-width content column so the settings pages feel like a native app on
 * tablets (the full-bleed background still spans the whole screen).
 */
export function PageBody({ children, isWide }: { children: ReactNode; isWide: boolean }) {
  return (
    <View style={[styles.body, isWide && styles.bodyWide]}>
      {children}
    </View>
  );
}

export function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const pal = usePal();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: pal.textPrimary }]}>{title}</Text>
      {subtitle ? <Text style={[styles.sectionSubtitle, { color: pal.textTertiary }]}>{subtitle}</Text> : null}
    </View>
  );
}

/** Inset-grouped card (iOS Settings style). */
export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const pal = usePal();
  return <View style={[styles.card, { backgroundColor: pal.surface, borderColor: pal.hairline }, style]}>{children}</View>;
}

export function CardRow({ children }: { children: ReactNode }) {
  return <View style={styles.cardRow}>{children}</View>;
}

export function CardSeparator() {
  return <View style={styles.cardSeparator} />;
}

export function Hint({ children }: { children: ReactNode }) {
  const pal = usePal();
  return <Text style={[styles.hint, { color: pal.textTertiary }]}>{children}</Text>;
}

export function Row({
  label,
  sublabel,
  control,
  onPress,
  last,
}: {
  label: string;
  sublabel?: string;
  control?: ReactNode;
  onPress?: () => void;
  last?: boolean;
}) {
  const pal = usePal();
  const body = (
    <View style={styles.rowInner}>
      <View style={styles.rowTextWrap}>
        <Text style={[styles.rowLabel, { color: pal.textPrimary }]}>{label}</Text>
        {sublabel ? <Text style={[styles.rowSublabel, { color: pal.textTertiary }]}>{sublabel}</Text> : null}
      </View>
      {control}
    </View>
  );
  return (
    <View>
      {onPress ? (
        <PressableScale onPress={onPress} haptic="selection" accessibilityRole="button">
          {body}
        </PressableScale>
      ) : (
        body
      )}
      {last ? null : <View style={[styles.rowSeparator, { backgroundColor: pal.hairline }]} />}
    </View>
  );
}

export function ToggleRow({
  label,
  sublabel,
  value,
  accent,
  onChange,
  last,
}: {
  label: string;
  sublabel?: string;
  value: boolean;
  accent: string;
  onChange: (v: boolean) => void;
  last?: boolean;
}) {
  return (
    <Row
      label={label}
      sublabel={sublabel}
      last={last}
      control={<Toggle value={value} accent={accent} onValueChange={onChange} accessibilityLabel={label} />}
    />
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

export function GhostButton({
  label,
  onPress,
  danger,
  flex,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
  flex?: boolean;
}) {
  const pal = usePal();
  return (
    <PressableScale
      onPress={onPress}
      haptic={danger ? "medium" : "selection"}
      style={[styles.ghostBtn, { backgroundColor: pal.surface, borderColor: pal.hairlineStrong }, flex && styles.btnFlex]}
      accessibilityRole="button"
    >
      <Text style={[styles.ghostBtnText, { color: danger ? tokens.color.danger : pal.textPrimary }]}>{label}</Text>
    </PressableScale>
  );
}

export function DashedAddButton({ label, onPress }: { label: string; onPress: () => void }) {
  const pal = usePal();
  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      style={[styles.addBtn, { borderColor: pal.disabled, backgroundColor: pal.inputBg }]}
      accessibilityRole="button"
    >
      <Text style={[styles.addBtnText, { color: pal.textSecondary }]}>{label}</Text>
    </PressableScale>
  );
}

// ---------------------------------------------------------------------------
// Weekday tabs
// ---------------------------------------------------------------------------

export const WEEKDAY_TABS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function WeekdayTabs({
  active,
  accent,
  weekPeriods,
  onSelect,
}: {
  active: number;
  accent: string;
  weekPeriods: WeekPeriodsVM;
  onSelect: (index: number) => void;
}) {
  const pal = usePal();
  return (
    <View style={styles.weekdayRow}>
      {WEEKDAY_TABS.map((label, index) => {
        const isActive = index === active;
        const count = weekPeriods[index]?.length ?? 0;
        return (
          <PressableScale
            key={label}
            onPress={() => onSelect(index)}
            haptic="selection"
            style={[styles.weekdayTab, { backgroundColor: pal.surface, borderColor: pal.hairlineStrong }, isActive && { backgroundColor: accent, borderColor: "transparent" }]}
            accessibilityRole="tab"
            accessibilityLabel={`${label}: ${count} ${count === 1 ? "period" : "periods"}`}
          >
            <Text style={[styles.weekdayTabText, { color: pal.textSecondary }, isActive && styles.weekdayTabTextActive]}>{label}</Text>
            <View
              style={[
                styles.weekdayDot,
                count === 0 && styles.weekdayDotEmpty,
                count > 0 && { backgroundColor: isActive ? tokens.color.white : accent },
              ]}
            />
          </PressableScale>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Blur slider
// ---------------------------------------------------------------------------

export function BlurSlider({
  value,
  accent,
  onValueChange,
}: {
  value: number;
  accent: string;
  onValueChange: (v: number) => void;
}) {
  const trackRef = useRef<RNView | null>(null);
  const widthRef = useRef(1);
  const pageXRef = useRef(0);

  const valueFromX = useCallback(
    (x: number): number => {
      const w = widthRef.current || 1;
      return Math.max(0, Math.min(100, Math.round((x / w) * 100)));
    },
    [],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e, g) => {
          trackRef.current?.measureInWindow((x) => {
            pageXRef.current = x;
            onValueChange(valueFromX(g.moveX - x));
          });
        },
        onPanResponderMove: (_e, g) => onValueChange(valueFromX(g.moveX - pageXRef.current)),
      }),
    [valueFromX, onValueChange],
  );

  const pal = usePal();
  return (
    <View
      ref={trackRef}
      {...panResponder.panHandlers}
      onLayout={(e) => {
        widthRef.current = e.nativeEvent.layout.width;
      }}
      style={[styles.sliderTrack, { backgroundColor: pal.inputBg }]}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Wallpaper blur"
      accessibilityValue={{ min: 0, max: 100, now: value }}
      accessibilityActions={[
        { name: "increment", label: "Increase blur" },
        { name: "decrement", label: "Decrease blur" },
      ]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === "increment") onValueChange(Math.min(100, value + 10));
        else if (e.nativeEvent.actionName === "decrement") onValueChange(Math.max(0, value - 10));
      }}
    >
      <View style={[styles.sliderTrackFill, { width: `${value}%`, backgroundColor: accent }]} />
      <View style={[styles.sliderThumb, { left: `${value}%` }]} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Period card (Schedule page)
// ---------------------------------------------------------------------------

function ArrowSvg({ up }: { up: boolean }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" style={{ transform: up ? [] : [{ rotate: "180deg" }] }}>
      <Path d="M18 15l-6-6-6 6" stroke={tokens.color.text.tertiary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Amplitude-tinted chip showing "name · start → end". */
function PeriodSummaryChip({ period, index, accent }: { period: PeriodDraftVM; index: number; accent: string }) {
  const pal = usePal();
  return (
    <View style={styles.periodSummary}>
      <View style={[styles.periodNumberBadge, { backgroundColor: accent }]}>
        <Text style={styles.periodNumberText}>{index + 1}</Text>
      </View>
      <View style={styles.periodSummaryTextWrap}>
        <Text numberOfLines={1} style={[styles.periodSummaryName, { color: pal.textPrimary }]}>{period.name}</Text>
        <Text style={[styles.periodSummaryTimes, { color: pal.textTertiary }]}>
          {period.startLabel} → {period.endLabel}
        </Text>
      </View>
    </View>
  );
}

/** Deterministic inline time editor replacing OEM time pickers (see old sheet). */
function TimeEditor({
  hhmm,
  field,
  accent,
  onChange,
  onDone,
}: {
  hhmm: string;
  field: "start" | "end";
  accent: string;
  onChange: (hhmm: string) => void;
  onDone: () => void;
}) {
  const base = Number.parseInt(hhmm.slice(0, 2), 10) * 60 + Number.parseInt(hhmm.slice(3, 5), 10);
  const { hour12, minutes, period } = minutesToHour12(base);
  const pal = usePal();

  const compose = (h: number, m: number, p: "AM" | "PM") => {
    const h24 = p === "AM" ? (h === 12 ? 0 : h) : h === 12 ? 12 : h + 12;
    onChange(toHHMM({ minutes: h24 * 60 + m }));
  };
  const incHour = () => compose(hour12 === 12 ? 1 : hour12 + 1, minutes, period);
  const decHour = () => compose(hour12 === 1 ? 12 : hour12 - 1, minutes, period);
  const incMinute = () => compose(hour12, minutes === 59 ? 0 : minutes + 1, period);
  const decMinute = () => compose(hour12, minutes === 0 ? 59 : minutes - 1, period);

  return (
    <View style={[styles.timeEditor, { backgroundColor: pal.inputBg, borderColor: pal.hairlineStrong, borderWidth: StyleSheet.hairlineWidth }]}>
      <View style={styles.timeEditorHeader}>
        <Text style={[styles.timeEditorTitle, { color: pal.textSecondary }]}>{field === "start" ? "Set start" : "Set end"}</Text>
        <Text style={[styles.timeEditorLive, { color: accent }]}>{minutesOfDayToLabel(base)}</Text>
        <PressableScale onPress={onDone} haptic="selection" style={styles.doneBtn} accessibilityRole="button">
          <Text style={[styles.doneText, { color: accent }]}>Done</Text>
        </PressableScale>
      </View>
      <View style={styles.stepRow}>
        <Stepper label="Hour" value={hour12} onInc={incHour} onDec={decHour} />
        <Stepper label="Minute" value={String(minutes).padStart(2, "0")} onInc={incMinute} onDec={decMinute} />
        <View style={styles.ampmBox}>
          <Text style={styles.stepLabel}>AM / PM</Text>
          <View style={styles.ampmRow}>
            {(["AM", "PM"] as const).map((p) => {
              const isActive = p === period;
              return (
                <PressableScale
                  key={p}
                  onPress={() => compose(hour12, minutes, p)}
                  haptic="selection"
                  style={[styles.ampmBtn, isActive ? { backgroundColor: accent } : styles.ampmIdle]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.ampmText, isActive ? styles.ampmActiveText : styles.ampmIdleText]}>{p}</Text>
                </PressableScale>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

function Stepper({
  label,
  value,
  onInc,
  onDec,
}: {
  label: string;
  value: number | string;
  onInc: () => void;
  onDec: () => void;
}) {
  const pal = usePal();
  return (
    <View style={styles.stepBox}>
      <Text style={[styles.stepLabel, { color: pal.textTertiary }]}>{label}</Text>
      <PressableScale onPress={onInc} haptic="selection" style={[styles.stepBtn, { backgroundColor: pal.surface, borderColor: pal.hairlineStrong }]} accessibilityRole="button">
        <Text style={[styles.stepBtnText, { color: pal.textPrimary }]}>+</Text>
      </PressableScale>
      <Text style={[styles.stepValue, { color: pal.textPrimary }]}>{value}</Text>
      <PressableScale onPress={onDec} haptic="selection" style={[styles.stepBtn, { backgroundColor: pal.surface, borderColor: pal.hairlineStrong }]} accessibilityRole="button">
        <Text style={[styles.stepBtnText, { color: pal.textPrimary }]}>−</Text>
      </PressableScale>
    </View>
  );
}

export function PeriodCard({
  period,
  index,
  accent,
  expanded,
  onToggleExpand,
  onNameChange,
  onStartPress,
  onEndPress,
  onTeacherChange,
  onRoomChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  period: PeriodDraftVM;
  index: number;
  accent: string;
  expanded: boolean;
  onToggleExpand: () => void;
  onNameChange: (name: string) => void;
  onStartPress: () => void;
  onEndPress: () => void;
  onTeacherChange: (teacher: string) => void;
  onRoomChange: (room: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const pal = usePal();
  return (
    <Card style={styles.periodCard}>
      <PressableScale
        onPress={onToggleExpand}
        haptic="selection"
        accessibilityRole="button"
        accessibilityLabel={`Edit ${period.name}`}
        accessibilityState={{ expanded }}
        style={styles.periodHeadBtn}
      >
        <PeriodSummaryChip period={period} index={index} accent={accent} />
        <View style={styles.periodHeadActions}>
          <PressableScale onPress={onMoveUp} haptic="selection" style={styles.iconBtn} accessibilityLabel="Move up">
            <ArrowSvg up />
          </PressableScale>
          <PressableScale onPress={onMoveDown} haptic="selection" style={styles.iconBtn} accessibilityLabel="Move down">
            <ArrowSvg up={false} />
          </PressableScale>
          <PressableScale onPress={onRemove} haptic="selection" style={styles.iconBtn} accessibilityLabel="Remove period">
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke={tokens.color.danger} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </PressableScale>
        </View>
      </PressableScale>
      {expanded ? (
        <View style={styles.periodEditor}>
          <TextInput
            value={period.name}
            onChangeText={onNameChange}
            style={[styles.nameInput, { backgroundColor: pal.inputBg, color: pal.textPrimary }]}
            placeholder="Period name"
            placeholderTextColor={pal.textTertiary}
            accessibilityLabel="Period name"
          />
          <View style={styles.periodTimes}>
            <PressableScale
              onPress={onStartPress}
              haptic="selection"
              style={[styles.timeBtn, { backgroundColor: pal.inputBg }]}
              accessibilityRole="button"
              accessibilityLabel="Set start time"
            >
              <Text style={[styles.timeText, { color: pal.textPrimary }]}>{period.startLabel}</Text>
            </PressableScale>
            <Text style={[styles.timeSep, { color: pal.textTertiary }]}>→</Text>
            <PressableScale
              onPress={onEndPress}
              haptic="selection"
              style={[styles.timeBtn, { backgroundColor: pal.inputBg }]}
              accessibilityRole="button"
              accessibilityLabel="Set end time"
            >
              <Text style={[styles.timeText, { color: pal.textPrimary }]}>{period.endLabel}</Text>
            </PressableScale>
          </View>
          <View style={styles.metaRow}>
            <View style={[styles.metaInputWrap, { backgroundColor: pal.inputBg }]}>
              <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                <Path d="M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M12 3a4 4 0 110 8 4 4 0 010-8z" stroke={pal.textTertiary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <TextInput
                value={period.teacher ?? ""}
                onChangeText={onTeacherChange}
                style={[styles.metaInput, { color: pal.textPrimary }]}
                placeholder="Teacher"
                placeholderTextColor={pal.textTertiary}
                accessibilityLabel="Teacher name"
              />
            </View>
            <View style={[styles.metaInputWrap, { backgroundColor: pal.inputBg }]}>
              <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                <Path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" stroke={pal.textTertiary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <TextInput
                value={period.room ?? ""}
                onChangeText={onRoomChange}
                style={[styles.metaInput, { color: pal.textPrimary }]}
                placeholder="Room"
                placeholderTextColor={pal.textTertiary}
                accessibilityLabel="Room number"
              />
            </View>
          </View>
        </View>
      ) : null}
    </Card>
  );
}

/** Renders the expanded period's inline time editor, when one is open. */
export function PeriodTimeEditor({
  period,
  field,
  accent,
  onChange,
  onDone,
}: {
  period: PeriodDraftVM;
  field: "start" | "end";
  accent: string;
  onChange: (hhmm: string) => void;
  onDone: () => void;
}) {
  return <TimeEditor hhmm={period[field]} field={field} accent={accent} onChange={onChange} onDone={onDone} />;
}

// ---------------------------------------------------------------------------
// Wallpaper preview
// ---------------------------------------------------------------------------

export function WallpaperPreview({
  previewUri,
  blur,
  label,
}: {
  previewUri: string | null;
  blur: number;
  label: string;
}) {
  const previewTarget = useRef<RNView | null>(null);
  return (
    <View style={styles.phonePreview}>
      <BlurTargetView ref={previewTarget} style={StyleSheet.absoluteFill} pointerEvents="none">
        {previewUri ? (
          <Image source={{ uri: previewUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.phonePreviewEmpty]} />
        )}
      </BlurTargetView>
      {previewUri && blur > 0 ? (
        <BlurView
          blurTarget={previewTarget}
          intensity={blur}
          tint="dark"
          blurMethod="dimezisBlurViewSdk31Plus"
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View style={styles.phonePreviewScrim} />
      <Text style={styles.phonePreviewLabel}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Scroll container
// ---------------------------------------------------------------------------

export function PageScroll({
  children,
  bottomInset,
}: {
  children: ReactNode;
  /** Extra bottom padding so content clears the pinned Save bar. */
  bottomInset: number;
}) {
  const scrollRef = useRef<ScrollView | null>(null);
  return (
    <ScrollView
      ref={scrollRef}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomInset }]}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Layout
  body: { paddingHorizontal: tokens.spacing.xl },
  bodyWide: { alignSelf: "center", width: 460, maxWidth: "100%" },
  sectionHeader: { gap: 2, marginTop: tokens.spacing.xxl, marginBottom: tokens.spacing.sm },
  sectionTitle: {
    fontSize: tokens.text.body,
    fontWeight: "700",
    color: tokens.color.text.primary,
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: tokens.text.micro,
    color: tokens.color.text.tertiary,
  },
  card: {
    backgroundColor: tokens.color.surface2,
    borderRadius: tokens.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.hairline,
    overflow: "hidden",
  },
  cardRow: { paddingHorizontal: tokens.spacing.lg, paddingVertical: tokens.spacing.sm },
  cardSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: tokens.color.hairline,
    marginLeft: tokens.spacing.lg,
  },
  hint: {
    fontSize: tokens.text.micro,
    color: tokens.color.text.tertiary,
    marginTop: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.xs,
  },
  rowInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.lg,
    minHeight: tokens.tap,
    paddingVertical: tokens.spacing.sm,
    alignSelf: "stretch",
  },
  rowTextWrap: { flex: 1, minWidth: 0, gap: 2 },
  rowLabel: {
    fontSize: tokens.text.subtext,
    fontWeight: "500",
    color: tokens.color.text.primary,
  },
  rowSublabel: {
    fontSize: tokens.text.micro,
    color: tokens.color.text.tertiary,
  },
  rowSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: tokens.color.hairline,
  },
  // Buttons
  ghostBtn: {
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: 10,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.hairlineStrong,
    minHeight: tokens.tap,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostBtnText: {
    fontSize: tokens.text.subtext,
    fontWeight: "500",
    color: tokens.color.text.primary,
  },
  btnFlex: { flex: 1 },
  addBtn: {
    borderStyle: "dashed",
    borderColor: "rgba(0,0,0,0.15)",
    borderWidth: 1,
    borderRadius: tokens.radius.md,
    backgroundColor: "rgba(255,255,255,0.4)",
    minHeight: tokens.tap,
    alignItems: "center",
    justifyContent: "center",
    marginTop: tokens.spacing.sm,
  },
  addBtnText: {
    fontSize: tokens.text.subtext,
    fontWeight: "500",
    color: tokens.color.text.secondary,
  },
  // Weekday tabs
  weekdayRow: {
    flexDirection: "row",
    gap: 6,
  },
  weekdayTab: {
    flex: 1,
    minHeight: tokens.tap,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.color.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.hairlineStrong,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 6,
  },
  weekdayTabText: {
    fontSize: tokens.text.micro,
    fontWeight: "600",
    color: tokens.color.text.secondary,
  },
  weekdayTabTextActive: { color: tokens.color.white },
  weekdayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  weekdayDotEmpty: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.2)",
  },
  // Blur slider
  sliderTrack: {
    height: 28,
    borderRadius: tokens.radius.full,
    backgroundColor: "rgba(0,0,0,0.06)",
    overflow: "hidden",
    justifyContent: "center",
  },
  sliderTrackFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: tokens.radius.full,
  },
  sliderThumb: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: tokens.color.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.hairlineStrong,
    top: 2,
    marginLeft: -12,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  // Period card
  periodCard: { padding: 0 },
  periodHeadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: tokens.tap + 8,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
  },
  periodSummary: { flex: 1, flexDirection: "row", alignItems: "center", gap: tokens.spacing.md, minWidth: 0 },
  periodNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  periodNumberText: {
    color: tokens.color.white,
    fontSize: tokens.text.micro,
    fontWeight: "700",
  },
  periodSummaryTextWrap: { flex: 1, minWidth: 0, gap: 1 },
  periodSummaryName: {
    fontSize: tokens.text.subtext,
    fontWeight: "600",
    color: tokens.color.text.primary,
  },
  periodSummaryTimes: {
    fontSize: tokens.text.micro,
    color: tokens.color.text.tertiary,
    fontVariant: ["tabular-nums"],
  },
  periodHeadActions: { flexDirection: "row", alignItems: "center", gap: 2 },
  iconBtn: {
    width: tokens.tap,
    height: tokens.tap,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tokens.radius.sm,
  },
  periodEditor: {
    paddingHorizontal: tokens.spacing.md,
    paddingBottom: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  nameInput: {
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 8,
    borderRadius: tokens.radius.sm,
    backgroundColor: "rgba(0,0,0,0.04)",
    fontSize: tokens.text.subtext,
    color: tokens.color.text.primary,
  },
  periodTimes: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  timeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: tokens.radius.sm,
    backgroundColor: "rgba(0,0,0,0.04)",
    alignItems: "center",
    minHeight: tokens.tap,
    justifyContent: "center",
  },
  timeText: {
    fontSize: tokens.text.subtext,
    fontVariant: ["tabular-nums"],
    color: tokens.color.text.primary,
  },
  timeSep: {
    fontSize: tokens.text.micro,
    color: tokens.color.text.tertiary,
  },
  metaRow: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
  },
  metaInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: tokens.spacing.sm,
    borderRadius: tokens.radius.sm,
    backgroundColor: "rgba(0,0,0,0.04)",
    minHeight: tokens.tap,
  },
  metaInput: {
    flex: 1,
    minWidth: 0,
    fontSize: tokens.text.subtext,
    color: tokens.color.text.primary,
    paddingVertical: 6,
  },
  // Time editor
  timeEditor: {
    padding: 12,
    borderRadius: tokens.radius.md,
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  timeEditorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  timeEditorTitle: {
    fontSize: tokens.text.micro,
    fontWeight: "600",
    color: tokens.color.text.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  timeEditorLive: {
    fontSize: tokens.text.body,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  doneBtn: {
    minHeight: tokens.tap,
    justifyContent: "center",
    paddingHorizontal: tokens.spacing.sm,
  },
  doneText: {
    fontSize: tokens.text.subtext,
    fontWeight: "600",
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  stepBox: { flex: 1, alignItems: "center", gap: 6 },
  stepLabel: {
    fontSize: tokens.text.micro,
    color: tokens.color.text.tertiary,
  },
  stepBtn: {
    width: tokens.tap,
    height: tokens.tap,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.color.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.hairlineStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: {
    fontSize: tokens.text.body,
    fontWeight: "500",
    color: tokens.color.text.primary,
  },
  stepValue: {
    fontSize: tokens.text.subtext,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    color: tokens.color.text.primary,
    minHeight: 20,
  },
  ampmBox: { flex: 1, alignItems: "center", gap: 6 },
  ampmRow: {
    flexDirection: "row",
    borderRadius: tokens.radius.sm,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.hairlineStrong,
  },
  ampmBtn: {
    minWidth: 56,
    alignItems: "center",
    justifyContent: "center",
    minHeight: tokens.tap,
    paddingHorizontal: 10,
  },
  ampmIdle: { backgroundColor: tokens.color.surface2 },
  ampmText: {
    fontSize: tokens.text.subtext,
    fontWeight: "600",
  },
  ampmActiveText: { color: tokens.color.white },
  ampmIdleText: { color: tokens.color.text.secondary },
  // Wallpaper preview
  phonePreview: {
    width: 84,
    aspectRatio: 9 / 16,
    borderRadius: tokens.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.hairlineStrong,
    backgroundColor: "rgba(255,255,255,0.72)",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  phonePreviewEmpty: { backgroundColor: "rgba(255,255,255,0.55)" },
  phonePreviewScrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 28,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  phonePreviewLabel: {
    fontSize: tokens.text.micro,
    fontWeight: "500",
    color: "rgba(255,255,255,0.9)",
    marginBottom: tokens.spacing.xs,
    paddingHorizontal: 4,
  },
  // Scroll
  scrollContent: { paddingTop: tokens.spacing.lg },
});

/** Fragment re-export so pages can render lists without an extra import. */
export { Fragment };
