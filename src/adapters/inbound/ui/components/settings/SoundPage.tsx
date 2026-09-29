import { StyleSheet, Text, View } from "react-native";
import { tokens } from "../../design-system/tokens";
import type { SettingsActions } from "../../ports";
import type { SettingsDraftVM } from "@application/ports/view-models/ViewModels";
import { Card, Hint, PageBody, PageScroll, Row, SectionHeader, ToggleRow } from "./primitives";
import { PressableScale } from "../PressableScale";

interface Props {
  draft: SettingsDraftVM;
  actions: SettingsActions;
  isWide: boolean;
  bottomInset: number;
}

/** Notifications, end-of-period sound and the custom alarm ringtone. */
export function SoundPage({ draft, actions, isWide, bottomInset }: Props) {
  const accent = draft.accentColor;
  const ringtoneName = draft.alarmSoundUri ? draft.alarmSoundUri.split("/").pop() : null;

  return (
    <PageScroll bottomInset={bottomInset}>
      <PageBody isWide={isWide}>
        <SectionHeader title="Notifications" subtitle="Alerts when a period ends" />
        <Card>
          <ToggleRow
            label="Period-end notifications"
            sublabel="End-of-period and boundary alerts"
            value={draft.notificationsEnabled}
            accent={accent}
            onChange={(v) => actions.previewNotifications(v)}
            last
          />
        </Card>
        <Hint>Turn off to stop end-of-period and boundary alerts entirely.</Hint>

        <SectionHeader title="Sound" subtitle="What plays when a period ends" />
        <Card>
          <ToggleRow
            label="Sound when a period ends"
            sublabel="Plays even when the app is closed"
            value={draft.soundEnabled}
            accent={accent}
            onChange={(v) => actions.previewSound(v)}
            last
          />
        </Card>

        <SectionHeader title="Alarm ringtone" subtitle="Used by the end-of-period alarm" />
        <Card>
          <Row
            label="Custom alarm ringtone"
            sublabel={ringtoneName ?? "Built-in tone"}
            control={
              <PressableScale
                onPress={() => actions.pickAlarmSound()}
                haptic="light"
                style={[styles.pickBtn, { borderColor: accent }]}
                accessibilityRole="button"
              >
                <Text style={[styles.pickBtnText, { color: accent }]}>Choose</Text>
              </PressableScale>
            }
            last={!draft.alarmSoundUri}
          />
          {draft.alarmSoundUri ? (
            <Row
              label="Back to built-in tone"
              control={
                <PressableScale
                  onPress={() => actions.clearAlarmSound()}
                  haptic="selection"
                  style={[styles.pickBtn, { borderColor: tokens.color.hairlineStrong }]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.pickBtnText, { color: tokens.color.danger }]}>Reset</Text>
                </PressableScale>
              }
              last
            />
          ) : null}
        </Card>
        <Hint>The chosen ringtone plays when a period ends — even when the app is closed.</Hint>
      </PageBody>
    </PageScroll>
  );
}

const styles = StyleSheet.create({
  pickBtn: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 8,
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    backgroundColor: tokens.color.surface2,
    minHeight: tokens.tap,
    alignItems: "center",
    justifyContent: "center",
  },
  pickBtnText: {
    fontSize: tokens.text.subtext,
    fontWeight: "600",
    color: tokens.color.text.primary,
  },
});
