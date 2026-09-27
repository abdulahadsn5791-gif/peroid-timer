import type { PhaseColors } from "./PhaseColor";

export interface RingPalette {
  id: string;
  name: string;
  colors: PhaseColors;
}

export const RING_PALETTES: readonly RingPalette[] = [
  { id: "classic", name: "Classic", colors: ["#2563EB", "#B45309", "#DC2626"] },
  { id: "signal", name: "Signal", colors: ["#16A34A", "#F59E0B", "#DC2626"] },
  { id: "twilight", name: "Twilight", colors: ["#0EA5E9", "#8B5CF6", "#EC4899"] },
  { id: "lagoon", name: "Lagoon", colors: ["#14B8A6", "#F97316", "#E11D48"] },
];

export function paletteAt(index: number): RingPalette {
  return RING_PALETTES[index] ?? RING_PALETTES[0];
}