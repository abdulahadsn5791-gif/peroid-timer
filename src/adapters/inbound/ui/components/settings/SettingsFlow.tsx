import { useEffect, useRef, useState } from "react";
import { BackHandler, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";
import Svg, { Path, Circle as SCircle, Line } from "react-native-svg";
import Animated, { FadeIn, FadeOut, SlideInDown, SlideInRight, SlideOutDown, SlideOutRight } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tokens, themePalette } from "../../design-system/tokens";
import type { AppDeps } from "../../ports";
import type { SettingsDraftVM } from "@application/ports/view-models/ViewModels";
import { RING_PALETTES } from "@domain/value-objects/RingPalette";
import { PressableScale } from "../PressableScale";
import { PageBody, SettingsTheme, usePal } from "./primitives";
import type { SettingsRoute } from "./types";
import { SchedulePage } from "./SchedulePage";
import { LookPage } from "./LookPage";
import { SoundPage } from "./SoundPage";

interface Props {
  draft: SettingsDraftVM;
  deps: AppDeps;
  /** Called when the sheet is fully dismissed (after close-or-save). */
  onDismiss: () => void;
  isWide: boolean;
}

interface NavState {
  route: SettingsRoute;
  /** Increments on push so slide direction can be derived. */
  depth: number;
}

const MENU: Array<{ route: SettingsRoute; title: string; subtitle: string }> = [
  { route: "schedule", title: "Schedule", subtitle: "Weekly timetable and periods" },
  { route: "look", title: "Look", subtitle: "Wallpaper, accent and ring colors" },
  { route: "sound", title: "Sound", subtitle: "Notifications and alarm ringtone" },
];

function ChevronIcon({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="M9 6l6 6-6 6" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function BackIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M15 6l-6 6 6 6" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CloseIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Line x1="6" y1="6" x2="18" y2="18" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
      <Line x1="18" y1="6" x2="6" y2="18" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

/**
 * Full-screen settings, replacing the one giant scrolling sheet. A root menu
 * pushes Schedule / Look / Sound sub-pages so each page holds one concern and
 * there is far less accidental touching while scrolling. "Save & apply" is
 * pinned to the bottom bar on every page.
 */
export function SettingsFlow({ draft, deps, onDismiss, isWide }: Props) {
  return (
    <SettingsTheme theme={draft.theme}>
      <SettingsFlowInner draft={draft} deps={deps} onDismiss={onDismiss} isWide={isWide} />
    </SettingsTheme>
  );
}

function SettingsFlowInner({ draft, deps, onDismiss, isWide }: Omit<Props, never>) {
  const actions = deps.settingsActions;
  const accent = draft.accentColor;
  const pal = themePalette(draft.theme);
  const insets = useSafeAreaInsets();
  // Live previews for the root menu rows — read from the draft so they stay
  // current after editing a sub-page.
  const totalPeriods = draft.weekPeriods.reduce((sum, day) => sum + day.length, 0);
  const alertsOn = draft.notificationsEnabled || draft.soundEnabled;
  const paletteDots = RING_PALETTES[draft.paletteIndex]?.colors ?? [];
  // app.json expo.version — always equals the installed release's version.
  const appVersion = Constants.expoConfig?.version ?? "1.0.0";
  const [nav, setNav] = useState<NavState>({ route: "root", depth: 0 });
  const navRef = useRef(nav);
  navRef.current = nav;

  // Hardware back: pop a sub-page first, otherwise let the dismiss effect run.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (navRef.current.route !== "root") {
        setNav({ route: "root", depth: navRef.current.depth - 1 });
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, []);

  const popToRoot = () => setNav({ route: "root", depth: Math.max(0, nav.depth - 1) });
  const push = (route: SettingsRoute) => setNav({ route, depth: nav.depth + 1 });

  const saveAndClose = () => {
    void actions.save().then(() => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onDismiss();
    });
  };

  const pageProps = { draft, actions, isWide, bottomInset: SAVE_BAR_HEIGHT + insets.bottom + 12 };

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: pal.canvas }]} pointerEvents="box-none">
      <Animated.View
        entering={SlideInDown.springify().damping(20).stiffness(190)}
        exiting={SlideOutDown.duration(220)}
        style={styles.panel}
      >
        <View style={[styles.panelSurface, { backgroundColor: pal.canvas }]}>
          <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
            {nav.route === "root" ? (
              <>
                <View style={styles.headerSide}>
                  <Text style={[styles.headerTitle, { color: pal.textPrimary }]}>Settings</Text>
                </View>
                <PressableScale
                  onPress={() => {
                    actions.close();
                    onDismiss();
                  }}
                  haptic="light"
                  style={[styles.closeBtn, draft.theme === "dark" && styles.closeBtnDark]}
                  accessibilityRole="button"
                  accessibilityLabel="Close settings"
                >
                  <CloseIcon color={tokens.color.text.secondary} />
                </PressableScale>
              </>
            ) : (
              <>
                <View style={styles.headerSide}>
                  <PressableScale onPress={popToRoot} haptic="light" style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back to settings menu">
                    <BackIcon color={accent} />
                  </PressableScale>
                  <Text style={[styles.headerTitle, { color: pal.textPrimary }]}>{MENU.find((m) => m.route === nav.route)?.title ?? "Settings"}</Text>
                </View>
                <PressableScale onPress={saveAndClose} haptic="medium" style={styles.headerSaveBtn} accessibilityRole="button" accessibilityLabel="Save and apply">
                  <Text style={[styles.headerSaveText, { color: accent }]}>Save</Text>
                </PressableScale>
              </>
            )}
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.pageHost}
          >
            <View style={styles.pageHostInner}>
              {nav.route === "root" ? (
              <Animated.View key="root" entering={FadeIn.duration(140)} exiting={FadeOut.duration(90)} style={styles.page}>
              <PageBody isWide={isWide}>
                <Text style={[styles.rootSubtitle, { marginTop: tokens.spacing.md, color: pal.textTertiary }]}>Everything is saved only when you tap Save.</Text>
                {MENU.map((item) => {
                  const valueLabel =
                    item.route === "schedule"
                      ? `${totalPeriods} ${totalPeriods === 1 ? "period" : "periods"} this week`
                      : item.route === "look"
                        ? `accent ${accent}`
                        : `alerts ${alertsOn ? "on" : "off"}`;
                  return (
                    <PressableScale
                      key={item.route}
                      onPress={() => push(item.route)}
                      haptic="selection"
                      accessibilityRole="button"
                      accessibilityLabel={`${item.title}, ${valueLabel}`}
                    >
                      <View style={styles.menuRow}>
                        <View style={styles.menuTextWrap}>
                          <Text style={[styles.menuTitle, { color: pal.textPrimary }]}>{item.title}</Text>
                          <Text style={[styles.menuSubtitle, { color: pal.textTertiary }]}>{item.subtitle}</Text>
                        </View>
                        {item.route === "schedule" ? (
                          <Text style={[styles.menuValueText, draft.theme === "dark" && styles.menuValueTextDark]}>
                            {totalPeriods} {totalPeriods === 1 ? "period" : "periods"}
                          </Text>
                        ) : null}
                        {item.route === "look" ? (
                          <View style={styles.menuPreviewRow}>
                            <View style={[styles.accentDotPreview, { backgroundColor: accent }]} />
                            {paletteDots.map((c) => (
                              <View key={c} style={[styles.paletteDotPreview, { backgroundColor: c }]} />
                            ))}
                          </View>
                        ) : null}
                        {item.route === "sound" ? (
                          <View style={styles.menuPreviewRow}>
                            <View
                              style={[
                                styles.statusDot,
                                { backgroundColor: alertsOn ? tokens.color.success : pal.disabled },
                              ]}
                            />
                            <Text style={[styles.menuValueText, draft.theme === "dark" && styles.menuValueTextDark]}>{alertsOn ? "On" : "Off"}</Text>
                          </View>
                        ) : null}
                        <ChevronIcon color={pal.textTertiary} />
                      </View>
                      <View style={styles.menuSeparator} />
                    </PressableScale>
                  );
                })}
                <Text style={[styles.versionText, draft.theme === "dark" && styles.versionTextDark]}>Period Timer {appVersion}</Text>
              </PageBody>
              </Animated.View>
            ) : (
              <Animated.View
                key={nav.route + String(nav.depth)}
                entering={SlideInRight.duration(240)}
                exiting={SlideOutRight.duration(180)}
                style={styles.page}
              >
                {nav.route === "schedule" ? <SchedulePage {...pageProps} /> : null}
                {nav.route === "look" ? <LookPage {...pageProps} /> : null}
                {nav.route === "sound" ? <SoundPage {...pageProps} /> : null}
              </Animated.View>
            )}
            </View>
          </KeyboardAvoidingView>

          {/* Pinned save bar — always reachable, no scrolling needed. */}
          <View
            style={[
              styles.saveBar,
              draft.theme === "dark" && styles.saveBarDark,
              { paddingBottom: insets.bottom + 10 },
            ]}
          >
            <PressableScale
              onPress={saveAndClose}
              haptic="medium"
              style={[styles.saveBtn, { backgroundColor: accent }]}
              accessibilityRole="button"
            >
              <Text style={styles.saveText}>Save &amp; apply</Text>
            </PressableScale>
            <Text style={styles.dirtyNote}>{draft.dirty ? "Unsaved changes" : "All changes saved"}</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const SAVE_BAR_HEIGHT = 92;

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: tokens.color.white,
  },
  panel: {
    flex: 1,
  },
  panelSurface: {
    flex: 1,
    backgroundColor: tokens.color.white,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: tokens.spacing.xl,
    paddingBottom: tokens.spacing.sm,
  },
  headerSide: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.xs,
    flex: 1,
  },
  headerTitle: {
    fontSize: tokens.text.title,
    fontWeight: "700",
    color: tokens.color.text.primary,
  },
  backBtn: {
    width: tokens.tap,
    height: tokens.tap,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -tokens.spacing.sm,
  },
  closeBtn: {
    width: tokens.tap,
    height: tokens.tap,
    borderRadius: tokens.tap / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.05)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.10)",
  },
  closeBtnDark: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.14)",
  },
  headerSaveBtn: {
    minHeight: tokens.tap,
    justifyContent: "center",
    paddingHorizontal: tokens.spacing.sm,
  },
  headerSaveText: {
    fontSize: tokens.text.subtext,
    fontWeight: "600",
  },
  pageHost: { flex: 1, overflow: "hidden" },
  pageHostInner: { flex: 1 },
  page: { flex: 1 },
  rootSubtitle: {
    fontSize: tokens.text.subtext,
    color: tokens.color.text.tertiary,
    marginBottom: tokens.spacing.md,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.md,
    minHeight: tokens.tap + 10,
    paddingVertical: tokens.spacing.sm,
  },
  menuTextWrap: { flex: 1, minWidth: 0, gap: 2 },
  menuTitle: {
    fontSize: tokens.text.body,
    fontWeight: "600",
    color: tokens.color.text.primary,
  },
  menuSubtitle: {
    fontSize: tokens.text.micro,
    color: tokens.color.text.tertiary,
  },
  menuValueText: {
    fontSize: tokens.text.micro,
    fontWeight: "500",
    color: tokens.color.text.tertiary,
    flexShrink: 0,
  },
  menuValueTextDark: { color: "rgba(255,255,255,0.42)" },
  menuPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexShrink: 0,
  },
  accentDotPreview: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.12)",
  },
  paletteDotPreview: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.10)",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  menuSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: tokens.color.hairlineStrong,
  },
  versionText: {
    textAlign: "center",
    marginTop: tokens.spacing.xxl,
    fontSize: tokens.text.micro,
    color: tokens.color.text.tertiary,
  },
  versionTextDark: { color: "rgba(255,255,255,0.42)" },
  saveBar: {
    paddingHorizontal: tokens.spacing.xl,
    paddingTop: tokens.spacing.md,
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.10)",
    backgroundColor: "transparent",
  },
  saveBarDark: {
    borderTopColor: "rgba(255,255,255,0.10)",
  },
  saveBtn: {
    minHeight: tokens.tap,
    borderRadius: tokens.radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: {
    color: tokens.color.white,
    fontSize: tokens.text.body,
    fontWeight: "600",
  },
  dirtyNote: {
    textAlign: "center",
    fontSize: tokens.text.micro,
    color: tokens.color.text.tertiary,
  },
});
