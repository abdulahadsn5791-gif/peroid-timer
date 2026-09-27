import { toSeconds } from "../value-objects/TimeOfDay";
import type { Period } from "../entities/Period";

export interface EndEvent {
  periodId: string;
  periodName: string;
}

/**
 * Returns the period that just ended in the last `windowSeconds` (default 2s,
 * matching the web app's one-tick notification window). Used by the per-tick
 * "period ended" check to sound + flash exactly once per period.
 */
export function periodJustEnded(
  periods: readonly Period[],
  nowSecondsOfDay: number,
  lastNotifiedPeriodId: string | null,
  windowSeconds = 2,
): EndEvent | null {
  for (const p of periods) {
    const end = toSeconds(p.end);
    if (nowSecondsOfDay >= end && nowSecondsOfDay < end + windowSeconds && lastNotifiedPeriodId !== p.id) {
      return { periodId: p.id, periodName: p.name };
    }
  }
  return null;
}