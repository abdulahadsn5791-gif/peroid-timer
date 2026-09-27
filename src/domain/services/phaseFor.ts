import {
  PHASE_TWO_UNTIL_REMAINING,
  PHASE_ONE_UNTIL_REMAINING,
  type PhaseIndex,
} from "../value-objects/PhaseColor";

/**
 * Maps a *remaining fraction* of a period (1 = all time left, 0 = just ended)
 * to the palette phase index.
 *   > 0.30            -> 0  (color 1)
 *   0.15 < x <= 0.30  -> 1  (color 2)
 *   <= 0.15           -> 2  (color 3)
 */
export function phaseFor(remainingFraction: number): PhaseIndex {
  if (remainingFraction <= PHASE_TWO_UNTIL_REMAINING) return 2;
  if (remainingFraction <= PHASE_ONE_UNTIL_REMAINING) return 1;
  return 0;
}

export function clampFraction(value: number): number {
  return Math.max(0, Math.min(1, value));
}