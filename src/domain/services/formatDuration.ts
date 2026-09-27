export interface DurationText {
  text: string;
  hasHours: boolean;
}

/**
 * Formats a remaining time in seconds.
 *  >= 3600 seconds -> "H:MM:SS" (hasHours = true, ring clock renders at 16% ring width)
 *  otherwise       -> "MM:SS"   (hasHours = false, ring clock renders at 23% ring width)
 *
 * Seconds are always present so the countdown visibly ticks.
 */
export function formatDuration(totalSeconds: number): DurationText {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return { text: `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`, hasHours: true };
  }
  return { text: `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`, hasHours: false };
}

/**
 * Same countdown but spelled out with units, so a long "4:05:32" can never be
 * mistaken for the clock time 4:05 AM/PM: "4h 05m 32s", "16m 23s", "9s".
 */
export function formatDurationWithUnits(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

export function formatCountdown(totalSeconds: number): string {
  return formatDuration(totalSeconds).text;
}

export function formatTotalMilliseconds(ms: number): string {
  return formatDuration(Math.round(ms / 1000)).text;
}