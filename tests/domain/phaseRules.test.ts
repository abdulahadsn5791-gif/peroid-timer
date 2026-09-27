import { describe, expect, test } from "bun:test";
import { phaseFor } from "@domain/services/phaseFor";
import { phaseColor } from "@domain/services/phaseColor";
import { clockColor } from "@domain/services/clockColor";
import { paletteAt } from "@domain/value-objects/RingPalette";

describe("Phase rules", () => {
  const palette = paletteAt(0); // Classic: blue / amber / red

  test("phaseFor maps remaining fraction to index", () => {
    expect(phaseFor(0.5)).toBe(0);
    expect(phaseFor(0.35)).toBe(0);
    expect(phaseFor(0.3)).toBe(1); // exactly at the 0.30 boundary
    expect(phaseFor(0.16)).toBe(1);
    expect(phaseFor(0.15)).toBe(2); // exactly at the 0.15 boundary
    expect(phaseFor(0.01)).toBe(2);
    expect(phaseFor(0)).toBe(2);
  });

  test("phaseColor picks the palette color for the phase", () => {
    expect(phaseColor(palette, 0)).toBe("#2563EB");
    expect(phaseColor(palette, 1)).toBe("#B45309");
    expect(phaseColor(palette, 2)).toBe("#DC2626");
  });

  test("clockColor: color-clock on always phases, off only colors tight phases", () => {
    expect(clockColor(palette, 0, true)).toBe("#2563EB");
    expect(clockColor(palette, 0, false)).toBeNull();
    expect(clockColor(palette, 2, false)).toBe("#DC2626");
    expect(clockColor(palette, 1, false)).toBe("#B45309");
  });
});