import type { PhaseIndex } from "../value-objects/PhaseColor";
import type { RingPalette } from "../value-objects/RingPalette";

/**
 * Returns the flat hex color for a palette phase. Palette colors are flat
 * fills — never gradients, never translucent.
 */
export function phaseColor(palette: RingPalette, phase: PhaseIndex): string {
  return palette.colors[phase] ?? palette.colors[0];
}