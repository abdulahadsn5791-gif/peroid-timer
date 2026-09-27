import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  BackHandler,
  Image,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type View as RNView,
  type ViewStyle,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import Animated, { SlideInDown, SlideOutDown } from "react-native-reanimated";
import { BlurTargetView, BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { tokens, shadow } from "../design-system/tokens";
import type { SettingsDraftVM, PeriodDraftVM } from "@application/ports/view-models/ViewModels";
import { ACCENT_PRESETS } from "@domain/value-objects/AccentColor";
import { RING_PALETTES } from "@domain/value-objects/RingPalette";
import {
  minutesOfDayToLabel,
  minutesToHour12,
  parseTimeHHMM,
  toHHMM,
} from "@domain/value-objects/TimeOfDay";
import { hexToRgba } from "../utils/color";
import { Toggle } from "./Toggle";
import { PressableScale } from "./PressableScale";
import type { SettingsActions } from "../ports";

interface Props {
  visible: boolean;
  draft: SettingsDraftVM;
  isWide: boolean;
  actions: SettingsActions;
  onDismiss: () => void;
  sceneBlur: RefObject<RNView | null>;
}

/**
 * Settings sheet grown as frosted glass over the live app instead of a Modal,
 * so the blur samples the actual scene on Android too. Rendered in-window above
 * the scene (kept in sync with its BackHandler for hardware back).
 */
function BlurSlider({ value, accent, onValueChange }: { value: number; accent: string; onValueChange: (v: number) => void }) {
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

  return (
    <View
      ref={trackRef}
      {...panResponder.panHandlers}
      onLayout={(e) => {
        widthRef.current = e.nativeEvent.layout.width;
      }}
      style={styles.sliderTrack}
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
      <View style={[styles.sliderThumb, { left: `${value}%`, marginLeft: -12 }]} />
    </View>
  );
}

export function SettingsSheet({ visible, draft, isWide, actions, onDismiss, sceneBlur }: Props) {
  const accent = draft.accentColor;
  const phonePreviewTarget = useRef<RNView | null>(null);
  const [customHex, setCustomHex] = useState(draft.accentColor);
  const [editing, setEditing] = useState<null | { id: string; field: "start" | "end" }>(null);
  const dismissWithRevert = () => {
    actions.close();
    onDismiss();
  };

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      dismissWithRevert();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const panelStyle = useMemo<Array<ViewStyle | false>>(
    () => [{ width: "100%" }, isWide && { width: 460, alignSelf: "center" }],
    [isWide],
  );

  if (!visible) return null;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.overlay} pointerEvents="box-none">
      <Animated.View
        entering={SlideInDown.springify().damping(20).stiffness(190)}
        exiting={SlideOutDown.duration(220)}
        style={panelStyle}
      >
        <View style={[styles.panelFrame, isWide && styles.panelFrameWide, shadow(2)]}>
          <BlurView
            intensity={56}
            tint="light"
            blurTarget={sceneBlur}
            blurMethod="dimezisBlurViewSdk31Plus"
            style={styles.panelBlur}
          >
            {!isWide && <View style={styles.grabber} />}
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={styles.scrollContent}
            >
              <Text style={styles.sheetTitle}>Schedule settings</Text>

              <SectionLabel>App background</SectionLabel>
              <View style={styles.backgroundPreviewRow}>
                <View style={styles.phonePreview}>
                  <BlurTargetView ref={phonePreviewTarget} style={StyleSheet.absoluteFill} pointerEvents="none">
                    {draft.wallpaperPreviewUri ? (
                      <Image source={{ uri: draft.wallpaperPreviewUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    ) : (
                      <View style={[StyleSheet.absoluteFill, styles.phonePreviewEmpty]} />
                    )}
                  </BlurTargetView>
                  {draft.wallpaperPreviewUri && draft.wallpaperBlur > 0 ? (
                    <BlurView
                      blurTarget={phonePreviewTarget}
                      intensity={draft.wallpaperBlur}
                      tint="dark"
                      blurMethod="dimezisBlurViewSdk31Plus"
                      style={StyleSheet.absoluteFill}
                    />
                  ) : null}
                  <View style={styles.phonePreviewScrim} />
                  <Text style={styles.phonePreviewLabel}>Home</Text>
                </View>
                <View style={styles.backgroundControls}>
                  <Text style={styles.sliderLabel}>Blur {draft.wallpaperBlur}%</Text>
                  <BlurSlider value={draft.wallpaperBlur} accent={accent} onValueChange={(v) => actions.previewWallpaperBlur(v)} />
                  <Text style={styles.sliderHint}>Drag to blur the wallpaper behind the app's frosted glass.</Text>
                </View>
              </View>
              <View style={styles.btnRow}>
                <PressableScale
                  onPress={() => void actions.pickWallpaper()}
                  haptic="light"
                  style={[styles.ghostBtn, styles.btnFlex]}
                  accessibilityRole="button"
                >
                  <Text style={styles.ghostBtnText}>Choose photo</Text>
                </PressableScale>
                <PressableScale
                  onPress={() => actions.removeWallpaper()}
                  haptic="selection"
                  style={[styles.ghostBtn, { borderColor: tokens.color.hairlineStrong }]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.ghostBtnText, { color: tokens.color.danger }]}>Remove</Text>
                </PressableScale>
              </View>
              <Hint>Shown only behind the app home screen — it never touches your phone's wallpaper.</Hint>

              <SectionLabel>Accent color</SectionLabel>
              <Group style={styles.looseGroup}>
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
                        style={[
                          styles.swatch,
                          { backgroundColor: hex },
                          selected ? styles.swatchSelected : styles.swatchIdle,
                        ]}
                      />
                    );
                  })}
                  <View style={styles.customSwatch}>
                    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                      <Path d="M12 5v14M5 12h14" stroke={tokens.color.text.tertiary} strokeWidth={2} strokeLinecap="round" />
                    </Svg>
                    <TextInput
                      value={customHex}
                      onChangeText={(t) => {
                        setCustomHex(t);
                        if (/^#[0-9a-fA-F]{6}$/.test(t)) actions.previewAccent(t);
                      }}
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={styles.hexInput}
                      accessibilityLabel="Custom accent hex"
                    />
                  </View>
                </View>
              </Group>
              <Hint>Buttons, switches and the current-period highlight. One accent only.</Hint>

              <SectionLabel>Ring colors</SectionLabel>
              <Group style={styles.looseGroup}>
                <View style={styles.paletteGrid}>
                  {RING_PALETTES.map((palette, index) => {
                    const selected = index === draft.paletteIndex;
                    return (
                      <PressableScale
                        key={palette.id}
                        onPress={() => actions.previewPalette(index)}
                        haptic="selection"
                        style={[
                          styles.paletteCard,
                          basePaletteStyle(accent, selected),
                        ].filter(Boolean) as ViewStyle[]}
                        accessibilityRole="button"
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
              </Group>
              <Hint>Color 1 until 30% left · color 2 until 15% · color 3 in the last 15%.</Hint>

              <SectionLabel>Appearance</SectionLabel>
              <Group>
                <ToggleRow
                  label="Also color the clock numbers"
                  value={draft.colorClock}
                  accent={accent}
                  onChange={(v) => actions.previewColorClock(v)}
                />
                <GroupSeparator />
                <ToggleRow
                  label="Color the notification"
                  value={draft.colorNotification}
                  accent={accent}
                  onChange={(v) => actions.previewColorNotification(v)}
                />
                <GroupSeparator />
                <ToggleRow
                  label="Color active bars"
                  value={draft.colorActiveBars}
                  accent={accent}
                  onChange={(v) => actions.previewColorActiveBars(v)}
                />
              </Group>
              <Hint>Watch the live notification on your screen change color with each phase of the current period. Turn on &quot;Color active bars&quot; to light up the ring ticks you have already elapsed.</Hint>

              <SectionLabel>Class periods — set each one's real start and end time</SectionLabel>
              <Group>
                {draft.periods.map((period, index) => (
                  <Fragment key={period.id}>
                    {index > 0 ? <GroupSeparator /> : null}
                    <PeriodRow
                      period={period}
                      index={index}
                      accent={accent}
                      actions={actions}
                      editing={editing?.id === period.id ? editing.field : null}
                      onBeginEdit={(field) => setEditing({ id: period.id, field })}
                      onEditingDone={() => setEditing(null)}
                    />
                  </Fragment>
                ))}
              </Group>
              <PressableScale onPress={() => actions.addPeriod()} haptic="selection" style={[styles.ghostBtn, styles.addBtn]}>
                <Text style={[styles.ghostBtnText, { color: tokens.color.text.secondary }]}>+ Add period</Text>
              </PressableScale>

              <SectionLabel>Notifications</SectionLabel>
              <Group>
                <ToggleRow
                  label="Period-end notifications"
                  value={draft.notificationsEnabled}
                  accent={accent}
                  onChange={(v) => actions.previewNotifications(v)}
                />
              </Group>
              <Hint>Turn off to stop end-of-period and boundary alerts entirely.</Hint>

              <SectionLabel>Sound</SectionLabel>
              <Group>
                <ToggleRow
                  label="Sound when a period ends"
                  value={draft.soundEnabled}
                  accent={accent}
                  onChange={(v) => actions.previewSound(v)}
                />
              </Group>

              <PressableScale
                onPress={() =>
                  void actions.save().then(() => {
                    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    onDismiss();
                  })
                }
                haptic="medium"
                style={[styles.saveBtn, { backgroundColor: accent }, shadow(1)]}
                accessibilityRole="button"
              >
                <Text style={styles.saveText}>Save &amp; apply</Text>
              </PressableScale>
            </ScrollView>
          </BlurView>
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.sectionLabelChip}>
      <Text style={styles.sectionLabel}>{children}</Text>
    </View>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <Text style={styles.hint}>{children}</Text>;
}

function Group({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.group, style]}>{children}</View>;
}

function GroupSeparator() {
  return <View style={styles.groupSeparator} />;
}

function ToggleRow({
  label,
  value,
  accent,
  onChange,
}: {
  label: string;
  value: boolean;
  accent: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Toggle value={value} accent={accent} onValueChange={onChange} accessibilityLabel={label} />
    </View>
  );
}

function PeriodRow({
  period,
  index,
  accent,
  actions,
  editing,
  onBeginEdit,
  onEditingDone,
}: {
  period: PeriodDraftVM;
  index: number;
  accent: string;
  actions: SettingsActions;
  editing: "start" | "end" | null;
  onBeginEdit: (field: "start" | "end") => void;
  onEditingDone: () => void;
}) {
  return (
    <View style={styles.periodCard}>
      <View style={styles.periodTop}>
        <TextInput
          value={period.name}
          onChangeText={(name) => actions.updatePeriod(period.id, { name })}
          style={styles.nameInput}
          placeholder="Period name"
        />
        <PressableScale onPress={() => actions.moveUp(index)} haptic="selection" style={styles.iconBtn} accessibilityLabel="Move up">
          <ArrowSvg up />
        </PressableScale>
        <PressableScale onPress={() => actions.moveDown(index)} haptic="selection" style={styles.iconBtn} accessibilityLabel="Move down">
          <ArrowSvg up={false} />
        </PressableScale>
        <PressableScale onPress={() => actions.remove(index)} haptic="selection" style={styles.iconBtn} accessibilityLabel="Remove period">
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke={tokens.color.danger} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </PressableScale>
      </View>
      <View style={styles.periodTimes}>
        <PressableScale
          onPress={() => onBeginEdit("start")}
          haptic="selection"
          style={[styles.timeBtn, { borderColor: editing === "start" ? accent : tokens.color.hairlineStrong }]}
        >
          <Text style={styles.timeText}>{period.startLabel}</Text>
        </PressableScale>
        <Text style={styles.timeSep}>→</Text>
        <PressableScale
          onPress={() => onBeginEdit("end")}
          haptic="selection"
          style={[styles.timeBtn, { borderColor: editing === "end" ? accent : tokens.color.hairlineStrong }]}
        >
          <Text style={styles.timeText}>{period.endLabel}</Text>
        </PressableScale>
      </View>
      {editing !== null && (
        <TimeEditor
          hhmm={period[editing]}
          field={editing}
          accent={accent}
          onChange={(hhmm) => {
            const patch = editing === "start" ? { start: hhmm } : { end: hhmm };
            actions.updatePeriod(period.id, patch);
          }}
          onDone={onEditingDone}
        />
      )}
    </View>
  );
}

/**
 * Deterministic time editor that replaces the native Android time dialog.
 * Some OEM pickers silently flip AM/PM even when asked for a 24h dial; an
 * explicit AM/PM control here makes that impossible.
 */
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
  const base = parseTimeHHMM(hhmm).minutes;
  const { hour12, minutes, period } = minutesToHour12(base);

  const compose = (h: number, m: number, p: "AM" | "PM") => {
    const h24 = p === "AM" ? (h === 12 ? 0 : h) : h === 12 ? 12 : h + 12;
    onChange(toHHMM({ minutes: h24 * 60 + m }));
  };
  const incHour = () => compose(hour12 === 12 ? 1 : hour12 + 1, minutes, period);
  const decHour = () => compose(hour12 === 1 ? 12 : hour12 - 1, minutes, period);
  const incMinute = () => compose(hour12, minutes === 59 ? 0 : minutes + 1, period);
  const decMinute = () => compose(hour12, minutes === 0 ? 59 : minutes - 1, period);

  return (
    <View style={styles.timeEditor}>
      <View style={styles.timeEditorHeader}>
        <Text style={styles.timeEditorTitle}>{field === "start" ? "Set start" : "Set end"}</Text>
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
              const active = p === period;
              return (
                <PressableScale
                  key={p}
                  onPress={() => compose(hour12, minutes, p)}
                  haptic="selection"
                  style={[styles.ampmBtn, active ? { backgroundColor: accent } : styles.ampmIdle]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.ampmText, active ? styles.ampmActiveText : styles.ampmIdleText]}>{p}</Text>
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
  return (
    <View style={styles.stepBox}>
      <Text style={styles.stepLabel}>{label}</Text>
      <PressableScale onPress={onInc} haptic="selection" style={styles.stepBtn} accessibilityRole="button">
        <Text style={styles.stepBtnText}>+</Text>
      </PressableScale>
      <Text style={styles.stepValue}>{value}</Text>
      <PressableScale onPress={onDec} haptic="selection" style={styles.stepBtn} accessibilityRole="button">
        <Text style={styles.stepBtnText}>−</Text>
      </PressableScale>
    </View>
  );
}

function ArrowSvg({ up }: { up: boolean }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" style={{ transform: up ? [] : [{ rotate: "180deg" }] }}>
      <Path d="M18 15l-6-6-6 6" stroke={tokens.color.text.tertiary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function basePaletteStyle(accent: string, selected: boolean): ViewStyle | undefined {
  if (selected) {
    return {
      borderColor: accent,
      backgroundColor: hexToRgba(accent, 0.1),
      borderWidth: 1.5,
    };
  }
  return { borderColor: tokens.color.hairlineStrong, backgroundColor: "rgba(255,255,255,0.72)", borderWidth: 1 };
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: "flex-end",
  },
  panelFrame: {
    maxHeight: "88%",
    borderRadius: tokens.radius.xl,
    overflow: "hidden",
  },
  panelFrameWide: {
    maxHeight: "85%",
  },
  panelBlur: {
    flexShrink: 1,
    padding: tokens.spacing.xl,
    borderRadius: tokens.radius.xl,
    overflow: "hidden",
  },
  scrollContent: {
    paddingBottom: 120,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.10)",
    alignSelf: "center",
    marginBottom: tokens.spacing.lg,
  },
  sheetTitle: {
    fontSize: tokens.text.title,
    fontWeight: "600",
    color: tokens.color.text.primary,
    marginBottom: tokens.spacing.xl,
  },
  sectionLabelChip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    marginTop: tokens.spacing.xl,
    marginBottom: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 4,
    borderRadius: tokens.radius.full,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.hairlineStrong,
  },
  sectionLabel: {
    fontSize: tokens.text.micro,
    fontWeight: "600",
    color: tokens.color.text.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  hint: {
    fontSize: tokens.text.micro,
    color: tokens.color.text.tertiary,
    marginTop: tokens.spacing.sm,
  },
  group: {
    backgroundColor: "rgba(255,255,255,0.72)",
    borderRadius: tokens.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.hairlineStrong,
    overflow: "hidden",
  },
  groupSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: tokens.color.hairlineStrong,
    marginLeft: tokens.spacing.lg,
  },
  looseGroup: {
    padding: tokens.spacing.md,
  },
  wallpaperPreview: {
    height: 112,
    borderRadius: tokens.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.hairlineStrong,
    backgroundColor: "rgba(255,255,255,0.72)",
    overflow: "hidden",
  },
  backgroundPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.lg,
    marginTop: tokens.spacing.xs,
  },
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
  phonePreviewEmpty: {
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  phonePreviewLabel: {
    fontSize: tokens.text.micro,
    fontWeight: "500",
    color: "rgba(255,255,255,0.9)",
    marginBottom: tokens.spacing.xs,
    paddingHorizontal: 4,
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
  sliderTrack: {
    height: 28,
    marginTop: tokens.spacing.xs,
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
  phonePreviewScrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 28,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  btnRow: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.xs,
  },
  btnFlex: { flex: 1 },
  ghostBtn: {
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: 10,
    borderRadius: tokens.radius.md,
    backgroundColor: "rgba(255,255,255,0.72)",
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
  addBtn: {
    borderStyle: "dashed",
    borderColor: "rgba(0,0,0,0.15)",
    marginTop: tokens.spacing.sm,
  },
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
    backgroundColor: "rgba(255,255,255,0.55)",
    borderRadius: tokens.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.hairlineStrong,
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
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.lg,
    minHeight: tokens.tap,
    alignSelf: "stretch",
  },
  toggleLabel: {
    fontSize: tokens.text.subtext,
    fontWeight: "500",
    color: tokens.color.text.primary,
    flexShrink: 1,
  },
  periodCard: {
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
  },
  periodTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.xs,
  },
  nameInput: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 6,
    borderRadius: tokens.radius.sm,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.hairlineStrong,
    fontSize: tokens.text.subtext,
    color: tokens.color.text.primary,
  },
  iconBtn: {
    width: tokens.tap,
    height: tokens.tap,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tokens.radius.sm,
  },
  periodTimes: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
  },
  timeBtn: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: tokens.spacing.sm,
    borderRadius: tokens.radius.sm,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: StyleSheet.hairlineWidth,
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
  timeEditor: {
    marginTop: tokens.spacing.sm,
    padding: 12,
    borderRadius: tokens.radius.md,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.hairlineStrong,
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
  stepBox: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  stepLabel: {
    fontSize: tokens.text.micro,
    color: tokens.color.text.tertiary,
  },
  stepBtn: {
    width: tokens.tap,
    height: tokens.tap,
    borderRadius: tokens.radius.sm,
    backgroundColor: "rgba(255,255,255,0.72)",
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
  ampmBox: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
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
  ampmIdle: {
    backgroundColor: "rgba(255,255,255,0.72)",
  },
  ampmText: {
    fontSize: tokens.text.subtext,
    fontWeight: "600",
  },
  ampmActiveText: {
    color: tokens.color.white,
  },
  ampmIdleText: {
    color: tokens.color.text.secondary,
  },
  saveBtn: {
    marginTop: tokens.spacing.xxl,
    minHeight: tokens.tap,
    borderRadius: tokens.radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: {
    color: tokens.color.white,
    fontSize: tokens.text.body,
    fontWeight: "500",
  },
});