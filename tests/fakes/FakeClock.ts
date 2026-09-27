import type { ClockPort, ClockSnapshot } from "@application/ports/outbound/ClockPort";
import type { TodayDateParts } from "@domain/services/todayLabel";

/**
 * Deterministic clock for tests. Set any epoch ms and everything else derives
 * from local-time arithmetic, so boundary/day-part lookups behave exactly like
 * the real adapter.
 */
export class FakeClock implements ClockPort {
  private currentMs: number;

  constructor(epochMs = 0) {
    this.currentMs = epochMs;
  }

  setNow(epochMs: number): void {
    this.currentMs = epochMs;
  }

  now(): ClockSnapshot {
    const d = new Date(this.currentMs);
    const mins = d.getHours() * 60 + d.getMinutes();
    return {
      epochMs: this.currentMs,
      minutesOfDay: mins,
      secondsOfDay: mins * 60 + d.getSeconds(),
    };
  }

  todayBoundaryEpochSec(): number {
    const d = new Date(this.currentMs);
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
    return Math.floor(start / 1000);
  }

  todayParts(): TodayDateParts {
    const d = new Date(this.currentMs);
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), weekday: d.getDay() };
  }
}