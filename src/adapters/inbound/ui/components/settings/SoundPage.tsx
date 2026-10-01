import { StyleSheet, Text, View } from "react-native";
import { tokens } from "../../design-system/tokens";
import type { SettingsActions } from "../../ports";
import type { SettingsDraftVM } from "@application/ports/view-models/ViewModels";
import { UPCOMING_ALERT_MAX_HOURS } from "@domain/entities/Settings";
import { Card, DragSlider, Hint, PageBody, PageScroll, Row, SectionHeader, ToggleRow, usePal } from "./primitives";
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
  const pal = usePal();
  const ringtoneName = draft.alarmSoundUri ? draft.alarmSoundUri.split("/").pop() : null;

  return (
    <PageScroll bottomInset={bottomInset}>
      <PageBody isWide={isWide}>
        <SectionHeader title="Notifications" subtitle="Alerts when a period ends" />
        <Card>
          <View style={styles.toggleStack}>
          <ToggleRow
            label="Period-end notifications"
            sublabel="Alert when a period ends"
            value={draft.notificationsEnabled}
            accent={accent}
            onChange={(v) => actions.previewNotifications(v)}
            last
          />
          </View>
        </Card>
        <Hint>Turn off to end the day completely in silence — no alert, no ringtone.</Hint>

        <SectionHeader
          title="Upcoming lecture alert"
          subtitle="A heads-up notification before the next period starts"
        />
        <Card>
          <View style={styles.toggleStack}>
            <Text style={styles.sliderLabel}>
              Remind me {draft.upcomingAlertHours === 0 ? "off" : `${draft.upcomingAlertHours}h before`}
            </Text>
            <DragSlider
              value={draft.upcomingAlertHours}
              min={0}
              max={UPCOMING_ALERT_MAX_HOURS}
              accent={accent}
              accessibilityLabel="Upcoming lecture alert lead time in hours"
              onValueChange={(v) => actions.previewUpcomingAlertHours(v)}
            />
            <Text style={styles.sliderHint}>
              0 turns the upcoming alert off. 1 or 2 hours is typical — drag as far as
              {` ${UPCOMING_ALERT_MAX_HOURS}`}h to get warned a full weekend ahead.
            </Text>
          </View>
        </Card>
        <Hint>
          Fires once per lecture, at (start − lead time) — even when the app is closed. It follows
          the period-end notification toggle above.
        </Hint>

        <SectionHeader title="Sound" subtitle="What plays when a period ends" />
        <Card>
          <View style={styles.toggleStack}>
          <ToggleRow
            label="Sound when a period ends"
            sublabel="Uses your alarm volume, not media"
            value={draft.soundEnabled}
            accent={accent}
            onChange={(v) => actions.previewSound(v)}
            last
          />
          </View>
        </Card>
        <Hint>
          The alarm follows the alarm volume slider on your phone — press a volume button while it
          rings to silence it instantly.
        </Hint>

        <SectionHeader title="Alarm ringtone" subtitle="Used by the end-of-period alarm" />
        <Card>
          <Row
            label="Custom alarm ringtone"
            sublabel={ringtoneName ?? "Built-in tone"}
            control={
              <PressableScale
                onPress={() => actions.pickAlarmSound()}
                haptic="light"
                style={[styles.pickBtn, { borderColor: accent, backgroundColor: pal.surface }]}
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
                  style={[styles.pickBtn, { borderColor: "transparent", backgroundColor: pal.surfaceAlt }]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.pickBtnText, { color: pal.danger }]}>Reset</Text>
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
  toggleStack: {
    paddingVertical: tokens.spacing.xs,
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
  pickBtn: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 8,
    borderRadius: tokens.radius.sm,
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
