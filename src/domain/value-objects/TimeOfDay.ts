export type TimeOfDay = { minutes: number };

export const MINUTES_PER_DAY = 1440;

export function timeOfDay(minutes: number): TimeOfDay {
  const wrapped = ((Math.round(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return { minutes: wrapped };
}

export function parseTimeHHMM(value: string): TimeOfDay {
  const parts = String(value ?? "00:00").split(":");
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return timeOfDay(h * 60 + m);
}

export function toHHMM(t: TimeOfDay): string {
  const h = Math.floor(t.minutes / 60);
  const m = t.minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function toSeconds(t: TimeOfDay): number {
  return t.minutes * 60;
}

export function addMinutes(t: TimeOfDay, minutes: number): TimeOfDay {
  return timeOfDay(t.minutes + minutes);
}

export function minutesToHour12(m: number): { hour12: number; minutes: number; period: "AM" | "PM" } {
  let hour24 = Math.floor(m / 60) % 24;
  const minutes = m % 60;
  const period: "AM" | "PM" = hour24 >= 12 ? "PM" : "AM";
  let hour12 = hour24 % 12;
  if (hour12 === 0) hour12 = 12;
  return { hour12, minutes, period };
}

/**
 * Wall-clock label in the same 24h format as the phone's own status bar
 * ("16:05", not "4:05 PM"). The whole app speaks 24h — minutesOfDayToLabel is
 * the ONLY place times turn into text — so an 8:30 AM period is always "08:30"
 * and can never render as PM.
 */
export function minutesOfDayToLabel(m: number): string {
  const hour24 = Math.floor(m / 60) % 24;
  const minutes = m % 60;
  return `${String(hour24).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}