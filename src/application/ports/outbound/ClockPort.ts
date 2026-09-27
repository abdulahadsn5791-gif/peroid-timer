import type { TodayDateParts } from "@domain/services/todayLabel";

export interface ClockSnapshot {
  epochMs: number;
  minutesOfDay: number;
  secondsOfDay: number;
}

export interface ClockPort {
  now(): ClockSnapshot;
  /** Epoch seconds at the start of the current local day (midnight). */
  todayBoundaryEpochSec(): number;
  todayParts(): TodayDateParts;
}