import type { PhaseIndex } from "../value-objects/PhaseColor";
import type { RingPalette } from "../value-objects/RingPalette";
import { phaseColor } from "./phaseColor";

/**
 * Decides the color of the big clock numbers.
 *
 * "Also color the clock numbers" ON  -> numbers always use the ring's phase color.
 * OFF                                -> numbers change color only in the last two
 *                                        phases (phase 1 and 2); in phase 0 they
 *                                        use the default (adaptive) text color.
 *
 * Between periods the ring uses its phase-0 color, so the same rule applies with
 * phase locked to 0.
 *
 * Returns a hex string, or null to signal "use the adaptive text color".
 */
export function clockColor(
  palette: RingPalette,
  phase: PhaseIndex,
  colorClock: boolean,
): string | null {
  if (colorClock) return phaseColor(palette, phase);
  if (phase > 0) return phaseColor(palette, phase);
  return null;
}