import { createSchedule, currentIndexAt, nextIndexAt } from "../entities/Schedule";
import type { Period } from "../entities/Period";

export interface StatusResult {
  currentIdx: number;
  nextIdx: number;
}

export function computeStatus(nowMinutes: number, periods: readonly Period[]): StatusResult {
  const schedule = createSchedule([...periods]);
  return {
    currentIdx: currentIndexAt(schedule, nowMinutes),
    nextIdx: nextIndexAt(schedule, nowMinutes),
  };
}