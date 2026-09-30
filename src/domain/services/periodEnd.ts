import { toSeconds } from "../value-objects/TimeOfDay";
import type { Period } from "../entities/Period";

export interface EndEvent {
  periodId: string;
  periodName: string;
  /**
   * "YYYY-MM-DD:periodId" — date-scoped dedupe key so the alert fires once per
   * calendar day+period. (The old weekday-only key never expired: the same
   * period on the same weekday was silently suppressed a week later.)
   */
  notifyKey: string;
}

/**
 * Returns the period that just ended in the last `windowSeconds` (default 2s,
 * matching the web app's one-tick notification window). Used by the per-tick
 * "period ended" check to sound + flash exactly once per period.
 *
 * `dateKey` ("2026-09-30") scopes the dedupe to one calendar day, so the same
 * period alerts again on its next occurrence.
 */
export function periodJustEnded(
  periods: readonly Period[],
  nowSecondsOfDay: number,
  lastNotifiedKey: string | null,
  dateKey: string,
  windowSeconds = 2,
): EndEvent | null {
  for (const p of periods) {
    const end = toSeconds(p.end);
    const key = `${dateKey}:${p.id}`;
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
