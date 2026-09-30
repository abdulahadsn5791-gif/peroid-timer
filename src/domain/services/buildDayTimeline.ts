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
 * v7 — the WHOLE week, not one day. The old v6 snapshot described a single
 * day, and every alarm was one-shot, so when Android killed the process
 * overnight (normal, not a bug) nothing re-armed anything for the morning:
 * widget, alarms and the live notification all stayed stale until the app was
 * reopened. v7 carries `days` — 8 consecutive local midnights (today + the
 * next 7) — so native code can arm every alarm for the whole horizon and
 * re-arm itself at each midnight rollover without the app ever running.
 * `segments` of one day is empty exactly when that weekday has no lectures
 * (an "empty preset") — native then skips that day entirely.
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

/** One resolved day inside the week snapshot. */
export interface DayTimelineEntry {
  /** Local midnight (epoch sec) this entry describes. */
  boundaryUnixSec: number;
  /** 0 = Sunday … 6 = Saturday — the weekday of this entry. */
  weekday: number;
  segments: DayTimelineSegment[];
}

export interface DayTimeline {
  version: 7;
  generatedAtUnixSec: number;
  accentHex: string;
  /** Ring the end-of-period alarm at all. */
  soundEnabled: boolean;
  /** Post end-of-period notifications. Off = a completely silent, silent day end. */
  notificationsEnabled: boolean;
  colorNotification: boolean;
  /** Custom alarm ringtone (file/content URI); null/absent = built-in tone. */
  alarmSoundUri: string | null;
  days: DayTimelineEntry[];
}

/** How many consecutive days the snapshot covers: today + a full week. */
export const SNAPSHOT_DAY_COUNT = 8;

/** Local midnight `daysAhead` days after the given boundary (DST-correct). */
function boundaryDaysAhead(boundaryUnixSec: number, daysAhead: number): { boundary: number; weekday: number } {
  const d = new Date(boundaryUnixSec * 1000);
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() + daysAhead);
  return { boundary: Math.floor(m.getTime() / 1000), weekday: m.getDay() };
}

function segmentsForDay(settings: Settings, boundaryUnixSec: number, weekday: number): DayTimelineSegment[] {
  const periods = periodsFor(settings.weekSchedule, weekday);
  const palette = paletteAt(settings.paletteIndex);
  return periods.map((p: Period) => {
    const startUnixSec = boundaryUnixSec + p.start.minutes * 60;
    const endUnixSec = boundaryUnixSec + p.end.minutes * 60;
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
}

/**
 * Builds the "what is true at time T" snapshot for the whole alarm horizon.
 * Boundaries in seconds-of-day are mapped to absolute epoch seconds using
 * local-midnight arithmetic derived from the day boundary provided by the
 * clock adapter.
 */
export function buildDayTimeline(
  settings: Settings,
  boundaryUnixSec: number,
  nowEpochSec: number,
): DayTimeline {
  const days: DayTimelineEntry[] = [];
  for (let i = 0; i < SNAPSHOT_DAY_COUNT; i++) {
    const { boundary, weekday } = boundaryDaysAhead(boundaryUnixSec, i);
    days.push({
      boundaryUnixSec: boundary,
      weekday: weekdayOf(weekday),
      segments: segmentsForDay(settings, boundary, weekday),
    });
  }

  return {
    version: 7,
    generatedAtUnixSec: nowEpochSec,
    accentHex: settings.accentColor,
    soundEnabled: settings.soundEnabled,
    notificationsEnabled: settings.notificationsEnabled,
    colorNotification: settings.colorNotification,
    alarmSoundUri: settings.alarmSoundUri ?? null,
    days,
  };
}

export { toSeconds };
export function secondsIntoDay(segment: DayTimelineSegment): { startSec: number; endSec: number } {
  return { startSec: segment.startUnixSec, endSec: segment.endUnixSec };
}
