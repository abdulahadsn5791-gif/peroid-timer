import type { PhaseColors } from "./PhaseColor";
import { RING_PALETTES } from "./RingPalette";

/**
 * Custom color overrides for the timer ring. Each of the three phase colors
 * can be overridden individually; `null` falls back to the selected palette's
 * color for that phase. All values are validated `#rrggbb` hex strings.
 */
export interface CustomRingColors {
  /** Ring color while more than 30% of the period remains. */
  phase0: string | null;
  /** Ring color between 15% and 30% remaining. */
  phase1: string | null;
  /** Ring color in the last 15%. */
  phase2: string | null;
}

export const DEFAULT_CUSTOM_RING_COLORS: CustomRingColors = {
  phase0: null,
  phase1: null,
  phase2: null,
};

export type HexColor = string;

export function isValidHexColor6(value: unknown): value is HexColor {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

/** Uppercases valid hex, maps everything else to null (the palette fallback). */
export function normalizeOptionalHex(value: unknown): HexColor | null {
  return isValidHexColor6(value) ? (value.toUpperCase() as HexColor) : null;
}

export function normalizeCustomRingColors(value: unknown): CustomRingColors {
  const v = (value ?? {}) as Partial<Record<keyof CustomRingColors, unknown>>;
  return {
    phase0: normalizeOptionalHex(v.phase0),
    phase1: normalizeOptionalHex(v.phase1),
    phase2: normalizeOptionalHex(v.phase2),
  };
}

/**
 * Resolves the three phase colors: the custom override when set, otherwise
 * the selected palette's color. Custom colors REPLACE palette colors —
 * palettes stay untouched, so switching palettes only changes the phases
 * that have no override.
 */
export function resolvePhaseColors(
  paletteIndex: number,
  custom: CustomRingColors,
): PhaseColors {
  const palette = RING_PALETTES[paletteIndex] ?? RING_PALETTES[0];
  return [
    custom.phase0 ?? palette.colors[0],
    custom.phase1 ?? palette.colors[1],
    custom.phase2 ?? palette.colors[2],
  ];
}

/**
 * User-saved swatches. A fresh install ships with a small starter set; the
 * user's saved colors are appended (deduped, case-insensitive) so every color
 * they ever pick is one tap away afterwards.
 */
export const STARTER_SWATCHES: readonly HexColor[] = [
  "#2563EB",
  "#0EA5E9",
  "#14B8A6",
  "#16A34A",
  "#84CC16",
  "#FACC15",
  "#F97316",
  "#EF4444",
  "#EC4899",
  "#8B5CF6",
  "#6B7280",
  "#111827",
];

export function normalizeSavedSwatches(value: unknown): HexColor[] {
  if (!Array.isArray(value)) return [];
  const out: HexColor[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (!isValidHexColor6(raw)) continue;
    const hex = raw.toUpperCase() as HexColor;
    if (seen.has(hex)) continue;
    seen.add(hex);
    out.push(hex);
    if (out.length >= 24) break; // bounded storage
  }
  return out;
}

/** Adds a swatch to the front of the list (deduped, capped). */
export function withSwatch(list: readonly HexColor[], hex: HexColor): HexColor[] {
  const rest = list.filter((c) => c.toLowerCase() !== hex.toLowerCase());
  return [hex, ...rest].slice(0, 24);
}
