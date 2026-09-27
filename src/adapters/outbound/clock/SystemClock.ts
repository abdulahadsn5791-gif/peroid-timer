import type {
  ClockPort,
  ClockSnapshot,
} from "@application/ports/outbound/ClockPort";
import type { TodayDateParts } from "@domain/services/todayLabel";

/**
 * The single permitted place for wall-clock time. Everything else in the code
 * base receives time through this port; there is no other Date.now()/new Date().
 */
export class SystemClock implements ClockPort {
  now(): ClockSnapshot {
    const d = new Date();
    const minutesOfDay = d.getHours() * 60 + d.getMinutes();
    const secondsOfDay = minutesOfDay * 60 + d.getSeconds();
    return { epochMs: d.getTime(), minutesOfDay, secondsOfDay };
  }

  todayBoundaryEpochSec(): number {
    const d = new Date();
    return Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 1000);
  }

  todayParts(): TodayDateParts {
    const d = new Date();
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
      weekday: d.getDay(),
    };
  }
}