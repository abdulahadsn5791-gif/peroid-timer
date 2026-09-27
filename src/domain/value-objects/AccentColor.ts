export type AccentColor = string;

export const ACCENT_PRESETS: readonly AccentColor[] = [
  "#2563EB",
  "#0EA5E9",
  "#15803D",
  "#F97316",
  "#DC2626",
  "#EC4899",
  "#8B5CF6",
  "#111827",
];

export const DEFAULT_ACCENT = ACCENT_PRESETS[0];

export function isValidHexColor(value: string): boolean {
  return /^#([0-9a-f]{6})$/i.test(value);
}

export function normalizeAccentColor(value: string): AccentColor {
  if (isValidHexColor(value)) return value;
  return DEFAULT_ACCENT;
}