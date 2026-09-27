export type PhaseIndex = 0 | 1 | 2;

export const PHASE_COUNT = 3;

/**
 * Thresholds are expressed as *remaining fraction* of the period.
 * - Phase 0 (color 1): more than 30% of the period remains.
 * - Phase 1 (color 2): between 15% and 30% remains.
 * - Phase 2 (color 3): the last 15%.
 */
export const PHASE_ONE_UNTIL_REMAINING = 0.3;
export const PHASE_TWO_UNTIL_REMAINING = 0.15;

export interface PhaseThresholds {
  phaseOneUntilRemaining: number;
  phaseTwoUntilRemaining: number;
}

export const DEFAULT_PHASE_THRESHOLDS: PhaseThresholds = {
  phaseOneUntilRemaining: PHASE_ONE_UNTIL_REMAINING,
  phaseTwoUntilRemaining: PHASE_TWO_UNTIL_REMAINING,
};

export type PhaseColors = [string, string, string];

export const PHASE_COLORS: Record<PhaseIndex, number> = { 0: 0, 1: 1, 2: 2 };