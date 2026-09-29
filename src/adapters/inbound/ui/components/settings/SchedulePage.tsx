import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { tokens } from "../../design-system/tokens";
import type { SettingsActions } from "../../ports";
import type { SettingsDraftVM } from "@application/ports/view-models/ViewModels";
import {
  DashedAddButton,
  GhostButton,
  Hint,
  PageBody,
  PageScroll,
  PeriodCard,
  PeriodTimeEditor,
  SectionHeader,
  WeekdayTabs,
  WEEKDAY_TABS,
} from "./primitives";

interface Props {
  draft: SettingsDraftVM;
  actions: SettingsActions;
  isWide: boolean;
  bottomInset: number;
}

/**
 * Weekly timetable + per-day periods. Each period collapses to a summary row;
 * expanding it opens the name/time/teacher/room editor so the list stays
 * scannable even with many periods.
 */
export function SchedulePage({ draft, actions, isWide, bottomInset }: Props) {
  const accent = draft.accentColor;
  const dayPeriods = draft.periods;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [timeField, setTimeField] = useState<"start" | "end" | null>(null);

  // Switching day collapses any open editor — it must not leak across days.
  useEffect(() => {
    setExpandedId(null);
    setTimeField(null);
  }, [draft.weekday]);

  const expanded = dayPeriods.find((p) => p.id === expandedId) ?? null;

  return (
    <PageScroll bottomInset={bottomInset}>
      <PageBody isWide={isWide}>
        <SectionHeader title="Weekly timetable" subtitle="Every day has its own preset" />
        <WeekdayTabs
          active={draft.weekday}
          accent={accent}
          weekPeriods={draft.weekPeriods}
          onSelect={actions.setWeekday}
        />
        {dayPeriods.length === 0 ? (
          <Hint>
            {WEEKDAY_TABS[draft.weekday]} has no lectures — the timer, alarms and notifications stay
            off for this day.
          </Hint>
        ) : null}
        <View style={styles.btnRow}>
          <GhostButton label="Clear this day" danger flex onPress={actions.clearDay} />
          <GhostButton label="Copy to all days" flex onPress={actions.copyToAllDays} />
        </View>
        <Hint>Empty preset = a lecture-free day: no countdown, no alarm, no notification.</Hint>

        <SectionHeader
          title={`${WEEKDAY_TABS[draft.weekday]} periods`}
          subtitle="Tap a period to edit its name, times, teacher and room"
        />
        <View style={styles.periodList}>
          {dayPeriods.map((period, index) => (
            <PeriodCard
              key={period.id}
              period={period}
              index={index}
              accent={accent}
              expanded={expandedId === period.id}
              onToggleExpand={() => {
                const opening = expandedId !== period.id;
                setExpandedId(opening ? period.id : null);
                setTimeField(null);
              }}
              onNameChange={(name) => actions.updatePeriod(period.id, { name })}
              onStartPress={() => setTimeField("start")}
              onEndPress={() => setTimeField("end")}
              onTeacherChange={(teacher) => actions.updatePeriod(period.id, { teacher })}
              onRoomChange={(room) => actions.updatePeriod(period.id, { room })}
              onMoveUp={() => actions.moveUp(index)}
              onMoveDown={() => actions.moveDown(index)}
              onRemove={() => {
                if (expandedId === period.id) {
                  setExpandedId(null);
                  setTimeField(null);
                }
                actions.remove(index);
              }}
            />
          ))}
          {dayPeriods.length === 0 ? (
            <View style={styles.emptyDayBox}>
              <Text style={styles.emptyDayText}>No lectures on {WEEKDAY_TABS[draft.weekday]}</Text>
              <Text style={styles.emptyDaySub}>Add a period below to schedule this day.</Text>
            </View>
          ) : null}
        </View>

        {expanded && timeField ? (
          <View style={styles.timeEditorWrap}>
            <PeriodTimeEditor
              period={expanded}
              field={timeField}
              accent={accent}
              onChange={(hhmm) => {
                const patch = timeField === "start" ? { start: hhmm } : { end: hhmm };
                actions.updatePeriod(expanded.id, patch);
              }}
              onDone={() => setTimeField(null)}
            />
          </View>
        ) : null}

        <DashedAddButton
          label="+ Add period"
          onPress={() => {
            setExpandedId(null);
            setTimeField(null);
            actions.addPeriod();
          }}
        />
      </PageBody>
    </PageScroll>
  );
}

const styles = StyleSheet.create({
  btnRow: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
  },
  periodList: { gap: tokens.spacing.sm, marginTop: tokens.spacing.xs },
  emptyDayBox: {
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.lg,
    alignItems: "center",
    gap: 4,
  },
  emptyDayText: {
    fontSize: tokens.text.subtext,
    fontWeight: "600",
    color: tokens.color.text.secondary,
  },
  emptyDaySub: {
    fontSize: tokens.text.micro,
    color: tokens.color.text.tertiary,
  },
  timeEditorWrap: { marginTop: tokens.spacing.sm },
});
