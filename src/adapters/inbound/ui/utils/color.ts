/** Presentation-only helpers. Time/phase math stays in the domain. */

export function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return `rgba(0,0,0,${alpha})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export interface HourMinute {
  hour: number;
  minute: number;
}

export function toHourMinute(hhmm: string): HourMinute {
  const parts = String(hhmm || "00:00").split(":");
  return { hour: parseInt(parts[0], 10) || 0, minute: parseInt(parts[1], 10) || 0 };
}

export function fromHourMinute(h: number, m: number): string {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}