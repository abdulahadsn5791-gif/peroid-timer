import type { Settings } from "../entities/Settings";
import type { Period } from "../entities/Period";
import { periodsFor, weekdayOf } from "../entities/WeekSchedule";
import type { PhaseColors } from "../value-objects/PhaseColor";
import { DEFAULT_PHASE_THRESHOLDS } from "../value-objects/PhaseColor";
import { paletteAt } from "../value-objects/RingPalette";
import { toSeconds, minutesOfDayToLabel } from "../value-objects/TimeOfDay";

/**
 * The native snapshot. Production Kotlin code contains NO schedule logic — it
 * only looks up "what is true at time T" inside this snapshot and draws it.
 * Thresholds, durations, colors and labels travel as data so native code never
 * re-derives rules; the only arithmetic it performs is the time-relative piece
 * (remaining fraction at a given moment).
 *
 * Weekly timetables: the snapshot is always for ONE resolved day. `segments`
 * is empty exactly when that weekday has no lectures (an "empty preset") —
 * native then skips transition alarms and the live notification entirely, so
 * an empty day never beeps or buzzes.
 */
export interface DayTimelineSegment {
  id: string;
  name: string;
  startUnixSec: number;
  endUnixSec: number;
  durationSec: number;
  startLabel: string;
  endLabel: string;
  colors: PhaseColors;
  phaseOneUntilRemaining: number;
  phaseTwoUntilRemaining: number;
}

export interface DayTimeline {
  version: 5;
  generatedAtUnixSec: number;
  boundaryUnixSec: number;
  /** 0 = Sunday … 6 = Saturday — the weekday this snapshot is for. */
  weekday: number;
  accentHex: string;
  soundEnabled: boolean;
  colorNotification: boolean;
  /** Custom alarm ringtone (file/content URI); null/absent = built-in tone. */
  alarmSoundUri: string | null;
  segments: DayTimelineSegment[];
}

/**
 * Builds the "what is true at time T" snapshot for one day. Boundaries in
 * seconds-of-day are mapped to absolute epoch seconds using the day boundary
 * provided by the clock adapter.
 */
export function buildDayTimeline(
  settings: Settings,
  boundaryUnixSec: number,
  nowEpochSec: number,
  weekday?: number,
): DayTimeline {
  const resolvedWeekday = weekday ?? weekdayOf(new Date(nowEpochSec * 1000).getDay());
  const periods = periodsFor(settings.weekSchedule, resolvedWeekday);
  const palette = paletteAt(settings.paletteIndex);
  const segments: DayTimelineSegment[] = periods.map((p: Period) => {
    const startMinutes = p.start.minutes;
    const endMinutes = p.end.minutes;
    const startUnixSec = boundaryUnixSec + startMinutes * 60;
    const endUnixSec = boundaryUnixSec + endMinutes * 60;
    return {
      id: p.id,
      name: p.name,
      startUnixSec,
      endUnixSec,
      durationSec: Math.max(1, endUnixSec - startUnixSec),
      startLabel: minutesOfDayToLabel(p.start.minutes),
      endLabel: minutesOfDayToLabel(p.end.minutes),
      colors: [...palette.colors] as PhaseColors,
      phaseOneUntilRemaining: DEFAULT_PHASE_THRESHOLDS.phaseOneUntilRemaining,
      phaseTwoUntilRemaining: DEFAULT_PHASE_THRESHOLDS.phaseTwoUntilRemaining,
    };
  });

  return {
    version: 5,
    generatedAtUnixSec: nowEpochSec,
    boundaryUnixSec,
    weekday: resolvedWeekday,
    accentHex: settings.accentColor,
    soundEnabled: settings.soundEnabled,
    colorNotification: settings.colorNotification,
    alarmSoundUri: settings.alarmSoundUri ?? null,
    segments,
  };
}

export { toSeconds };
export function secondsIntoDay(segment: DayTimelineSegment): { startSec: number; endSec: number } {
  return { startSec: segment.startUnixSec, endSec: segment.endUnixSec };
}
