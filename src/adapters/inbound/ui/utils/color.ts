/** Presentation-only helpers. Time/phase math stays in the domain. */

export function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return `rgba(0,0,0,${alpha})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/**
 * Perceived luminance of a #rrggbb color (0 = black, 1 = white), Rec. 601
 * luma — enough for "should text over this color be light or dark?". Returns
 * 0.5 for anything unparseable so callers fall back to neutral behavior.
 */
export function luminanceOf(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 0.5;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** True when the color is dark enough that light text/glass should sit on it. */
export function isDarkColor(hex: string): boolean {
  return luminanceOf(hex) < 0.55;
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