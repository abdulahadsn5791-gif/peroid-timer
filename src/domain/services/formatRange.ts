import type { Period } from "../entities/Period";
import { minutesOfDayToLabel, toSeconds, type TimeOfDay } from "../value-objects/TimeOfDay";

/**
 * "08:30 – 09:10". All times are 24h wall-clock labels (identical to the
 * phone's own status-bar time), so a single hour value can never be
 * misinterpreted as AM or PM.
 */
export function formatTimeOfDayLabel(t: TimeOfDay): string {
  return minutesOfDayToLabel(t.minutes);
}

export function formatRange(p: Period): string {
  return `${minutesOfDayToLabel(p.start.minutes)} – ${minutesOfDayToLabel(p.end.minutes)}`;
}

export function periodEndLabel(p: Period): string {
  return formatTimeOfDayLabel(p.end);
}

export function periodStartLabel(p: Period): string {
  return formatTimeOfDayLabel(p.start);
}

export function periodStartSeconds(p: Period): number {
  return toSeconds(p.start);
}

export function periodEndSeconds(p: Period): number {
  return toSeconds(p.end);
}