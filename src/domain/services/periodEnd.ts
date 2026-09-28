import { toSeconds } from "../value-objects/TimeOfDay";
import type { Period } from "../entities/Period";

export interface EndEvent {
  periodId: string;
  periodName: string;
  /** "weekday:periodId" — dedupe key so the alert fires once per day+period. */
  notifyKey: string;
}

/**
 * Returns the period that just ended in the last `windowSeconds` (default 2s,
 * matching the web app's one-tick notification window). Used by the per-tick
 * "period ended" check to sound + flash exactly once per period.
 *
 * `notifyKey` carries the weekday, so the same period id on different weekdays
 * (weekly presets) never suppresses each other.
 */
export function periodJustEnded(
  periods: readonly Period[],
  nowSecondsOfDay: number,
  lastNotifiedKey: string | null,
  weekday: number,
  windowSeconds = 2,
): EndEvent | null {
  for (const p of periods) {
    const end = toSeconds(p.end);
    const key = `${weekday}:${p.id}`;
    if (
      nowSecondsOfDay >= end &&
      nowSecondsOfDay < end + windowSeconds &&
      lastNotifiedKey !== key
    ) {
      return { periodId: p.id, periodName: p.name, notifyKey: key };
    }
  }
  return null;
}
